import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {installDriver} from '../packages/driver/factory.mjs';

// Optional external contract artifact; no network/install is performed by this test.
const npmRoot=process.env.DSH_DRIVER_NPM_NODE_MODULES??'/private/tmp/dsh-local-npm-verify/npm/node_modules';
const artifact=name=>join(npmRoot,'@deepseek-ai',name);
const packages=['cordis','dsh-agent','dsh-session','dsh-session-projection','dsh-session-persistence-jsonl','dsh-scope'];
const available=packages.every(name=>existsSync(join(artifact(name),'lib/index.js')));
const load=name=>import(pathToFileURL(join(artifact(name),'lib/index.js')));
const contains=(error,target)=>error===target||(error instanceof AggregateError&&error.errors.some(error=>contains(error,target)));

test('real rc.2 Cordis releases the factory after JSONL close fails, then reports EIO',{
  skip:available?false:'requires rc.2 npm artifacts; set DSH_DRIVER_NPM_NODE_MODULES',
},async()=>{
  for(const name of packages.filter(name=>name!=='cordis')){
    assert.equal(JSON.parse(await readFile(join(artifact(name),'package.json'),'utf8')).version,'0.2.0-rc.2');
  }
  assert.equal(JSON.parse(await readFile(join(artifact('cordis'),'package.json'),'utf8')).version,'4.0.4');
  const [{Context},{AgentRegistry,agentEvents},{SessionStore},{default:SessionProjections},
    {default:JsonlPersistence},{createScope}]=await Promise.all(packages.map(load));
  for(const mode of ['provider-unload','explicit-dispose']){
    const root=await mkdtemp(join(tmpdir(),'zcode-driver-close-'));
    const ctx=new Context();
    new AgentRegistry(ctx);new SessionStore(ctx);new SessionProjections(ctx);
    const persistence=new JsonlPersistence(ctx,{root,compression:'none'});
    const create=persistence.create.bind(persistence);
    let writer,driver,reinstalled;
    persistence.create=async(...args)=>{writer=await create(...args);return writer};
    const deps={createScope,agentEvents,transport:{create:async()=> 'zcode-close-test',dispose(){}}};
    const provider=ctx.plugin({inject:['agents','sessions','sessionProjections','sessionPersistence'],
      apply(providerCtx){driver=installDriver(providerCtx,deps)}});
    try{
      await provider.await();assert.equal(driver.state.state,'occupied');
      const {agent}=await ctx.agents.create({sessionId:'close-failure'});
      const io=Object.assign(new Error('injected live event drain EIO'),{code:'EIO'});
      writer.persistContiguous=async()=>{throw io};
      agent.session.append('turn/start',{turn:1});
      assert.equal(writer.buffered.length,1,'live event reached the real JSONL writer');
      const released=()=>ctx.agents.get(agent.id)===undefined&&ctx.sessions.get(agent.id)===undefined
        &&ctx.sessionProjections.stateOf(agent.session,'turnBoundary')===undefined
        &&ctx.sessionProjections.stateOf(agent.session,'inbox')===undefined;
      const reports=[];
      ctx.logger.exporter({export(message){if(message.type==='error'&&message.args.includes(io))reports.push({io,released:released()})}});
      if(mode==='provider-unload'){
        // Fiber unload reports disposer errors through the actual Cordis logger.
        await provider.dispose();assert.ok(reports.length>0,'original EIO was reported');
      }else{
        await assert.rejects(driver.dispose(),error=>{
          assert.ok(contains(error,io),'original EIO is retained in the rejection');
          assert.equal(released(),true,'all cleanup completed before rejection');return true;
        });
      }
      assert.equal(driver.state.state,'disposed');
      await assert.rejects(ctx.agents.create({sessionId:'after-close-failure'}),/no agent factory registered/);
      assert.equal(released(),true);assert.ok(reports.every(report=>report.released));
      // Native close still releases the JSONL write claim after a failed drain.
      const reopened=await ctx.sessionPersistence.open(agent.id,'write');await reopened.close();
      reinstalled=installDriver(ctx,deps);assert.equal(reinstalled.state.state,'occupied');
      const next=await ctx.agents.create({sessionId:'after-reinstall'});await next.dispose();
    }finally{
      await reinstalled?.dispose();await provider.dispose();await ctx.fiber.dispose();
      await rm(root,{recursive:true,force:true});
    }
  }
});

test('real Cordis parks input behind maintenance, persists clear, and aborts pending approval on unload',{
  skip:available?false:'requires rc.2 npm artifacts; set DSH_DRIVER_NPM_NODE_MODULES',
},async()=>{
  const [{Context},{AgentRegistry,agentEvents},{SessionStore},{default:SessionProjections},
    {default:JsonlPersistence},{createScope}]=await Promise.all(packages.map(load));
  const [{V4Conversation},{MockPeer,tick}]=await Promise.all([
    import('../packages/host/conversation.mjs'),import('./helpers/zcode-runtime-fixture.mjs'),
  ]);
  const root=await mkdtemp(join(tmpdir(),'zcode-driver-commands-'));
  const ctx=new Context();new AgentRegistry(ctx);new SessionStore(ctx);new SessionProjections(ctx);new JsonlPersistence(ctx,{root,compression:'none'});
  const peer=new MockPeer();peer.snapshot.control.canStop=false;peer.snapshot.control.activeWorks=[];peer.snapshot.rows.window=[];
  const transport={create:async()=>peer.snapshot.sessionId,dispose(){peer.close()},conversation:()=>new V4Conversation(peer,{
    address:{runtime:'zcode',authority:'official-host',workspace:'/workspace',sessionId:peer.snapshot.sessionId},
    workspace:{workspacePath:'/workspace',workspaceKey:'/workspace'},connectionId:peer.connectionId,clientId:'real-cordis',clientMode:'desktop-continuous',runnable:true,managementAllowed:true,reconnectable:true,
  })};
  const driver=installDriver(ctx,{transport,createScope,agentEvents});
  let finish;
  try{
    const {agent}=await ctx.agents.create({sessionId:'command-effects'});await agent.ready();await tick();
    assert.equal(peer.calls.filter(call=>call.method==='v4/conversation/subscribe').length,1);
    let maintenanceSignal;const maintenance=agent.runMaintenance(signal=>{maintenanceSignal=signal;return new Promise(resolve=>{finish=resolve})});
    agent.followup({id:'parked',role:'user',source:{kind:'user',rpcId:'parked'},content:[{type:'text',text:'parked'}]});
    assert.equal(agent.inbox.nextTurn.length,1);assert.equal(peer.calls.some(call=>call.method==='v4/command'),false);
    let idle=false;const waiting=agent.whenIdle().then(()=>{idle=true});await tick();assert.equal(idle,false);
    agent.cancel({kind:'user'});assert.equal(maintenanceSignal.aborted,true);assert.deepEqual(agent.inbox.nextTurn,[]);
    finish(42);assert.equal(await maintenance,42);await waiting;assert.equal(peer.calls.some(call=>call.method==='v4/command'),false);
    const requestSeen=Promise.withResolvers();let permissionSignal;
    ctx.on('approval/request',request=>{permissionSignal=request.signal;requestSeen.resolve();return new Promise(()=>{})});
    const snapshot=structuredClone(peer.snapshot);snapshot.seq++;snapshot.revision++;snapshot.pendingInteractions=[{interactionId:'permission',kind:'permission',anchorRowId:null,createdAt:0,payload:{kind:'permission',toolCallId:'call-1',toolName:'Bash',summary:'Run?',detail:{},options:[]}}];
    peer.publish(snapshot);await requestSeen.promise;
    await driver.dispose();assert.equal(permissionSignal.aborted,true);assert.equal(ctx.agents.get(agent.id),undefined);assert.equal(ctx.sessions.get(agent.id),undefined);
    const reader=await ctx.sessionPersistence.open(agent.id,'write');
    try{
      const {events}=await reader.read(0);
      const splices=events.filter(event=>event.type==='agent/inbox/spliced');assert.equal(splices.length,2);
      assert.equal(splices[0].data.inserted[0].id,'parked');assert.equal(splices[1].data.outcome,'canceled');assert.equal(splices[1].data.removedCount,1);
      assert.equal(events.some(event=>event.type==='approval/decided'),false,'unload cannot answer a stale permission');
    }finally{await reader.close()}
  }finally{finish?.();await driver.dispose();await ctx.fiber.dispose();await rm(root,{recursive:true,force:true})}
});
