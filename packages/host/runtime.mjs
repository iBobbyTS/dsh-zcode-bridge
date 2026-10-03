import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { inspectInstallation, runtimeEnv, BridgeError } from './installation.mjs';
import { ProtocolPeer } from './protocol.mjs';
export const initialStatus=()=>({state:'unavailable',reason:'not-connected',auth:'unconfirmed',connected:false});
/** Owns only children it launches; there is no attach or shared-process killer. */
export class BridgeHost {
  #status=initialStatus(); #peer; #child; #operation; #disposed=false; #stop; #disposePromise;
  constructor({appPath,workspacePath,inspect=inspectInstallation,spawnProcess=spawn,onStatus=()=>{}}={}){this.appPath=appPath;this.workspacePath=workspacePath;this.inspect=inspect;this.spawnProcess=spawnProcess;this.onStatus=onStatus}
  get status(){return structuredClone(this.#status)}
  #publish(change){this.#status={...this.#status,...change};this.onStatus(this.status)}
  connect(){
    if(this.#disposed)return Promise.reject(new BridgeError('disposed'));
    if(this.#operation)return this.#operation;
    if(this.#peer&&!this.#peer.closed)return Promise.resolve(this.status);
    this.#operation=this.#connect().finally(()=>{this.#operation=undefined});return this.#operation;
  }
  async #connect(){
    this.#status=initialStatus();this.#publish({state:'restricted',reason:'connecting',connected:false,auth:'unconfirmed'});
    try{
      const installation=await this.inspect(this.appPath);
      if(this.#disposed)throw new BridgeError('disposed');
      if(!this.workspacePath)throw new BridgeError('workspace-required');
      let workspacePath;try{workspacePath=await realpath(this.workspacePath)}catch{throw new BridgeError('workspace-missing')}
      if(this.#disposed)throw new BridgeError('disposed');
      this.#publish({installation,workspacePath});
      const child=this.spawnProcess(installation.launcher,[installation.cjs,'app-server','--stdio'],{cwd:workspacePath,env:runtimeEnv(installation.providerConfig),stdio:['pipe','pipe','pipe']});
      this.#child=child;
      const exited=new Promise(resolve=>child.once('close',resolve));
      let stopping;this.#stop=()=>stopping??=stopOwned(child,exited);
      let stderrBytes=0;child.stderr.on('data',b=>{stderrBytes+=b.length}); // never collect raw diagnostics/credentials
      child.once('error',()=>{this.#peer?.close('launch-failed')});
      this.#peer=new ProtocolPeer(child.stdout,child.stdin,{
        onAuthUnavailable:()=>this.#publish({state:'restricted',reason:'official-auth-source-missing',auth:'unavailable'}),
        onClose:reason=>{this.#publish({state:'unavailable',reason,connected:false});void this.#stop?.()},
      });
      const capabilities=await this.#peer.request('runtime/capabilities',{});
      if(!capabilities||typeof capabilities.independentPlanState!=='boolean')throw new BridgeError('capabilities-invalid');
      const workspace={workspacePath,workspaceKey:workspacePath};
      const list=await this.#peer.request('session/list',{workspace,limit:5});
      if(!list||!Array.isArray(list.sessions))throw new BridgeError('sessions-invalid');
      if(this.#disposed)throw new BridgeError('disposed');
      this.#publish({state:'restricted',reason:installation.verified?'official-auth-source-missing':'runtime-unverified',connected:true,auth:'unavailable',authority:'official-cli-default-storage',sharedSessions:'unverified',pid:child.pid,capabilities,sessionCount:list.sessions.length,roundTrip:{method:'session/list',response:'validated',at:new Date().toISOString()},stderrBytes});
      return this.status;
    }catch(e){
      this.#peer?.close(e instanceof BridgeError?e.code:'launch-failed');await this.#stop?.();
      this.#publish({state:'unavailable',reason:this.#disposed?'disposed':e instanceof BridgeError?e.code:'launch-failed',connected:false});
      return this.status;
    }
  }
  dispose(){
    if(this.#disposePromise)return this.#disposePromise;
    this.#disposed=true;this.#peer?.close('disposed');
    this.#disposePromise=(async()=>{await this.#operation;await this.#stop?.();this.#publish({state:'unavailable',reason:'disposed',connected:false})})();return this.#disposePromise;
  }
}
/** EOF first, then signals only the exact owned ChildProcess, never a discovered PID. */
export async function stopOwned(child,exited){
  child.stdin.end();
  const wait=ms=>new Promise(resolve=>{const t=setTimeout(()=>resolve(false),ms);exited.then(()=>{clearTimeout(t);resolve(true)})});
  if(await wait(1500))return;
  child.kill('SIGTERM');if(await wait(1000))return;
  child.kill('SIGKILL');await wait(1000);
}
