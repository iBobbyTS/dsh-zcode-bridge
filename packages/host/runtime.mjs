import { WORKFLOW_COMMANDS, WORKFLOW_MANAGEMENT_WRITES } from './workflow.mjs';
import { HostTools } from './host-tools.mjs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { inspectInstallation, runtimeEnv, BridgeError } from './installation.mjs';
import { V4Conversation, INPUT_COMMANDS, MANAGEMENT_COMMANDS, HISTORY_COMMANDS, WORK_COMMANDS } from './conversation.mjs';
import { CatalogClient } from './catalog.mjs';
import { InsightsClient } from './insights.mjs';
import { AutomationClient, OFF_PEAK_ENTITLEMENT_REASON } from './automation.mjs';
import { ProtocolPeer } from './protocol.mjs';
import { AppServerPool } from './app-server-pool.mjs';
import { remoteState } from './remote.mjs';
import { FailSafeState, commandAllowed, SAFE_OPERATIONS } from './fail-safe.mjs';
import { compatibilityProjection } from './compatibility.mjs';
import {INTERACTION_COMMANDS,validateHookReview,validateInteractionRoute} from '../driver/hook-review.mjs';
export const initialStatus=()=>({state:'unavailable',reason:'not-connected',auth:'unconfirmed',connected:false});
/** Owns only children it launches; there is no attach or shared-process killer. */
export class BridgeHost {
  #conversations=new Set(); #handles=new Map(); #deleted=new Set(); #clientId='bridge-'+randomUUID(); #status=initialStatus(); #peer; #catalog; #insights; #automation; #hostTools; #operation; #disposed=false; #stop; #disposePromise; #failSafe=new FailSafeState();
  constructor({appPath,workspacePath,defaultWorkspace,inspect=inspectInstallation,spawnProcess=spawn,catalogLimit=4096,onStatus=()=>{},authorityMode='restricted-cli',launcher}={}){if(!Number.isSafeInteger(catalogLimit)||catalogLimit<50||catalogLimit>65536)throw new BridgeError('catalog-limit-invalid');if(!['restricted-cli','host-backed','self-managed'].includes(authorityMode))throw new BridgeError('authority-mode-invalid');this.authorityMode=authorityMode;this.launcher=launcher;this.catalogLimit=catalogLimit;this.appPath=appPath;this.workspacePath=workspacePath;this.defaultWorkspace=defaultWorkspace;this.inspect=inspect;this.spawnProcess=spawnProcess;this.onStatus=onStatus}
  /** Adds the per-connection fail-safe grade and the version-compatibility truth table.
   *  Both are derived facts: the fail-safe never persists, and the compatibility record is the
   *  bridge's own verified-version constant, never a ZCode source-derived claim. */
  get status(){const {pool,...snapshot}=this.#status;const status=structuredClone(snapshot);if(pool)status.pool=pool;status.failSafe=this.#failSafe.state;status.compatibility=compatibilityProjection(this.#status.installation??null);return status}
  /** Read official catalog facts only. An address query never activates a Session. */
  async listSessions(options={}){
    try{return await this.#listSessions(options)}catch(error){this.#observeFailure(error);throw error}
  }
  /** #listSessions body; the public wrapper records any failure code (a core sessions-invalid
   *  projection must stop new side effects, not only close the peer). */
  async #listSessions({address,signal}={}){
    if(this.authorityMode==='host-backed')return this.#hostCatalog(address,signal);
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
    if(address&&sessions.length===0){const catalog=await this.#listSessions({signal});return {...catalog,sessions:catalog.sessions.filter(row=>row.address.sessionId===address.sessionId)}}
    const visible=sessions.filter(row=>!this.#deleted.has(row.address.sessionId));
    return {sessions:visible,catalog:{complete:!truncated,truncated,limit,deleted:[...this.#deleted],sharedGui:'unverified',authorityKind:'owned-headless',lifetime:'process'},management:{rename:status.installation?.verified===true,delete:status.installation?.verified===true,archive:false,pin:false,reason:'archive-pin-carrier-unverified',renameCas:false,deleteSemantics:'official-runtime-removal'},scope:{authority:status.sessionAuthority,workspace:status.workspacePath},availability:{state:status.state,reason:status.reason,capabilities:{create:false,open:false,nativeAgent:false}}};
  }
  async #hostCatalog(address,signal){
    const state=this.status;
    if(this.#disposed||!state.connected)throw new BridgeError('source-unavailable');
    if(address&&(address.runtime!=='zcode'||address.authority!==state.sessionAuthority||typeof address.workspace!=='string'||typeof address.sessionId!=='string'))throw new BridgeError('source-address-mismatch');
    const {tasks,observedAt}=await this.launcher.read('catalog',{signal});
    const visible=tasks.filter(t=>t.deleted!==true&&(!address||(t.taskId===address.sessionId&&t.workspacePath===address.workspace)));
    const sessions=visible.map(t=>({address:{runtime:'zcode',authority:state.sessionAuthority,workspace:t.workspacePath,sessionId:t.taskId},title:t.title,cwd:t.workspacePath,running:undefined,sharedTask:{status:t.status,createdAt:t.createdAt,lastActivityAt:t.updatedAt,pinned:t.pinned===true,archived:t.archived===true,titleSource:t.titleOverridden===true?'custom':['custom','default','generated','first_input'].includes(t.titleSource)?t.titleSource:'unknown',cronAutomationId:t.cronAutomationId,offPeakTaskId:t.offPeakTaskId,observedAt}}));
    return {sessions,catalog:{complete:true,truncated:false,limit:tasks.length,deleted:[],sharedGui:'shared-task-store',authorityKind:'official-host-channel',lifetime:'official',readOnly:true,multiWorkspace:true},management:{rename:false,delete:false,archive:false,pin:false,reason:'read-only-official-host'},scope:{authority:state.sessionAuthority,workspace:'official-task-catalog'},availability:{state:'restricted',reason:'live-http-read-only-zero-model-requests',capabilities:{create:false,open:false,nativeAgent:false}}};
  }
  async sharedWritePreflight(address,{signal}={}){
    if(this.authorityMode!=='host-backed'||!this.status.connected)throw new BridgeError('source-unavailable');
    await this.#hostCatalog(address,signal);
    return this.launcher.read('preflight',{address,signal});
  }
  /** Per-session official usage readback for the minimal turn accounting; read-only and address-checked. */
  async taskUsage(address,{signal}={}){
    if(this.authorityMode!=='host-backed')throw new BridgeError('source-unavailable');
    const state=this.status;
    if(!state.connected||!address||address.runtime!=='zcode'||address.authority!==state.sessionAuthority||typeof address.workspace!=='string'||!address.workspace||typeof address.sessionId!=='string'||!address.sessionId)throw new BridgeError('source-address-mismatch');
    return this.launcher.read('taskUsage',{address,signal});
  }
  /** Minimal turn: one bridge-owned model turn. Main owns the single-shot claim and the prompt; the caller
   *  supplies no address, prompt, model or session id, so no foreign session can be targeted. */
  async runMinimalTurn({signal}={}){
    if(this.authorityMode!=='host-backed'||!this.status.connected)throw new BridgeError('source-unavailable');
    const result=await this.launcher.read('sendMinimalTask',{signal});
    const state=this.status;
    return {...result,address:{runtime:'zcode',authority:state.sessionAuthority,workspace:result.workspacePath,sessionId:result.taskId}};
  }
  /** Scoped API for live session. Read projection is permitted; restricted runtime never admits actions. */
  createConversation(address,{onChange=()=>{}}={}){
    const status=this.status;
    if(this.#disposed||!status.connected||!this.#peer||this.#peer.closed)throw new BridgeError('source-unavailable');
    if(!address||address.runtime!=='zcode'||address.authority!==status.sessionAuthority||address.workspace!==status.workspacePath||typeof address.sessionId!=='string'||!address.sessionId)throw new BridgeError('source-address-mismatch');
    if(this.#deleted.has(address.sessionId))throw new BridgeError('session-deleted');
    // The publisher replaces by (connectionId, topic); each downstream owner needs its own stable slot.
    const connectionId=status.sessionAuthority+':'+randomUUID();
    const conversation=new V4Conversation(this.#peer,{address,workspace:{workspacePath:status.workspacePath,workspaceKey:status.workspacePath},connectionId,clientId:this.#clientId,runnable:status.state==='available',managementAllowed:status.installation?.verified===true,hostTools:this.#hostTools,onChange:state=>{if(state.status==='error'){const code=typeof state.error==='string'?state.error:state.error?.code;if(code)this.#failSafe.observe(code)}if(state.status==='closed')this.#conversations.delete(conversation);onChange(state)}});
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
  async conversationOperation({handle,operation,command,commandId,kind,preferences,attachment,uploadId,chunkIndex,dataBase64,ref,target,attachmentIndex,offset,limit,baseRevision,baseLogEpoch,endedCursor,endedLimit,workId,params},signal){
    // A core incompatibility stopped new side effects; only the explicit safe whitelist remains.
    if(this.#failSafe.blocksNewSideEffects&&!this.#coreOperationAllowed(operation,command,kind))throw new BridgeError('runtime-incompatible');
    const conversation=this.#handles.get(handle);
    if(!conversation)throw new BridgeError('conversation-handle-invalid');
    if(operation==='release'){this.#handles.delete(handle);await conversation.cancel();return {released:true}}
    if(operation==='state')return conversation.state;
    if(operation==='connect'){await conversation.connect();return conversation.state}
    if(operation==='query'){const result=await conversation.queryCommand(commandId,{signal});await this.#acceptLifecycle(conversation,result);return result}
    if(operation==='historyQuery')return conversation.historyQuery({kind,target,baseRevision,baseLogEpoch},{signal});
    if(operation==='workflowManage')return conversation.workflowManage(kind,params,{signal});
    if(operation==='workflowRead')return conversation.workflowRead(kind,params,{signal});
    if(operation==='sessionUsage')return conversation.sessionUsage({signal});
    if(operation==='hostRegistration')return conversation.hostRegistration({signal});
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
    if(operation!=='command'||!command||!(MANAGEMENT_COMMANDS.has(command.type)||INPUT_COMMANDS.has(command.type)||HISTORY_COMMANDS.has(command.type)||WORK_COMMANDS.has(command.type)||WORKFLOW_COMMANDS.has(command.type)||INTERACTION_COMMANDS.has(command.type)))throw new BridgeError('management-command-unavailable');
    if(HISTORY_COMMANDS.has(command.type)&&command.payload?.target&&(command.baseRevision===undefined||command.baseLogEpoch===undefined))throw new BridgeError('history-target-unconfirmed');
    validateHookReview(conversation,command);
    validateInteractionRoute(conversation,command);
    const result=await conversation.submit(command,{signal});
    await this.#acceptLifecycle(conversation,result);return result;
  }
  /** Official MCP/plugin/skill directory read. Never a second catalog and never an MCP tool call. */
  async catalogRead(kind,params={},{signal}={}){
    try{return await this.#catalogClient().read(kind,params,{signal})}catch(error){this.#observeFailure(error);throw error}
  }
  /** Official management operation. Progress correlates by operationId; official result is authoritative. */
  async catalogOperate(operation,params={},{signal,operationId}={}){
    if(this.#failSafe.blocksNewSideEffects)throw new BridgeError('runtime-incompatible');
    try{return await this.#catalogClient().operate(operation,params,{signal,operationId})}catch(error){this.#observeFailure(error);throw error}
  }
  /** Records an optional-capability failure without letting it stop already-confirmed paths. */
  #observeFailure(error){const code=error?.code??error?.protocolCode;if(code)this.#failSafe.observe(code)}
  /** Whitelist of operations allowed once a core incompatibility stopped new side effects: reads,
   *  ownership release, explicit safe-stop commands, workflow reads, workspace presentation reads and
   *  host registration (a pure plugins/mcp directory read). Every other listed write surface
   *  (attachment staging/commit, workflow-store writes, workspace preference writes) is refused
   *  rather than relying on a peer close. */
  #coreOperationAllowed(operation,command,kind){
    if(operation==='command')return commandAllowed(this.#failSafe.level,command?.type);
    if(SAFE_OPERATIONS.has(operation))return true;
    if(operation==='workflowManage')return !WORKFLOW_MANAGEMENT_WRITES.has(kind);
    if(operation==='workspaceConfig')return kind==='presentation';
    return false;
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
  /** Official account/usage/diagnostic read. Never a second store; account state stays UNKNOWN. */
  async insightsRead(kind,params={},{signal}={}){
    try{return await this.#insightsClient().read(kind,params,{signal})}catch(error){this.#observeFailure(error);throw error}
  }
  /** Bounded projection of account honesty, gated model surfaces and the latest resource sample. */
  insightsState(){
    const client=this.#insights;
    if(client)return client.state();
    const reason=this.#disposed?'disposed':!this.#status.connected?'not-connected':'insights-unavailable';
    const auth=this.#status.auth??'unconfirmed';
    return {account:{state:'unknown',reason,auth,query:{available:false,reason},login:{available:false,reason}},gated:{},resourceSample:null,admission:{allowed:false,reason}};
  }
  #insightsClient(){
    if(this.#disposed)throw new BridgeError('disposed');
    const insights=this.#insights;
    if(!insights||!this.#status.connected||!this.#peer||this.#peer.closed)throw new BridgeError('insights-unavailable');
    return insights;
  }
  /** Automation/Off-Peak honesty projection. Management is a Host-consumed reverse carrier with no
   *  app-server request surface; nothing here is a second task store. */
  automationState(){
    const automation=this.#automation;
    if(automation)return automation.state();
    const reason=this.#disposed?'disposed':!this.#status.connected?'not-connected':'automation-unavailable';
    const auth=this.#status.auth??'unconfirmed';
    return {management:{available:false,reason,carriers:[]},offPeak:{available:false,reason,entitlement:{state:'unknown',reason:OFF_PEAK_ENTITLEMENT_REASON},carriers:[]},runFeedback:{available:false,reason,execution:{state:'gated',reason:'model-execution-gated'}},account:{state:'unknown',reason:'official-account-carrier-not-exposed',auth},reverse:{allowed:false,reason,records:[]},admission:{allowed:false,reason}};
  }
  /** Remote management belongs to the outer Host/server, not this local stdio process. */
  remoteState(){
    const connected=!this.#disposed&&this.#status.connected===true&&this.#peer&&!this.#peer.closed;
    return remoteState({connected:!!connected,authority:this.#status.sessionAuthority,workspace:this.#status.workspacePath,reason:this.#disposed?'disposed':this.#status.reason});
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
    if(this.authorityMode==='self-managed'&&this.pool&&!this.pool.disposed&&this.#status.connected)return Promise.resolve(this.status);
    if(this.#peer&&!this.#peer.closed)return Promise.resolve(this.status);
    this.#operation=this.#connect().finally(()=>{this.#operation=undefined});return this.#operation;
  }
  async #connect(){
    if(this.authorityMode==='self-managed'){
      const pool=this.pool??=new AppServerPool({appPath:this.appPath,inspect:this.inspect,spawnProcess:this.spawnProcess});
      this.#publish({state:'unavailable',reason:'connecting',connected:false,auth:'unavailable'});
      let peer;
      try{
        if(this.defaultWorkspace!==undefined)peer=await pool.acquire(this.defaultWorkspace);
        if(this.#disposed)throw new BridgeError('disposed');
        this.#publish({state:'available',connected:true,auth:'unavailable',reason:'direct-storage',sessionAuthority:'self-managed:'+randomUUID(),workspacePath:peer?.workspacePath??this.defaultWorkspace,pool,authorityMode:'self-managed'});
      }catch(error){this.#publish({state:'unavailable',connected:false,auth:'unavailable',reason:this.#disposed?'disposed':error.code??'launch-failed'})}
      finally{peer?.releaseHold()}
      return this.status;
    }
    if(this.authorityMode==='host-backed'){
      if(!this.launcher){this.#publish({state:'unavailable',reason:'launcher-unconfigured',connected:false});return this.status}
      const project=state=>{if(!this.#disposed)this.#publish({state:state.phase==='ready'?(state.auth==='authenticated'?'authenticated':'restricted'):'unavailable',reason:state.phase==='ready'?(state.auth==='authenticated'?'live-http-authenticated-read-only':'host-execution-disabled-official-host'):state.reason??'launcher-'+state.phase,connected:state.phase==='ready'&&state.auth==='authenticated',sessionAuthority:'official-host:'+state.mainPid,workspacePath:'official-task-catalog',auth:state.auth??'unconfirmed',authority:'official-host-channel',launcher:state,authorityMode:'host-backed'})};
      this.launcherUnsubscribe??=this.launcher.subscribe(project);project(await this.launcher.start());return this.status;
    }
    let peer,stop,terminalReason;
    this.#hostTools?.dispose();this.#hostTools=undefined;this.#catalog?.dispose();this.#catalog=undefined;this.#insights?.dispose();this.#insights=undefined;this.#automation?.dispose();this.#automation=undefined;
    // Fail-safe is per-connection runtime state; a fresh connection attempt starts neutral.
    this.#failSafe.reset();
    this.#deleted.clear();this.#handles.clear();this.#status=initialStatus();this.#publish({state:'restricted',reason:'connecting',connected:false,auth:'unconfirmed'});
    try{
      const installation=await this.inspect(this.appPath);
      if(this.#disposed)throw new BridgeError('disposed');
      if(!this.workspacePath)throw new BridgeError('workspace-required');
      // Never resolve an opaque remote identity against the local filesystem or launch a local
      // runtime for it. Unknown future remote kinds fail closed through the same boundary.
      if(typeof this.workspacePath==='string'&&this.workspacePath.trim().startsWith('remote:'))throw new BridgeError('remote-workspace-unavailable');
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
        onClose:reason=>{terminalReason=reason;this.#failSafe.observe(reason);this.#publish({state:'unavailable',reason,connected:false});void stop()},
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
      this.#insights=new InsightsClient(peer,{auth:'unavailable'});
      this.#automation=new AutomationClient(peer,{auth:'unavailable'});
      this.#hostTools=new HostTools(peer,{workspace,catalog:this.#catalog});
      return this.status;
    }catch(e){
      const reason=terminalReason??(e instanceof BridgeError?e.code:'launch-failed');
      // Grade the terminal failure: a core decode/authority error marks the runtime incompatible,
      // an optional-capability failure is isolated, an unknown code stays neutral.
      this.#failSafe.observe(reason);
      this.#hostTools?.dispose();this.#hostTools=undefined;this.#catalog?.dispose();this.#catalog=undefined;this.#insights?.dispose();this.#insights=undefined;this.#automation?.dispose();this.#automation=undefined;
      peer?.close(reason);await stop?.();
      this.#publish({state:'unavailable',reason:this.#disposed?'disposed':reason,connected:false});
      return this.status;
    }
  }
  /** Driver-mode takeover of the official catalog import. While the zcode driver occupies the
   * factory, IT owns the DSH session list (lazy placeholders + resume-gated backfill); the host
   * mirror directory must not announce its own per-conversation records or shadow them with
   * partial per-row projections. Idempotent: a second call only re-runs the retirement. */
  suspendDirectory(reason){
    if(this.directorySuspended===undefined)this.directorySuspended=reason??true;
    return typeof this.zcodeRuntime?.retireImportedMirrors==='function'?this.zcodeRuntime.retireImportedMirrors():Promise.resolve([]);
  }
  dispose(){
    if(this.#disposePromise)return this.#disposePromise;
    this.#disposed=true;this.#hostTools?.dispose();this.#hostTools=undefined;this.#catalog?.dispose();this.#catalog=undefined;this.#insights?.dispose();this.#insights=undefined;this.#automation?.dispose();this.#automation=undefined;this.#peer?.close('disposed');
    this.launcherUnsubscribe?.();this.launcherUnsubscribe=undefined;
    this.#disposePromise=(async()=>{if(this.authorityMode!=='self-managed')await this.launcher?.dispose();await this.pool?.dispose();await this.#operation;await this.#stop?.();this.#publish({state:'unavailable',reason:'disposed',connected:false})})();return this.#disposePromise;
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
