import { V4Conversation } from './conversation.mjs';
import { CommandLifecycle } from './command-lifecycle.mjs';
import { MirrorState } from './mirror-state.mjs';
import { displayProjection, officialSelection, sameSelection, selectionOutcome } from './model-selection.mjs';
const fault=code=>Object.assign(new Error(code),{code});
const clean=value=>JSON.parse(JSON.stringify(value));
// Persistent entities can own multiple rows. Rendering identity belongs to the epoch + rowId.
export const projectionRowKey=(logEpoch,rowId)=>'row:'+JSON.stringify([logEpoch,rowId]);
export const SHARED_GUI_HINT='官方 GUI 可能正在运行本会话';

export function approvalAnswer(interaction,outcome){
  if(!['permission','userInput'].includes(interaction.kind))throw fault('interaction-mapping-unavailable');
  if(outcome==='unavailable')return null;
  if(outcome==='cancelled')return {action:'cancel'};
  if(interaction.kind!=='permission')throw fault('interaction-mapping-unavailable');
  const options=interaction.payload?.options??[];
  const option=options.find(value=>value.kind===(outcome==='allowed-once'?'allowOnce':'deny'));
  if(!['allowed-once','rejected'].includes(outcome))throw fault('interaction-mapping-unavailable');
  return {...(option?{optionId:option.id??option.optionId}:{}),action:outcome==='allowed-once'?'accept':'decline'};
}

/** Registered foreign Agent. Scope/event factories come from the installed official DSH,
 * not a parallel implementation. Inbox mutation without an official route fails explicitly. */
export class ZCodeAgent {
  status='idle';disposed=false;mirror=new MirrorState();streams=new Map();projected=new Set();turns=new Map();pendingApprovals=new Map();revision=0;idleWaiters=[];dispatches=new Set();
  constructor(ctx,session,record,{peer,createScope,agentEvents,onPersist=()=>{},onReplacement,onFirstInput,approval}={}){
    Object.assign(this,{id:session.id,session,record,peer,onPersist,onReplacement:onReplacement??(snapshot=>this.reconcile(snapshot)),onFirstInput,approval});
    this.turns=new Map(record.turns??[]);
    if(!record.turns&&record.snapshot){const ids=[...new Set(record.snapshot.rows.window.map(row=>row.turnId))];const starts=(record.events??[]).filter(event=>event.type==='turn/start'&&event.seq>=(record.historyStartSeq??0));ids.forEach((id,index)=>{if(starts[index])this.turns.set(id,starts[index].data.turn)})}
    this.nextTurn=Math.max(0,...(record.events??[]).filter(event=>event.type==='turn/start').map(event=>event.data.turn))+1;
    this.commands=new CommandLifecycle(record);
    this.options={provider:'zcode',model:record.selection?.modelId??'official-default',reasoningEffort:record.selection?.options?.reasoningLevel};
    this.scope=createScope(ctx,this);this.ctx=this.scope.ctx;this.dispatch=agentEvents(ctx,this);
    const unavailable=()=>{throw fault('official-inbox-edit-unavailable')};
    const commands=this.commands;
    this.inbox={get nextTurn(){return commands.pending('next-turn')},get nextStep(){return commands.pending('next-step')},clear:unavailable,replace:unavailable,remove:unavailable,splice:unavailable,append:(target,message)=>this.send(message,target,true),prepend:unavailable};
    this.conversation=null;
    if(record.officialId&&!record.imported)this.bindConversation();

  }
  persist(){const promise=Promise.resolve().then(()=>this.onPersist());void promise.catch(()=>{});return promise}
  append(type,data,opts){const event=this.session.append(type,clean(data),opts);this.record.events??=[];this.record.events=this.session.snapshotEvents?clean(this.session.snapshotEvents()):[...this.record.events,clean(event)];this.persist();return event}
  setStatus(status){if(this.status===status)return;this.status=status;this.dispatch.emit('agent/status',{status});if(status==='idle')for(const resolve of this.idleWaiters.splice(0))resolve()}
  bindConversation(){
    this.conversation=new V4Conversation(this.peer,{address:{runtime:'zcode',authority:this.record.authority,workspace:this.record.workspace,sessionId:this.record.officialId},workspace:{workspacePath:this.record.workspace,workspaceKey:this.record.workspace},connectionId:this.peer.connectionId,clientId:'dsh-zcode-bridge',clientMode:'desktop-continuous',runnable:true,managementAllowed:true,reconnectable:true,onChange:state=>this.project(state)});
    this.offState=this.peer.launcher?.subscribe(state=>{if(state.phase==='ready'&&this.conversation?.state.status==='error'&&!this.disposed)void this.reconnect().catch(()=>{})});
  }
  async connect(){if(!this.conversation&&this.record.officialId)this.bindConversation();if(this.conversation)await this.conversation.connect()}
  async reconnect(){if(!this.conversation)return;await this.conversation.connect();for(const command of this.conversation.state.commands)if(command.state==='outcome-unknown'){const result=await this.conversation.queryCommand(command.commandId);this.commands.receipt(command.commandId,result)}await this.persist()}
  project(state){
    if(this.disposed)return;
    if(state.error){this.record.error=state.error;this.flushStreams(true);this.setStatus('idle');this.persist();return}
    const snapshot=state.snapshot;if(!snapshot)return;
    const decision=this.mirror.accept(snapshot);if(!decision.accepted)return;
    const migrate=this.record.projectionIdentityVersion!==2&&(this.projected.size>0||(this.record.projected?.length??0)>0||Object.keys(this.record.prefixes??{}).length>0||(this.record.events??[]).some(event=>event.seq>=(this.record.historyStartSeq??0)&&(event.type==='turn/start'||['user/message','assistant/message'].includes(event.type)&&(event.data.id??event.data.message?.id??'').startsWith('zcode-'))));
    // Legacy entity keys cannot distinguish omitted rows. Replay the authoritative window behind
    // the existing native replay cut so repaired messages precede their turn end, with audit intact.
    if(decision.replaced||migrate){this.onReplacement(snapshot);return}
    this.record.projectionIdentityVersion=2;
    this.record.snapshot=snapshot;this.record.error=null;
    const groups=new Map();for(const row of snapshot.rows.window){if(!groups.has(row.turnId))groups.set(row.turnId,[]);groups.get(row.turnId).push(row)}
    for(const rows of groups.values()){
    for(const sourceRow of rows){
      const row={...sourceRow,...(sourceRow.kind==='userInput'&&!sourceRow.sourceCommandId?{sourceCommandId:rows.find(item=>item.kind==='turnHeader')?.sourceCommandId}:{}),projectionKey:projectionRowKey(snapshot.logEpoch,sourceRow.rowId)};
      const turn=this.turnFor(row.turnId);
      if(row.kind==='turnHeader'&&!this.projected.has(row.projectionKey)){this.append('turn/start',{turn});this.append('step/start',{turn,step:1});this.projected.add(row.projectionKey)}
      if(row.kind==='userInput'&&!this.projected.has(row.projectionKey)){
        this.append('user/message',{id:'zcode-'+row.projectionKey,role:'user',source:{kind:'user',...(row.sourceCommandId?{rpcId:this.commands.project(row.sourceCommandId)}:{})},content:[{type:'text',text:row.text}]},{surfaceOp:'append'});this.projected.add(row.projectionKey);
      }
      if(['assistantText','reasoning','toolCall'].includes(row.kind))this.projectAssistant(row,turn);
      if(row.kind==='toolCall'&&['success','error','cancelled'].includes(row.status)&&!this.projected.has(row.projectionKey+':result')){
        const call=this.projected.has(row.projectionKey+':call');if(!call)this.commitTool(row,turn);
        this.append('tool/result',{turn,step:1,message:{id:'zcode-result-'+row.projectionKey,role:'tool',source:{kind:'tool',callId:row.toolCallId},toolCallId:row.toolCallId,content:[{type:'text',text:row.output?.text??row.error?.message??row.status}],...(row.status==='error'?{isError:true}:{})}},{surfaceOp:'append'});
        this.projected.add(row.projectionKey+':result');
      }
    }
    for(const sourceRow of rows.filter(row=>row.kind==='turnHeader'&&row.state!=='running')){const row={...sourceRow,projectionKey:projectionRowKey(snapshot.logEpoch,sourceRow.rowId)};if(!this.projected.has(row.projectionKey+':end')){
      this.flushStreams(row.state!=='completedSuccess',this.turnFor(row.turnId));this.append('step/end',{turn:this.turnFor(row.turnId),step:1});this.append('turn/end',{turn:this.turnFor(row.turnId),reason:row.state==='completedSuccess'?{kind:'completed'}:row.state==='failed'?{kind:'error',error:{code:'UNKNOWN',message:'Official ZCode turn failed'}}:{kind:'interrupted'}});this.projected.add(row.projectionKey+':end');
    }
    }
    }
    this.setStatus(snapshot.control.canStop?'running':'idle');
    for(const interaction of snapshot.pendingInteractions)if(!this.pendingApprovals.has(interaction.interactionId)){
      const controller=new AbortController();this.pendingApprovals.set(interaction.interactionId,controller);
      void this.ask(interaction,controller).catch(error=>{this.record.error=error.code??'interaction-mapping-unavailable';this.persist()});
    }
    for(const [id,controller] of this.pendingApprovals)if(!snapshot.pendingInteractions.some(interaction=>interaction.interactionId===id)){controller.abort();this.pendingApprovals.delete(id)}
    this.record.projected=[...this.projected];this.persist();
  }
  turnFor(id){if(!this.turns.has(id)){this.turns.set(id,this.nextTurn++);this.record.turns=[...this.turns]}return this.turns.get(id)}
  reconcile(snapshot){
    // Close only local rendering activity. No official cancellation/write is synthesized.
    this.flushStreams(true);for(const controller of this.pendingApprovals.values())controller.abort();this.pendingApprovals.clear();
    let turn=null,step=null;const pendingTools=new Map();
    for(const event of this.session.snapshotEvents?.()??this.record.events??[]){
      if(event.type==='turn/start')turn=event.data.turn;
      if(event.type==='step/start')step=event.data.step;
      if(event.type==='tool/call')pendingTools.set(event.data.callId,event.data);
      if(event.type==='tool/result')pendingTools.delete(event.data.message.toolCallId);
      if(event.type==='step/end')step=null;
      if(event.type==='turn/end')turn=null;
    }
    for(const [callId,call] of pendingTools)this.append('tool/result',{turn:call.turn,step:call.step,message:{id:'zcode-replaced-'+callId+'-'+this.session.seq,role:'tool',source:{kind:'tool',callId},toolCallId:callId,content:[{type:'text',text:'Official history was replaced; this local tool projection is retired.'}]}},{surfaceOp:'append'});
    if(turn!==null){if(step!==null)this.append('step/end',{turn,step});this.append('turn/end',{turn,reason:{kind:'interrupted'}})}
    this.mirror.accept(snapshot);
    this.record.historyStartSeq=this.session.seq;this.record.historyGeneration=(this.record.historyGeneration??0)+1;
    // A non-inherited native replay cut carries the positive cursor even for empty history.
    // Full original rendering events remain in the audit log; no Session lifecycle is removed.
    this.append('session/end-seed',{});
    this.record.projected=[];this.projected.clear();this.record.prefixes={};this.turns.clear();this.record.turns=[];
    // Do not reset assistant frame revisions or native Session sequences. Future turns retain
    // their monotonically allocated native numbers, although official turn IDs may be reused.
    this.project({snapshot});
  }
  projectAssistant(row,turn){
    if(this.projected.has(row.projectionKey))return;
    if(row.kind==='toolCall'){if(!this.projected.has(row.projectionKey+':call')&&row.status!=='inputStreaming')this.commitTool(row,turn);return}
    let stream=this.streams.get(row.projectionKey);
    if(!stream){stream={attemptId:this.id+':'+(this.record.historyGeneration??0)+':'+row.projectionKey,turn,step:1,index:0,text:this.record.prefixes?.[row.projectionKey]??'',baseline:this.record.prefixes?.[row.projectionKey]??'',records:[],row};this.streams.set(row.projectionKey,stream);this.dispatch.emit('agent/assistant-stream',{frame:{type:'start',attemptId:stream.attemptId,revision:++this.revision,turn,step:1}});this.chunk(stream,{type:'block-start',index:0,blockType:row.kind==='reasoning'?'reasoning':'text'})}
    if(!row.text.startsWith(stream.text)){this.record.error='official-stream-replaced';return}
    const suffix=row.text.slice(stream.text.length);if(suffix)this.chunk(stream,{type:row.kind==='reasoning'?'reasoning-delta':'text-delta',index:0,text:suffix});stream.text=row.text;stream.row=row;
    if(row.state!=='streaming')this.commitStream(row.projectionKey,row.state!=='complete');
  }
  chunk(stream,chunk){const time=Date.now();stream.records.push({type:'chunk',time,chunk});this.dispatch.emit('agent/assistant-stream',{frame:{type:'chunk',attemptId:stream.attemptId,revision:++this.revision,index:stream.index++,time,chunk}})}
  commitStream(id,interrupted){const stream=this.streams.get(id);if(!stream)return;const block={type:stream.row.kind==='reasoning'?'reasoning':'text',text:stream.text.slice(stream.baseline.length)};this.chunk(stream,{type:'block-end',index:0,block});const event=this.append('assistant/message',{turn:stream.turn,step:1,message:{id:'zcode-'+id,role:'assistant',source:{kind:'model',provider:'zcode',model:stream.row.model??this.options.model},content:[block]},stream:stream.records,...(interrupted?{interrupted:true}:{})},{surfaceOp:'append'});this.dispatch.emit('agent/assistant-stream',{frame:{type:'end',attemptId:stream.attemptId,revision:++this.revision,index:stream.index,outcome:{kind:'committed',eventType:'assistant/message',seq:event.seq}}});this.streams.delete(id);if(interrupted){this.record.prefixes??={};this.record.prefixes[id]=stream.text}else{delete this.record.prefixes?.[id];this.projected.add(id)}}
  flushStreams(interrupted,turn){for(const [id,stream] of [...this.streams])if(turn===undefined||turn===stream.turn)this.commitStream(id,interrupted)}
  commitTool(row,turn){this.append('assistant/message',{turn,step:1,message:{id:'zcode-tool-'+row.projectionKey,role:'assistant',source:{kind:'model',provider:'zcode',model:this.options.model},content:[{type:'tool-call',id:row.toolCallId,name:row.toolName,arguments:row.inputText}]},stream:[]},{surfaceOp:'append'});this.append('tool/call',{turn,step:1,callId:row.toolCallId,name:row.toolName,arguments:row.inputText});this.projected.add(row.projectionKey+':call');this.projected.add(row.projectionKey)}
  async ask(interaction,controller){
    if(interaction.kind!=='permission'){this.record.error='interaction-mapping-unavailable:'+interaction.kind;this.persist();return}
    const request={agent:this,toolName:interaction.payload?.toolName??'ZCode',...(interaction.payload?.toolCallId?{callId:interaction.payload.toolCallId}:{}),reason:interaction.payload?.reason??interaction.payload?.summary??interaction.payload?.message??'Official ZCode permission request',signal:controller.signal};
    this.append('approval/asked',{id:interaction.interactionId,toolName:request.toolName,reason:request.reason});
    const outcome=await (this.approval?this.approval(request):this.dispatch.waterfall('approval/request',request,()=>Promise.resolve('unavailable')));
    if(controller.signal.aborted)return;
    const answer=approvalAnswer(interaction,outcome);
    this.append('approval/decided',{id:interaction.interactionId,outcome});
    if(answer){const result=await this.conversation.submit({type:'resolveInteraction',payload:{interactionId:interaction.interactionId,answer}});this.record.approval={interactionId:interaction.interactionId,outcome,settlement:'assumed-single-answerer',ack:result.ack};this.persist()}
  }
  send(message,target,wakeup){
    if(this.disposed)throw fault('agent-disposed');
    if(!wakeup)throw fault('official-inject-unavailable');
    if(message.content.some(part=>part.type!=='text'))throw fault('official-attachment-unavailable');
    const text=message.content.map(part=>part.text).join('\n');
    const {operation,duplicate}=this.commands.receive(message,target);if(duplicate)return;
    const commandId=operation.commandId;
    // Native admission remains synchronous; its identified message is readable from inbox until
    // the matching official user row arrives. Dispatch waits for the durable association.
    const task=this.persist().then(async()=>{
      if(this.disposed)throw fault('agent-disposed');
      if(!this.record.officialId){
        if(this.firstInputFlight){await this.firstInputFlight;if(!this.record.officialId)throw fault('first-input-not-created')}
        else {
          if(this.record.createCommandId)throw fault('create-outcome-unknown');
          operation.type='createSession';
          this.firstInputFlight=this.onFirstInput(this,operation,text);
          try{return await this.firstInputFlight}finally{this.firstInputFlight=null}
        }
      }
      if(!await this.whenProjectionReady())throw fault('projection-unconfirmed');
      this.commands.mark(commandId,'dispatching');
      return this.conversation.submit({type:'sendText',commandId,payload:{text,...(this.record.selection?{modelSelection:this.record.selection}:{}),requestedDelivery:target==='next-step'?'guide':'queue',mode:this.record.mode??'build'}});
    }).then(result=>{this.commands.receipt(commandId,result);return this.persist()},error=>{
      this.commands.mark(commandId,error.sent===false?'not-sent':(this.record.createCommandId===commandId||this.conversation?.command(commandId))?'outcome-unknown':'not-sent',{error:error.code??'send-failed'});this.record.error=error.code??'send-failed';return this.persist();
    });
    this.dispatches.add(task);void task.finally(()=>this.dispatches.delete(task)).catch(()=>{});
  }

  followup(message){this.send(message,'next-turn',true)}
  steer(message){this.send(message,'next-step',true)}
  inject(){throw fault('official-inject-unavailable')}
  cancel(){for(const controller of this.pendingApprovals.values())controller.abort();const snapshot=this.conversation?.state.snapshot;const work=snapshot?.control.activeWorks.find(work=>work.foregroundExecutionId);if(snapshot?.control.canStop&&work)void this.conversation.submit({type:'stop',payload:{expectedForegroundExecutionId:work.foregroundExecutionId}}).catch(error=>{this.record.error=error.code;this.persist()})}
  whenIdle(){return this.status==='idle'?Promise.resolve():new Promise(resolve=>this.idleWaiters.push(resolve))}
  runMaintenance(task){if(this.status!=='idle')throw fault('agent-busy');return task(new AbortController().signal)}
  /** Wait until the mirror projection is live so a selection can be admitted. A freshly created
   * session's default binding races its own subscribe; without this the submit fails as
   * projection-unconfirmed before the first snapshot. */
  async whenProjectionReady(timeoutMs=5000){
    const ready=()=>this.conversation?.state.admission.allowed===true;
    if(ready())return true;
    await this.connect().catch(()=>{});
    const deadline=Date.now()+timeoutMs;
    while(!ready()&&!this.disposed&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
    return ready();
  }
  /** Dispatch one OFFICIAL-identity selection through the app-server and classify the ACK.
   * The runtime selection is only installed on a confirmed/unchanged outcome; the caller decides
   * what the user sees, so a failed/outcome-unknown ACK never looks like a success. */
  async select(official){
    if(!this.record.officialId&&!this.record.createCommandId){this.record.selection=clean(official);await this.persist();return {outcome:'confirmed',state:'staged'}}
    if(!this.record.officialId)throw fault('create-outcome-unknown');
    await this.whenProjectionReady();
    const result=await this.conversation.submit({type:'switchModelConfig',payload:{provider:official.providerId,model:official.modelId,thought:official.options?.reasoningLevel??''}});
    const outcome=selectionOutcome(result);
    if(outcome.outcome==='confirmed'||outcome.outcome==='unchanged'){this.record.selection=clean(official);this.options.model=official.modelId;this.options.reasoningEffort=official.options?.reasoningLevel;this.persist()}
    return {...outcome,state:result?.state};
  }
  /** Commit a confirmed selection: keep the official identity for execution (sendText/switchModelConfig)
   * and append the DSH presentation route as the durable `model/selection` projection. The event goes
   * through `append`, so record.events/persistence capture it and the picker restores after restart. */
  confirmSelection({display,official}){
    const execution=officialSelection(official);
    if(!sameSelection(this.record.selection,execution)){this.record.selection=clean(execution);this.persist()}
    this.options.model=display.model;this.options.reasoningEffort=display.reasoningEffort;
    const projection=displayProjection(display);
    const events=this.session.snapshotEvents?.()??this.record.events??[];
    const last=[...events].reverse().find(event=>event.type==='model/selection')?.data;
    if(!sameSelection(last,projection))this.append('model/selection',projection);else this.persist();
    return projection;
  }
  async dispose(){if(this.disposal)return this.disposal;this.disposed=true;return this.disposal=this.disposeOwned()}
  async disposeOwned(){this.offState?.();await Promise.allSettled([...this.dispatches]);for(const controller of this.pendingApprovals.values())controller.abort();this.flushStreams(true);await this.conversation?.cancel();await this.scope.dispose();this.setStatus('idle')}
}
