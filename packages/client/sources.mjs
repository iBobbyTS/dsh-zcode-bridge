import {createNativeSessionSource,parseRuntimeSessionAddress,parseRuntimeSessionKey,runtimeSessionKey} from '@deepseek-ai/dsh-api-session-controller/client';
import {notifySubscribers} from '@deepseek-ai/dsh-client-store';
import React from 'react';
import {RemoteConversation} from './remote-conversation.mjs';
import {ZCodeConversationView} from './conversation-view.jsx';

const unavailable=reason=>Object.freeze({state:'unavailable',reason,capabilities:Object.freeze({create:false,open:false,nativeAgent:false})});
const sourceError=code=>Object.assign(new Error(code),{code});

/** Two fixed runtime routes. No Agent factory, foreign DSH scope, transcript, or plugin registry. */
export class RuntimeSessions {
  #native;#rows=Object.freeze([]);#zcodeRows=Object.freeze([]);#availability=unavailable('not-connected');
  #listeners=new Set();#availabilityListeners=new Set();#references=new Set();#subscriptions=[];
  #directoryListeners=new Set();#selectionListeners=new Set();#deleted=new Set();#groups={};#settings;#settingsError=null;#catalog={complete:false,truncated:false,sharedGui:'unverified'};#directory;#query='';#page=0;#pageSize=20;#selected=null;#opened=new Map();#openVersion=0;
  #closed=false;#generation=0;#readVersion=0;#requests=new Set();#reads=new Set();#refresh;#scope;#disposal;#conversationResolver;
  constructor({sessions,rpc,connectionGeneration,nativeAuthority,conversationResolver,settings}){
    if(typeof nativeAuthority!=='string'||!nativeAuthority)throw sourceError('native-authority-required');
    this.rpc=rpc;
    try{this.#settings=settings??globalThis.localStorage;if(!this.#settings)this.#settingsError='local-settings-unavailable';const raw=this.#settings?.getItem('dsh.zcode.local-groups');if(raw){const groups=JSON.parse(raw);if(!groups||typeof groups!=='object'||Array.isArray(groups)||Object.entries(groups).some(([key,value])=>parseRuntimeSessionKey(key).runtime!=='zcode'||typeof value!=='string'))throw sourceError('local-groups-invalid');this.#groups=groups}}
    catch(error){this.#settingsError=error.code??'local-settings-unavailable';this.#settings=undefined}

    this.#conversationResolver=conversationResolver;
    this.#native=createNativeSessionSource(sessions,nativeAuthority,'native-session-store');
    this.#subscriptions.push(this.#native.list.subscribe(()=>this.#publish()));
    if(connectionGeneration)this.#subscriptions.push(connectionGeneration.subscribe(()=>{
      this.#generation++;this.#openVersion++;this.#refresh=undefined;for(const request of this.#requests)request.abort();
      this.#scope=undefined;this.#catalog=Object.freeze({complete:false,truncated:false,sharedGui:'unverified'});this.#zcodeRows=Object.freeze([]);this.#availability=unavailable('host-unreachable');this.#publish();
    }));
    this.#publish();
  }
  list={getSnapshot:()=>this.#rows,subscribe:listener=>this.#subscribe(this.#listeners,listener)};
  zcodeAvailability={getSnapshot:()=>this.#availability,subscribe:listener=>this.#subscribe(this.#availabilityListeners,listener)};
  directory={getSnapshot:()=>this.#directory,subscribe:listener=>this.#subscribe(this.#directoryListeners,listener)};
  selection={getSnapshot:()=>this.#selected,subscribe:listener=>this.#subscribe(this.#selectionListeners,listener)};
  setDirectory({query=this.#query,page=this.#page,pageSize=this.#pageSize}={}){
    if(typeof query!=='string'||query.length>1000||!Number.isSafeInteger(page)||page<0||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw sourceError('directory-query-invalid');
    this.#page=query!==this.#query?0:page;this.#query=query;this.#pageSize=pageSize;this.#publish();
  }
  setGroup(address,group){
    const fixed=parseRuntimeSessionAddress(address),key=runtimeSessionKey(fixed);
    if(this.#closed||fixed.runtime!=='zcode'||this.#deleted.has(key)||typeof group!=='string'||group.length>100)throw sourceError('local-group-invalid');
    this.#groups={...this.#groups};if(group.trim())this.#groups[key]=group.trim();else delete this.#groups[key];
    this.#saveGroups();this.#publish();
  }
  #saveGroups(){try{this.#settings?.setItem('dsh.zcode.local-groups',JSON.stringify(this.#groups))}catch{this.#settingsError='local-settings-write-failed'}}
  #remove(address){
    const key=runtimeSessionKey(address);this.#deleted.add(key);delete this.#groups[key];this.#saveGroups();
    this.#zcodeRows=Object.freeze(this.#zcodeRows.filter(row=>row.key!==key));
    this.#publish();
  }
  async open(address){
    if(this.#closed)throw sourceError('disposed');const version=++this.#openVersion,fixed=parseRuntimeSessionAddress(address);
    if(fixed.runtime!=='zcode'||this.#deleted.has(runtimeSessionKey(fixed)))throw sourceError('session-deleted');
    await this.refreshAddress(fixed);
    const conversation=this.#conversationResolver?.(fixed)??new RemoteConversation(this.rpc,fixed);
    const remove=conversation.subscribe(state=>{if(state.error==='session-deleted')this.#remove(fixed)});
    this.#opened.set(conversation,remove);
    try{
      await conversation.connect();if(this.#closed||version!==this.#openVersion)throw sourceError('disposed');
      const reference=this.retain(fixed,{source:'mainView',conversation});
      const previous=this.#selected;this.#selected=Object.freeze({address:fixed,reference,conversation});
      if(previous){previous.reference.release();this.#opened.get(previous.conversation)?.();void previous.conversation.cancel().catch(()=>{});this.#opened.delete(previous.conversation)}
      notifySubscribers(this.#selectionListeners,'[zcode-bridge] selection');return reference;
    }catch(error){remove();this.#opened.delete(conversation);await conversation.cancel();throw error}
  }
  async disconnect(){this.#openVersion++;const selected=this.#selected;this.#selected=null;if(selected){selected.reference.release();this.#opened.get(selected.conversation)?.();this.#opened.delete(selected.conversation);await selected.conversation.cancel()}notifySubscribers(this.#selectionListeners,'[zcode-bridge] selection')}
  async manage(address,type,payload,commandId){
    const key=runtimeSessionKey(address),selected=this.#selected;
    if(!selected||runtimeSessionKey(selected.address)!==key)throw sourceError('open-session-first');
    const result=await selected.conversation.submit({type,payload,...(commandId?{commandId}:{})});
    if(type==='deleteSession'&&['accepted','duplicate'].includes(result.ack?.status))this.#remove(address);
    await this.refresh();return result;
  }
  async queryManagement(commandId){const selected=this.#selected;if(!selected)throw sourceError('open-session-first');const result=await selected.conversation.queryCommand(commandId);if(result.type==='deleteSession'&&['accepted','duplicate'].includes(result.ack?.status))this.#remove(selected.address);await this.refresh();return result}
  #subscribe(listeners,listener){if(this.#closed)return ()=>{};listeners.add(listener);return ()=>listeners.delete(listener)}
  #publish(){
    if(this.#closed)return;
    const matches=this.#zcodeRows.filter(row=>!this.#deleted.has(row.key)&&(row.title||row.address.sessionId).toLocaleLowerCase().includes(this.#query.toLocaleLowerCase()));
    this.#page=Math.min(this.#page,Math.max(0,Math.ceil(matches.length/this.#pageSize)-1));
    this.#directory=Object.freeze({rows:Object.freeze(matches.slice(this.#page*this.#pageSize,(this.#page+1)*this.#pageSize).map(row=>({...row,group:this.#groups[row.key]??''}))),query:this.#query,page:this.#page,pageSize:this.#pageSize,total:matches.length,catalog:this.#catalog,settingsError:this.#settingsError});
    this.#rows=Object.freeze([...this.#native.list.getSnapshot(),...this.#zcodeRows]);
    notifySubscribers(this.#directoryListeners,'[zcode-bridge] directory');
    notifySubscribers(this.#listeners,'[zcode-bridge] Session sources');
    notifySubscribers(this.#availabilityListeners,'[zcode-bridge] availability');
  }
  /** Explicit legacy resolution. The new-session default is never consulted. */
  legacyAddress(sessionId){if(this.#closed)throw sourceError('disposed');return this.#native.address(sessionId)}
  /** New-session runtime is explicit. Restricted ZCode creation fails before any native or official action. */
  async create({runtime,...options}){
    if(this.#closed)throw sourceError('disposed');
    if(runtime==='native')return this.#native.create(options);
    if(runtime==='zcode')throw sourceError('zcode-source-not-ready');
    throw sourceError('unknown-runtime');
  }
  refresh(){
    if(this.#closed)return Promise.reject(sourceError('disposed'));
    if(this.#refresh)return this.#refresh;
    const generation=this.#generation;
    const operation=Promise.allSettled([this.#native.refresh(),this.#requestRead()]).then(results=>{
      if(this.#closed||generation!==this.#generation)return;
      if(results[0].status==='rejected')throw results[0].reason;
    });
    this.#refresh=operation;
    void operation.finally(()=>{if(this.#refresh===operation)this.#refresh=undefined}).catch(()=>{});
    return operation;
  }
  #requestRead(address){
    const operation=this.#read(address);this.#reads.add(operation);
    void operation.then(()=>this.#reads.delete(operation),()=>this.#reads.delete(operation));return operation;
  }
  async #read(address){
    const generation=this.#generation,version=++this.#readVersion,abort=new AbortController();
    for(const request of this.#requests)request.abort();this.#requests.add(abort);
    try{
      const response=await this.rpc.call('/zcode-bridge','sessions',address?{address}:{},abort.signal);
      if(this.#closed||generation!==this.#generation||version!==this.#readVersion)return;
      if(!response.ok)throw sourceError(response.error.code);
      const value=response.value;
      if(!value||!Array.isArray(value.sessions)||!value.scope||typeof value.scope.authority!=='string'||!value.scope.authority||typeof value.scope.workspace!=='string'||!value.scope.workspace||!value.availability||!['restricted','unavailable'].includes(value.availability.state)||typeof value.availability.reason!=='string'||value.availability.capabilities?.create!==false||value.availability.capabilities?.open!==false||value.availability.capabilities?.nativeAgent!==false)throw sourceError('sessions-invalid');
      if(address&&(address.authority!==value.scope.authority||address.workspace!==value.scope.workspace))throw sourceError('source-address-mismatch');
      const rows=value.sessions.map(row=>{
        const fixed=parseRuntimeSessionAddress(row.address);
        if(fixed.runtime!=='zcode'||fixed.authority!==value.scope.authority||fixed.workspace!==value.scope.workspace||typeof row.title!=='string'||(row.cwd!==undefined&&row.cwd!==fixed.workspace)||row.running!==undefined)throw sourceError('sessions-invalid');
        if(address&&runtimeSessionKey(fixed)!==runtimeSessionKey(address))throw sourceError('source-address-mismatch');
        return Object.freeze({address:fixed,key:runtimeSessionKey(fixed),title:row.title,cwd:fixed.workspace,running:undefined});
      });
      if(new Set(rows.map(row=>row.key)).size!==rows.length)throw sourceError('sessions-invalid');
      if(value.catalog&&(typeof value.catalog.complete!=='boolean'||typeof value.catalog.truncated!=='boolean'||value.catalog.complete===value.catalog.truncated||value.catalog.sharedGui!=='unverified'||!Array.isArray(value.catalog.deleted)||value.catalog.deleted.some(id=>typeof id!=='string'||!id)))throw sourceError('sessions-invalid');
      const sameScope=this.#scope?.authority===value.scope.authority&&this.#scope?.workspace===value.scope.workspace;
      if(!address)this.#catalog=Object.freeze(value.catalog??{complete:false,truncated:true,sharedGui:'unverified'});
      else if(!sameScope)this.#catalog=Object.freeze({complete:false,truncated:false,sharedGui:'unverified'});
      for(const sessionId of value.catalog?.deleted??[])this.#remove({runtime:'zcode',...value.scope,sessionId});
      const visible=rows.filter(row=>!this.#deleted.has(row.key));
      this.#scope=Object.freeze({...value.scope});
      this.#zcodeRows=Object.freeze(address&&sameScope?[...this.#zcodeRows.filter(row=>runtimeSessionKey(address)!==row.key),...visible]:visible);
      this.#availability=Object.freeze({state:value.availability.state,reason:value.availability.reason,capabilities:Object.freeze({create:false,open:false,nativeAgent:false})});
      this.#publish();
    }catch(error){
      if(!this.#closed&&generation===this.#generation&&version===this.#readVersion){
        this.#catalog=Object.freeze({complete:false,truncated:false,sharedGui:'unverified'});this.#zcodeRows=Object.freeze([]);this.#availability=unavailable(error.code??'host-unreachable');this.#publish();
        if(address)throw error;
      }
    }finally{this.#requests.delete(abort)}
  }
  /** Read-only targeted official query. Never resumes a native Session or activates a ZCode Session. */
  refreshAddress(address){
    if(this.#closed)return Promise.reject(sourceError('disposed'));
    const fixed=parseRuntimeSessionAddress(address);
    if(fixed.runtime==='native'){
      if(runtimeSessionKey(fixed)!==runtimeSessionKey(this.#native.address(fixed.sessionId)))return Promise.reject(sourceError('source-address-mismatch'));
      return this.#native.refresh();
    }
    return this.#requestRead(fixed);
  }
  retain(address,options){
    if(this.#closed)throw sourceError('disposed');
    options.signal?.throwIfAborted();
    const fixed=parseRuntimeSessionAddress(address);
    if(fixed.runtime==='native'){
      const retained=this.#native.retain(fixed,options);let live=true;
      const reference=Object.freeze({...retained,release:()=>{if(!live)return;live=false;retained.release();this.#references.delete(reference)}});
      this.#references.add(reference);return reference;
    }
    const key=runtimeSessionKey(fixed),subscriptions=new Set(),released=unavailable('reference-released'),mismatch=unavailable('source-address-mismatch');let live=true;
    const subscribe=(source,listener)=>{
      if(!live)return ()=>{};
      const remove=source.subscribe(()=>{if(live)listener()});subscriptions.add(remove);
      return ()=>{subscriptions.delete(remove);remove()};
    };
    const conversation=options?.conversation??this.#conversationResolver?.(fixed);
    const renderSessionArea=(options?.renderSessionArea||conversation)?()=>{
      if(typeof options?.renderSessionArea==='function')return options.renderSessionArea(reference);
      return React.createElement(ZCodeConversationView,{key,reference,conversation,rpc:this.rpc});
    }:undefined;
    const reference=Object.freeze({runtime:'zcode',address:fixed,
      summary:{getSnapshot:()=>live?this.#zcodeRows.find(row=>row.key===key):undefined,subscribe:listener=>subscribe(this.list,listener)},
      availability:{getSnapshot:()=>!live?released:this.#scope&&(fixed.authority!==this.#scope.authority||fixed.workspace!==this.#scope.workspace)?mismatch:this.#availability,subscribe:listener=>subscribe(this.zcodeAvailability,listener)},
      release:()=>{if(!live)return;live=false;for(const remove of subscriptions)remove();subscriptions.clear();this.#references.delete(reference)},
      ...(renderSessionArea?{renderSessionArea}:{}),
    });
    this.#references.add(reference);return reference;
  }
  /** Withdraw subscriptions and requests; the Host plugin independently owns its child process. */
  dispose(){
    if(this.#disposal)return this.#disposal;this.#closed=true;this.#generation++;
    for(const reference of this.#references)reference.release();
    const cleanups=[];for(const [conversation,remove] of this.#opened){remove();cleanups.push(conversation.cancel())}this.#opened.clear();this.#selected=null;this.#directoryListeners.clear();this.#selectionListeners.clear();
    for(const unsubscribe of this.#subscriptions)unsubscribe();this.#subscriptions=[];
    for(const request of this.#requests)request.abort();this.#requests.clear();
    this.#listeners.clear();this.#availabilityListeners.clear();this.#rows=Object.freeze([]);this.#zcodeRows=Object.freeze([]);this.#availability=unavailable('disposed');
    this.#disposal=Promise.allSettled([...this.#reads,...cleanups]).then(()=>{});return this.#disposal;
  }
}

/** Mount only while the installed native controller is present; unload leaves it untouched. */
export function installRuntimeSessions(ctx){
  return ctx.inject(['sessions'],scope=>{
    const sources=new RuntimeSessions({sessions:scope.sessions,rpc:scope.connection.rpc,connectionGeneration:scope.connection.generation,nativeAuthority:globalThis.location?.origin});
    scope.provide('runtimeSessions',sources);
    scope.effect(()=>()=>sources.dispose(),'zcode-bridge: Session sources');
  }).dispose;
}
