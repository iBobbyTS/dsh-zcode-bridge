import { TaskRealtimeBus } from './host-bus.mjs';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fault } from './config.mjs';

/** Main owns the official coordinator. Only these messages enter it; logs/credentials never do. */
export class HostAuthority {
  #bus;#hosts=new Map();#closed=false;
  constructor(){this.#bus=new TaskRealtimeBus({logger:{info(){},warn(){}},seenEventLimit:1000})}
  register({hostId,child,workspaceKeys=[],deliveryKind='desktop_window'}){
    if(this.#closed||this.#hosts.has(hostId))throw fault('host-registration-denied');
    const adapter=new EventEmitter();adapter.postMessage=m=>child.postMessage(m);let database=null;
    const onMessage=m=>{
      if(m?.type==='database-startup-state'){database=projectDatabase(m.state);this.onDatabase?.(hostId,database);return}
      // Session routing can initiate work; it remains explicitly disabled until S03.
      if(['task-run-lease-acquire','task-run-lease-release','task-owner-command-request','task-owner-command-result','task-realtime-publish','task-stream-op-publish'].includes(m?.type))adapter.emit('message',m);
    };
    const onExit=()=>this.unregister(hostId);
    child.on('message',onMessage);child.once('exit',onExit);
    this.#hosts.set(hostId,{child,adapter,onMessage,onExit,attachments:new Set(),database:()=>database});
    this.#bus.registerHost({hostId,windowId:0,child:adapter,workspaceKeys,deliveryKind});
  }
  updateWorkspaceKeys(hostId,keys){if(!this.#hosts.has(hostId))throw fault('host-not-registered');this.#bus.updateHostWorkspaceKeys(hostId,keys)}
  attach(hostId,attachmentId,port,scope,clientMode){
    const h=this.#hosts.get(hostId);if(!h||h.attachments.has(attachmentId))throw fault('attachment-denied');
    h.child.postMessage({type:'attach-service-port',requestId:randomUUID(),attachmentId,scope,clientMode},[port]);h.attachments.add(attachmentId);
  }
  detach(hostId,attachmentId){const h=this.#hosts.get(hostId);if(!h?.attachments.delete(attachmentId))return;h.child.postMessage({type:'detach-service-port',attachmentId})}
  unregister(hostId){
    const h=this.#hosts.get(hostId);if(!h)return;
    for(const id of h.attachments)this.detach(hostId,id);
    this.#bus.unregisterHost(hostId);h.child.off('message',h.onMessage);h.child.off('exit',h.onExit);this.#hosts.delete(hostId);
  }
  login(){throw fault('login-disabled-s03')}
  registerOAuthState(){return this.login()}
  handleOAuthDeepLink(){return this.login()}
  openOAuthBrowser(){return this.login()}
  controlDatabaseStartup(){throw fault('database-control-disabled-s02')}
  database(hostId){return this.#hosts.get(hostId)?.database()??null}
  get diagnostics(){return {...this.#bus.collectMemoryDiagnostics(),hosts:this.#hosts.size,pendingOwnerCommands:this.#bus.pendingOwnerCommands.size,seenEventIds:this.#bus.seenEventIds.size,sharedOfficialMain:'NO-GO',login:'disabled-s03',sessionRouting:'disabled-s03'}}
  dispose(){if(this.#closed)return;this.#closed=true;for(const id of this.#hosts.keys())this.unregister(id);
    // Reference bus is app-lifetime and keeps replay buffers after unregister. Our launcher
    // has a shorter lifetime: cancel each owned flush timer and release these retained buffers.
    for(const batch of this.#bus.streamBatches.values())if(batch.timer)clearTimeout(batch.timer);
    this.#bus.streamBatches.clear();this.#bus.seenEventIds.clear();this.#bus.seenEventOrder.length=0;
  }
}
function projectDatabase(s){if(!s||typeof s!=='object')return null;const out={};for(const k of ['phase','databaseId','databasePhase','errorCode','stage','attemptId','startupId'])if(typeof s[k]==='string')out[k]=s[k];return out}

/** Dispatch seam for a future provider transport. Never counts prompts or usage. There is no
 * public interceptor in the unmodified packaged Host; live installation is deliberately false.
 * S04 must NOT_RUN(cannot-enforce) until an actual per-request transport can be installed. */
export class ProviderRequestGate {
  #limit;#sent=0;#blocked=0;
  constructor({limit=0}={}){if(!Number.isSafeInteger(limit)||limit<0)throw fault('request-limit-invalid');this.#limit=limit}
  dispatchBeforeSend(send){if(this.#sent>=this.#limit){this.#blocked++;throw fault('model-request-budget-exhausted')}this.#sent++;return send()}
  get state(){return {unit:'actual-provider-request',sent:this.#sent,blocked:this.#blocked,limit:this.#limit,installed:false,enforceable:false,reason:'packaged-host-has-no-public-provider-transport-interceptor'}}
}
