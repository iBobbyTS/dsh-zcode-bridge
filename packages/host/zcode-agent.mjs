import { randomUUID } from 'node:crypto';
import { V4Conversation, newCommandId } from './conversation.mjs';
import { MirrorState } from './mirror-state.mjs';
const fault=code=>Object.assign(new Error(code),{code});
const clean=value=>JSON.parse(JSON.stringify(value));
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
  status='idle';disposed=false;mirror=new MirrorState();streams=new Map();projected=new Set();turns=new Map();pendingApprovals=new Map();revision=0;idleWaiters=[];
  constructor(ctx,session,record,{peer,createScope,agentEvents,onPersist=()=>{},onReplacement=()=>{},approval}={}){
    Object.assign(this,{id:session.id,session,record,peer,onPersist,onReplacement,approval});
    this.options={provider:'zcode',model:record.selection?.modelId??'official-default',reasoningEffort:record.selection?.options?.reasoningLevel};
    this.scope=createScope(ctx,this);this.ctx=this.scope.ctx;this.dispatch=agentEvents(ctx,this);
    const unavailable=()=>{throw fault('official-inbox-edit-unavailable')};
    this.inbox={nextTurn:[],nextStep:[],clear:unavailable,replace:unavailable,remove:unavailable,splice:unavailable,append:(target,message)=>this.send(message,target,true),prepend:unavailable};
    this.conversation=new V4Conversation(peer,{address:{runtime:'zcode',authority:record.authority,workspace:record.workspace,sessionId:record.officialId},workspace:{workspacePath:record.workspace,workspaceKey:record.workspace},connectionId:peer.connectionId,clientId:'dsh-zcode-bridge',clientMode:'desktop-continuous',runnable:true,managementAllowed:true,reconnectable:true,onChange:state=>this.project(state)});
    this.offState=peer.launcher?.subscribe(state=>{if(state.phase==='ready'&&this.conversation.state.status==='error'&&!this.disposed)void this.reconnect().catch(()=>{})});
  }
  persist(){const promise=Promise.resolve().then(()=>this.onPersist());void promise.catch(()=>{});return promise}
  append(type,data,opts){const event=this.session.append(type,clean(data),opts);this.record.events??=[];this.record.events=this.session.snapshotEvents?clean(this.session.snapshotEvents()):[...this.record.events,clean(event)];this.persist();return event}
  setStatus(status){if(this.status===status)return;this.status=status;this.dispatch.emit('agent/status',{status});if(status==='idle')for(const resolve of this.idleWaiters.splice(0))resolve()}
  async connect(){await this.conversation.connect()}
  async reconnect(){await this.conversation.connect();for(const command of this.conversation.state.commands)if(command.state==='outcome-unknown')await this.conversation.queryCommand(command.commandId)}
  project(state){
    if(this.disposed)return;
    if(state.error){this.record.error=state.error;this.flushStreams(true);this.setStatus('idle');this.persist();return}
    const snapshot=state.snapshot;if(!snapshot)return;
    const decision=this.mirror.accept(snapshot);if(!decision.accepted)return;
    if(decision.replaced){this.record.snapshot=snapshot;this.persist();this.onReplacement(snapshot);return}
    this.record.snapshot=snapshot;this.record.error=null;
    for(const sourceRow of snapshot.rows.window){
      const row={...sourceRow,entityId:sourceRow.entityId??snapshot.logEpoch+':row:'+sourceRow.rowId};
      const turn=this.turnFor(row.turnId);
      if(row.kind==='turnHeader'&&!this.projected.has(row.entityId)){this.append('turn/start',{turn});this.append('step/start',{turn,step:1});this.projected.add(row.entityId)}
      if(row.kind==='userInput'&&!this.projected.has(row.entityId)){
        this.append('user/message',{id:'zcode-'+row.entityId,role:'user',source:{kind:'user',...(row.sourceCommandId?{rpcId:row.sourceCommandId}:{})},content:[{type:'text',text:row.text}]},{surfaceOp:'append'});this.projected.add(row.entityId);
      }
      if(['assistantText','reasoning','toolCall'].includes(row.kind))this.projectAssistant(row,turn);
      if(row.kind==='toolCall'&&['success','error','cancelled'].includes(row.status)&&!this.projected.has(row.entityId+':result')){
        const call=this.projected.has(row.entityId+':call');if(!call)this.commitTool(row,turn);
        this.append('tool/result',{turn,step:1,message:{id:'zcode-result-'+row.entityId,role:'tool',source:{kind:'tool',callId:row.toolCallId},toolCallId:row.toolCallId,content:[{type:'text',text:row.output?.text??row.error?.message??row.status}],...(row.status==='error'?{isError:true}:{})}},{surfaceOp:'append'});
        this.projected.add(row.entityId+':result');
      }
    }
    for(const sourceRow of snapshot.rows.window.filter(row=>row.kind==='turnHeader'&&row.state!=='running')){const row={...sourceRow,entityId:sourceRow.entityId??snapshot.logEpoch+':row:'+sourceRow.rowId};if(!this.projected.has(row.entityId+':end')){
      this.flushStreams(row.state!=='completedSuccess');this.append('step/end',{turn:this.turnFor(row.turnId),step:1});this.append('turn/end',{turn:this.turnFor(row.turnId),reason:row.state==='completedSuccess'?{kind:'completed'}:row.state==='failed'?{kind:'error',error:{code:'UNKNOWN',message:'Official ZCode turn failed'}}:{kind:'interrupted'}});this.projected.add(row.entityId+':end');
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
  turnFor(id){if(!this.turns.has(id))this.turns.set(id,this.turns.size+1);return this.turns.get(id)}
  projectAssistant(row,turn){
    if(this.projected.has(row.entityId))return;
    if(row.kind==='toolCall'){if(!this.projected.has(row.entityId+':call')&&row.status!=='inputStreaming')this.commitTool(row,turn);return}
    let stream=this.streams.get(row.entityId);
    if(!stream){stream={attemptId:this.id+':'+row.entityId,turn,step:1,index:0,text:this.record.prefixes?.[row.entityId]??'',baseline:this.record.prefixes?.[row.entityId]??'',records:[],row};this.streams.set(row.entityId,stream);this.dispatch.emit('agent/assistant-stream',{frame:{type:'start',attemptId:stream.attemptId,revision:++this.revision,turn,step:1}});this.chunk(stream,{type:'block-start',index:0,blockType:row.kind==='reasoning'?'reasoning':'text'})}
    if(!row.text.startsWith(stream.text)){this.record.error='official-stream-replaced';return}
    const suffix=row.text.slice(stream.text.length);if(suffix)this.chunk(stream,{type:row.kind==='reasoning'?'reasoning-delta':'text-delta',index:0,text:suffix});stream.text=row.text;stream.row=row;
    if(row.state!=='streaming')this.commitStream(row.entityId,row.state!=='complete');
  }
  chunk(stream,chunk){const time=Date.now();stream.records.push({type:'chunk',time,chunk});this.dispatch.emit('agent/assistant-stream',{frame:{type:'chunk',attemptId:stream.attemptId,revision:++this.revision,index:stream.index++,time,chunk}})}
  commitStream(id,interrupted){const stream=this.streams.get(id);if(!stream)return;const block={type:stream.row.kind==='reasoning'?'reasoning':'text',text:stream.text.slice(stream.baseline.length)};this.chunk(stream,{type:'block-end',index:0,block});const event=this.append('assistant/message',{turn:stream.turn,step:1,message:{id:'zcode-'+id,role:'assistant',source:{kind:'model',provider:'zcode',model:stream.row.model??this.options.model},content:[block]},stream:stream.records,...(interrupted?{interrupted:true}:{})},{surfaceOp:'append'});this.dispatch.emit('agent/assistant-stream',{frame:{type:'end',attemptId:stream.attemptId,revision:++this.revision,index:stream.index,outcome:{kind:'committed',eventType:'assistant/message',seq:event.seq}}});this.streams.delete(id);if(interrupted){this.record.prefixes??={};this.record.prefixes[id]=stream.text}else{delete this.record.prefixes?.[id];this.projected.add(id)}}
  flushStreams(interrupted){for(const id of [...this.streams.keys()])this.commitStream(id,interrupted)}
  commitTool(row,turn){this.append('assistant/message',{turn,step:1,message:{id:'zcode-tool-'+row.entityId,role:'assistant',source:{kind:'model',provider:'zcode',model:this.options.model},content:[{type:'tool-call',id:row.toolCallId,name:row.toolName,arguments:row.inputText}]},stream:[]},{surfaceOp:'append'});this.append('tool/call',{turn,step:1,callId:row.toolCallId,name:row.toolName,arguments:row.inputText});this.projected.add(row.entityId+':call');this.projected.add(row.entityId)}
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
    const commandId=newCommandId();
    // Public Agent delivery is synchronous, like native. Persist the operation identity before
    // dispatch; transport ambiguity never triggers an automatic resend.
    this.record.pending={commandId,type:'sendText'};
    void Promise.resolve(this.persist()).then(()=>this.conversation.submit({type:'sendText',commandId,payload:{text,...(this.record.selection?{modelSelection:this.record.selection}:{}),requestedDelivery:target==='next-step'?'guide':'queue',mode:this.record.mode??'build'}})).then(result=>{this.record.lastCommand=result;this.record.pending=result.state==='outcome-unknown'?this.record.pending:null;this.persist()},error=>{this.record.error=error.code??'send-failed';this.persist()});
  }
  followup(message){this.send(message,'next-turn',true)}
  steer(message){this.send(message,'next-step',true)}
  inject(){throw fault('official-inject-unavailable')}
  cancel(){for(const controller of this.pendingApprovals.values())controller.abort();const snapshot=this.conversation.state.snapshot;const work=snapshot?.control.activeWorks.find(work=>work.foregroundExecutionId);if(snapshot?.control.canStop&&work)void this.conversation.submit({type:'stop',payload:{expectedForegroundExecutionId:work.foregroundExecutionId}}).catch(error=>{this.record.error=error.code;this.persist()})}
  whenIdle(){return this.status==='idle'?Promise.resolve():new Promise(resolve=>this.idleWaiters.push(resolve))}
  runMaintenance(task){if(this.status!=='idle')throw fault('agent-busy');return task(new AbortController().signal)}
  async select(selection){const result=await this.conversation.submit({type:'switchModelConfig',payload:{provider:selection.providerId,model:selection.modelId,thought:selection.options?.reasoningLevel??''}});if(['accepted','duplicate'].includes(result.ack?.status)){this.record.selection=clean(selection);this.options.model=selection.modelId;this.options.reasoningEffort=selection.options?.reasoningLevel;this.persist()}return result}
  async dispose(){this.disposed=true;this.offState?.();for(const controller of this.pendingApprovals.values())controller.abort();this.flushStreams(true);await this.conversation.cancel();await this.scope.dispose();this.setStatus('idle')}
}
