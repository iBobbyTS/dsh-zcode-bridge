import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {LauncherPeer} from '../host/launcher/execution.mjs';
import {V4Conversation,negotiatedClientHello} from '../host/conversation.mjs';
import {commandAckSchema,parseCommandEnvelope} from '../host/vendor/zcode/v4.mjs';

const fault=code=>Object.assign(new Error(code),{code});
/** Uses the host-owned launcher or workspace pool; executor lifetime belongs to the host. */
export class DriverTransport {
  #resumes=new Map();
  constructor(host){this.host=host;this.facades=new Map();this.holders=new Set();this.workspaces=new Map();this.prepared=new Map()}
  /** `signal` is optional: background callers (legacy history backfill) run unscoped by an
   * individual request lifecycle, while driver sessions always pass their command's signal. */
  async ready(cwd,signal){
    signal?.throwIfAborted();
    if(this.host.pool)return this.selfReady(cwd,signal);
    await this.host.connect();
    if(this.host.pool)return this.selfReady(cwd,signal);
    signal?.throwIfAborted();
    const state=this.host.launcher?.state;
    if(state?.phase!=='ready'||state.auth!=='authenticated'||!state.executionWorkspace)throw fault('execution-unavailable');
    if(cwd!==undefined&&cwd!==state.executionWorkspace)throw Object.assign(fault('driver-workspace-mismatch'),{cwd,executionWorkspace:state.executionWorkspace});
    if(!this.peer){
      this.peer=new LauncherPeer(this.host.launcher);
      this.offRecovery=this.host.launcher.subscribe(state=>{if(state.phase!=='ready')this.handshake=null});
    }
    if(!this.handshake){
      const flight=(async()=>{const hello=await this.peer.request('hello',undefined,{signal});await this.peer.request('initialize',negotiatedClientHello(hello,{clientId:'dsh-zcode-driver',appVersion:'0.1.0',workspaceHookReviewUi:true}),{signal})})().catch(error=>{if(this.handshake===flight)this.handshake=null;throw error});
      this.handshake=flight;
    }
    await this.handshake;
    signal?.throwIfAborted();
    return state.executionWorkspace;
  }
  async defaultWorkspace(){
    if(!this.workspaceFlight)this.workspaceFlight=(async()=>{
      const store=this.store??this.host.driverStateStore;
      if(!store)throw fault('driver-state-unavailable');
      await (store.ensureLoaded?.()??store.load());
      const workspace=store.value.executionWorkspace??join(process.env.DSH_HOME??join(homedir(),'.dsh'),'zcode-execution');
      try{await mkdir(workspace,{recursive:true})}catch{throw Object.assign(fault('workspace-unavailable'),{sent:false})}
      if(store.value.executionWorkspace!==workspace){store.value.executionWorkspace=workspace;try{await store.save()}catch{ /* Execution remains usable when local persistence fails. */ }}
      this.executionWorkspace=workspace;return workspace;
    })().catch(error=>{this.workspaceFlight=null;throw error});
    return this.workspaceFlight;
  }
  async facadeFor(workspace,{prepare=false,conversationId,signal}={}){
    let facade=this.facades.get(workspace);
    if(!facade||facade.closed){facade=await this.host.pool.forWorkspace(workspace);this.facades.set(workspace,facade)}
    return prepare?this.#prepare(facade,conversationId,signal):facade;
  }
  #hold(facade){
    facade.hold();
    const holder={facade,released:false,release:()=>{if(holder.released)return;holder.released=true;this.#detachSignal(holder);this.#forgetPrepared(holder);facade.releaseHold();this.holders.delete(holder)}};
    this.holders.add(holder);return holder;
  }
  #prepare(facade,conversationId,signal){
    const previous=conversationId===undefined?undefined:this.#resumes.get(conversationId);
    const holder=this.#hold(facade);
    // In-flight creates have distinct opaque keys and cannot be consumed before their ACK.
    this.#registerPrepared(holder,conversationId??Symbol('create-handoff'));
    if(conversationId!==undefined)this.#resumes.set(conversationId,holder);
    // Replace retries only after the new unit is held, so there is no eviction window.
    previous?.release();this.#bindSignal(holder,signal);return holder;
  }
  #bindSignal(holder,signal){
    if(!signal)return;
    const abort=()=>{if(holder.unconsumed)holder.release()};
    holder.offAbort=()=>signal.removeEventListener('abort',abort);
    signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted)abort();
  }
  #detachSignal(holder){
    holder.offAbort?.();holder.offAbort=undefined;
  }
  #registerPrepared(holder,key){
    if(holder.released)return;
    const {facade}=holder;holder.key=key;holder.unconsumed=true;
    if(!this.prepared.has(facade))this.prepared.set(facade,new Map());
    const slots=this.prepared.get(facade);
    if(!slots.has(key))slots.set(key,[]);
    slots.get(key).push(holder);
  }
  #forgetPrepared(holder){
    const slots=this.prepared.get(holder.facade),queue=slots?.get(holder.key),index=queue?.indexOf(holder)??-1;
    if(index!==-1)queue.splice(index,1);
    if(queue&&!queue.length)slots.delete(holder.key);
    if(slots&&!slots.size)this.prepared.delete(holder.facade);
    if(this.#resumes.get(holder.key)===holder)this.#resumes.delete(holder.key);
    holder.key=undefined;holder.unconsumed=false;
  }
  #takePrepared(facade,conversationId){
    const holder=this.prepared.get(facade)?.get(conversationId)?.[0];
    if(holder){this.#forgetPrepared(holder);this.#detachSignal(holder)}
    return holder;
  }
  async selfReady(cwd,signal){
    const workspace=await this.defaultWorkspace();
    signal?.throwIfAborted();
    if(cwd!==undefined&&cwd!==workspace)throw Object.assign(fault('driver-workspace-mismatch'),{cwd,executionWorkspace:workspace});
    const facade=await this.facadeFor(workspace);await facade.ready({signal});signal?.throwIfAborted();return workspace;
  }
  async requestFor(method,params,options){
    if(!this.host.pool)return this.peer.request(method,params,options);
    const topicId=typeof params?.topic==='string'&&params.topic.startsWith('conversation/')?params.topic.slice('conversation/'.length):undefined;
    const sessionId=params?.sessionId,bindings=this.host.driverBindings;
    const known=params?.workspace?.workspacePath??(topicId?bindings?.workspaceOf(topicId):undefined)??(sessionId?bindings?.workspaceOf(sessionId):undefined);
    const workspace=known??this.workspaces.get(topicId)??this.workspaces.get(sessionId)??await this.defaultWorkspace();
    if(known)for(const id of new Set([topicId,sessionId]))if(id)this.workspaces.set(id,workspace);
    return (await this.facadeFor(workspace)).request(method,params,options);
  }
  async create({cwd,signal,firstInput,modelSelection,mode}){
    const workspace=await this.ready(cwd,signal),commandId=randomUUID();
    const envelope={
      commandId,clientId:'dsh-zcode-driver',sessionId:null,type:'createSession',issuedAt:Date.now(),
      payload:{workspaceId:workspace,...(firstInput?{firstInput:{...firstInput,...(modelSelection?{modelSelection}:{}),...(mode?{mode}:{})}}:{}),
        ...(!firstInput&&(modelSelection||mode)?{config:{...(modelSelection?{modelSelection}:{}),...(mode?{mode}:{})}}:{})},
    };
    const parsed=parseCommandEnvelope(envelope);
    if(!parsed.ok)throw fault('command-invalid');
    let ack,unit;
    try{
      try{
        if(this.host.pool)unit=await this.facadeFor(workspace,{prepare:true,signal});
        ack=commandAckSchema.parse(await (unit?.facade??this.peer).request('v4/command',{...parsed.envelope,workspace:{workspacePath:workspace,workspaceKey:workspace}},{signal}));
      }catch(error){throw Object.assign(error,{commandId,state:error.sent===false?'not-sent':'outcome-unknown'})}
      if(ack.commandId!==commandId)throw Object.assign(fault('command-receipt-mismatch'),{commandId,state:'outcome-unknown'});
      if(!['accepted','duplicate'].includes(ack.status))throw Object.assign(fault(ack.reasonCode??'driver-create-unconfirmed'),{commandId,ack,state:ack.status});
      if(ack.result?.type!=='createSession'||!ack.result.sessionId)throw Object.assign(fault('driver-create-unconfirmed'),{commandId,ack,state:'outcome-unknown'});
      if(unit){this.#forgetPrepared(unit);this.#registerPrepared(unit,ack.result.sessionId)}
      if(this.host.pool)this.workspaces.set(ack.result.sessionId,workspace);
      return ack.result.sessionId;
    }catch(error){unit?.release();throw error}
  }
  conversation({zcodeConversationId,cwd}){
    if(this.host.pool){
      const workspace=cwd??this.executionWorkspace;
      // Every prepared facade transfers ownership through the same handoff path.
      const facade=this.facades.get(workspace);
      let holder=this.#takePrepared(facade,zcodeConversationId);
      if(!facade||facade.closed){holder?.release();throw fault('execution-unavailable')}
      holder??=this.#hold(facade);
      this.workspaces.set(zcodeConversationId,workspace);
      try{return new V4Conversation(facade,{
        address:{runtime:'zcode',authority:this.host.status?.sessionAuthority??'official-host',workspace,sessionId:zcodeConversationId},
        workspace:{workspacePath:workspace,workspaceKey:workspace},connectionId:facade.connectionId,
        clientId:'dsh-zcode-driver',clientMode:'desktop-continuous',runnable:true,managementAllowed:true,reconnectable:true,
        onChange:state=>{if(state.status==='closed')holder.release()},
      })}catch(error){holder.release();throw error}
    }
    if(!this.peer)throw fault('execution-unavailable');
    const workspace=cwd??this.host.launcher.state.executionWorkspace;
    return new V4Conversation(this.peer,{
      address:{runtime:'zcode',authority:this.host.status?.sessionAuthority??'official-host',workspace,sessionId:zcodeConversationId},
      workspace:{workspacePath:workspace,workspaceKey:workspace},connectionId:this.peer.connectionId,
      clientId:'dsh-zcode-driver',clientMode:'desktop-continuous',runnable:true,managementAllowed:true,reconnectable:true,
    });
  }
  /** Resume only establishes the authenticated handshake: a resumed legacy/history session lives
   * in ANY workspace (its own project dir), never the launcher's single execution workspace, so
   * the create-side cwd equality check must not apply here. The conversation address carries the
   * session's own workspace when a binding exists. */
  async resume({zcodeConversationId,cwd,signal}){
    await this.ready(undefined,signal);
    if(this.host.pool){
      const workspace=cwd??this.host.driverBindings?.workspaceOf(zcodeConversationId)??this.workspaces.get(zcodeConversationId)??this.executionWorkspace;
      // Hold the looked-up facade until conversation consumes it; do not handshake the project.
      const unit=await this.facadeFor(workspace,{prepare:true,conversationId:zcodeConversationId,signal});
      try{signal?.throwIfAborted();this.workspaces.set(zcodeConversationId,workspace)}catch(error){unit.release();throw error}
    }
    return zcodeConversationId;
  }
  dispose(){
    if(this.host.pool){
      for(const holder of [...this.holders])holder.release();
      for(const facade of new Set(this.facades.values()))facade.close('transport-disposed');
      this.facades.clear();this.workspaces.clear();this.prepared.clear();this.#resumes.clear();return;
    }
    this.offRecovery?.();this.peer?.close();
  }
}
