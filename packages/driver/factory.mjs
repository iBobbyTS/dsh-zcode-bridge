import {DriverAgent} from './agent.mjs';
import {turnBoundaryProjectionDefinition,inboxProjectionDefinition} from './projections.mjs';

export const BINDING_EVENT='zcode-driver/conversation-bound';
const readEvents=session=>Array.from({length:session.seq},(_,seq)=>session.eventAt(seq));
export function boundConversationId(id,events){
  let bound;
  for(const event of events){
    if(event.type!==BINDING_EVENT)continue;
    const data=event.data;
    if(event.ignorable!==true||data.sessionId!==id||typeof data.zcodeConversationId!=='string'||!data.zcodeConversationId||bound&&bound!==data.zcodeConversationId)throw new Error('invalid ZCode conversation binding');
    bound=data.zcodeConversationId;
  }
  return bound??id;
}
// A canceled load must release a write handle even when the backend resolves late.
function cancellable(call,signal,abandoned=()=>{}){
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    let settled=false;
    const abort=()=>{if(settled)return;settled=true;reject(signal.reason)};
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(call).then(value=>{
      if(settled){void Promise.resolve(abandoned(value)).catch(()=>{});return}
      settled=true;signal.removeEventListener('abort',abort);resolve(value);
    },error=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);reject(error)});
  });
}

export class DriverFactory {
  accepting=true;transactions=new Set();
  gate={state:'open',fn:null,error:null,waiters:[]};
  constructor(ctx,{transport,createScope,agentEvents,interruptedTurnClosers,beforeResume}){
    Object.assign(this,{ctx,transport,createScope,agentEvents,interruptedTurnClosers});
    if(beforeResume)this.gate={state:'bound',fn:beforeResume,error:null,waiters:[]};
  }
  /** Claim the legacy write gate synchronously when the factory becomes callable. Until the gate is
   * bound (or failed) every resume waits: an unbound hook must never mean "pass through", otherwise a
   * resume in the installation window would publish a title-only placeholder before the archive/state
   * load finished. Direct factory installs without legacy wiring keep the default open gate. */
  claimWriteGate(){if(this.gate.state==='open')this.gate.state='initializing'}
  setWriteGate(fn){this.gate.fn=fn;this.#settleGate('bound')}
  openWriteGate(){this.#settleGate('open')}
  failWriteGate(error){this.gate.error=error;this.#settleGate('failed')}
  writeGateState(){return this.gate.state}
  #settleGate(state){this.gate.state=state;for(const resolve of this.gate.waiters.splice(0))resolve()}
  async #awaitWriteGate(signal){
    while(this.gate.state==='initializing'){
      await new Promise(resolve=>{this.gate.waiters.push(resolve);signal?.addEventListener('abort',resolve,{once:true})});
      signal?.throwIfAborted();
    }
    if(this.gate.state==='failed')throw this.gate.error??Object.assign(new Error('legacy-write-gate-unavailable'),{code:'legacy-write-gate-unavailable'});
  }
  createAgent(ownerCtx,options){return this.open(ownerCtx,options,'startup')}
  resume(ownerCtx,options){return this.open(ownerCtx,options,'resume')}
  async open(ownerCtx,options,source){
    if(!this.accepting)throw new Error('ZCode driver is not active');
    ownerCtx.fiber.assertActive();
    const id=source==='startup'?options.sessionId:options.resumeSessionId;
    const abort=new AbortController(),signal=abort.signal;
    let handle,agent,detachAgent,detachSession,publication,disposal,unfollowOwner,loadGuard=true;
    const callerAbort=()=>abort.abort(options.signal.reason);
    options.signal?.throwIfAborted();
    options.signal?.addEventListener('abort',callerAbort,{once:true});
    const dispose=(ownerTriggered=false)=>disposal??=(async()=>{
      abort.abort(new Error(`agent "${id}" lifecycle disposed`));
      options.signal?.removeEventListener('abort',callerAbort);
      if(publication)await publication;
      const errors=[];
      for(const cleanup of [()=>agent?.stop(),()=>handle?.close(),()=>detachAgent?.(),()=>detachSession?.(),()=>agent?.scope.dispose()]){
        try{await cleanup()}catch(error){errors.push(error)}
      }
      this.transactions.delete(dispose);
      if(!ownerTriggered)await unfollowOwner?.();
      if(errors.length)throw new AggregateError(errors,'ZCode driver teardown failed');
    })();
    this.transactions.add(dispose);
    try{
      unfollowOwner=ownerCtx.effect(()=>()=>!loadGuard||disposal?undefined:dispose(true),`zcode-driver.lifecycle(${id})`);
      // A resume is the write gate for an imported legacy Session: the complete history must be in
      // the store before the Session is announced, so an open/prompt never reads a partial transcript.
      // While the gate is initializing the resume waits; a failed initialization keeps rejecting; an
      // undeclared legacy row resolves immediately for ordinary driver Sessions once the gate is open.
      if(source==='resume'){
        await this.#awaitWriteGate(signal);
        if(this.gate.fn)await cancellable(()=>this.gate.fn(id,signal),signal);
      }
      const persistence=this.ctx.get('sessionPersistence');
      let session,storedCount=0,zcodeConversationId;
      if(source==='startup'){
        // Validate caller data before sending anything to ZCode, preserve its authoritative id.
        session=this.ctx.sessions.prepare(id,{seed:options.seed,meta:options.meta,inheritedEventCount:options.inheritedEventCount});
        // Fork/history adaptation is a later task; never pretend an independent draft inherited it.
        if(options.meta?.isSeeded||options.seed?.length)throw new Error('ZCode driver history creation is not available');
        zcodeConversationId=await cancellable(()=>this.transport.create({cwd:session.header.cwd,signal,firstInput:options.firstInput,
          modelSelection:options.modelSelection??options.agentOptions?.modelSelection,mode:options.mode??options.agentOptions?.mode}),signal);
        const binding={type:BINDING_EVENT,seq:session.seq,time:Date.now(),ignorable:true,data:{sessionId:id,zcodeConversationId}};
        // append() cannot set ignorable. Re-prepare the still-detached log with the binding envelope.
        session=this.ctx.sessions.prepare(id,{seed:[...readEvents(session),binding],meta:session.header,inheritedEventCount:session.inheritedEventCount});
        if(persistence)handle=await cancellable(()=>persistence.create(session.header,{inheritedEventCount:session.inheritedEventCount,signal}),signal,value=>value.close());
      }else{
        if(!persistence)throw new Error('cannot resume: session persistence is not configured');
        handle=await cancellable(()=>persistence.open(id,'write',{signal}),signal,value=>value.close());
        const cold=await cancellable(()=>handle.read(0,undefined,{signal}),signal);
        zcodeConversationId=boundConversationId(id,cold.events);
        storedCount=cold.events.length;
        const open=cold.events.findLast(event=>event.type==='turn/start'||event.type==='turn/end')?.type==='turn/start';
        if(open&&!this.interruptedTurnClosers)throw new Error('driver resume requires the official interruptedTurnClosers contract');
        const closers=open?this.interruptedTurnClosers(cold.events).map(event=>event.type==='turn/end'?{...event,data:{...event.data,reason:{kind:'aborted',reason:{kind:'disposed'}}}}:event):[];
        if(closers.length){await cancellable(()=>handle.append(closers),signal);storedCount+=closers.length}
        session=this.ctx.sessions.prepare(id,{seed:[...cold.events,...closers],meta:handle.header,inheritedEventCount:handle.inheritedEventCount,eventState:cold.eventState});
        await cancellable(()=>this.transport.resume({zcodeConversationId,cwd:session.header.cwd,signal}),signal);
      }
      signal.throwIfAborted();
      // Exact scope disposer is nested under the owner, behind the lifecycle drain.
      const releaseScopeOwner=ownerCtx.effect(function*(){
        agent=new DriverAgent(this.ctx,session,{...options.agentOptions,
          ...(options.modelSelection?{modelSelection:options.modelSelection}:{}),...(options.mode?{mode:options.mode}:{})},zcodeConversationId,{...this,parentAgent:options.parentAgent});
        yield agent.scope.rawDispose;
        yield ()=>disposal?undefined:dispose(true);
      }.bind(this),`zcode-driver.scope(${id})`);
      // The early load guard is no longer needed; the ordered scope effect owns teardown.
      loadGuard=false;
      await unfollowOwner();
      unfollowOwner=releaseScopeOwner;
      const setupCommit=await cancellable(()=>options.setup?.(agent.ctx,agent),signal);
      setupCommit?.commit();
      if(handle){
        // Flush all unpublished events (binding and setup included) before either registry announcement.
        await cancellable(()=>handle.append(readEvents(session).slice(storedCount)),signal);
      }
      signal.throwIfAborted();
      ownerCtx.fiber.assertActive();
      let finish;
      publication=new Promise(resolve=>{finish=resolve});
      try{
        detachSession=agent.ctx.sessions.enter(session);
        detachAgent=this.ctx.agents.enter(agent,options.parentAgent);
        agent.ctx.sessions.announce(session);
        signal.throwIfAborted();
        await this.ctx.agents.announce(agent,source,signal);
        signal.throwIfAborted();
      }finally{finish();publication=undefined}
      // A confirmed create stays confirmed even if subsequent observation is unavailable.
      if(agent.conversation)agent.track(agent.ready());
      options.signal?.removeEventListener('abort',callerAbort);
      return {agent,dispose};
    }catch(error){await dispose().catch(()=>{});throw error}
  }
  async dispose(){
    this.accepting=false;
    const results=await Promise.allSettled([...this.transactions].map(dispose=>dispose()));
    this.transport.dispose();
    const errors=results.filter(result=>result.status==='rejected').map(result=>result.reason);
    if(errors.length)throw new AggregateError(errors,'ZCode driver unload failed');
  }
}

/** Factory occupation is the first registry mutation; blocked installs never touch projections. */
export function installDriver(ctx,deps){
  const factory=new DriverFactory(ctx,deps);
  const state={state:'unavailable',reason:'driver-starting'};
  // Cordis nests exact effect disposers yielded by a composite. Factory release
  // follows handle drain on provider unload as well as explicit disposal.
  const release=ctx.effect(function*(){
    let releaseFactory;
    try{releaseFactory=ctx.agents.setFactory(factory)}catch(error){
      if(error.message!=='an agent factory is already registered')throw error;
      state.state='blocked-official-loop-active';
      state.reason='必须先关闭官方 agent-loop 插件才能启用 ZCode driver';
      return;
    }
    const releases=[releaseFactory];
    yield releaseFactory;
    for(const definition of [turnBoundaryProjectionDefinition,inboxProjectionDefinition]){
      const release=ctx.sessionProjections.register(definition);
      releases.push(release);yield release;
    }
    state.state='occupied';state.reason=null;
    yield async()=>{
      // Cordis chains yielded cleanup on fulfillment only. Release these
      // single-shot capabilities ourselves before reporting a drain failure.
      const errors=[];
      for(const cleanup of [()=>factory.dispose(),...releases.toReversed()]){
        try{await cleanup()}catch(error){errors.push(error)}
      }
      state.state='disposed';
      if(errors.length===1)throw errors[0];
      if(errors.length>1)throw new AggregateError(errors,'ZCode driver occupation cleanup failed');
    };
  },'zcode-driver: occupation');
  let disposal;
  return {factory,state,dispose:()=>disposal??=Promise.resolve(release())};
}
