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
