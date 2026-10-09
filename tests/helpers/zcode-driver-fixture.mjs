import assert from 'node:assert/strict';

export function driverFixture(){
  const log=[],agents=new Map(),sessions=new Map(),stored=new Map(),writes=new Set(),projections=new Map();
  let factory;
  function context(){
    const effects=new Set();let active=true;
    const ctx={fiber:{assertActive(){if(!active)throw new Error('owner is disposed')}},get:name=>name==='sessionPersistence'?persistence:undefined,
      agents:registry,sessions:sessionStore,sessionProjections:projectionRegistry,
      effect(callback){
        ctx.fiber.assertActive();const cleanups=[];let disposed;
        const release=()=>{
          if(disposed)return disposed;
          effects.delete(release);
          disposed=(async()=>{const errors=[];for(const cleanup of cleanups.toReversed()){try{await cleanup()}catch(error){errors.push(error)}}if(errors.length)throw new AggregateError(errors)})();return disposed;
        };
        effects.add(release);
        try{
          const result=callback();
          if(result?.next){for(const cleanup of result){if(cleanup)cleanups.push(cleanup)}}else if(result)cleanups.push(result);
        }catch(error){void release();throw error}
        return release;
      },
      async unload(){active=false;for(const release of [...effects].toReversed())await release()},
      effects,
    };
    return ctx;
  }
  const registry={
    setFactory(value){log.push('factory');if(factory)throw new Error('an agent factory is already registered');factory=value;return ()=>{factory=undefined;log.push('factory-released')}},
    enter(agent){assert.equal(agent.id,agent.session.id);if(agents.has(agent.id))throw new Error('duplicate agent');agents.set(agent.id,agent);log.push('agent-enter');return ()=>{agents.delete(agent.id);log.push('agent-detach')}},
    async announce(agent,source,signal){log.push('agent-announce:'+source);await registry.onAnnounce?.(agent,signal)},
  };
  const sessionStore={
    prepare(id,{seed,meta={},inheritedEventCount=0}={}){
      if(sessions.has(id))throw new Error('duplicate session');
      const events=structuredClone(seed??[]);
      for(const [index,event] of events.entries())assert.equal(event.seq,index);
      const header={version:4,id,createdAt:meta.createdAt??1,isSeeded:meta.isSeeded??false,delegationDepth:meta.delegationDepth??0,...(meta.cwd?{cwd:meta.cwd}:{}),...(meta.agentPreset===undefined?{}:{agentPreset:meta.agentPreset})};
      const session={id,header,inheritedEventCount,get seq(){return events.length},eventAt:seq=>events[seq],
        append(type,data){const event=Object.freeze({type,data:structuredClone(data),seq:events.length,time:1});events.push(event);return event}};
      if(seed&&events.at(-1)?.type!=='session/end-seed')session.append('session/end-seed',{});
      log.push('session-prepare');return session;
    },
    enter(session){if(sessions.has(session.id))throw new Error('duplicate session');sessions.set(session.id,session);log.push('session-enter');return ()=>{sessions.delete(session.id);log.push('session-detach')}},
    announce(){log.push('session-announce')},
  };
  const projectionRegistry={register(def){log.push('projection:'+def.key);const previous=projections.get(def.key);if(previous&&previous.stateVersion!==def.stateVersion)throw new Error('projection version conflict');projections.set(def.key,def);return ()=>projections.delete(def.key)}};
  function handle(record){
    const id=record.header.id;if(writes.has(id))throw new Error('already owned');writes.add(id);let closed=false;
    return {header:record.header,inheritedEventCount:0,
      async read(){return {events:structuredClone(record.events),eventState:'detached'}},
      async append(events){if(closed)throw new Error('closed');for(const event of events){assert.equal(event.seq,record.events.length);record.events.push(structuredClone(event))}log.push('persist-append')},
      async close(){if(closed)return;closed=true;writes.delete(id);log.push('handle-close')},
    };
  }
  const persistence={
    async create(header){if(stored.has(header.id))throw new Error('already exists');const record={header,events:[]};stored.set(header.id,record);log.push('persist-create');return handle(record)},
    async open(id,access){assert.equal(access,'write');log.push('persist-open');return handle(stored.get(id))},
  };
  const transport={calls:[],async create({cwd}){transport.calls.push(['create',cwd]);return 'zcode-conv-Y'},
    async resume({zcodeConversationId}){transport.calls.push(['resume',zcodeConversationId]);return zcodeConversationId},dispose(){log.push('transport-close')}};
  const ctx=context(),owner=context();
  const deps={transport,
    createScope(ctx,agent){const scopeCtx=context();scopeCtx.sessions=sessionStore;const rawDispose=ctx.effect(()=>async()=>{log.push('scope-close:'+agent.id);await scopeCtx.unload()});return {ctx:scopeCtx,rawDispose,dispose:()=>Promise.resolve(rawDispose())}},
    agentEvents(ctx,agent){return {emit(name,payload){log.push([name,{...payload,agent}])},async serial(){},waterfall(name,payload,next){return next()}}},
  };
  return {ctx,owner,deps,registry,log,agents,sessions,stored,writes,projections,persistence,transport,get factory(){return factory}};
}
