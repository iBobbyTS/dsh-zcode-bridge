import {approvalAnswer} from '../host/zcode-agent.mjs';
import {selectionOutcome} from '../host/model-selection.mjs';
import {DriverInbox} from './inbox.mjs';
import {commandFault,inputCommandId,ROUTED_COMMANDS,rejectOperation,validateMessage,promptPayload,requestedDelivery} from './commands.mjs';
import {queueSteerTransfer,requireAcceptedCommand} from './queue-steer.mjs';
import {captureControlReceipt} from './control-receipts.mjs';
import {validateHookReview,validateInteractionRoute,driverHookOperation} from './hook-review.mjs';
import {classifyUserInputRoute,USER_INPUT_OFFICIAL,officialRequestQuestions,officialAnswerPayload} from '../host/user-input.mjs';
import {ConversationEventTranslator} from './events.mjs';
import {installCompactCommand,compactOperation} from './compact.mjs';
import {historyOperation} from './history.mjs';
import {newCommandId} from '../host/conversation.mjs';

export class DriverAgent {
  status='idle';disposed=false;activity=null;tasks=new Set();inputs=new Map();approvals=new Map();idleWaiters=[];lastError=null;wasError=false;resolvingInputs=false;
  constructor(ctx,session,options,zcodeConversationId,{createScope,agentEvents,parentAgent,transport,conversation}){
    Object.assign(this,{id:session.id,session,options:Object.freeze({...options}),zcodeConversationId,transport});
    this.scope=createScope(ctx,this,parentAgent?{parent:parentAgent}:undefined);
    this.ctx=this.scope.ctx;this.dispatch=agentEvents(ctx,this);this.inbox=new DriverInbox(this);
    const replacements=new Map();
    for(let seq=0;seq<session.seq;seq++){
      const event=session.eventAt(seq);
      if(event.type==='agent/input/command-replaced'&&event.data?.messageId&&event.data?.commandId){
        replacements.set(event.data.messageId,event.data.commandId);
      }
    }
    for(const target of ['next-turn','next-step'])for(const message of this.inbox.current()[target]){
      if(!message.id.startsWith('zcode-queue:')){
        const commandId=replacements.get(message.id)??inputCommandId(this.id,message.id);
        this.inputs.set(message.id,{message,commandId,target,reconstructed:true});
      }
    }
    this.conversation=conversation??transport?.conversation?.({zcodeConversationId,cwd:session.header.cwd});
    if(this.conversation)this.translator=new ConversationEventTranslator({session,dispatch:this.dispatch,conversation:this.conversation,
      attachments:()=>this.ctx.get?this.ctx.get('attachments'):this.ctx.attachments,
      input:commandId=>[...this.inputs.values()].find(input=>input.commandId===commandId)?.message,
      acceptInput:row=>this.conversation.command(row.sourceCommandId)?.ack?.status!=='rejected',
      syncInbox:snapshot=>{if(!this.resolvingInputs)this.inbox.sync(snapshot)},claim:id=>{const location=this.inbox.locate(id);if(location)this.inbox.commit(location.target,location.index,1,[])},
    });
    this.offConversation=this.conversation?.subscribe(state=>this.observe(state));
    this.offRecovery=this.conversation?.peer.launcher?.subscribe(state=>{
      if(state.phase==='ready'&&(this.conversation.state.status==='error'||this.wasError)&&!this.disposed){
        this.wasError=false;
        this.track(this.ready());
      }
    });
    installCompactCommand(this);
  }
  assertAvailable(){if(this.disposed)throw commandFault('agent-disposed');if(!this.conversation)throw commandFault('driver-command-unavailable')}
  compactOperation(payload,signal){return this.track(compactOperation(this,payload,signal))}
  historyOperation(payload,signal){return this.track(historyOperation(this,payload,signal))}
  hookOperation(payload,signal){return this.track(driverHookOperation(this,payload,signal))}
  track(task){
    this.tasks.add(task);
    void task.catch(error=>this.reportError(error)).finally(()=>{this.tasks.delete(task);this.notifyIdle()});
    return task;
  }
  reportError(error){this.lastError=error;this.dispatch.emit('agent/error',{error})}
  setStatus(status){if(this.status!==status){this.status=status;this.dispatch.emit('agent/status',{status})}this.notifyIdle()}
  notifyIdle(){if(this.status==='idle'&&!this.activity&&!this.tasks.size)for(const resolve of this.idleWaiters.splice(0))resolve()}
  observe(state){
    if(this.disposed)return;
    if(state.status!=='live'){
      if(state.status==='error')this.wasError=true;
      if(state.error){this.reportError(commandFault(state.error));this.translator&&this.track(this.translator.interrupt())}
      if(state.status==='error'&&this.conversation?.peer.launcher?.state?.phase==='ready'&&!this.disposed){
        this.wasError=false;
        this.track(this.ready());
      }
      return;
    }
    const snapshot=state.snapshot;if(!snapshot)return;
    this.setStatus(snapshot.control.canStop||snapshot.control.activeWorks.length?'running':'idle');
    if(!this.resolvingInputs)this.inbox.sync(snapshot,{deferConsumption:true});
    this.track(this.translator.enqueue(snapshot));
    for(const [id,controller] of this.approvals)if(!snapshot.pendingInteractions.some(item=>item.interactionId===id))controller.abort();
    for(const interaction of snapshot.pendingInteractions){
      if(interaction.kind==='workspaceHookReview')continue;
      if(this.approvals.has(interaction.interactionId))continue;
      if(interaction.kind==='permission'){
        const controller=new AbortController();this.approvals.set(interaction.interactionId,controller);
        this.track(this.ask(interaction,controller));continue;
      }
      if(interaction.kind==='userInput'){
        // Only the generic, untimed variant has an official surface. Restricted/timed variants stay
        // pending for the plugin questionnaire card (masking / no draft / no free text / snooze).
        if(classifyUserInputRoute(interaction)!==USER_INPUT_OFFICIAL)continue;
        const controller=new AbortController();this.approvals.set(interaction.interactionId,controller);
        this.track(this.askUserInput(interaction,controller));continue;
      }
      this.reportError(commandFault('interaction-mapping-unavailable'));
    }
  }
  ready(){return this.readiness??=this.readyOwned().then(()=>{this.dispatchPendingInputs()}).finally(()=>{this.readiness=null})}
  async readyOwned(){
    // Inbox pruning must never win the race against recovery resolution: the flag spans the
    // whole readiness window (connect, admission wait, queries), and the finally-clause sync
    // is the first prune permitted after every unsettled input command reached an outcome.
    this.resolvingInputs=true;
    let settled=false;
    try{
      await this.#readyOwnedResolve();
      settled=true;
    }finally{
      this.resolvingInputs=false;
      this.wasError=false;
      // A failed resolution must not prune either: unsettled inputs stay queued for the retry.
      if(settled&&this.conversation?.state?.snapshot)this.inbox.sync(this.conversation.state.snapshot,{deferConsumption:true});
    }
  }
  async #readyOwnedResolve(){
    this.assertAvailable();
    if(!this.conversation.state.admission.allowed){
      // Admission only needs the authenticated handshake, never the create-side cwd equality:
      // a resumed legacy session lives in its own project workspace while the launcher keeps a
      // single execution workspace, and the conversation address already carries the session's
      // own workspace. Passing the session cwd here would fault driver-workspace-mismatch and
      // leave the live subscription (and every snapshot-driven surface) permanently dormant.
      await this.transport.ready?.(undefined,new AbortController().signal);
      await this.conversation.connect({forceSnapshot:true});
      if(!this.conversation.state.admission.allowed)await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{off();reject(commandFault('projection-unconfirmed'))},5000);
        const off=this.conversation.subscribe(state=>{if(state.admission.allowed||state.status==='closed'||state.error){clearTimeout(timer);off();state.admission.allowed?resolve():reject(commandFault(state.error??'agent-disposed'))}});
      });
    }
    this.assertAvailable();
    await this.resolvePendingInputs();
  }
  async resolvePendingInputs(){
    for(const [id,input] of this.inputs){
      // A live in-flight submit owns its own outcome: transportLost converts it to
      // outcome-unknown synchronously, so resolving here could only race a healthy ACK.
      if(input.dispatching)continue;
      // Delivery evidence outranks inbox residence and is re-read per input: the translator
      // can claim (consume) an input while this loop awaits another input's query, and its
      // old-epoch command would otherwise never reach a terminal state.
      const liveSnapshot=this.conversation.state.snapshot;
      const delivered=liveSnapshot?.rows?.window?.some(row=>row.sourceCommandId===input.commandId);
      if(delivered){
        const record=this.conversation.command(input.commandId);
        if(record)this.conversation.settleCommand?.(input.commandId,'completed');
        // Register only while the inbox still holds the input — the post-resolution sync
        // needs the terminal record to keep dispatchPendingInputs away. A consumed input
        // whose ledger record was capacity-evicted re-registers nothing: re-occupying a
        // slot at a full ledger would throw and abort the whole recovery loop.
        else if(this.inbox.locate(id)){
          try{this.conversation.registerCommand?.({commandId:input.commandId,type:'sendText',state:'completed'})}
          catch(error){/* at capacity: the user-row sync consumes it without a ledger record */}
        }
        continue;
      }
      if(!this.inbox.locate(id))continue;
      const snapshot=liveSnapshot;
      let record=this.conversation.command(input.commandId);
      const trackedSubmission=!!record;
      if(!record){
        if(!input.reconstructed||snapshot?.inputRouting?.mode==='choice')continue;
        delete input.reconstructed;
        record=this.conversation.registerCommand?.({commandId:input.commandId,type:'sendText',state:'outcome-unknown'});
      }
      // 'sent-unconfirmed' is excluded on purpose: that state means a live submit is still
      // awaiting the official decision, and a query would legitimately return unknown.
      if(record&&['outcome-unknown','accepted-awaiting-terminal','running','waiting'].includes(record.state)){
        let queryResult;
        try{queryResult=await this.conversation.queryCommand(input.commandId)}
        catch(err){
          queryResult=this.conversation.command(input.commandId);
        }
        if(queryResult?.state==='failed'&&(queryResult.ack?.reasonCode==='fault.command.inputDiscardedOnRestart'||queryResult.error==='fault.command.inputDiscardedOnRestart')){
          const newId=newCommandId();
          this.session.append('agent/input/command-replaced',{messageId:input.message.id,originalCommandId:input.commandId,commandId:newId});
          input.commandId=newId;
          this.inbox.queueIds.delete(id);
          this.reportError(commandFault('fault.command.inputDiscardedOnRestart'));
          continue;
        }
        if(queryResult?.state==='failed'&&(queryResult.ack?.reasonCode==='fault.command.queryUnavailable'||queryResult.error==='fault.command.queryUnavailable')){
          // A transient fact-store failure is not an outcome: keep the command re-queryable
          // and the input in the inbox, or the post-resolution sync would prune it silently.
          this.conversation.settleCommand?.(input.commandId,'outcome-unknown',{ack:undefined});
          this.inbox.queueIds.delete(id);
          if(!input.queryFaultAlerted){input.queryFaultAlerted=true;this.reportError(commandFault('fault.command.queryUnavailable'))}
          continue;
        }
        if(queryResult?.state==='outcome-unknown'){
          this.conversation.settleCommand?.(input.commandId,'not-sent');
          this.inbox.queueIds.delete(id);
          // Only a command this process actually submitted has a degraded outcome to report;
          // a reconstructed input resolving unknown is a first dispatch, not a recovery fault.
          if(trackedSubmission)this.reportError(commandFault('command-outcome-unknown'));
          continue;
        }
        if(queryResult?.ack?.status==='duplicate'||queryResult?.state==='accepted-awaiting-terminal'||queryResult?.state==='completed'){
          if(!snapshot?.queue?.items?.some(item=>item.queueItemId===this.inbox.queueIds.get(id))){
            this.inbox.queueIds.delete(id);
          }
        }
      }
    }
    for(const command of this.conversation.state.commands){
      if(command.state==='outcome-unknown'&&![...this.inputs.values()].some(i=>i.commandId===command.commandId)){
        const result=await this.conversation.queryCommand(command.commandId);
        // A control command with an unknowable outcome never justifies blocking all input
        // delivery. Controls are transient and never replayed; degrade and let the user re-issue.
        if(result.state==='outcome-unknown'){
          this.conversation.settleCommand?.(command.commandId,'not-sent');
          this.reportError(commandFault('command-outcome-unknown'));
        }
      }
    }
  }
  send(message,target,wakeup){
    this.assertAvailable();if(!wakeup)rejectOperation('inject');validateMessage(message);
    if(this.inputs.has(message.id))throw commandFault('official-message-already-admitted');
    this.inbox.admit(target,message);
    // Identity association only: command state always comes from V4Conversation.
    const input={message:structuredClone(message),commandId:inputCommandId(this.id,message.id),target};this.inputs.set(message.id,input);
    this.dispatchInput(input);
  }
  dispatchPendingInputs(){
    if(this.disposed||this.activity||this.conversation.state.snapshot?.inputRouting?.mode==='choice')return;
    const snapshot=this.conversation.state.snapshot;
    for(const [id,input] of this.inputs){
      // A tracked command (including outcome-unknown) belongs to V4's ledger.
      // Only an input that has not entered that ledger may be dispatched here.
      const cmd=this.conversation.command(input.commandId);
      if(!input.dispatching&&this.inbox.locate(id)&&!this.inbox.queueIds.has(id)&&(!cmd||cmd.state==='not-sent')){
        // Delivery evidence outranks the ledger here too: a user row already in the window
        // blocks re-dispatch even when the completed record was capacity-evicted (or the
        // capacity-skipped registration never happened) and the translator has not yet
        // claimed the input out of the inbox.
        if(snapshot?.rows?.window?.some(row=>row.sourceCommandId===input.commandId))continue;
        this.dispatchInput(input,true);
      }
    }
  }
  dispatchInput(input,ready=false){
    if(input.dispatching)return input.task;
    input.dispatching=true;
    const run=async()=>{
      if(!ready)await this.ready();
      if(!this.inbox.locate(input.message.id))throw commandFault('input-canceled');
      // The create/firstInput selection is the session's initial route only. A later message
      // must not re-assert it: an explicit switch belongs to the official selectModel entry,
      // and re-sending would overwrite a confirmed selection with the stale creation option.
      const payload=await promptPayload(input.message,this.conversation,this.ctx.get?.('attachments')??this.ctx.attachments);
      this.assertAvailable();
      const state=this.conversation.state;
      const pending=state.commands.some(command=>command.type==='sendText'&&['sent-unconfirmed','accepted-awaiting-terminal','running','waiting'].includes(command.state));
      const result=await this.conversation.submit({type:'sendText',commandId:input.commandId,payload:{...payload,requestedDelivery:input.target==='next-turn'&&pending?'queue':requestedDelivery(input.target,state.snapshot)}});
      try{requireAcceptedCommand(result)}catch(error){this.reportError(error)}
      return result;
    };
    input.task=this.track((this.activity?this.activity.done:Promise.resolve()).then(run).finally(()=>{input.dispatching=false}));
    return input.task;
  }
  followup(message){this.send(message,'next-turn',true)}
  steer(message){
    const transfer=queueSteerTransfer(this,message?.id);
    if(!transfer)return this.send(message,'next-step',true);
    this.assertAvailable();
    if(!transfer.removed||transfer.task)throw commandFault('official-queue-steer-unconfirmed');
    const {queueItemId,input,baseRevision,baseLogEpoch}=transfer.removed;
    if(queueItemId)transfer.task=this.submitControl({type:'sendQueuedNow',baseRevision,baseLogEpoch,payload:{queueItemId}});
    else {
      input.target='next-step';this.inbox.admit('next-step',input.message);
      transfer.task=this.dispatchInput(input);
    }
  }
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
      const payload=await promptPayload(input.message,this.conversation,this.ctx.get?.('attachments')??this.ctx.attachments);
      return this.conversation.submit({type:'sendText',commandId:input.commandId,baseRevision,baseLogEpoch,
        payload:{...payload,requestedDelivery:'startNow',heldQueueDisposition:disposition,expectedHeldQueueItemIds:expectedQueueItemIds}});
    })());
  }
  /** Dispatch one OFFICIAL-identity model switch through ZCode and classify its receipt. This
   * installs nothing durable: the official command entry persists only after the returned outcome
   * is confirmed/unchanged (see the driver model-selection seam). A refused, stale or
   * outcome-unknown receipt is classified, never presented as success. */
  async selectModel(official){
    this.assertAvailable();
    await this.ready();
    let result;
    try{result=await this.conversation.submit({type:'switchModelConfig',payload:{provider:official.providerId,model:official.modelId,thought:official.options?.reasoningLevel??''}})}
    catch(error){return {outcome:error?.state==='outcome-unknown'?'outcome-unknown':'failed',ack:{reasonCode:error?.code??'selection-failed'}}}
    return selectionOutcome(result);
  }
  submitControl(command){
    this.assertAvailable();if(!ROUTED_COMMANDS.has(command.type))rejectOperation(command.type);
    return captureControlReceipt(this,command.type,this.track((async()=>{
      await this.ready();const snapshot=this.conversation.state.snapshot;
      validateHookReview(this.conversation,command);
      if(command.baseRevision!==undefined&&command.baseRevision!==snapshot.revision)throw commandFault('proto.staleRevision');
      validateInteractionRoute(this.conversation,command);
      const result=await this.conversation.submit(command,{signal:command.signal});
      // V4 returns negative receipts as values. Preserve that ledger, but fail
      // the control boundary so track reports them even while transport is live.
      if(['rejected','stale','failed','not-sent','outcome-unknown'].includes(result.state)||['rejected','stale','failed'].includes(result.ack?.status))requireAcceptedCommand(result);
      return result;
    })()));
  }
  rename(title){return this.submitControl({type:'renameSession',payload:{title}})}
  async renameAndRead(title){
    requireAcceptedCommand(await this.rename(title));
    this.assertAvailable();
    await this.conversation.resync({forceSnapshot:true});
    if(this.conversation.state.status!=='live')await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{off();reject(commandFault('rename-title-unconfirmed'))},5000);
      const off=this.conversation.subscribe(state=>{
        if(state.status!=='live'&&!state.error&&state.status!=='closed')return;
        clearTimeout(timer);off();state.status==='live'?resolve():reject(commandFault(state.error??'agent-disposed'));
      });
    });
    this.assertAvailable();
    const officialTitle=this.conversation.state.snapshot?.meta.title;
    if(officialTitle!==title)throw commandFault('rename-title-unconfirmed');
    return officialTitle;
  }
  queueAction({queueItemId,action,newText,beforeQueueItemId,baseRevision,baseLogEpoch}){
    const type={edit:'editQueueItem',sendNow:'sendQueuedNow',reorder:'reorderQueueItem'}[action];
    if(!type)rejectOperation(action);
    return this.submitControl({type,baseRevision,baseLogEpoch,payload:{queueItemId,...(action==='edit'?{newText}:{}),...(action==='reorder'?{beforeQueueItemId}:{})}});
  }
  cancel(cause,options={}){
    if(this.disposed)throw commandFault('agent-disposed');
    if(this.conversation?.state.status==='error')throw commandFault('execution-unavailable');
    // A cancel can arrive before the first projection is live; do not reject here —
    // submitControl awaits readiness itself, and with no stoppable work the cancel
    // is a legitimate no-op.
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
  /** Official-path userInput: ask through the official live-root waterfall, then map the human
   * answer back into one resolveInteraction command. The plugin-path variants never reach here, and
   * a missing or refusing answerer surfaces the official error instead of resolving locally. */
  async askUserInput(interaction,controller){
    const userQuestions=this.ctx.get?.('userQuestions');
    if(!userQuestions||typeof userQuestions.ask!=='function')throw commandFault('user-questions-unavailable');
    let answer;
    try{answer=await userQuestions.ask({agent:this,questions:officialRequestQuestions(interaction),signal:controller.signal})}
    catch(error){if(!controller.signal.aborted&&!this.disposed)this.reportError(commandFault(error?.code??'user-questions-unavailable'));return}
    if(controller.signal.aborted||this.disposed)return;
    return this.submitControl({type:'resolveInteraction',payload:{interactionId:interaction.interactionId,answer:officialAnswerPayload(interaction,answer)}});
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
    this.translator?.abort();this.offRecovery?.();this.offConversation?.();await this.conversation?.cancel();
    await this.translator?.close();
    await this.activity?.done;await Promise.allSettled([...this.tasks]);this.setStatus('idle');
  }
}
