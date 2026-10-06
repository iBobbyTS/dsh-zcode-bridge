import {approvalAnswer} from '../host/zcode-agent.mjs';
import {DriverInbox} from './inbox.mjs';
import {commandFault,inputCommandId,ROUTED_COMMANDS,rejectOperation,validateMessage,promptPayload,requestedDelivery} from './commands.mjs';

export class DriverAgent {
  status='idle';disposed=false;activity=null;tasks=new Set();inputs=new Map();approvals=new Map();idleWaiters=[];lastError=null;
  constructor(ctx,session,options,zcodeConversationId,{createScope,agentEvents,parentAgent,transport}){
    Object.assign(this,{id:session.id,session,options:Object.freeze({...options}),zcodeConversationId,transport});
    this.scope=createScope(ctx,this,parentAgent?{parent:parentAgent}:undefined);
    this.ctx=this.scope.ctx;this.dispatch=agentEvents(ctx,this);this.inbox=new DriverInbox(this);
    for(const target of ['next-turn','next-step'])for(const message of this.inbox.current()[target]){
      if(!message.id.startsWith('zcode-queue:'))this.inputs.set(message.id,{message,commandId:inputCommandId(this.id,message.id),target});
    }
    this.conversation=transport?.conversation?.({zcodeConversationId,cwd:session.header.cwd});
    this.offConversation=this.conversation?.subscribe(state=>this.observe(state));
  }
  assertAvailable(){if(this.disposed)throw commandFault('agent-disposed');if(!this.conversation)throw commandFault('driver-command-unavailable')}
  track(task){
    this.tasks.add(task);
    void task.catch(error=>{this.lastError=error;this.dispatch.emit('agent/error',{error})}).finally(()=>{this.tasks.delete(task);this.notifyIdle()});
    return task;
  }
  setStatus(status){if(this.status!==status){this.status=status;this.dispatch.emit('agent/status',{status})}this.notifyIdle()}
  notifyIdle(){if(this.status==='idle'&&!this.activity&&!this.tasks.size)for(const resolve of this.idleWaiters.splice(0))resolve()}
  observe(state){
    if(this.disposed)return;
    if(state.status!=='live'){if(state.error)this.lastError=commandFault(state.error);return}
    const snapshot=state.snapshot;if(!snapshot)return;
    this.setStatus(snapshot.control.canStop||snapshot.control.activeWorks.length?'running':'idle');
    this.inbox.sync(snapshot);
    for(const [id,controller] of this.approvals)if(!snapshot.pendingInteractions.some(item=>item.interactionId===id))controller.abort();
    for(const interaction of snapshot.pendingInteractions){
      if(this.approvals.has(interaction.interactionId))continue;
      if(interaction.kind!=='permission'){this.lastError=commandFault('interaction-mapping-unavailable');continue}
      const controller=new AbortController();this.approvals.set(interaction.interactionId,controller);
      this.track(this.ask(interaction,controller));
    }
  }
  ready(){return this.readiness??=this.readyOwned().finally(()=>{this.readiness=null})}
  async readyOwned(){
    this.assertAvailable();
    if(!this.conversation.state.admission.allowed){
      await this.transport.ready?.(this.session.header.cwd,new AbortController().signal);
      await this.conversation.connect({forceSnapshot:true});
      if(!this.conversation.state.admission.allowed)await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{off();reject(commandFault('projection-unconfirmed'))},5000);
        const off=this.conversation.subscribe(state=>{if(state.admission.allowed||state.status==='closed'||state.error){clearTimeout(timer);off();state.admission.allowed?resolve():reject(commandFault(state.error??'agent-disposed'))}});
      });
    }
    this.assertAvailable();
    // Loss is classified by V4Conversation first. Query the same ids, never replay.
    for(const command of this.conversation.state.commands)if(command.state==='outcome-unknown'){
      const result=await this.conversation.queryCommand(command.commandId);
      if(result.state==='outcome-unknown')throw commandFault('command-outcome-unknown');
    }
  }
  send(message,target,wakeup){
    this.assertAvailable();if(!wakeup)rejectOperation('inject');validateMessage(message);
    if(this.inputs.has(message.id))throw commandFault('official-message-already-admitted');
    this.inbox.admit(target,message);
    // Identity association only: command state always comes from V4Conversation.
    const input={message:structuredClone(message),commandId:inputCommandId(this.id,message.id),target};this.inputs.set(message.id,input);
    const run=async()=>{
      await this.ready();
      if(!this.inbox.locate(message.id))throw commandFault('input-canceled');
      const payload=await promptPayload(input.message,this.conversation,this.ctx.get?.('attachments')??this.ctx.attachments,{modelSelection:this.options.modelSelection,mode:this.options.mode});
      this.assertAvailable();
      const state=this.conversation.state;
      const pending=state.commands.some(command=>command.type==='sendText'&&['sent-unconfirmed','accepted-awaiting-terminal','running','waiting'].includes(command.state));
      return this.conversation.submit({type:'sendText',commandId:input.commandId,payload:{...payload,requestedDelivery:target==='next-turn'&&pending?'queue':requestedDelivery(target,state.snapshot)}});
    };
    input.task=this.track((this.activity?this.activity.done:Promise.resolve()).then(run));
  }
  followup(message){this.send(message,'next-turn',true)}
  steer(message){this.send(message,'next-step',true)}
  inject(){this.assertAvailable();rejectOperation('inject')}
  confirmHeldInput({messageId,disposition,expectedQueueItemIds,baseRevision,baseLogEpoch}){
    this.assertAvailable();
    if(!['clearQueueAndSend','keepQueueAndSend'].includes(disposition))throw commandFault('held-disposition-invalid');
    const input=this.inputs.get(messageId);
    if(!input||this.conversation.command(input.commandId))throw commandFault('held-input-unconfirmed');
    return this.track((async()=>{
      if(!input.task)throw commandFault('held-input-unconfirmed');
      await input.task.catch(()=>{});await this.ready();
      const snapshot=this.conversation.state.snapshot;
      if(baseRevision!==snapshot.revision||baseLogEpoch!==snapshot.logEpoch)throw commandFault('held-queue-confirmation-stale');
      if(!this.inbox.locate(messageId)||snapshot.inputRouting.mode!=='choice')throw commandFault('held-input-unconfirmed');
      const payload=await promptPayload(input.message,this.conversation,this.ctx.get?.('attachments')??this.ctx.attachments,{modelSelection:this.options.modelSelection,mode:this.options.mode});
      return this.conversation.submit({type:'sendText',commandId:input.commandId,baseRevision,baseLogEpoch,
        payload:{...payload,requestedDelivery:'startNow',heldQueueDisposition:disposition,expectedHeldQueueItemIds:expectedQueueItemIds}});
    })());
  }
  submitControl(command){
    this.assertAvailable();if(!ROUTED_COMMANDS.has(command.type))rejectOperation(command.type);
    return this.track((async()=>{
      await this.ready();const snapshot=this.conversation.state.snapshot;
      if(command.baseRevision!==undefined&&command.baseRevision!==snapshot.revision)throw commandFault('proto.staleRevision');
      if(command.type==='resolveInteraction'&&snapshot.pendingInteractions.find(item=>item.interactionId===command.payload?.interactionId)?.kind!=='permission')rejectOperation('userInput');
      return this.conversation.submit(command);
    })());
  }
  rename(title){return this.submitControl({type:'renameSession',payload:{title}})}
  queueAction({queueItemId,action,newText,beforeQueueItemId,baseRevision,baseLogEpoch}){
    const type={edit:'editQueueItem',sendNow:'sendQueuedNow',reorder:'reorderQueueItem'}[action];
    if(!type)rejectOperation(action);
    return this.submitControl({type,baseRevision,baseLogEpoch,payload:{queueItemId,...(action==='edit'?{newText}:{}),...(action==='reorder'?{beforeQueueItemId}:{})}});
  }
  cancel(cause,options={}){
    if(this.disposed)throw commandFault('agent-disposed');
    if(this.conversation?.state.status==='error')throw commandFault('execution-unavailable');
    if(this.conversation&&!this.conversation.state.admission.allowed)throw commandFault('projection-unconfirmed');
    if(!options.keepInbox)this.inbox.clear();
    this.activity?.controller.abort(cause);
    const snapshot=this.conversation?.state.snapshot;
    if(!snapshot?.control.canStop)return;
    const work=snapshot.control.activeWorks.find(work=>work.foregroundExecutionId);
    return this.submitControl({type:'stop',payload:{expectedForegroundExecutionId:work?.foregroundExecutionId}});
  }
  async ask(interaction,controller){
    const request={agent:this,toolName:interaction.payload?.toolName??'ZCode',...(interaction.payload?.toolCallId?{callId:interaction.payload.toolCallId}:{}),reason:interaction.payload?.reason??interaction.payload?.summary??interaction.payload?.message??'Official ZCode permission request',signal:controller.signal};
    this.session.append('approval/asked',{id:interaction.interactionId,toolName:request.toolName,reason:request.reason});
    let abort;
    const canceled=new Promise(resolve=>{abort=()=>resolve('cancelled');controller.signal.addEventListener('abort',abort,{once:true})});
    let outcome;
    try{outcome=await Promise.race([this.dispatch.waterfall('approval/request',request,()=>Promise.resolve('unavailable')),canceled])}
    finally{controller.signal.removeEventListener('abort',abort)}
    if(controller.signal.aborted||this.disposed)return;
    const answer=approvalAnswer(interaction,outcome);
    this.session.append('approval/decided',{id:interaction.interactionId,outcome});
    if(answer)return this.submitControl({type:'resolveInteraction',payload:{interactionId:interaction.interactionId,answer}});
  }
  async whenIdle(){while(this.activity||this.tasks.size||this.status!=='idle')await new Promise(resolve=>this.idleWaiters.push(resolve))}
  runMaintenance(task){
    if(this.disposed)throw new Error('agent is disposed');
    if(this.activity)throw new Error('agent maintenance is already active');
    if(this.status!=='idle'||this.tasks.size)throw commandFault('agent-busy');
    const controller=new AbortController();let finish;
    const activity={controller,done:new Promise(resolve=>{finish=resolve})};this.activity=activity;
    let result;try{result=task(controller.signal)}catch(error){result=Promise.reject(error)}
    return Promise.resolve(result).finally(()=>{this.activity=null;finish();this.notifyIdle()});
  }
  stop(){return this.shutdown??=this.stopOwned()}
  async stopOwned(){
    this.disposed=true;this.activity?.controller.abort({kind:'disposed'});
    for(const controller of this.approvals.values())controller.abort();
    this.offConversation?.();await this.conversation?.cancel();
    await this.activity?.done;await Promise.allSettled([...this.tasks]);this.setStatus('idle');
  }
}
