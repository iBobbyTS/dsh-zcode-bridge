import {createNativeSessionSource,parseRuntimeSessionAddress,runtimeSessionKey} from '@deepseek-ai/dsh-api-session-controller/client';
import {notifySubscribers} from '@deepseek-ai/dsh-client-store';

const unavailable=reason=>Object.freeze({state:'unavailable',reason,capabilities:Object.freeze({create:false,open:false,nativeAgent:false})});
const sourceError=code=>Object.assign(new Error(code),{code});

/** Two fixed runtime routes. No Agent factory, foreign DSH scope, transcript, or plugin registry. */
export class RuntimeSessions {
  #native;#rows=Object.freeze([]);#zcodeRows=Object.freeze([]);#availability=unavailable('not-connected');
  #listeners=new Set();#availabilityListeners=new Set();#references=new Set();#subscriptions=[];
  #closed=false;#generation=0;#readVersion=0;#requests=new Set();#reads=new Set();#refresh;#scope;#disposal;
  constructor({sessions,rpc,connectionGeneration,nativeAuthority}){
    if(typeof nativeAuthority!=='string'||!nativeAuthority)throw sourceError('native-authority-required');
    this.rpc=rpc;
    this.#native=createNativeSessionSource(sessions,nativeAuthority,'native-session-store');
    this.#subscriptions.push(this.#native.list.subscribe(()=>this.#publish()));
    if(connectionGeneration)this.#subscriptions.push(connectionGeneration.subscribe(()=>{
      this.#generation++;this.#refresh=undefined;for(const request of this.#requests)request.abort();
      this.#scope=undefined;this.#zcodeRows=Object.freeze([]);this.#availability=unavailable('host-unreachable');this.#publish();
    }));
    this.#publish();
  }
  list={getSnapshot:()=>this.#rows,subscribe:listener=>this.#subscribe(this.#listeners,listener)};
  zcodeAvailability={getSnapshot:()=>this.#availability,subscribe:listener=>this.#subscribe(this.#availabilityListeners,listener)};
  #subscribe(listeners,listener){if(this.#closed)return ()=>{};listeners.add(listener);return ()=>listeners.delete(listener)}
  #publish(){
    if(this.#closed)return;
    this.#rows=Object.freeze([...this.#native.list.getSnapshot(),...this.#zcodeRows]);
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
      const response=await this.rpc.call('/api','zcode-bridge/sessions',address?{address}:{},abort.signal);
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
      const sameScope=this.#scope?.authority===value.scope.authority&&this.#scope?.workspace===value.scope.workspace;
      this.#scope=Object.freeze({...value.scope});
      this.#zcodeRows=Object.freeze(address&&sameScope?[...this.#zcodeRows.filter(row=>runtimeSessionKey(address)!==row.key),...rows]:rows);
      this.#availability=Object.freeze({state:value.availability.state,reason:value.availability.reason,capabilities:Object.freeze({create:false,open:false,nativeAgent:false})});
      this.#publish();
    }catch(error){
      if(!this.#closed&&generation===this.#generation&&version===this.#readVersion){
        this.#zcodeRows=Object.freeze([]);this.#availability=unavailable(error.code??'host-unreachable');this.#publish();
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
    const reference=Object.freeze({runtime:'zcode',address:fixed,
      summary:{getSnapshot:()=>live?this.#zcodeRows.find(row=>row.key===key):undefined,subscribe:listener=>subscribe(this.list,listener)},
      availability:{getSnapshot:()=>!live?released:this.#scope&&(fixed.authority!==this.#scope.authority||fixed.workspace!==this.#scope.workspace)?mismatch:this.#availability,subscribe:listener=>subscribe(this.zcodeAvailability,listener)},
      release:()=>{if(!live)return;live=false;for(const remove of subscriptions)remove();subscriptions.clear();this.#references.delete(reference)},
    });
    this.#references.add(reference);return reference;
  }
  /** Withdraw subscriptions and requests; the Host plugin independently owns its child process. */
  dispose(){
    if(this.#disposal)return this.#disposal;this.#closed=true;this.#generation++;
    for(const reference of this.#references)reference.release();
    for(const unsubscribe of this.#subscriptions)unsubscribe();this.#subscriptions=[];
    for(const request of this.#requests)request.abort();this.#requests.clear();
    this.#listeners.clear();this.#availabilityListeners.clear();this.#rows=Object.freeze([]);this.#zcodeRows=Object.freeze([]);this.#availability=unavailable('disposed');
    this.#disposal=Promise.allSettled([...this.#reads]).then(()=>{});return this.#disposal;
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
