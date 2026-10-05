import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EventEmitter } from 'node:events';
import { createLauncherConfig, prepareLauncher, sandboxProfile, fault } from './config.mjs';

/** Node/DSH-side resource owner. Status is a projection, never a command or auth transport. */
export class HostLauncher {
  #state={phase:'idle',revision:0,channelAvailable:false,services:[],login:'disabled-s03',sharedOfficialMain:'NO-GO'};
  #executionNonce;#routeBAttempted=false;#routeBReady=false;#launchCount=0;#reads=new Map();#readSeq=0;#events=new EventEmitter();#child;#starting;#stopping;#disposed=false;#exited;
  constructor(options,{spawnProcess=spawn}={}){this.options=options;this.spawnProcess=spawnProcess}
  get state(){return structuredClone(this.#state)}
  subscribe(listener){this.#events.on('state',listener);return ()=>this.#events.off('state',listener)}
  #publish(state){if(this.#routeBAttempted&&state.phase==='ready'&&state.auth==='authenticated')this.#routeBReady=true;this.#state={...state,revision:this.#state.revision+1};this.#events.emit('state',this.state)}
  waitState(afterRevision,{signal,timeoutMs=25000}={}){
    if(signal?.aborted)return Promise.reject(fault('cancelled'));
    if(this.#state.revision>afterRevision||this.#disposed)return Promise.resolve(this.state);
    return new Promise((resolve,reject)=>{const finish=(error,state)=>{clearTimeout(timer);unsubscribe();signal?.removeEventListener('abort',cancel);if(error)reject(error);else resolve(state)};
      const unsubscribe=this.subscribe(s=>finish(null,s));const cancel=()=>finish(fault('cancelled'));const timer=setTimeout(()=>finish(null,this.state),timeoutMs);signal?.addEventListener('abort',cancel,{once:true});});
  }
  start(){if(this.#disposed)return Promise.reject(fault('disposed'));if(this.#starting)return this.#starting;if(this.#child&&!this.#stopping)return Promise.resolve(this.state);
    this.#starting=this.#start().finally(()=>{this.#starting=undefined});return this.#starting;
  }
  async #start(){
    let config;
    try{
      if(process.platform!=='darwin')throw fault('launcher-platform-unsupported');
      if(this.#stopping)await this.#stopping;
      if(this.#disposed)throw fault('disposed');
      if(this.#routeBAttempted&&!this.#routeBReady)throw fault('route-b-retry-disabled');
      // Recovery uses the same validated configuration/profile, with a fresh owned run. Failed
      // first bootstrap remains guarded; an authenticated ready owner may recover after exit.
      config=prepareLauncher(createLauncherConfig({...this.options,...(this.#launchCount?{runId:'recovery-'+randomUUID()}: {})}));this.#launchCount++;this.#executionNonce=config.executionNonce;
      if(config.mode==='route-b')this.#routeBAttempted=true;
      const codeRoot=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
      const dependencyRoot=dirname(fileURLToPath(import.meta.resolve('zod')));
      const dependencyLinks=[];for(let p=codeRoot;p!==dirname(p);p=dirname(p)){const candidate=join(p,'node_modules/zod');try{if(realpathSync(candidate)===realpathSync(dependencyRoot))dependencyLinks.push(candidate)}catch{}}
      const profile=join(config.runRoot,'launcher.sb');writeFileSync(profile,sandboxProfile(config,codeRoot,dependencyRoot,dependencyLinks),{mode:0o600});
      this.#publish({phase:'starting',channelAvailable:false,landings:config.landing,routeB:config.routeB??null,services:[],login:'disabled-s03',sharedOfficialMain:'NO-GO'});
      const child=this.#child=this.spawnProcess('/usr/bin/sandbox-exec',['-f',profile,config.electronPath,realpathSync(fileURLToPath(new URL('./bootstrap.cjs',import.meta.url))),join(config.runRoot,'launcher.json')],{cwd:config.cwd,env:config.env,stdio:['pipe','pipe','pipe'],detached:true});
      let tail='';
      child.stdout.on('data',data=>{tail+=data.toString();if(tail.length>9*1024*1024){tail='';this.#publish({phase:'failed',reason:'launcher-output-limit',channelAvailable:false});void this.stop();return}let i;while((i=tail.indexOf('\n'))>=0){const line=tail.slice(0,i);tail=tail.slice(i+1);try{const m=JSON.parse(line);if(m.type==='launcher-event'&&m.nonce===this.#executionNonce){this.#events.emit('execution',m.event)}if(m.type==='launcher-read'){const p=this.#reads.get(m.id);if(p){this.#reads.delete(m.id);clearTimeout(p.timer);if(m.ok)p.resolve(m.value);else p.reject(Object.assign(fault(m.code??'route-b-read-failed'),typeof m.sent==='boolean'?{sent:m.sent}:{}));}}if(m.type==='launcher-state'&&m.state&&typeof m.state.phase==='string')this.#publish(m.state)}catch{/* Electron informational stdout is discarded. */}}});
      // Only error categories from Electron bootstrap are retained. Arbitrary diagnostic text,
      // file contents and Host output are never forwarded into DSH state.
      child.stderr.on('data',data=>{const categories=[...new Set(data.toString().match(/\b(?:ERR_[A-Z_]+|EACCES|EPERM|ENOENT|FATAL)\b/g)??[])];if(categories.length)this.#publish({...this.#state,bootstrapErrors:categories})});
      this.#exited=new Promise(resolve=>{child.once('error',()=>{this.#publish({phase:'failed',reason:'launcher-spawn-failed',channelAvailable:false});resolve()});child.once('close',(code)=>{for(const p of this.#reads.values()){clearTimeout(p.timer);p.reject(fault('execution-outcome-unknown'))}this.#reads.clear();if(this.#state.phase!=='stopped')this.#publish({phase:code===0?'stopped':'failed',reason:code===0?'launcher-stopped':'launcher-exited',channelAvailable:false,services:[]});resolve();void this.stop().catch(()=>this.#publish({...this.#state,cleanup:'owned-group-cleanup-failed'}))})});
      return await new Promise(resolve=>{const off=this.subscribe(s=>{if(['ready','failed','stopped'].includes(s.phase)){clearTimeout(timer);off();resolve(s)}});const timer=setTimeout(()=>{off();this.#publish({phase:'failed',reason:'launcher-start-timeout',channelAvailable:false});void this.stop().then(()=>resolve(this.state))},35000)});
    }catch(e){this.#publish({phase:'failed',reason:e.code??'launcher-configuration-failed',channelAvailable:false,services:[],landings:{passed:false}});return this.state}
  }
  read(operation,{address,signal}={}){
    if(!['catalog','models','preflight','observation','taskUsage','sendMinimalTask'].includes(operation)||this.#state.phase!=='ready'||this.#state.landings?.mode!=='route-b'||!this.#child||this.#disposed)return Promise.reject(fault('route-b-read-unavailable'));
    if(signal?.aborted)return Promise.reject(fault('cancelled'));
    if(this.#reads.size>=32)return Promise.reject(fault('route-b-read-limit'));
    const id=++this.#readSeq;
    return new Promise((resolve,reject)=>{
      // preflight performs a bounded activity window inside Main; the single-turn dispatch waits on
      // one official session creation, so both carriers get a bounded extension.
      const timeoutMs=(operation==='preflight'?25000+(this.options.activityWindowMs??5000):operation==='sendMinimalTask'?120000:25000);
      const timer=setTimeout(()=>{this.#reads.delete(id);reject(fault('route-b-read-timeout'));void this.stop();},timeoutMs);
      this.#reads.set(id,{resolve,reject,timer});
      this.#child.stdin.write(JSON.stringify({id,operation,...(address?{address}:{})})+'\n',e=>{if(e){clearTimeout(timer);this.#reads.delete(id);reject(fault('route-b-read-transport'));}});
    });
  }
  onExecutionEvent(listener){this.#events.on('execution',listener);return ()=>this.#events.off('execution',listener)}
  execution(method,params,{signal}={}){
    if(this.#state.phase!=='ready'||this.#state.auth!=='authenticated'||!this.#child||this.#disposed)return Promise.reject(Object.assign(fault('execution-unavailable'),{sent:false}));
    if(signal?.aborted)return Promise.reject(Object.assign(fault('cancelled'),{sent:false}));
    if(this.#reads.size>=32)return Promise.reject(Object.assign(fault('execution-pending-limit'),{sent:false}));
    const id=++this.#readSeq;
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);this.#reads.delete(id)};
      const cancel=()=>{cleanup();reject(fault('execution-outcome-unknown'))};
      const timer=setTimeout(()=>{cleanup();reject(fault('execution-outcome-unknown'))},30000);
      this.#reads.set(id,{timer,resolve:value=>{cleanup();resolve(value)},reject:error=>{cleanup();reject(error)}});
      signal?.addEventListener('abort',cancel,{once:true});
      const line=JSON.stringify({id,operation:'execution',nonce:this.#executionNonce,method,params})+'\n';
      if(Buffer.byteLength(line)>1024*1024){cleanup();reject(Object.assign(fault('execution-size-limit'),{sent:false}));return}
      this.#child.stdin.write(line,error=>{if(error){cleanup();reject(fault('execution-outcome-unknown'))}});
    });
  }
  stop(){if(this.#stopping)return this.#stopping;this.#stopping=this.#stop().finally(()=>{this.#stopping=undefined});return this.#stopping}
  async #stop(){
    for(const p of this.#reads.values()){clearTimeout(p.timer);p.reject(fault('launcher-stopped'));}this.#reads.clear();
    const child=this.#child;if(!child)return;
    child.stdin.on('error',()=>{});child.stdin.end('stop\n');
    const delay=ms=>{let timer;return {promise:new Promise(r=>timer=setTimeout(r,ms)),clear:()=>clearTimeout(timer)}};
    const gentle=delay(4000);await Promise.race([this.#exited,gentle.promise]);gentle.clear();
    // Only the detached process group we created may be signalled. No process-name killing.
    // Always reap the owned group: Main may exit before a worker descendant.
    if(child.pid){try{process.kill(-child.pid,'SIGTERM')}catch(e){if(e.code!=='ESRCH')throw e}
      const grace=delay(500);await grace.promise;try{process.kill(-child.pid,'SIGKILL')}catch(e){if(e.code!=='ESRCH')throw e}}
    await this.#exited;
    if(this.#child===child)this.#child=undefined;
  }
  async dispose(){if(this.#disposed)return this.#stopping;this.#disposed=true;await this.stop();this.#publish({...this.#state,phase:'stopped',channelAvailable:false,services:[]});this.#events.removeAllListeners()}
}

/** Strict dedicated-channel endpoint: no client supplied paths, RPC names or commands. */
export async function handleLauncher(launcher,payload,signal){
  const keys=payload?.operation==='watch'?['operation','afterRevision']:['operation'];
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!['state','services','watch','observation'].includes(payload.operation)||Object.keys(payload).some(k=>!keys.includes(k))||(payload.operation==='watch'&&(!Number.isSafeInteger(payload.afterRevision)||payload.afterRevision<0)))return {ok:false,error:{code:'invalid-payload',message:'Launcher state projection only',details:{}}};
  try{if(signal?.aborted)throw fault('cancelled');if(payload.operation==='observation')return {ok:true,value:await launcher.read('observation',{signal})};const state=payload.operation==='watch'?await launcher.waitState(payload.afterRevision,{signal}):launcher.state;return {ok:true,value:payload.operation==='services'?{services:state.services,channelAvailable:state.channelAvailable,revision:state.revision}:state}}
  catch(e){return {ok:false,error:{code:e.code??'launcher-unavailable',message:'Launcher state unavailable',details:{}}}}
}
