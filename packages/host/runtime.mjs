import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { inspectInstallation, runtimeEnv, BridgeError } from './installation.mjs';
import { V4Conversation, INPUT_COMMANDS, MANAGEMENT_COMMANDS, HISTORY_COMMANDS, WORK_COMMANDS } from './conversation.mjs';
import { CatalogClient } from './catalog.mjs';
import { ProtocolPeer } from './protocol.mjs';
export const initialStatus=()=>({state:'unavailable',reason:'not-connected',auth:'unconfirmed',connected:false});
/** Owns only children it launches; there is no attach or shared-process killer. */
export class BridgeHost {
  #conversations=new Set(); #handles=new Map(); #deleted=new Set(); #clientId='bridge-'+randomUUID(); #status=initialStatus(); #peer; #catalog; #operation; #disposed=false; #stop; #disposePromise;
  constructor({appPath,workspacePath,inspect=inspectInstallation,spawnProcess=spawn,catalogLimit=4096,onStatus=()=>{}}={}){if(!Number.isSafeInteger(catalogLimit)||catalogLimit<50||catalogLimit>65536)throw new BridgeError('catalog-limit-invalid');this.catalogLimit=catalogLimit;this.appPath=appPath;this.workspacePath=workspacePath;this.inspect=inspect;this.spawnProcess=spawnProcess;this.onStatus=onStatus}
  get status(){return structuredClone(this.#status)}
  /** Read official catalog facts only. An address query never activates a Session. */
  async listSessions({address,signal}={}){
    const peer=this.#peer,status=this.status;
    if(this.#disposed||!status.connected||!peer||peer.closed)throw new BridgeError('source-unavailable');
    if(address!==undefined&&(!address||address.runtime!=='zcode'||address.authority!==status.sessionAuthority||address.workspace!==status.workspacePath||typeof address.sessionId!=='string'||!address.sessionId))throw new BridgeError('source-address-mismatch');
    // Official carrier has only limit (default 50), no offset/cursor/search. Grow the
    // prefix explicitly; never advertise a saturated bounded prefix as a complete catalog.
    let result,limit=address?1:50,truncated=false;
    do{
      result=await peer.request('session/list',{
        workspace:{workspacePath:status.workspacePath,workspaceKey:status.workspacePath},
        ...(address?{sessionIds:[address.sessionId]}:{limit}),
      },{signal});
      if(!result||!Array.isArray(result.sessions))throw new BridgeError('sessions-invalid');
      if(address||result.sessions.length<limit)break;
      if(limit===this.catalogLimit){truncated=true;break}
      limit=Math.min(this.catalogLimit,limit*2);
    }while(limit<=this.catalogLimit);
    if(this.#disposed||peer!==this.#peer||peer.closed||!this.#status.connected)throw new BridgeError('source-unavailable');
    if(!result||!Array.isArray(result.sessions))throw new BridgeError('sessions-invalid');
    const sessions=result.sessions.map(session=>{
      if(!session||typeof session.sessionId!=='string'||!session.sessionId||typeof session.title!=='string'||session.workspace?.workspacePath!==status.workspacePath||session.workspace?.workspaceKey!==status.workspacePath||typeof session.status!=='string'||(address&&session.sessionId!==address.sessionId))throw new BridgeError('sessions-invalid');
      return {address:{runtime:'zcode',authority:status.sessionAuthority,workspace:status.workspacePath,sessionId:session.sessionId},title:session.title,cwd:session.workspace.workspacePath,running:undefined};
    });
    if(new Set(sessions.map(row=>row.address.sessionId)).size!==sessions.length)throw new BridgeError('sessions-invalid');
    if(address&&sessions.length===0){const catalog=await this.listSessions({signal});return {...catalog,sessions:catalog.sessions.filter(row=>row.address.sessionId===address.sessionId)}}
    const visible=sessions.filter(row=>!this.#deleted.has(row.address.sessionId));
    return {sessions:visible,catalog:{complete:!truncated,truncated,limit,deleted:[...this.#deleted],sharedGui:'unverified',authorityKind:'owned-headless',lifetime:'process'},management:{rename:status.installation?.verified===true,delete:status.installation?.verified===true,archive:false,pin:false,reason:'archive-pin-carrier-unverified',renameCas:false,deleteSemantics:'official-runtime-removal'},scope:{authority:status.sessionAuthority,workspace:status.workspacePath},availability:{state:status.state,reason:status.reason,capabilities:{create:false,open:false,nativeAgent:false}}};
  }
  /** Scoped API for S03.B. Read projection is permitted; restricted runtime never admits actions. */
  createConversation(address,{onChange=()=>{}}={}){
    const status=this.status;
    if(this.#disposed||!status.connected||!this.#peer||this.#peer.closed)throw new BridgeError('source-unavailable');
    if(!address||address.runtime!=='zcode'||address.authority!==status.sessionAuthority||address.workspace!==status.workspacePath||typeof address.sessionId!=='string'||!address.sessionId)throw new BridgeError('source-address-mismatch');
    if(this.#deleted.has(address.sessionId))throw new BridgeError('session-deleted');
    // The publisher replaces by (connectionId, topic); each downstream owner needs its own stable slot.
    const connectionId=status.sessionAuthority+':'+randomUUID();
    const conversation=new V4Conversation(this.#peer,{address,workspace:{workspacePath:status.workspacePath,workspaceKey:status.workspacePath},connectionId,clientId:this.#clientId,runnable:status.state==='available',managementAllowed:status.installation?.verified===true,onChange:state=>{if(state.status==='closed')this.#conversations.delete(conversation);onChange(state)}});
    this.#conversations.add(conversation);return conversation;
  }
  /** Opaque per-view ownership; no runtime/command capability is accepted from UI. */
  async openConversation(address,{signal}={}){
    if(signal?.aborted)throw new BridgeError('cancelled');
    if(this.#handles.size>=64)throw new BridgeError('conversation-limit');
    const conversation=this.createConversation(address),handle=randomUUID();
    this.#handles.set(handle,conversation);
    const abort=()=>{this.#handles.delete(handle);void conversation.cancel()};signal?.addEventListener('abort',abort,{once:true});
    try{await conversation.connect();if(signal?.aborted)throw new BridgeError('cancelled');return {handle,state:conversation.state}}
    catch(error){this.#handles.delete(handle);await conversation.cancel();throw error}
    finally{signal?.removeEventListener('abort',abort)}
  }
  async conversationOperation({handle,operation,command,commandId,kind,preferences,attachment,uploadId,chunkIndex,dataBase64,ref,target,attachmentIndex,offset,limit,baseRevision,baseLogEpoch,endedCursor,endedLimit,workId},signal){
    const conversation=this.#handles.get(handle);
    if(!conversation)throw new BridgeError('conversation-handle-invalid');
    if(operation==='release'){this.#handles.delete(handle);await conversation.cancel();return {released:true}}
    if(operation==='state')return conversation.state;
    if(operation==='connect'){await conversation.connect();return conversation.state}
    if(operation==='query'){const result=await conversation.queryCommand(commandId,{signal});await this.#acceptLifecycle(conversation,result);return result}
    if(operation==='historyQuery')return conversation.historyQuery({kind,target,baseRevision,baseLogEpoch},{signal});
    if(operation==='subagents')return conversation.listSubagents({endedCursor,endedLimit},{signal});
    if(operation==='backgroundOutput')return conversation.readBackgroundBashOutput({workId},{signal});
    if(operation==='workspaceConfig')return conversation.workspaceConfiguration(kind,preferences,{signal});
    if(operation==='attachmentStart')return conversation.attachmentStart(attachment??{});
    if(operation==='attachmentChunk')return conversation.attachmentChunk({uploadId,chunkIndex,dataBase64});
    if(operation==='attachmentCommit')return conversation.attachmentCommit({uploadId});
    if(operation==='attachmentAbort')return conversation.attachmentAbort({uploadId});
    if(operation==='attachmentRead')return conversation.attachmentRead({ref,target,attachmentIndex,offset,limit,signal});
    if(operation==='conversationAttachmentStat')return conversation.conversationAttachmentStat({ref,target,attachmentIndex,signal});
    if(operation==='conversationAttachmentRead')return conversation.conversationAttachmentRead({ref,target,attachmentIndex,offset,limit,signal});
    if(operation!=='command'||!command||!(MANAGEMENT_COMMANDS.has(command.type)||INPUT_COMMANDS.has(command.type)||HISTORY_COMMANDS.has(command.type)||WORK_COMMANDS.has(command.type)))throw new BridgeError('management-command-unavailable');
    if(HISTORY_COMMANDS.has(command.type)&&command.payload?.target&&(command.baseRevision===undefined||command.baseLogEpoch===undefined))throw new BridgeError('history-target-unconfirmed');
    const result=await conversation.submit(command,{signal});
    await this.#acceptLifecycle(conversation,result);return result;
  }
  /** Official MCP/plugin/skill directory read. Never a second catalog and never an MCP tool call. */
  async catalogRead(kind,params={},{signal}={}){
    return this.#catalogClient().read(kind,params,{signal});
  }
  /** Official management operation. Progress correlates by operationId; official result is authoritative. */
  async catalogOperate(operation,params={},{signal,operationId}={}){
    return this.#catalogClient().operate(operation,params,{signal,operationId});
  }
  /** Bounded view of admission and in-flight operations. No official catalog is cached here. */
  catalogState(){
    const catalog=this.#catalog;
    const reason=this.#disposed?'disposed':!this.#status.connected?'not-connected':'catalog-unavailable';
    return {admission:catalog?catalog.admission:{reads:{allowed:false,reason},writes:{allowed:false,reason}},operations:catalog?catalog.operations:[],workspace:this.#status.workspacePath??null,installationVerified:this.#status.installation?.verified===true,auth:this.#status.auth??'unconfirmed'};
  }
  #catalogClient(){
    if(this.#disposed)throw new BridgeError('disposed');
    const catalog=this.#catalog;
    if(!catalog||!this.#status.connected||!this.#peer||this.#peer.closed)throw new BridgeError('catalog-unavailable');
    return catalog;
  }
  async #acceptLifecycle(conversation,result){
    // Accepted deletion is an official decision, including a later query of a
    // lost ACK. Fence all owners before cleanup; never resend the command.
    if(result.type==='deleteSession'&&['accepted','duplicate'].includes(result.ack?.status)){
      this.#deleted.add(conversation.address.sessionId);
      await Promise.allSettled([...this.#conversations].filter(c=>c.address.sessionId===conversation.address.sessionId).map(c=>c.cancel({reason:'session-deleted'})));
    }
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
    this.#catalog?.dispose();this.#catalog=undefined;
    this.#deleted.clear();this.#handles.clear();this.#status=initialStatus();this.#publish({state:'restricted',reason:'connecting',connected:false,auth:'unconfirmed'});
    try{
      const installation=await this.inspect(this.appPath);
      if(this.#disposed)throw new BridgeError('disposed');
      if(!this.workspacePath)throw new BridgeError('workspace-required');
      let workspacePath;try{workspacePath=await realpath(this.workspacePath)}catch{throw new BridgeError('workspace-missing')}
      if(this.#disposed)throw new BridgeError('disposed');
      this.#publish({installation,workspacePath,sessionAuthority:'official-headless:'+randomUUID()});
      const child=this.spawnProcess(installation.launcher,[installation.cjs,'app-server','--stdio'],{cwd:workspacePath,env:runtimeEnv(installation.providerConfig),stdio:['pipe','pipe','pipe']});
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
      this.#catalog=new CatalogClient(peer,{workspace:{workspacePath,workspaceKey:workspacePath},managementAllowed:installation.verified===true});
      return this.status;
    }catch(e){
      const reason=terminalReason??(e instanceof BridgeError?e.code:'launch-failed');
      this.#catalog?.dispose();this.#catalog=undefined;
      peer?.close(reason);await stop?.();
      this.#publish({state:'unavailable',reason:this.#disposed?'disposed':reason,connected:false});
      return this.status;
    }
  }
  dispose(){
    if(this.#disposePromise)return this.#disposePromise;
    this.#disposed=true;this.#catalog?.dispose();this.#catalog=undefined;this.#peer?.close('disposed');
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
