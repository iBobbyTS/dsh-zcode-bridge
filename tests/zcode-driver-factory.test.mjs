import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installDriver,BINDING_EVENT,boundConversationId} from '../packages/driver/index.mjs';
import {driverFixture} from './helpers/zcode-driver-fixture.mjs';
import {apply as applyHost} from '../packages/host/index.mjs';
import {DriverTransport} from '../packages/driver/transport.mjs';

test('official factory and incompatible projections block before any projection registration',async()=>{
  const f=driverFixture();const native={};const release=f.registry.setFactory(native);
  f.projections.set('turnBoundary',{stateVersion:999});f.projections.set('inbox',{stateVersion:999});
  f.log.length=0;
  const blocked=installDriver(f.ctx,f.deps);
  assert.equal(blocked.state.state,'blocked-official-loop-active');assert.match(blocked.state.reason,/关闭官方 agent-loop/);
  assert.deepEqual(f.log,['factory']);assert.equal(f.factory,native);
  await blocked.dispose();assert.equal(f.factory,native);
  release();f.projections.clear();f.log.length=0;
  const occupied=installDriver(f.ctx,f.deps);
  assert.equal(occupied.state.state,'occupied');assert.deepEqual(f.log,['factory','projection:turnBoundary','projection:inbox']);
  await occupied.dispose();assert.equal(f.factory,undefined);assert.equal(f.projections.size,0);
});

test('caller DSH id binds to ACK id, unsupported prompt fails, resume recovers binding',async()=>{
  const f=driverFixture(),driver=installDriver(f.ctx,f.deps);
  const handle=await f.factory.createAgent(f.owner,{sessionId:'DSH-X',meta:{cwd:'/workspace'}});
  assert.equal(handle.agent.id,'DSH-X');assert.equal(handle.agent.session.id,'DSH-X');assert.equal(handle.agent.zcodeConversationId,'zcode-conv-Y');
  const binding=f.stored.get('DSH-X').events.find(event=>event.type===BINDING_EVENT);
  assert.deepEqual(binding.data,{sessionId:'DSH-X',zcodeConversationId:'zcode-conv-Y'});assert.equal(binding.ignorable,true);
  assert.equal('zcodeConversationId' in handle.agent.session.header,false);
  assert.throws(()=>handle.agent.followup({id:'prompt-1'}),{code:'driver-command-unavailable'});
  assert.ok(f.log.indexOf('persist-append')<f.log.indexOf('session-enter'));
  assert.deepEqual(f.log.filter(x=>typeof x==='string'&&(/enter|announce/.test(x))),['session-enter','agent-enter','session-announce','agent-announce:startup']);
  const one=handle.dispose(),two=handle.dispose();assert.equal(one,two);await one;
  assert.equal(f.writes.size,0);assert.equal(f.agents.size,0);assert.equal(f.sessions.size,0);assert.equal(f.owner.effects.size,0);
  const resumed=await f.factory.resume(f.owner,{resumeSessionId:'DSH-X'});
  assert.equal(resumed.agent.zcodeConversationId,'zcode-conv-Y');assert.deepEqual(f.transport.calls.at(-1),['resume','zcode-conv-Y']);
  await driver.dispose();assert.equal(f.writes.size,0);assert.equal(f.agents.size,0);assert.equal(f.sessions.size,0);
  assert.ok(f.log.indexOf('handle-close')<f.log.indexOf('agent-detach'));
  assert.ok(f.log.indexOf('agent-detach')<f.log.indexOf('session-detach'));
});

test('imported session without binding resumes with ZCode id as DSH id',async()=>{
  const f=driverFixture(),driver=installDriver(f.ctx,f.deps);
  const h=await f.persistence.create({version:4,id:'old-zcode-id',createdAt:1,isSeeded:false,delegationDepth:0});await h.close();
  const handle=await f.factory.resume(f.owner,{resumeSessionId:'old-zcode-id'});
  assert.equal(handle.agent.id,'old-zcode-id');assert.equal(handle.agent.zcodeConversationId,'old-zcode-id');
  assert.deepEqual(f.transport.calls,[['resume','old-zcode-id']]);await driver.dispose();
});

test('idle agent exposes scoped dispatch and cancel only affects active maintenance',async()=>{
  const f=driverFixture(),driver=installDriver(f.ctx,f.deps);
  const {agent,dispose}=await f.factory.createAgent(f.owner,{sessionId:'idle'});
  assert.equal(agent.status,'idle');assert.ok(agent.ctx);assert.deepEqual(agent.options,{});assert.deepEqual(agent.inbox.nextTurn,[]);assert.deepEqual(agent.inbox.nextStep,[]);
  await agent.whenIdle();agent.cancel({kind:'disposed'});
  let finish,signal,idle=false;
  const task=agent.runMaintenance(s=>{signal=s;return new Promise(resolve=>{finish=resolve})});
  assert.equal(signal.aborted,false);assert.equal(agent.status,'idle');assert.throws(()=>agent.runMaintenance(async()=>{}),/already active/);
  const waiting=agent.whenIdle().then(()=>{idle=true});await Promise.resolve();assert.equal(idle,false);
  agent.cancel({kind:'user'},{keepInbox:true});assert.equal(signal.aborted,true);assert.deepEqual(signal.reason,{kind:'user'});
  finish(42);assert.equal(await task,42);await waiting;
  agent.dispatch.emit('agent/status',{status:'idle',agent:{id:'wrong'}});assert.equal(f.log.at(-1)[1].agent,agent);
  for(const name of ['send','followup','steer','inject'])assert.throws(()=>agent[name]({}),{code:'driver-command-unavailable'});
  await dispose();assert.throws(()=>agent.runMaintenance(async()=>{}),/disposed/);await driver.dispose();
});

test('setup and announce failures roll both registries and write ownership back',async()=>{
  for(const phase of ['setup','commit','announce']){
    const f=driverFixture(),driver=installDriver(f.ctx,f.deps);
    if(phase==='announce')f.registry.onAnnounce=async()=>{throw new Error(phase)};
    await assert.rejects(f.factory.createAgent(f.owner,{sessionId:phase,setup:()=>{
      assert.equal(f.agents.size,0);assert.equal(f.sessions.size,0);
      if(phase==='setup')throw new Error(phase);
      if(phase==='commit')return {commit(){throw new Error(phase)}};
    }}),new RegExp(phase));
    assert.equal(f.agents.size,0);assert.equal(f.sessions.size,0);assert.equal(f.writes.size,0);assert.equal(f.owner.effects.size,0);
    await driver.dispose();
  }
});

test('owner unload aborts a pending backend open and closes its late handle',async()=>{
  const f=driverFixture(),driver=installDriver(f.ctx,f.deps);
  let finish,closed=0;f.persistence.open=()=>new Promise(resolve=>{finish=resolve});
  const creation=f.factory.resume(f.owner,{resumeSessionId:'late'});const rejected=assert.rejects(creation,/disposed/);
  await Promise.resolve();await f.owner.unload();await rejected;
  finish({close:async()=>{closed++}});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(closed,1);assert.equal(f.factory.transactions.size,0);await driver.dispose();
});

test('provider unload drains all handles without disposing the shared host',async()=>{
  const f=driverFixture();installDriver(f.ctx,f.deps);
  await f.factory.createAgent(f.owner,{sessionId:'one'});await f.factory.createAgent(f.owner,{sessionId:'two'});
  await f.ctx.unload();assert.equal(f.factory,undefined);assert.equal(f.agents.size,0);assert.equal(f.sessions.size,0);assert.equal(f.writes.size,0);
  assert.ok(f.log.lastIndexOf('handle-close')<f.log.lastIndexOf('factory-released'));
});

test('bad bindings reject instead of routing to a different conversation',()=>{
  assert.equal(boundConversationId('imported',[]),'imported');
  assert.throws(()=>boundConversationId('DSH-X',[{type:BINDING_EVENT,ignorable:true,data:{sessionId:'other',zcodeConversationId:'Z'}}]),/invalid/);
  assert.throws(()=>boundConversationId('DSH-X',[{type:BINDING_EVENT,data:{sessionId:'DSH-X',zcodeConversationId:'Z'}}]),/invalid/);
});

test('status route exposes driver state through the host shared carrier',async()=>{
  let host,handler;
  const ctx={provide(name,value){assert.equal(name,'zcodeBridgeHost');host=value},effect(){},inject(names,callback){
    if(names.includes('webServer'))callback({webServer:{},extend(){return {connection:{rpc:{handle(channel,fn){assert.equal(channel,'/zcode-bridge');handler=fn}}}}}});
  }};
  applyHost(ctx);assert.ok(host);
  for(const state of ['blocked-official-loop-active','occupied']){
    host.driverState={state,reason:state==='occupied'?null:'disable official loop'};
    const result=await handler('status',{},new AbortController().signal);assert.equal(result.ok,true);assert.deepEqual(result.value.driverState,host.driverState);
  }
  await host.dispose();
});

test('bundle assembles the driver without disabling official rows and pins the probed cohort',async()=>{
  const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
  const bundle=await json('../bridge-bundle.json'),pkg=await json('../packages/driver/package.json');
  const patch=await readFile(new URL('../cordis.patch.yml',import.meta.url),'utf8');
  assert.ok(bundle.plugins.some(plugin=>plugin.id==='zcode-driver'&&plugin.package===pkg.name));
  assert.match(patch,/id: zcode-driver\s+name: '@dsh-zcode\/driver'/);assert.doesNotMatch(patch,/disabled:|id: (agent-loop|ui-settings-agent-loop)\b/);
  for(const [name,version] of Object.entries(pkg.peerDependencies))if(name.startsWith('@deepseek-ai/dsh-'))assert.equal(version,'0.2.0-rc.2');
});

test('transport reuses the host launcher to create an empty draft and releases only its listeners',async()=>{
  const requests=[],events=new Set(),states=new Set();let connected=0,hostDisposed=0;
  const launcher={state:{phase:'ready',auth:'authenticated',executionWorkspace:'/workspace'},
    onExecutionEvent(fn){events.add(fn);return ()=>events.delete(fn)},subscribe(fn){states.add(fn);return ()=>states.delete(fn)},
    async execution(method,params){requests.push({method,params});
      if(method==='hello')return {kind:'hello',protocolVersion:3,connectionId:'driver-test',clientMode:'desktop-continuous',deliveryProfile:'continuous',serverTime:0,capabilities:{nativeDialogs:true,localTerminal:true,binaryFrames:false,compression:'none'},auth:{}};
      if(method==='initialize')return {};
      if(method==='v4/command')return {commandId:params.commandId,status:'accepted',revisionAtDecision:0,result:{type:'createSession',sessionId:'ACK-Y'}};
      throw new Error(method);
    }};
  const host={launcher,async connect(){connected++},dispose(){hostDisposed++}},transport=new DriverTransport(host);
  const signal=new AbortController().signal;
  assert.equal(await transport.create({cwd:'/workspace',signal}),'ACK-Y');
  const envelope=requests.find(x=>x.method==='v4/command').params;
  assert.equal(envelope.sessionId,null);assert.equal(envelope.type,'createSession');assert.deepEqual(envelope.payload,{workspaceId:'/workspace'});
  await transport.resume({zcodeConversationId:'ACK-Y',cwd:'/workspace',signal});
  assert.equal(requests.filter(x=>x.method==='hello').length,1);assert.equal(requests.filter(x=>x.method==='v4/command').length,1);assert.equal(connected,2);
  assert.equal(events.size,1);assert.equal(states.size,2);transport.dispose();assert.equal(events.size,0);assert.equal(states.size,0);assert.equal(hostDisposed,0);
});

test('caller cancellation during setup rolls back without arming the returned lifecycle',async()=>{
  const f=driverFixture(),driver=installDriver(f.ctx,f.deps),controller=new AbortController();
  let entered;const setupEntered=new Promise(resolve=>{entered=resolve});
  const creation=f.factory.createAgent(f.owner,{sessionId:'cancel',signal:controller.signal,setup:()=>{entered();return new Promise(()=>{})}});
  const rejected=assert.rejects(creation,/caller canceled/);await setupEntered;controller.abort(new Error('caller canceled'));await rejected;
  assert.equal(f.writes.size,0);assert.equal(f.agents.size,0);assert.equal(f.sessions.size,0);assert.equal(f.owner.effects.size,0);
  const signal=new AbortController();const handle=await f.factory.createAgent(f.owner,{sessionId:'returned',signal:signal.signal});signal.abort();assert.equal(handle.agent.disposed,false);
  await driver.dispose();
});
