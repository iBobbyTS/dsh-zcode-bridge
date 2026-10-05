import { requestWorkflow, WORKFLOW_MANAGEMENT_WRITES, WORKFLOW_COMMANDS, WORKFLOW_LIMITATIONS } from './workflow.mjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { BridgeError } from './installation.mjs';
import { uploadAttachmentTransaction, encodeBase64 } from './attachment.mjs';
import {
  parseCommandEnvelope, commandAckSchema, commandsQueryResultSchema,
  COMMANDS_REQUIRING_BASE_REVISION, ROW_TARGETING_COMMANDS,
  conversationTopicFrameSchema, conversationTopicWireCandidateSchema,
  v4ConversationSubscribeParamsSchema, v4ConversationSubscribeResultSchema,
  v4ConversationResyncParamsSchema, v4ConversationResyncResultSchema,
  v4ConversationUnsubscribeParamsSchema, TopicWireFrameAssembler, applyConversationDeltas,
  helloMessageSchema, clientHelloSchema,
  PROTOCOL_V4_LIMITS,
  v4AttachmentBeginParamsSchema, v4AttachmentBeginResultSchema,
  v4AttachmentChunkParamsSchema, v4AttachmentChunkResultSchema,
  v4AttachmentCommitParamsSchema, v4AttachmentCommitResultSchema,
  v4AttachmentAbortParamsSchema, v4AttachmentAbortResultSchema,
  v4AttachmentReadParamsSchema, v4AttachmentReadResultSchema,
  v4ConversationAttachmentReadParamsSchema, v4ConversationAttachmentReadResultSchema,
  v4ConversationAttachmentStatParamsSchema, v4ConversationAttachmentStatResultSchema,
  sharedContextRefSchema,
  v4ConversationFileChangesParamsSchema, v4ConversationFileChangesResultSchema,
  v4ConversationFileRewindPreviewParamsSchema, v4ConversationFileRewindPreviewResultSchema,
  zcodeWorkspaceUpdateInteractionPreferencesParamsSchema, zcodeWorkspaceUpdateInteractionPreferencesResultSchema,
  zcodeWorkspaceUpdateModelIoPreferencesParamsSchema, zcodeWorkspaceUpdateModelIoPreferencesResultSchema,
  zcodeWorkspaceReadPresentationParamsSchema, zcodeWorkspacePresentationSchema,
  zcodeSessionSubagentsParamsSchema, zcodeSessionSubagentsResultSchema,
  v4BackgroundBashOutputParamsSchema, backgroundBashOutputResultSchema,
  zcodeTaskTokenUsageParamsSchema, zcodeTaskTokenUsageResultSchema,
} from './vendor/zcode/v4.mjs';
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const int=x=>Number.isSafeInteger(x)&&x>=0;
export const MANAGEMENT_COMMANDS=new Set(['renameSession','deleteSession','discardSharedContext']);
// Background/subagent work mutation. The official command carries the workId only; the identity is
// bound to this conversation's sessionId by the envelope, so a workId from another session cannot be
// addressed. Expired/unknown ids are NOT filtered locally: the official ACK is authoritative and
// returns fault.command.backgroundWorkCancelRejected.<reason> (observed: not_found).
export const WORK_COMMANDS=new Set(['cancelBackgroundWork']);
export const HISTORY_COMMANDS=new Set(['forkAssistant','createSelectionSideSession','editUserQuery','retryTurn','applyFileRewind','setAssistantFeedback','compact']);
const historyResources=new Set(['forkAssistant','createSelectionSideSession','applyFileRewind','setAssistantFeedback']);
const historyActions={forkAssistant:'canFork',editUserQuery:'canEdit',retryTurn:'canRetry',applyFileRewind:'canRewindFiles'};
const managementCommands=MANAGEMENT_COMMANDS;
const availabilityCommands={editQueueItem:'queueEdit',reorderQueueItem:'queueEdit',deleteQueueItem:'queueEdit',sendQueuedNow:'sendQueuedNow',switchModelConfig:'switchModelConfig',setFollowupMode:'setFollowupMode',pauseGoal:'pauseGoal',resumeGoal:'resumeGoal',compact:'compact'};
const terminal=new Set(['completed','failed','interrupted','rejected','stale','noop','not-sent']);
export const INPUT_COMMANDS=new Set(['sendText','sendGoalCommand','stop','sendQueuedNow','editQueueItem','reorderQueueItem','deleteQueueItem','setAutoDrain','switchModelConfig','switchCollaborationMode','setFollowupMode','pauseGoal','resumeGoal']);
const workspaceCarriers={
  presentation:['workspace/readPresentation',zcodeWorkspaceReadPresentationParamsSchema,zcodeWorkspacePresentationSchema],
  interaction:['workspace/updateInteractionPreferences',zcodeWorkspaceUpdateInteractionPreferencesParamsSchema,zcodeWorkspaceUpdateInteractionPreferencesResultSchema],
  modelIo:['workspace/updateModelIoPreferences',zcodeWorkspaceUpdateModelIoPreferencesParamsSchema,zcodeWorkspaceUpdateModelIoPreferencesResultSchema],
};
/** RFC 9562 UUIDv7; retries/query use the stored id, never this generator again. */
export function newCommandId(){
  const b=randomBytes(16);b.writeUIntBE(Date.now(),0,6);b[6]=(b[6]&15)|0x70;b[8]=(b[8]&63)|0x80;
  const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
/** Host-only handshake helper. CLI callers cannot infer these bits from runtime/capabilities. */
export function negotiatedClientHello(hostHello,{clientId,appVersion,workspaceHookReviewUi=false}={}){
  const hello=helloMessageSchema.parse(hostHello);
  const capabilities={};
  if(hello.capabilities.workspaceHookReview===true&&workspaceHookReviewUi)capabilities.workspaceHookReviewUi=true;
  if(hello.capabilities.workflowRunDeltas===true)capabilities.workflowRunDeltas=true;
  return clientHelloSchema.parse({kind:'clientHello',protocolVersion:3,clientId,appVersion,clientKind:hello.clientMode==='desktop-continuous'?'desktop':'web',...(Object.keys(capabilities).length?{capabilities}:{})});
}
/** One immutable authority/workspace/session/profile owner. No UI endpoint or runtime availability claim. */
export class V4Conversation {
  #state={status:'idle',snapshot:null,subscriptionId:null,logEpoch:null,error:null,gap:null,cleanupError:null};
  #assembler; #offHostTools; #offNotification; #offClosed; #connect; #resync; #generation=0; #closed=false;
  #observerErrors=0; #flight; #resyncAgain=null; #appliedBase=false; #orphans=[]; #frameTimer; #assemblyTimer; #commands=new Map(); #commandControllers=new Map(); #cancelPromise; #listeners=new Set();
  #uploads=new Map(); #committedUploads=new Map(); #attachmentRefs=new Map();
  constructor(peer,{address,workspace,connectionId,clientId,clientMode='web-remote-replayable',runnable=false,managementAllowed=false,hostTools,onChange=()=>{},frameTimeoutMs=10000,assemblyOptions={},maxCommands=128,reconnectable=false}={}){
    if(!workspace||!address||address.runtime!=='zcode'||!nonempty(address.authority)||!nonempty(address.sessionId)||address.workspace!==workspace?.workspacePath||workspace.workspaceKey!==workspace.workspacePath||!nonempty(workspace?.workspacePath)||!nonempty(connectionId)||!nonempty(clientId)||typeof runnable!=='boolean'||typeof managementAllowed!=='boolean'||!['desktop-continuous','web-remote-replayable'].includes(clientMode)||!int(frameTimeoutMs)||frameTimeoutMs===0||!int(maxCommands)||maxCommands===0)throw new BridgeError('conversation-context-invalid');
    Object.assign(this,{peer,address:structuredClone(address),workspace:structuredClone(workspace),connectionId,clientId,clientMode,runnable,managementAllowed,onChange,frameTimeoutMs,maxCommands});
    // Caller objects cannot mutate the owned routing context after admission.
    Object.freeze(this.address);Object.freeze(this.workspace);
    for(const key of ['peer','address','workspace','connectionId','clientId','clientMode','runnable','managementAllowed','frameTimeoutMs','maxCommands'])Object.defineProperty(this,key,{writable:false});
    this.hostTools=hostTools;
    this.#offHostTools=hostTools?.subscribe(()=>{if(!this.#closed)this.#publish()});
    this.topic='conversation/'+address.sessionId;
    Object.defineProperty(this,'topic',{writable:false});
    this.#assembler=new TopicWireFrameAssembler(conversationTopicFrameSchema,assemblyOptions);
    this.#offNotification=peer.onNotification(m=>{if(m.method==='v4/conversation/frame')this.#wire(m.params)});
    this.#offClosed=peer.onClosed(code=>reconnectable?this.#transportLost(code):this.#disconnect(code));
  }
  get state(){return structuredClone({...this.#state,commands:[...this.#commands.values()],observerErrors:this.#observerErrors,profile:this.clientMode==='desktop-continuous'?'continuous':'replayable',admission:this.admission,managementAdmission:this.managementAdmission,attachmentAdmission:this.attachmentAdmission,workAdmission:this.workAdmission,workflowAdmission:{reads:this.workAdmission,writes:this.managementAdmission,...WORKFLOW_LIMITATIONS},...(this.hostTools?{hostTools:this.hostTools.snapshot(this.address.sessionId)}:{})})}
  get admission(){return {allowed:!this.#closed&&this.runnable&&this.#state.status==='live'&&!!this.#state.snapshot,reason:this.#closed?'closed':!this.runnable?'runtime-restricted':this.#state.status!=='live'?'projection-unconfirmed':null}}
  get managementAdmission(){return {allowed:!this.#closed&&this.managementAllowed&&this.#state.status==='live'&&!!this.#state.snapshot,reason:this.#closed?'closed':!this.managementAllowed?'management-unverified':this.#state.status!=='live'?'projection-unconfirmed':null}}
  /** Attachment resource calls follow the official session-scoped wire, not model admission. */
  get attachmentAdmission(){return {allowed:!this.#closed&&this.#state.status==='live'&&!!this.#state.snapshot,reason:this.#closed?'closed':this.#state.status!=='live'?'projection-unconfirmed':null}}
  /** Observing/cancelling already-running background work and subagents follows the session projection,
   *  not the model-execution admission: a restricted runtime with no new model admission can still carry
   *  real background work, and the official carrier rejects unsupported/expired targets itself. */
  get workAdmission(){return {allowed:!this.#closed&&this.#state.status==='live'&&!!this.#state.snapshot,reason:this.#closed?'closed':this.#state.status!=='live'?'projection-unconfirmed':null}}
  async workflowManage(kind,params={}, {signal}={}){
    const writes=WORKFLOW_MANAGEMENT_WRITES.has(kind),admission=writes?this.managementAdmission:this.workAdmission;
    if(!admission.allowed)throw new BridgeError(admission.reason);
    const generation=this.#generation;
    const result=await requestWorkflow(this.peer,{kind,params,workspace:this.workspace,management:true},{signal});
    if(this.#closed||generation!==this.#generation||!this.workAdmission.allowed)throw new BridgeError(writes?'workflow-outcome-unknown':'workflow-owner-replaced');
    return result;
  }
  async workflowRead(kind,params={}, {signal}={}){
    if(!this.workAdmission.allowed)throw new BridgeError(this.workAdmission.reason);
    const generation=this.#generation;
    const result=await requestWorkflow(this.peer,{kind,params,sessionId:this.address.sessionId},{signal});
    if(this.#closed||generation!==this.#generation||!this.workAdmission.allowed)throw new BridgeError('workflow-owner-replaced');
    return result;
  }
  async hostRegistration({signal}={}){
    if(!this.workAdmission.allowed)throw new BridgeError(this.workAdmission.reason);
    if(!this.hostTools)throw new BridgeError('host-unavailable');
    return this.hostTools.registration({signal});
  }
  get assemblyStats(){return this.#assembler.getStats()}
  get listenerCount(){return this.#listeners.size}
  subscribe(listener){if(this.#closed)return ()=>{};this.#listeners.add(listener);return ()=>this.#listeners.delete(listener)}
  #publish(change={}){
    this.#state={...this.#state,...change};
    try{this.onChange(this.state)}catch{this.#observerErrors=Math.min(Number.MAX_SAFE_INTEGER,this.#observerErrors+1)}
    for(const listener of this.#listeners){try{listener(this.state)}catch{this.#observerErrors=Math.min(Number.MAX_SAFE_INTEGER,this.#observerErrors+1)}}
  }
  #base(){const s=this.#state.snapshot;return s&&this.#appliedBase&&s.logEpoch===this.#state.logEpoch?{logEpoch:s.logEpoch,seq:s.seq}:null}
  #deadline(flight){
    // ACK observers can synchronously end or replace a flight; deadlines belong to that flight only.
    if(this.#closed||this.#state.status==='error'||this.#flight!==flight)return;
    clearTimeout(this.#frameTimer);
    this.#frameTimer=setTimeout(()=>{if(this.#closed||this.#state.status==='error'||this.#flight!==flight)return;if(flight.kind==='recovery')this.#fail('recovery-frame-timeout');else void this.resync({forceSnapshot:true})},this.frameTimeoutMs);
  }
  connect({forceSnapshot=false}={}){
    if(this.#closed)return Promise.reject(new BridgeError('conversation-closed'));
    if(this.#connect)return this.#connect;
    const generation=++this.#generation,base=forceSnapshot?null:this.#base();
    this.#resyncAgain=null;this.#assembler.clear();clearTimeout(this.#assemblyTimer);clearTimeout(this.#frameTimer);
    const flight={kind:'initial',generation,forceSnapshot};this.#flight=flight;
    const operation=Promise.withResolvers();this.#connect=operation.promise;
    this.#publish({status:'connecting',subscriptionId:null,error:null,gap:null});
    if(this.#closed){this.#connect=null;operation.resolve(null);return operation.promise}
    const params=v4ConversationSubscribeParamsSchema.parse({topic:this.topic,connectionId:this.connectionId,clientMode:this.clientMode,workspace:this.workspace,...(base?{base}:{})});
    const request=this.peer.request('v4/conversation/subscribe',params,{onResult:raw=>{
      const result=v4ConversationSubscribeResultSchema.parse(raw),ack=result.ack;
      if(!nonempty(ack.subscriptionId)||!nonempty(ack.logEpoch))throw new BridgeError('subscription-ack-invalid');
      if(this.#closed||generation!==this.#generation){this.#orphans.push(this.#unsubscribe(ack.subscriptionId));return result}
      if(this.#state.status==='error'||this.#flight!==flight)return result;
      const held=this.#state.snapshot;
      if(ack.mode==='resume'&&(!base||base.logEpoch!==ack.logEpoch||!this.#appliedBase||held?.logEpoch!==base.logEpoch||held?.seq!==base.seq))throw new BridgeError('subscription-base-invalid');
      this.#appliedBase=ack.mode==='resume';
      if(this.#appliedBase){
        // Equal-watermark resume has no initial frame. Keep the held base and consume either replay or online deltas.
        clearTimeout(this.#frameTimer);this.#flight=null;
        this.#publish({subscriptionId:ack.subscriptionId,logEpoch:ack.logEpoch,status:'live'});
      }else{this.#publish({subscriptionId:ack.subscriptionId,logEpoch:ack.logEpoch});this.#deadline(flight)}
      return result;
    }}).catch(e=>{if(!this.#closed&&generation===this.#generation)this.#fail(e.code??'subscription-invalid');throw e}).finally(()=>{this.#connect=null});
    request.then(operation.resolve,operation.reject);return operation.promise;
  }
  #wire(raw){
    if(this.#closed||this.#state.status==='error'||!this.#state.subscriptionId)return;
    if(!raw||!nonempty(raw.topic)||!nonempty(raw.subscriptionId)){this.#fault('proto.unroutableFrame');return}
    if(raw.topic!==this.topic||raw.subscriptionId!==this.#state.subscriptionId)return;
    // Recovery reservations are authoritative; old online frames cannot settle or corrupt a flight.
    if(this.#flight?.kind==='recovery'&&raw.deliveryKind!=='recovery')return;
    const parsed=conversationTopicWireCandidateSchema.safeParse(raw);
    if(!parsed.success){this.#fault('proto.invalidWire');return}
    for(const event of this.#assembler.accept(parsed.data)){
      if(event.kind==='fault')this.#fault(event.fault.reasonCode);
      else this.#apply(event.frame,event.deliveryKind);
    }
    this.#scheduleAssemblyExpiry();
  }
  #scheduleAssemblyExpiry(){
    clearTimeout(this.#assemblyTimer);const at=this.#assembler.nextExpiryAt;
    if(at!==null)this.#assemblyTimer=setTimeout(()=>{for(const e of this.#assembler.expire())this.#fault(e.fault.reasonCode);this.#scheduleAssemblyExpiry()},Math.max(1,at-Date.now()));
  }
  #apply(frame,deliveryKind){
    if(this.#state.status==='error')return;
    if(!int(frame.fromSeq)||!int(frame.toSeq)||frame.toSeq<frame.fromSeq){this.#fault('proto.invalidSeq');return}
    const current=this.#state.snapshot;
    let next;
    if(frame.payload.kind==='snapshot'){
      const snapshot=frame.payload.snapshot;
      if(frame.fromSeq!==0||snapshot.sessionId!==this.address.sessionId||snapshot.logEpoch!==this.#state.logEpoch||snapshot.seq!==frame.toSeq||!int(snapshot.revision)){this.#fault('proto.snapshotIdentityMismatch');return}
      if(current&&current.logEpoch===snapshot.logEpoch){if(snapshot.seq<current.seq)return;if(snapshot.revision<current.revision){this.#fault('proto.revisionRegressed');return}}
      next=snapshot;
    }else{
      // ACK(snapshot) is not a baseline. Only actually held data can authorize delta apply.
      if(!this.#appliedBase||!current||current.logEpoch!==this.#state.logEpoch){this.#fault('proto.missingAppliedBase');return}
      if(frame.toSeq<=current.seq){if(deliveryKind==='recovery'||deliveryKind==='initial'){clearTimeout(this.#frameTimer);this.#flight=null;this.#publish({status:'live',error:null,gap:null})}return;}
      if(frame.fromSeq!==current.seq){
        this.#publish({gap:{fromSeq:current.seq,toSeq:frame.fromSeq}});
        this.#fault('proto.sequenceGap');return;
      }
      next={...applyConversationDeltas(current,frame.payload.deltas),seq:frame.toSeq};
      if(!int(next.revision)||next.revision<current.revision){this.#fault('proto.revisionRegressed');return}
    }
    if(this.#flight?.kind==='initial'&&deliveryKind!=='initial'&&frame.payload.kind!=='snapshot'){this.#fault('proto.initialDeliveryMismatch');return}
    const settling=!this.#flight||deliveryKind===this.#flight.kind||deliveryKind==='recovery';
    if(settling){clearTimeout(this.#frameTimer);this.#flight=null}this.#appliedBase=true;
    this.#state={...this.#state,status:settling?'live':this.#state.status,snapshot:next,error:null,gap:null};
    this.#reconcileCommands();this.#publish();
  }
  #fault(code){
    if(this.#closed)return;
    clearTimeout(this.#frameTimer);
    if(this.#flight?.kind==='recovery'){this.#fail(code);return}
    this.#assembler.abort(this.topic,this.#state.subscriptionId);
    void this.resync({forceSnapshot:code!=='proto.sequenceGap'});
  }
  #fail(code){clearTimeout(this.#frameTimer);clearTimeout(this.#assemblyTimer);this.#flight=null;this.#resyncAgain=null;this.#assembler.clear();this.#publish({status:'error',error:code})}
  resync({forceSnapshot=false}={}){
    if(this.#closed)return Promise.reject(new BridgeError('conversation-closed'));
    if(this.#resync){
      if(!this.#flight||(forceSnapshot&&!this.#flight.forceSnapshot)){this.#resyncAgain={forceSnapshot:forceSnapshot||this.#resyncAgain?.forceSnapshot===true};this.#publish({status:'resyncing'})}
      return this.#resync;
    }
    const subscriptionId=this.#state.subscriptionId,generation=this.#generation;
    if(!subscriptionId)return Promise.reject(new BridgeError('subscription-unconfirmed'));
    const base=forceSnapshot?null:this.#base();
    const operation=Promise.withResolvers();this.#resync=operation.promise;
    clearTimeout(this.#frameTimer);
    const flight={kind:'recovery',generation,forceSnapshot};this.#flight=flight;this.#publish({status:'resyncing'});
    if(this.#closed){this.#resync=null;operation.resolve(null);return operation.promise}
    const params=v4ConversationResyncParamsSchema.parse({topic:this.topic,connectionId:this.connectionId,subscriptionId,base,...(forceSnapshot?{forceSnapshot:true}:{})});
    const request=this.peer.request('v4/conversation/resync',params,{onResult:raw=>{
      const result=v4ConversationResyncResultSchema.parse(raw),ack=result.ack;
      if(!nonempty(ack.subscriptionId)||!nonempty(ack.logEpoch))throw new BridgeError('resync-ack-invalid');
      if(this.#closed||generation!==this.#generation||this.#state.status==='error'||this.#flight!==flight)return result;
      if(ack.subscriptionId!==subscriptionId||(ack.mode==='resume'&&(!base||base.logEpoch!==ack.logEpoch)))throw new BridgeError('resync-identity-mismatch');
      this.#appliedBase=ack.mode==='resume';this.#publish({logEpoch:ack.logEpoch});this.#deadline(flight);return result;
    }}).catch(e=>{if(!this.#closed&&generation===this.#generation)this.#fail(e.code??'resync-invalid');return null}).finally(()=>{this.#resync=null;const again=this.#resyncAgain;this.#resyncAgain=null;if(again&&!this.#closed)void this.resync(again)});
    request.then(operation.resolve,operation.reject);return operation.promise;
  }
  #reserveCommand(){
    if(this.#commands.size<this.maxCommands)return;
    for(const [id,record] of this.#commands){if(terminal.has(record.state)){this.#commands.delete(id);return}}
    throw new BridgeError('command-pending-limit');
  }
  command(commandId){const record=this.#commands.get(commandId);return record?structuredClone(record):null}
  /** Scoped official workspace carrier. No local persistence, defaults, or automatic retry. */
  async workspaceConfiguration(kind,preferences,{signal}={}){
    const carrier=Object.hasOwn(workspaceCarriers,kind)?workspaceCarriers[kind]:null;
    if(!carrier)throw new BridgeError('workspace-config-unavailable');
    const admission=kind==='presentation'?this.managementAdmission:this.admission;
    if(!admission.allowed)throw new BridgeError(admission.reason);
    const parsed=carrier[1].safeParse({workspace:this.workspace,...(kind==='presentation'?{}:{preferences})});
    if(!parsed.success)throw new BridgeError('workspace-config-invalid');
    const result=carrier[2].parse(await this.peer.request(carrier[0],parsed.data,{signal}));
    if(result.workspace.workspacePath!==this.workspace.workspacePath||result.workspace.workspaceKey!==this.workspace.workspaceKey)throw new BridgeError('workspace-config-identity-mismatch');
    return result;
  }
  /** A ref is usable only if this conversation committed it or the current session projection carries it. */
  #boundAttachmentRef(ref){
    if(!nonempty(ref))return false;
    if(this.#attachmentRefs.has(ref))return true;
    const rows=this.#state.snapshot?.rows?.window??[];
    return rows.some(row=>Array.isArray(row.attachments)&&row.attachments.some(a=>a?.ref===ref||a?.previewRef===ref));
  }
  /** The one imported shared context the official session projection currently exposes. */
  #pendingSharedContext(){
    const context=this.#state.snapshot?.sharedContextImport;
    if(!context||!nonempty(context.contextId)||typeof context.status!=='string')return null;
    return context;
  }
  #projectionAdmission(){const admission=this.attachmentAdmission;if(!admission.allowed)throw new BridgeError(admission.reason);}
  #rememberAttachmentRef(ref,meta){
    this.#attachmentRefs.set(ref,meta);
    if(this.#attachmentRefs.size>256)this.#attachmentRefs.delete(this.#attachmentRefs.keys().next().value);
  }
  #attachmentPort(){
    const self=this,connectionId=this.connectionId;
    return {
      begin:async p=>{
        const params=v4AttachmentBeginParamsSchema.parse({connectionId,...p});
        const result=v4AttachmentBeginResultSchema.parse(await self.peer.request('v4/attachment/begin',params));
        if(result.uploadId!==p.uploadId)throw new BridgeError('attachment-ack-mismatch');
        if(result.state==='staging')self.#uploads.set(p.uploadId,{fileName:p.fileName,mime:p.mime,totalBytes:p.totalBytes,totalChunks:p.totalChunks,checksum:p.checksum,nextChunkIndex:result.nextChunkIndex});
        else{self.#uploads.delete(p.uploadId);self.#committedUploads.set(p.uploadId,{ref:result.ref,fileName:p.fileName,mime:p.mime,totalBytes:p.totalBytes});self.#rememberAttachmentRef(result.ref,{fileName:p.fileName,mime:p.mime,bytes:p.totalBytes,uploadId:p.uploadId});}
        return result;
      },
      chunk:async p=>{
        if(!self.#uploads.has(p.uploadId))throw new BridgeError('attachment-untracked');
        const result=v4AttachmentChunkResultSchema.parse(await self.peer.request('v4/attachment/chunk',v4AttachmentChunkParamsSchema.parse({connectionId,...p})));
        if(result.uploadId!==p.uploadId)throw new BridgeError('attachment-ack-mismatch');
        self.#uploads.get(p.uploadId).nextChunkIndex=result.nextChunkIndex;
        return result;
      },
      commit:async p=>{
        const staged=self.#uploads.get(p.uploadId),prior=self.#committedUploads.get(p.uploadId);
        if(!staged&&!prior)throw new BridgeError('attachment-untracked');
        const result=v4AttachmentCommitResultSchema.parse(await self.peer.request('v4/attachment/commit',v4AttachmentCommitParamsSchema.parse({connectionId,...p})));
        if(!nonempty(result.ref))throw new BridgeError('attachment-ack-mismatch');
        const record=staged??prior;
        if(staged){self.#uploads.delete(p.uploadId);self.#committedUploads.set(p.uploadId,{ref:result.ref,fileName:staged.fileName,mime:staged.mime,totalBytes:staged.totalBytes});}
        self.#rememberAttachmentRef(result.ref,{fileName:record.fileName,mime:record.mime,bytes:record.totalBytes,uploadId:p.uploadId});
        return result;
      },
      abort:async p=>{
        const prior=self.#committedUploads.get(p.uploadId);
        try{v4AttachmentAbortResultSchema.parse(await self.peer.request('v4/attachment/abort',v4AttachmentAbortParamsSchema.parse({connectionId,...p})));}
        finally{self.#uploads.delete(p.uploadId);if(prior){self.#attachmentRefs.delete(prior.ref);self.#committedUploads.delete(p.uploadId);}}
        return {committedRefWithdrawn:Boolean(prior)};
      },
    };
  }
  /** Bounded official upload step 1/3. Restartable with the same uploadId per official begin semantics. */
  async attachmentStart({uploadId=`upload-${randomUUID()}`,fileName,mime,totalBytes,totalChunks,checksum}={}){
    this.#projectionAdmission();
    if(this.#uploads.size>=PROTOCOL_V4_LIMITS.attachmentUploadMaxConcurrent)throw new BridgeError('fault.attachment.tooManyUploads');
    const parsed=v4AttachmentBeginParamsSchema.safeParse({connectionId:this.connectionId,uploadId,sessionId:this.address.sessionId,fileName,mime,totalBytes,totalChunks,checksum});
    if(!parsed.success)throw new BridgeError('attachment-invalid');
    const result=await this.#attachmentPort().begin(parsed.data);
    return {uploadId,state:result.state,nextChunkIndex:result.nextChunkIndex,...(result.state==='committed'?{ref:result.ref}:{})};
  }
  /** Bounded official upload step 2/3. Chunk bytes are the official 384 KiB slices. */
  async attachmentChunk({uploadId,chunkIndex,dataBase64}={}){
    this.#projectionAdmission();
    const result=await this.#attachmentPort().chunk({sessionId:this.address.sessionId,uploadId,chunkIndex,dataBase64});
    return {uploadId,nextChunkIndex:result.nextChunkIndex};
  }
  /** Bounded official upload step 3/3. Only a validated commit records a session-bound ref. */
  async attachmentCommit({uploadId}={}){
    this.#projectionAdmission();
    const result=await this.#attachmentPort().commit({sessionId:this.address.sessionId,uploadId});
    return {uploadId,ref:result.ref};
  }
  /** Cancel a staged upload. A committed artifact is local-withdrawn only; there is no runtime delete carrier. */
  async attachmentAbort({uploadId}={}){
    this.#projectionAdmission();
    if(!this.#uploads.has(uploadId)&&!this.#committedUploads.has(uploadId))throw new BridgeError('attachment-untracked');
    const result=await this.#attachmentPort().abort({sessionId:this.address.sessionId,uploadId});
    return {uploadId,aborted:true,committedRefWithdrawn:result.committedRefWithdrawn};
  }
  /** Whole-file convenience over the same official transaction; never a full-data wire RPC. */
  async uploadAttachment({fileName,mime,bytes},{signal,onProgress,uploadId=`upload-${randomUUID()}`}={}){
    this.#projectionAdmission();
    if(!(bytes instanceof Uint8Array))throw new BridgeError('attachment-invalid');
    const port=this.#attachmentPort();
    return uploadAttachmentTransaction(port,{sessionId:this.address.sessionId,uploadId,fileName,mime,dataBase64:encodeBase64(bytes)},{signal,onProgress});
  }
  /** Official image/video/PDF preview read; authorized by session projection, never by path. */
  async attachmentRead({ref,target,attachmentIndex,offset=0,limit=PROTOCOL_V4_LIMITS.attachmentChunkMaxBytes,signal}={}){
    this.#projectionAdmission();
    if(!this.#boundAttachmentRef(ref))throw new BridgeError('attachment-ref-unbound');
    const parsed=v4AttachmentReadParamsSchema.safeParse({sessionId:this.address.sessionId,ref,...(target===undefined?{}:{target}),...(attachmentIndex===undefined?{}:{attachmentIndex}),offset,limit});
    if(!parsed.success)throw new BridgeError('attachment-invalid');
    return v4AttachmentReadResultSchema.parse(await this.peer.request('v4/attachment/read',parsed.data,{signal}));
  }
  /** Share/plain-text attachment metadata stat; same session binding, no content read. */
  async conversationAttachmentStat({ref,target,attachmentIndex,signal}={}){
    this.#projectionAdmission();
    if(!this.#boundAttachmentRef(ref))throw new BridgeError('attachment-ref-unbound');
    const parsed=v4ConversationAttachmentStatParamsSchema.safeParse({sessionId:this.address.sessionId,ref,target,attachmentIndex});
    if(!parsed.success)throw new BridgeError('attachment-invalid');
    return v4ConversationAttachmentStatResultSchema.parse(await this.peer.request('v4/conversation/attachmentStat',parsed.data,{signal}));
  }
  /** Share/plain-text attachment range read; official row authorization still decides. */
  async conversationAttachmentRead({ref,target,attachmentIndex,offset=0,limit=PROTOCOL_V4_LIMITS.attachmentChunkMaxBytes,signal}={}){
    this.#projectionAdmission();
    if(!this.#boundAttachmentRef(ref))throw new BridgeError('attachment-ref-unbound');
    const parsed=v4ConversationAttachmentReadParamsSchema.safeParse({sessionId:this.address.sessionId,ref,target,attachmentIndex,offset,limit});
    if(!parsed.success)throw new BridgeError('attachment-invalid');
    return v4ConversationAttachmentReadResultSchema.parse(await this.peer.request('v4/conversation/attachmentRead',parsed.data,{signal}));
  }
  /** Official subagent instance directory for this parent session (legacy session/subagents).
   *  Observation only: the running projection also arrives in the v4 snapshot; this carrier adds the
   *  cursor-paginated ended list. Unknown parents are the official rejection, never a fabricated empty. */
  async listSubagents({endedCursor,endedLimit}={}, {signal}={}){
    const admission=this.workAdmission;
    if(!admission.allowed)throw new BridgeError(admission.reason);
    const parsed=zcodeSessionSubagentsParamsSchema.safeParse({sessionId:this.address.sessionId,...(endedCursor===undefined?{}:{endedCursor}),...(endedLimit===undefined?{}:{endedLimit})});
    if(!parsed.success)throw new BridgeError('subagents-params-invalid');
    const result=zcodeSessionSubagentsResultSchema.safeParse(await this.peer.request('session/subagents',parsed.data,{signal}));
    if(!result.success)throw new BridgeError('subagents-result-invalid');
    return result.data;
  }
  /** Official session token usage (v4/conversation/usage; the @deprecated legacy session/usage name
   *  is retired by the official host, official index.ts:3656-3658). Same usage store and handler as
   *  the legacy name (server.ts v4 usage query case).
   *  Scoped identity: the sessionId is always this conversation's bound address, never a caller value.
   *  Pure aggregate read; no model admission is consumed and no local counter is kept. */
  async sessionUsage({signal}={}){
    const admission=this.workAdmission;
    if(!admission.allowed)throw new BridgeError(admission.reason);
    const generation=this.#generation;
    const parsed=zcodeTaskTokenUsageParamsSchema.safeParse({sessionId:this.address.sessionId});
    if(!parsed.success)throw new BridgeError('session-usage-params-invalid');
    const result=zcodeTaskTokenUsageResultSchema.safeParse(await this.peer.request('v4/conversation/usage',parsed.data,{signal}));
    // Owner re-checked after the await: a reply that lands after this owner was cancelled/replaced is
    // never delivered to the new owner (same guard shape as workflowRead's owner-replaced fence).
    if(this.#closed||generation!==this.#generation||!this.workAdmission.allowed)throw new BridgeError('session-usage-owner-replaced');
    if(!result.success)throw new BridgeError('session-usage-result-invalid');
    return result.data;
  }
  /** Official bounded background bash output read (v4/conversation/backgroundBashOutput).
   *  Unknown/expired workIds are the official {kind:'unavailable'}; no local tail is invented. */
  async readBackgroundBashOutput({workId}={}, {signal}={}){
    const admission=this.workAdmission;
    if(!admission.allowed)throw new BridgeError(admission.reason);
    const parsed=v4BackgroundBashOutputParamsSchema.safeParse({sessionId:this.address.sessionId,workId});
    if(!parsed.success)throw new BridgeError('background-output-params-invalid');
    const result=backgroundBashOutputResultSchema.safeParse(await this.peer.request('v4/conversation/backgroundBashOutput',parsed.data,{signal}));
    if(!result.success)throw new BridgeError('background-output-result-invalid');
    return result.data;
  }
  /** Cancel one work by official workId. The official ACK is authoritative: expired/unknown ids come
   *  back rejected with their official reasonCode, and a late id never cancels a later unrelated work. */
  async cancelBackgroundWork({workId}={}, {signal}={}){
    return this.submit({type:'cancelBackgroundWork',payload:{workId}},{signal});
  }
  /** Queries are pinned to the row's observed revision/epoch; late responses cannot authorize an apply. */
  async historyQuery({kind,target,baseRevision,baseLogEpoch}={}, {signal}={}){
    this.#projectionAdmission();
    const carriers={fileChanges:['v4/conversation/fileChanges',v4ConversationFileChangesParamsSchema,v4ConversationFileChangesResultSchema],fileRewindPreview:['v4/conversation/fileRewindPreview',v4ConversationFileRewindPreviewParamsSchema,v4ConversationFileRewindPreviewResultSchema]};
    const carrier=carriers[kind];if(!carrier)throw new BridgeError('history-query-unavailable');
    const snapshot=this.#state.snapshot;
    if(baseLogEpoch!==snapshot.logEpoch)throw new BridgeError('proto.staleLogEpoch');
    if(baseRevision!==snapshot.revision)throw new BridgeError('proto.staleRevision');
    const row=snapshot.rows.window.find(r=>r.rowId===target?.rowId&&r.entityId===target?.entityId);
    if(!row)throw new BridgeError('row-target-unconfirmed');
    if(row.kind!=='turnHeader'||(kind==='fileRewindPreview'&&row.actions?.canRewindFiles!==true))throw new BridgeError('guard.actionUnavailable');
    const params=carrier[1].safeParse({sessionId:this.address.sessionId,target,baseRevision,baseLogEpoch});
    if(!params.success)throw new BridgeError('history-query-invalid');
    const result=carrier[2].parse(await this.peer.request(carrier[0],params.data,{signal}));
    this.#projectionAdmission();
    if(this.#state.snapshot.logEpoch!==baseLogEpoch)throw new BridgeError('proto.staleLogEpoch');
    if(this.#state.snapshot.revision!==baseRevision)throw new BridgeError('proto.staleRevision');
    return {kind,target,baseRevision,baseLogEpoch,result};
  }
  async submit({type,payload,commandId=newCommandId(),baseRevision,baseLogEpoch}={}, {signal}={}){
    const resource=historyResources.has(type)&&!(type==='createSelectionSideSession'&&payload?.firstInput);
    const admission=WORK_COMMANDS.has(type)?this.workAdmission:managementCommands.has(type)||resource?this.managementAdmission:this.admission;
    if(!admission.allowed)throw new BridgeError(admission.reason);
    if(baseRevision!==undefined&&!int(baseRevision))throw new BridgeError('command-invalid');
    if(!nonempty(commandId))throw new BridgeError('command-invalid');
    if(this.#commands.has(commandId))throw new BridgeError('command-already-tracked');
    if(signal?.aborted)throw new BridgeError('cancelled');
    const snapshot=this.#state.snapshot;
    if(baseLogEpoch!==undefined&&baseLogEpoch!==snapshot.logEpoch)throw new BridgeError('proto.staleLogEpoch');
    if(HISTORY_COMMANDS.has(type)&&baseRevision!==undefined&&baseRevision!==snapshot.revision)throw new BridgeError('proto.staleRevision');
    const availability=availabilityCommands[type];
    if(availability&&snapshot.availability?.[availability]?.allowed!==true)throw new BridgeError(snapshot.availability?.[availability]?.reasonCode??'action-unavailable');
    if(['editQueueItem','reorderQueueItem','deleteQueueItem','sendQueuedNow'].includes(type)){
      const item=snapshot.queue.items.find(x=>x.queueItemId===payload?.queueItemId);
      if(!item)throw new BridgeError('queue-item-unconfirmed');
      if(item.dispatch.state!=='queued')throw new BridgeError('guard.queueItemReserved');
      if(type==='editQueueItem'&&item.kind==='compact')throw new BridgeError('guard.queueItemNotEditable');
      if(type==='reorderQueueItem'&&payload.beforeQueueItemId!==null&&!snapshot.queue.items.some(x=>x.queueItemId===payload.beforeQueueItemId))throw new BridgeError('queue-target-unconfirmed');
    }
    if(['sendText','sendGoalCommand'].includes(type)&&snapshot.inputRouting.mode==='choice'){
      const ids=payload?.expectedHeldQueueItemIds;
      if(!payload?.heldQueueDisposition||!Array.isArray(ids))throw new BridgeError('held-queue-confirmation-required');
      if(new Set(ids).size!==ids.length||ids.length!==snapshot.queue.items.length||ids.some(id=>!snapshot.queue.items.some(x=>x.queueItemId===id)))throw new BridgeError('held-queue-confirmation-stale');
    }
    if(type==='stop'){
      const executionId=payload?.expectedForegroundExecutionId;
      if(!snapshot.control.canStop||!executionId||!snapshot.control.activeWorks.some(x=>x.foregroundExecutionId===executionId))throw new BridgeError('stop-target-unconfirmed');
    }
    // Identity is the official workId bound to this session. It is deliberately not snapshot-filtered:
    // an expired id must reach the official runtime and be rejected there, not silently redirected.
    if(WORKFLOW_COMMANDS.has(type)&&type!=='startSavedWorkflow'&&!nonempty(payload?.workId))throw new BridgeError('command-invalid');
    if(type==='cancelBackgroundWork'&&!nonempty(payload?.workId))throw new BridgeError('command-invalid');
    if((type==='resolveInteraction'||type==='snoozeInteractionAutoResolution'||type==='respondWorkspaceHookReview'||type==='toggleWorkspaceHookReviewItem')&&!snapshot.pendingInteractions.some(x=>x.interactionId===payload?.interactionId))throw new BridgeError('interaction-unconfirmed');
    if(type==='revokeWorkspaceHookTrust'&&payload?.interactionId&&!snapshot.pendingInteractions.some(x=>x.interactionId===payload.interactionId))throw new BridgeError('interaction-unconfirmed');
    if(['sendText','editUserQuery'].includes(type)&&payload?.attachments!==undefined){
      if(!Array.isArray(payload.attachments))throw new BridgeError('command-invalid');
      if(payload.attachments.some(attachment=>!this.#boundAttachmentRef(attachment?.ref)))throw new BridgeError('attachment-ref-unbound');
    }
    if(payload?.context_refs!==undefined){
      if(type!=='sendText')throw new BridgeError('command-invalid');
      const refs=payload.context_refs,parsedRef=Array.isArray(refs)&&refs.length===1?sharedContextRefSchema.safeParse(refs[0]):null;
      const context=this.#pendingSharedContext();
      if(!parsedRef?.success||!context||context.contextId!==parsedRef.data.context_id||!['pending','reserved'].includes(context.status))throw new BridgeError('shared-context-unconfirmed');
    }
    if(type==='discardSharedContext'){
      const context=this.#pendingSharedContext();
      if(!context||context.contextId!==payload?.contextId||context.status!=='pending')throw new BridgeError('shared-context-unconfirmed');
    }
    const envelope={commandId,clientId:this.clientId,sessionId:this.address.sessionId,type,payload,issuedAt:Date.now(),...(COMMANDS_REQUIRING_BASE_REVISION.has(type)?{baseRevision:baseRevision??snapshot.revision}:{}),...(ROW_TARGETING_COMMANDS.has(type)?{baseLogEpoch:snapshot.logEpoch}:{})};
    const parsed=parseCommandEnvelope(envelope);
    if(!parsed.ok)throw new BridgeError('command-invalid');
    if(ROW_TARGETING_COMMANDS.has(type)&&!snapshot.rows.window.some(row=>row.rowId===payload.target.rowId&&row.entityId===payload.target.entityId))throw new BridgeError('row-target-unconfirmed');
    if(HISTORY_COMMANDS.has(type)&&ROW_TARGETING_COMMANDS.has(type)){
      const row=snapshot.rows.window.find(r=>r.rowId===payload.target.rowId&&r.entityId===payload.target.entityId);
      const action=historyActions[type];
      if((action&&row.actions?.[action]!==true)||(type==='setAssistantFeedback'&&row.kind!=='assistantText'))throw new BridgeError('guard.actionUnavailable');
    }
    this.#reserveCommand();
    const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    this.#commandControllers.set(commandId,controller);
    const record={commandId,type,sessionId:envelope.sessionId,logEpoch:snapshot.logEpoch,revision:snapshot.revision,state:'sent-unconfirmed',...(WORK_COMMANDS.has(type)||type==='resumeWorkflowRun'?{workId:payload.workId}:{}),...(type==='resumeWorkflowRun'?{baselineWorkflowSequence:snapshot.workflowRuns?.runs?.find(r=>r.runId===payload.workId)?.lastEventSequence??-1}:{})};
    this.#commands.set(commandId,record);this.#publish();
    try{
      await this.peer.request('v4/command',parsed.envelope,{signal:controller.signal,onResult:raw=>{this.#ack(record,raw);return raw}});
    }catch(e){
      if(!terminal.has(record.state)&&!['running','waiting'].includes(record.state)){
        record.state=e.code==='runtime-rejected'?'failed':e.sent===false?'not-sent':'outcome-unknown';
        record.error=e.code??'command-invalid';
      }
    }finally{signal?.removeEventListener('abort',abort);this.#commandControllers.delete(commandId);this.#publish()}
    return this.command(commandId);
  }
  #ack(record,raw){
    const ack=commandAckSchema.parse(raw);
    if(ack.commandId!==record.commandId||!int(ack.revisionAtDecision))throw new BridgeError('command-ack-mismatch');
    if(['rejected','stale','noop','failed'].includes(ack.status)&&!ack.reasonCode)throw new BridgeError('command-reason-missing');
    if(['accepted','duplicate'].includes(ack.status)&&WORKFLOW_COMMANDS.has(record.type)){
      if(record.type==='resumeWorkflowRun')record.workflowRunId=record.workId;
      else{
        if(ack.result?.type!==record.type||!nonempty(ack.result.runId)||!nonempty(ack.result.toolCallId))throw new BridgeError('command-result-mismatch');
        record.workflowRunId=ack.result.runId;record.workflowToolCallId=ack.result.toolCallId;
      }
    }
    record.ack=ack;
    if(['accepted','duplicate'].includes(ack.status)&&['forkAssistant','createSelectionSideSession'].includes(ack.result?.type)){
      if(ack.result.type!==record.type||!nonempty(ack.result.sessionId)||ack.result.sessionId===this.address.sessionId)throw new BridgeError('command-result-mismatch');
      record.branchAddress={...this.address,sessionId:ack.result.sessionId};
    }
    if(!terminal.has(record.state))record.state=['accepted','duplicate'].includes(ack.status)?'accepted-awaiting-terminal':ack.status;
    this.#reconcileCommands();
  }
  async queryCommand(commandId,{signal}={}){
    const record=this.#commands.get(commandId);if(!record)throw new BridgeError('command-untracked');
    if(this.#closed)throw new BridgeError('conversation-closed');
    const key={sessionId:record.sessionId,commandId};
    await this.peer.request('v4/commands/query',{commands:[key]},{signal,onResult:raw=>{
      const result=commandsQueryResultSchema.parse(raw);
      if(result.results.length!==1||result.results[0].key.sessionId!==key.sessionId||result.results[0].key.commandId!==key.commandId)throw new BridgeError('command-query-mismatch');
      const item=result.results[0];
      if(item.result==='unknown'){if(!terminal.has(record.state))record.state='outcome-unknown';this.#reconcileCommands()}else this.#ack(record,item.result);
      return result;
    }});
    this.#publish();return this.command(commandId);
  }
  #reconcileCommands(){
    const snapshot=this.#state.snapshot;if(!snapshot)return;
    for(const record of this.#commands.values()){
      if(terminal.has(record.state))continue;
      const rerun=['editUserQuery','retryTurn'].includes(record.type)&&['accepted','duplicate'].includes(record.ack?.status);
      if(record.logEpoch!==snapshot.logEpoch&&!rerun)continue;
      // A cancel has no turnHeader. Its terminal is the authoritative work projection: once the work
      // leaves running (or disappears), the accepted cancellation is settled.
      if(record.type==='cancelBackgroundWork'&&['accepted','duplicate'].includes(record.ack?.status)){
        const work=(snapshot.backgroundWorks??[]).find(w=>w.workId===record.workId);
        const workflow=(snapshot.workflowRuns?.runs??[]).find(r=>r.runId===record.workId);
        record.state=work?.status==='running'||workflow&&['pending','running'].includes(workflow.status)?'running':'completed';
        continue;
      }
      if(WORKFLOW_COMMANDS.has(record.type)&&['accepted','duplicate'].includes(record.ack?.status)){
        const run=snapshot.workflowRuns?.runs?.find(r=>r.runId===record.workflowRunId);
        // Resume ACK may arrive before run-started. The previous stopped incarnation
        // cannot settle the new command: journal sequence must advance beyond its base.
        if(run&&(record.type!=='resumeWorkflowRun'||run.lastEventSequence>record.baselineWorkflowSequence)){
          record.state=({pending:'running',running:'running',completed:'completed',errored:'failed',stopped:'interrupted'})[run.status];
        }
        continue;
      }
      const header=snapshot.rows.window.find(row=>row.kind==='turnHeader'&&row.sourceCommandId===record.commandId);
      if(!header)continue;
      record.turnId=header.turnId;record.resultLogEpoch=snapshot.logEpoch;
      record.state=({completedSuccess:'completed',completedInterrupted:'interrupted',failed:'failed',running:'running'})[header.state];
      if(record.state==='running'&&snapshot.pendingInteractions.some(x=>x.anchorRowId!==null&&snapshot.rows.window.some(row=>row.rowId===x.anchorRowId&&row.turnId===header.turnId)))record.state='waiting';
    }
  }
  /** Cancels observation/wait only. Runtime stop is a separately correlated command. */
  cancelCommand(commandId){const controller=this.#commandControllers.get(commandId);if(!controller)return false;controller.abort();this.#commandControllers.delete(commandId);return true}
  async #unsubscribe(subscriptionId){
    if(this.peer.closed)return;
    const params=v4ConversationUnsubscribeParamsSchema.parse({topic:this.topic,connectionId:this.connectionId,subscriptionId});
    try{await this.peer.request('v4/conversation/unsubscribe',params)}
    catch(e){this.#publish({cleanupError:{code:e.code??'unsubscribe-failed',...(e.protocolCode===undefined?{}:{protocolCode:e.protocolCode})}})}
  }
  #transportLost(code){
    if(this.#closed)return;
    ++this.#generation;clearTimeout(this.#frameTimer);clearTimeout(this.#assemblyTimer);this.#assembler.clear();this.#flight=null;
    for(const [id,controller] of this.#commandControllers){controller.abort();const record=this.#commands.get(id);if(record&&!terminal.has(record.state)){record.state='outcome-unknown';record.error=code}}
    this.#commandControllers.clear();this.#publish({status:'error',error:code,subscriptionId:null});
  }
  #disconnect(code){
    if(this.#closed)return;this.#closed=true;++this.#generation;
    clearTimeout(this.#frameTimer);clearTimeout(this.#assemblyTimer);this.#assembler.clear();
    this.#offHostTools?.();this.#offHostTools=undefined;this.#offNotification();this.#offClosed();
    for(const [id,controller] of this.#commandControllers){controller.abort();const record=this.#commands.get(id);if(record&&!terminal.has(record.state)){record.state='outcome-unknown';record.error=code}}
    this.#commandControllers.clear();this.#publish({status:'closed',error:code,subscriptionId:null});
  }
  cancel({reason='cancelled'}={}){
    if(this.#cancelPromise)return this.#cancelPromise;
    const id=this.#state.subscriptionId;this.#disconnect(reason);
    // A subscribe in flight still receives its ACK, cleans the owned orphan, then settles.
    this.#cancelPromise=(async()=>{if(id)await this.#unsubscribe(id);await this.#connect;await this.#resync;await Promise.all(this.#orphans);this.#orphans=[]})().catch(e=>{this.#publish({cleanupError:{code:e.code??'subscription-cleanup-uncertain'}})});
    return this.#cancelPromise;
  }
}
