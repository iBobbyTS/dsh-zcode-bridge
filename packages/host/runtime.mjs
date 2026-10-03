import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { inspectInstallation, runtimeEnv, BridgeError } from './installation.mjs';
import { V4Conversation } from './conversation.mjs';
import { ProtocolPeer } from './protocol.mjs';
export const initialStatus=()=>({state:'unavailable',reason:'not-connected',auth:'unconfirmed',connected:false});
/** Owns only children it launches; there is no attach or shared-process killer. */
export class BridgeHost {
  #conversations=new Set(); #clientId='bridge-'+randomUUID(); #status=initialStatus(); #peer; #child; #operation; #disposed=false; #stop; #disposePromise;
  constructor({appPath,workspacePath,inspect=inspectInstallation,spawnProcess=spawn,onStatus=()=>{}}={}){this.appPath=appPath;this.workspacePath=workspacePath;this.inspect=inspect;this.spawnProcess=spawnProcess;this.onStatus=onStatus}
  get status(){return structuredClone(this.#status)}
  /** Read official catalog facts only. An address query never activates a Session. */
  async listSessions({address,signal}={}){
    const peer=this.#peer,status=this.status;
    if(this.#disposed||!status.connected||!peer||peer.closed)throw new BridgeError('source-unavailable');
    if(address!==undefined&&(!address||address.runtime!=='zcode'||address.authority!==status.sessionAuthority||address.workspace!==status.workspacePath||typeof address.sessionId!=='string'||!address.sessionId))throw new BridgeError('source-address-mismatch');
    const result=await peer.request('session/list',{
      workspace:{workspacePath:status.workspacePath,workspaceKey:status.workspacePath},
      ...(address?{sessionIds:[address.sessionId]}:{}),
    },{signal});
    if(this.#disposed||peer!==this.#peer||peer.closed||!this.#status.connected)throw new BridgeError('source-unavailable');
    if(!result||!Array.isArray(result.sessions))throw new BridgeError('sessions-invalid');
    const sessions=result.sessions.map(session=>{
      if(!session||typeof session.sessionId!=='string'||!session.sessionId||typeof session.title!=='string'||session.workspace?.workspacePath!==status.workspacePath||session.workspace?.workspaceKey!==status.workspacePath||typeof session.status!=='string'||(address&&session.sessionId!==address.sessionId))throw new BridgeError('sessions-invalid');
      return {address:{runtime:'zcode',authority:status.sessionAuthority,workspace:status.workspacePath,sessionId:session.sessionId},title:session.title,cwd:session.workspace.workspacePath,running:undefined};
    });
    return {sessions,scope:{authority:status.sessionAuthority,workspace:status.workspacePath},availability:{state:status.state,reason:status.reason,capabilities:{create:false,open:false,nativeAgent:false}}};
  }
  /** Scoped API for S03.B. Read projection is permitted; restricted runtime never admits actions. */
  createConversation(address,{onChange=()=>{}}={}){
    const status=this.status;
    if(this.#disposed||!status.connected||!this.#peer||this.#peer.closed)throw new BridgeError('source-unavailable');
    if(!address||address.runtime!=='zcode'||address.authority!==status.sessionAuthority||address.workspace!==status.workspacePath||typeof address.sessionId!=='string'||!address.sessionId)throw new BridgeError('source-address-mismatch');
    const conversation=new V4Conversation(this.#peer,{address,workspace:{workspacePath:status.workspacePath,workspaceKey:status.workspacePath},connectionId:status.sessionAuthority,clientId:this.#clientId,runnable:status.state==='available',onChange:state=>{if(state.status==='closed')this.#conversations.delete(conversation);onChange(state)}});
    this.#conversations.add(conversation);return conversation;
  }
  #publish(change){this.#status={...this.#status,...change};this.onStatus(this.status)}
  connect(){
    if(this.#disposed)return Promise.reject(new BridgeError('disposed'));
    if(this.#operation)return this.#operation;
    if(this.#peer&&!this.#peer.closed)return Promise.resolve(this.status);
    this.#operation=this.#connect().finally(()=>{this.#operation=undefined});return this.#operation;
  }
  async #connect(){
    let peer,stop,terminalReason;
    this.#status=initialStatus();this.#publish({state:'restricted',reason:'connecting',connected:false,auth:'unconfirmed'});
    try{
      const installation=await this.inspect(this.appPath);
      if(this.#disposed)throw new BridgeError('disposed');
      if(!this.workspacePath)throw new BridgeError('workspace-required');
      let workspacePath;try{workspacePath=await realpath(this.workspacePath)}catch{throw new BridgeError('workspace-missing')}
      if(this.#disposed)throw new BridgeError('disposed');
      this.#publish({installation,workspacePath,sessionAuthority:'official-headless:'+randomUUID()});
      const child=this.spawnProcess(installation.launcher,[installation.cjs,'app-server','--stdio'],{cwd:workspacePath,env:runtimeEnv(installation.providerConfig),stdio:['pipe','pipe','pipe']});
      this.#child=child;
      const exited=new Promise(resolve=>child.once('close',resolve));
      let stopping;stop=this.#stop=()=>stopping??=stopOwned(child,exited);
      let stderrBytes=0;child.stderr.on('data',b=>{stderrBytes+=b.length}); // never collect raw diagnostics/credentials
      child.once('error',()=>{peer?.close('launch-failed')});
      peer=this.#peer=new ProtocolPeer(child.stdout,child.stdin,{
        onAuthUnavailable:()=>this.#publish({state:'restricted',reason:'official-auth-source-missing',auth:'unavailable'}),
        onClose:reason=>{terminalReason=reason;this.#publish({state:'unavailable',reason,connected:false});void stop()},
      });
      const capabilities=await peer.request('runtime/capabilities',{});
      if(!capabilities||typeof capabilities.independentPlanState!=='boolean')throw new BridgeError('capabilities-invalid');
      const workspace={workspacePath,workspaceKey:workspacePath};
      const list=await peer.request('session/list',{workspace,limit:5});
      if(!list||!Array.isArray(list.sessions))throw new BridgeError('sessions-invalid');
      if(this.#disposed)throw new BridgeError('disposed');
      // A later frame in the same stdout batch may have closed this peer
      // after fulfilling the response but before this continuation resumed.
      if(peer.closed){await stop();return this.status}
      this.#publish({state:'restricted',reason:installation.verified?'official-auth-source-missing':'runtime-unverified',connected:true,auth:'unavailable',authority:'official-cli-default-storage',sharedSessions:'unverified',pid:child.pid,capabilities,sessionCount:list.sessions.length,roundTrip:{method:'session/list',response:'validated',at:new Date().toISOString()},stderrBytes});
      return this.status;
    }catch(e){
      const reason=terminalReason??(e instanceof BridgeError?e.code:'launch-failed');
      peer?.close(reason);await stop?.();
      this.#publish({state:'unavailable',reason:this.#disposed?'disposed':reason,connected:false});
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
