import { randomBytes } from 'node:crypto';
import { BridgeError } from './installation.mjs';
import {
  parseCommandEnvelope, commandAckSchema, commandsQueryResultSchema,
  COMMANDS_REQUIRING_BASE_REVISION, ROW_TARGETING_COMMANDS,
  conversationTopicFrameSchema, conversationTopicWireCandidateSchema,
  v4ConversationSubscribeParamsSchema, v4ConversationSubscribeResultSchema,
  v4ConversationResyncParamsSchema, v4ConversationResyncResultSchema,
  v4ConversationUnsubscribeParamsSchema, TopicWireFrameAssembler, applyConversationDeltas,
  helloMessageSchema, clientHelloSchema,
} from './vendor/zcode/v4.mjs';
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const int=x=>Number.isSafeInteger(x)&&x>=0;
const terminal=new Set(['completed','failed','interrupted','rejected','stale','noop','not-sent']);
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
  #assembler; #offNotification; #offClosed; #connect; #resync; #generation=0; #closed=false;
  #observerErrors=0; #flight; #resyncAgain=null; #appliedBase=false; #orphans=[]; #frameTimer; #assemblyTimer; #commands=new Map(); #commandControllers=new Map(); #cancelPromise;
  constructor(peer,{address,workspace,connectionId,clientId,clientMode='web-remote-replayable',runnable=false,onChange=()=>{},frameTimeoutMs=10000,assemblyOptions={},maxCommands=128}={}){
    if(!workspace||!address||address.runtime!=='zcode'||!nonempty(address.authority)||!nonempty(address.sessionId)||address.workspace!==workspace?.workspacePath||workspace.workspaceKey!==workspace.workspacePath||!nonempty(workspace?.workspacePath)||!nonempty(connectionId)||!nonempty(clientId)||typeof runnable!=='boolean'||!['desktop-continuous','web-remote-replayable'].includes(clientMode)||!int(frameTimeoutMs)||frameTimeoutMs===0||!int(maxCommands)||maxCommands===0)throw new BridgeError('conversation-context-invalid');
    Object.assign(this,{peer,address:structuredClone(address),workspace:structuredClone(workspace),connectionId,clientId,clientMode,runnable,onChange,frameTimeoutMs,maxCommands});
    // Caller objects cannot mutate the owned routing context after admission.
    Object.freeze(this.address);Object.freeze(this.workspace);
    for(const key of ['peer','address','workspace','connectionId','clientId','clientMode','runnable','frameTimeoutMs','maxCommands'])Object.defineProperty(this,key,{writable:false});
    this.topic='conversation/'+address.sessionId;
    Object.defineProperty(this,'topic',{writable:false});
    this.#assembler=new TopicWireFrameAssembler(conversationTopicFrameSchema,assemblyOptions);
    this.#offNotification=peer.onNotification(m=>{if(m.method==='v4/conversation/frame')this.#wire(m.params)});
    this.#offClosed=peer.onClosed(code=>this.#disconnect(code));
  }
  get state(){return structuredClone({...this.#state,commands:[...this.#commands.values()],observerErrors:this.#observerErrors,profile:this.clientMode==='desktop-continuous'?'continuous':'replayable',admission:this.admission})}
  get admission(){return {allowed:!this.#closed&&this.runnable&&this.#state.status==='live'&&!!this.#state.snapshot,reason:this.#closed?'closed':!this.runnable?'runtime-restricted':this.#state.status!=='live'?'projection-unconfirmed':null}}
  get assemblyStats(){return this.#assembler.getStats()}
  #publish(change={}){this.#state={...this.#state,...change};try{this.onChange(this.state)}catch{this.#observerErrors=Math.min(Number.MAX_SAFE_INTEGER,this.#observerErrors+1)}}
  #base(){const s=this.#state.snapshot;return s&&this.#appliedBase&&s.logEpoch===this.#state.logEpoch?{logEpoch:s.logEpoch,seq:s.seq}:null}
  #deadline(){
    clearTimeout(this.#frameTimer);if(this.#closed)return;
    this.#frameTimer=setTimeout(()=>{if(this.#closed)return;if(this.#flight?.kind==='recovery')this.#fail('recovery-frame-timeout');else void this.resync({forceSnapshot:true})},this.frameTimeoutMs);
  }
  connect({forceSnapshot=false}={}){
    if(this.#closed)return Promise.reject(new BridgeError('conversation-closed'));
    if(this.#connect)return this.#connect;
    const generation=++this.#generation,base=forceSnapshot?null:this.#base();
    this.#resyncAgain=null;this.#assembler.clear();clearTimeout(this.#assemblyTimer);clearTimeout(this.#frameTimer);
    this.#flight={kind:'initial',generation,forceSnapshot};
    const operation=Promise.withResolvers();this.#connect=operation.promise;
    this.#publish({status:'connecting',subscriptionId:null,error:null,gap:null});
    if(this.#closed){this.#connect=null;operation.resolve(null);return operation.promise}
    const params=v4ConversationSubscribeParamsSchema.parse({topic:this.topic,connectionId:this.connectionId,clientMode:this.clientMode,workspace:this.workspace,...(base?{base}:{})});
    const request=this.peer.request('v4/conversation/subscribe',params,{onResult:raw=>{
      const result=v4ConversationSubscribeResultSchema.parse(raw),ack=result.ack;
      if(!nonempty(ack.subscriptionId)||!nonempty(ack.logEpoch))throw new BridgeError('subscription-ack-invalid');
      if(this.#closed||generation!==this.#generation){this.#orphans.push(this.#unsubscribe(ack.subscriptionId));return result}
      if(ack.mode==='resume'&&(!base||base.logEpoch!==ack.logEpoch))throw new BridgeError('subscription-base-invalid');
      this.#appliedBase=ack.mode==='resume';this.#publish({subscriptionId:ack.subscriptionId,logEpoch:ack.logEpoch});this.#deadline();return result;
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
    this.#flight={kind:'recovery',generation,forceSnapshot};this.#publish({status:'resyncing'});
    if(this.#closed){this.#resync=null;operation.resolve(null);return operation.promise}
    const params=v4ConversationResyncParamsSchema.parse({topic:this.topic,connectionId:this.connectionId,subscriptionId,base,...(forceSnapshot?{forceSnapshot:true}:{})});
    const request=this.peer.request('v4/conversation/resync',params,{onResult:raw=>{
      const result=v4ConversationResyncResultSchema.parse(raw),ack=result.ack;
      if(!nonempty(ack.subscriptionId)||!nonempty(ack.logEpoch))throw new BridgeError('resync-ack-invalid');
      if(this.#closed||generation!==this.#generation)return result;
      if(ack.subscriptionId!==subscriptionId||(ack.mode==='resume'&&(!base||base.logEpoch!==ack.logEpoch)))throw new BridgeError('resync-identity-mismatch');
      this.#appliedBase=ack.mode==='resume';this.#publish({logEpoch:ack.logEpoch});this.#deadline();return result;
    }}).catch(e=>{if(!this.#closed&&generation===this.#generation)this.#fail(e.code??'resync-invalid');return null}).finally(()=>{this.#resync=null;const again=this.#resyncAgain;this.#resyncAgain=null;if(again&&!this.#closed)void this.resync(again)});
    request.then(operation.resolve,operation.reject);return operation.promise;
  }
  #reserveCommand(){
    if(this.#commands.size<this.maxCommands)return;
    for(const [id,record] of this.#commands){if(terminal.has(record.state)){this.#commands.delete(id);return}}
    throw new BridgeError('command-pending-limit');
  }
  command(commandId){const record=this.#commands.get(commandId);return record?structuredClone(record):null}
  async submit({type,payload,commandId=newCommandId()}={}, {signal}={}){
    if(!this.admission.allowed)throw new BridgeError(this.admission.reason);
    if(!nonempty(commandId))throw new BridgeError('command-invalid');
    if(this.#commands.has(commandId))throw new BridgeError('command-already-tracked');
    if(signal?.aborted)throw new BridgeError('cancelled');
    const snapshot=this.#state.snapshot;
    if(type==='stop'){
      const executionId=payload?.expectedForegroundExecutionId;
      if(!snapshot.control.canStop||!executionId||!snapshot.control.activeWorks.some(x=>x.foregroundExecutionId===executionId))throw new BridgeError('stop-target-unconfirmed');
    }
    if(type==='resolveInteraction'&&!snapshot.pendingInteractions.some(x=>x.interactionId===payload?.interactionId))throw new BridgeError('interaction-unconfirmed');
    const envelope={commandId,clientId:this.clientId,sessionId:this.address.sessionId,type,payload,issuedAt:Date.now(),...(COMMANDS_REQUIRING_BASE_REVISION.has(type)?{baseRevision:snapshot.revision}:{}),...(ROW_TARGETING_COMMANDS.has(type)?{baseLogEpoch:snapshot.logEpoch}:{})};
    const parsed=parseCommandEnvelope(envelope);
    if(!parsed.ok)throw new BridgeError('command-invalid');
    if(ROW_TARGETING_COMMANDS.has(type)&&!snapshot.rows.window.some(row=>row.rowId===payload.target.rowId&&row.entityId===payload.target.entityId))throw new BridgeError('row-target-unconfirmed');
    this.#reserveCommand();
    const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    this.#commandControllers.set(commandId,controller);
    const record={commandId,type,sessionId:envelope.sessionId,logEpoch:snapshot.logEpoch,revision:snapshot.revision,state:'sent-unconfirmed'};
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
    record.ack=ack;
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
      if(terminal.has(record.state)||record.logEpoch!==snapshot.logEpoch)continue;
      const header=snapshot.rows.window.find(row=>row.kind==='turnHeader'&&row.sourceCommandId===record.commandId);
      if(!header)continue;
      record.turnId=header.turnId;
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
  #disconnect(code){
    if(this.#closed)return;this.#closed=true;++this.#generation;
    clearTimeout(this.#frameTimer);clearTimeout(this.#assemblyTimer);this.#assembler.clear();
    this.#offNotification();this.#offClosed();
    for(const [id,controller] of this.#commandControllers){controller.abort();const record=this.#commands.get(id);if(record&&!terminal.has(record.state)){record.state='outcome-unknown';record.error=code}}
    this.#commandControllers.clear();this.#publish({status:'closed',error:code,subscriptionId:null});
  }
  cancel(){
    if(this.#cancelPromise)return this.#cancelPromise;
    const id=this.#state.subscriptionId;this.#disconnect('cancelled');
    // A subscribe in flight still receives its ACK, cleans the owned orphan, then settles.
    this.#cancelPromise=(async()=>{if(id)await this.#unsubscribe(id);await this.#connect;await this.#resync;await Promise.all(this.#orphans);this.#orphans=[]})().catch(e=>{this.#publish({cleanupError:{code:e.code??'subscription-cleanup-uncertain'}})});
    return this.#cancelPromise;
  }
}
