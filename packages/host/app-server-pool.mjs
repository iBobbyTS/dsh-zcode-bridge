import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir, realpath, stat} from 'node:fs/promises';
import {inspectInstallation, runtimeEnv, BridgeError} from './installation.mjs';
import {ProtocolPeer} from './protocol.mjs';
import {stopOwned} from './runtime.mjs';

const fault=(code,sent=false)=>Object.assign(new BridgeError(code),{sent});
const emit=(listeners,value)=>{for(const listener of listeners){try{listener(value)}catch{ /* Observers cannot interrupt ownership cleanup. */ }}};
// A waiter's cancellation never cancels the shared installation/spawn/handshake flight.
function waitFor(flight,signal){
  if(signal?.aborted)return Promise.reject(fault('cancelled'));
  if(!signal)return flight;
  return new Promise((resolve,reject)=>{
    const abort=()=>{cleanup();reject(fault('cancelled'))};
    const cleanup=()=>signal.removeEventListener('abort',abort);
    signal.addEventListener('abort',abort,{once:true});
    flight.then(value=>{cleanup();resolve(value)},error=>{cleanup();reject(error)});
  });
}

class WorkspacePeer {
  #closed=false; #holds=0; #notifications=new Set(); #closures=new Set(); #closeReason;
  constructor(pool,entry){
    this.pool=pool;this.entry=entry;
    Object.defineProperties(this,{connectionId:{value:entry.connectionId,enumerable:true},launcher:{value:entry.launcher,enumerable:true}});
  }
  get closed(){return this.#closed}
  get workspacePath(){return this.entry.workspacePath}
  // forWorkspace is a lookup. Ownership is explicit through hold() or pool.acquire().
  hold(){if(this.closed||this.pool.disposed)throw fault('execution-disposed');this.#holds++;this.entry.holds++;this.pool.touch(this.entry);return this}
  releaseHold(){if(this.#holds>0){this.#holds--;this.entry.holds--}this.pool.trim()}
  onNotification(listener){this.#notifications.add(listener);return ()=>this.#notifications.delete(listener)}
  onClosed(listener){this.#closures.add(listener);return ()=>this.#closures.delete(listener)}
  notify(message){if(!this.closed)emit(this.#notifications,message)}
  lost(reason){if(!this.closed)emit(this.#closures,reason)}
  dispose(reason){this.lost(reason);this.#closed=true;this.#closeReason=reason;this.#notifications.clear();this.#closures.clear()}
  close(reason='execution-disposed'){
    if(this.closed)return;
    this.#closed=true;this.#closeReason=reason;this.#notifications.clear();this.#closures.clear();this.releaseHold();
  }
  async ready({signal}={}){return this.#run(signal,()=>this)}
  async request(method,params,{signal,timeoutMs,onResult}={}){
    return this.#run(signal,peer=>peer.request(method,params,{signal,timeoutMs,onResult}));
  }
  async #run(signal,operation){
    if(this.closed||this.pool.disposed)throw fault(this.#closeReason??'execution-disposed');
    if(signal?.aborted)throw fault('cancelled');
    const entry=this.entry;let dispatched=false;entry.pending++;this.pool.touch(entry);
    try{
      const peer=await waitFor(this.pool.ensure(entry),signal);
      if(signal?.aborted)throw fault('cancelled');
      if(this.closed||this.pool.disposed)throw fault(this.#closeReason??'execution-disposed');
      dispatched=true;return await operation(peer);
    }catch(error){
      // ProtocolPeer records whether a queued request reached stdin before losing the stream.
      if(['transport-eof','transport-truncated','protocol-truncated','transport-error','transport-closed'].includes(error.code))throw fault('execution-disconnected',dispatched&&error.sent===true);
      // The flight's handshake bytes do not mean this caller's request was sent.
      if(!dispatched)throw Object.assign(new BridgeError(error.code??'launch-failed'),{...(error.protocolCode===undefined?{}:{protocolCode:error.protocolCode}),sent:false});
      if(error.sent===undefined)error.sent=false;
      throw error;
    }finally{entry.pending--;this.pool.trim()}
  }
}

/** Owns one lazy stdio child per canonical workspace; peers survive child generations. */
export class AppServerPool {
  #entries=new Map(); #retiring=new Map(); #disposed=false; #disposePromise; #clock=0; #stops=new Set(); #lookups=new Set();
  constructor({appPath,inspect=inspectInstallation,spawnProcess=spawn,maxEntries=8,logger}={}){
    if(!Number.isSafeInteger(maxEntries)||maxEntries<1)throw fault('pool-limit-invalid');
    Object.assign(this,{appPath,inspect,spawnProcess,maxEntries,logger});
  }
  get disposed(){return this.#disposed}
  get size(){return this.#entries.size}
  forWorkspace(workspacePath){
    if(this.disposed)return Promise.reject(fault('execution-disposed'));
    const lookup=this.#workspace(workspacePath);this.#lookups.add(lookup);
    void lookup.finally(()=>this.#lookups.delete(lookup)).catch(()=>{});
    return lookup;
  }
  async #workspace(path){
    let workspacePath;
    try{
      // realpath is the identity even when callers use different symlink spellings.
      try{workspacePath=await realpath(path)}catch(error){if(error.code!=='ENOENT')throw error;await mkdir(path,{recursive:true});workspacePath=await realpath(path)}
      if(!(await stat(workspacePath)).isDirectory())throw fault('workspace-unavailable');
    }catch{throw fault('workspace-unavailable')}
    if(this.disposed)throw fault('execution-disposed');
    let entry=this.#entries.get(workspacePath);
    if(!entry){
      const listeners=new Set();
      const launcher={state:{phase:'starting',revision:0,workspacePath},subscribe(listener){listeners.add(listener);try{listener(this.state)}catch{}return ()=>listeners.delete(listener)}};
      entry={workspacePath,connectionId:'bridge-'+randomUUID(),holds:0,pending:0,flight:null,child:null,peer:null,launcher,listeners};
      entry.facade=new WorkspacePeer(this,entry);this.#entries.set(workspacePath,entry);
    }else if(entry.facade.closed){entry.facade=new WorkspacePeer(this,entry)}
    this.touch(entry);
    // Keep the looked-up entry until its caller can acquire a hold; evict older idle entries.
    this.trim(entry);return entry.facade;
  }
  async acquire(workspacePath,options){
    const peer=await this.forWorkspace(workspacePath);peer.hold();
    try{await peer.ready(options);return peer}catch(error){peer.releaseHold();throw error}
  }
  touch(entry){entry.used=++this.#clock}
  #publish(entry,phase,reason){
    entry.launcher.state={phase,reason,revision:entry.launcher.state.revision+1,workspacePath:entry.workspacePath,pid:entry.child?.pid};
    emit(entry.listeners,entry.launcher.state);
  }
  ensure(entry){
    if(this.disposed)return Promise.reject(fault('execution-disposed'));
    if(entry.flight)return entry.flight;
    if(entry.peer&&!entry.peer.closed)return Promise.resolve(entry.peer);
    const flight=this.#start(entry).finally(()=>{if(entry.flight===flight)entry.flight=null;this.trim()});
    entry.flight=flight;return flight;
  }
  async #start(entry){
    // Retirement outlives map membership; replacements must also exclude old entries' children.
    await this.#retiring.get(entry.workspacePath);
    // EOF can precede the ChildProcess close event. Never overlap owned generations.
    await entry.exited;
    if(this.disposed)throw fault('execution-disposed');
    this.#publish(entry,'starting');
    const installation=await this.inspect(this.appPath);
    if(this.disposed)throw fault('execution-disposed');
    let child;
    try{child=this.spawnProcess(installation.launcher,[installation.cjs,'app-server','--stdio'],{cwd:entry.workspacePath,env:runtimeEnv(installation.providerConfig),stdio:['pipe','pipe','pipe']})}catch{throw fault('launch-failed')}
    entry.child=child;entry.stderrBytes=0;
    let resolveExit,closed=false;
    const exited=entry.exited=new Promise(resolve=>{resolveExit=resolve});
    const lost=()=>{
      if(closed||entry.child!==child)return;closed=true;entry.peer?.close('execution-disconnected');
      entry.facade.lost('execution-disconnected');this.#publish(entry,'starting','execution-disconnected');
    };
    child.once('exit',lost);
    child.once('close',()=>{lost();resolveExit()});
    child.stderr.on('data',buffer=>{entry.stderrBytes+=buffer.length});
    child.once('error',()=>entry.peer?.close('launch-failed'));
    const peer=entry.peer=new ProtocolPeer(child.stdout,child.stdin,{onAuthUnavailable:()=>{},onClose:reason=>{
      if(entry.peer!==peer)return;
      entry.error=reason;lost();
      // A child may keep running after closing stdout. Reap it so lazy recovery can proceed.
      void this.#stop(entry,child,exited).catch(()=>{});
    }});
    peer.onNotification(message=>entry.facade.notify(message));
    try{
      const capabilities=await peer.request('runtime/capabilities',{});
      if(!capabilities||typeof capabilities.independentPlanState!=='boolean')throw fault('capabilities-invalid');
      const workspace={workspacePath:entry.workspacePath,workspaceKey:entry.workspacePath};
      const list=await peer.request('session/list',{workspace,limit:1});
      if(!list||!Array.isArray(list.sessions))throw fault('sessions-invalid');
      if(this.disposed)throw fault('execution-disposed');
      if(peer.closed||closed)throw fault(entry.error??'execution-disconnected');
      entry.error=null;entry.capabilities=capabilities;this.#publish(entry,'ready');return peer;
    }catch(error){
      entry.error=error.code??'launch-failed';peer.close(entry.error);
      await this.#stop(entry,child,exited);throw error;
    }
  }
  #stop(entry,child=entry.child,exited=entry.exited){
    if(!child)return Promise.resolve();
    if(entry.stoppingChild===child)return entry.stopping;
    entry.stoppingChild=child;
    // Register before initiating EOF, and retain the barrier until the child fully closes.
    const stopping=entry.stopping=Promise.all([Promise.resolve().then(()=>stopOwned(child,exited)),exited]).then(()=>{});
    this.#retiring.set(entry.workspacePath,stopping);this.#stops.add(stopping);
    void stopping.finally(()=>{
      this.#stops.delete(stopping);
      if(this.#retiring.get(entry.workspacePath)===stopping)this.#retiring.delete(entry.workspacePath);
    }).catch(()=>{});return stopping;
  }
  trim(exclude){
    if(this.disposed)return;
    while(this.size>this.maxEntries){
      const candidate=[...this.#entries.values()].filter(entry=>entry!==exclude&&entry.holds===0&&entry.pending===0&&!entry.flight).sort((a,b)=>a.used-b.used)[0];
      if(!candidate){this.#diagnostic({event:'pool-over-capacity',size:this.size,maxEntries:this.maxEntries});return}
      this.#entries.delete(candidate.workspacePath);candidate.facade.dispose('pool-evicted');candidate.peer?.close('pool-evicted');
      // LRU entry disposal uses the same owned EOF/signal ladder as pool disposal.
      void this.#stop(candidate).catch(()=>{});
      this.#diagnostic({event:'pool-evicted',workspacePath:candidate.workspacePath,size:this.size,maxEntries:this.maxEntries});
    }
  }
  #diagnostic(event){try{this.logger?.(event)}catch{ /* Diagnostics cannot alter pool behavior. */ }}
  dispose(){
    if(this.#disposePromise)return this.#disposePromise;
    this.#disposed=true;
    for(const entry of this.#entries.values()){
      entry.facade.dispose('execution-disposed');entry.peer?.close('execution-disposed');void this.#stop(entry).catch(()=>{});
    }
    this.#disposePromise=(async()=>{
      await Promise.allSettled([...this.#lookups]);
      await Promise.allSettled([...this.#entries.values()].map(entry=>entry.flight));
      await Promise.allSettled([...this.#stops]);this.#entries.clear();
    })();return this.#disposePromise;
  }
}
