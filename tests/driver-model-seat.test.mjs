// Model seat: the real `zcode` llm directory, the official selectModel entry taken over by the
// driver, deployment-default coverage, and the two S02 deferred corrections (sticky selection and
// the real provider/model on request/header). The selection branches are verified through a real
// rc.2 SessionController + modelSelection projection + the picker's own wire value, never a
// driver-internal flag alone.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {installDriver} from '../packages/driver/factory.mjs';
import {installModelSeat,coverDefaultModel,installDefaultModelCover} from '../packages/driver/model-seat.mjs';
import {installZCodeLlm} from '../packages/host/zcode-llm.mjs';
import {ConversationEventTranslator} from '../packages/driver/events.mjs';
import {V4Conversation} from '../packages/host/conversation.mjs';
import {MockPeer,baseSnapshot,sampleProviders,tick} from './helpers/zcode-runtime-fixture.mjs';
import {commandWorld,message} from './helpers/lifecycle-commands.mjs';

const root=process.env.DSH_DRIVER_NPM_NODE_MODULES??'/private/tmp/dsh-local-npm-verify/npm/node_modules';
const cohort=['cordis','dsh-agent','dsh-session','dsh-session-projection','dsh-scope','dsh-typert-registry','dsh-api-session-controller','dsh-typert-protocol','dsh-llm'];
const artifact=name=>join(root,'@deepseek-ai',name,'lib/index.js');
const available=cohort.every(name=>existsSync(artifact(name)));
const real={skip:available?false:'requires rc.2 npm artifacts; set DSH_DRIVER_NPM_NODE_MODULES'};
let hooksRegistered=false;

test('ZCode directory maps the launcher projection through providerInfo/listModels/resolveModel/resolveCallConfig and stays fail-closed',real,async()=>{
  const [{Context},{LlmRuntime}]=await Promise.all(['cordis','dsh-llm'].map(name=>import(pathToFileURL(artifact(name)))));
  const reads=[];
  const launcherModels=[
    {id:'A',models:[{id:'model_a',reasoningLevels:['low','medium','high'],defaultReasoningLevel:'medium'}]},
    {id:'B',models:[{id:'model_c',reasoningLevels:['low'],defaultReasoningLevel:'low'}]},
  ];
  const {ZCODE_STREAM_FAIL_CLOSED}=await import('../packages/host/zcode-llm.mjs');
  const ctx=new Context(),llm=new LlmRuntime(ctx);
  const installed=installZCodeLlm(ctx,{discover:async()=>{reads.push('models');return launcherModels}});
  assert.deepEqual(llm.listProviders(),[{id:'zcode',name:'Zcode'}]);
  assert.deepEqual(installed.adapter.providerInfo('zcode'),{id:'zcode',name:'Zcode'});
  assert.deepEqual((await llm.listModels('zcode')).map(model=>model.id),['A/model_a','B/model_c']);
  const resolved=await llm.resolveModelInfo('zcode','A/model_a');
  assert.deepEqual(resolved.reasoning.efforts.map(effort=>effort.id),['low','medium','high']);
  assert.equal(resolved.reasoning.defaultEffort,'medium');
  assert.deepEqual(await llm.resolveCallConfig({provider:'zcode',model:'A/model_a'}),{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'});
  assert.deepEqual(await llm.resolveCallConfig({provider:'zcode',model:'A/model_a',reasoningEffort:'high'}),{provider:'zcode',model:'A/model_a',reasoningEffort:'high'});
  await assert.rejects(llm.resolveCallConfig({provider:'zcode',model:'A/model_a',reasoningEffort:'max'}),error=>error.code==='UNSUPPORTED_REASONING_EFFORT');
  assert.ok(reads.length>=4,'every catalog query is sourced from the live launcher read');
  assert.throws(()=>installed.adapter.stream(),{code:ZCODE_STREAM_FAIL_CLOSED});
  const prepared=await installed.adapter.prepareCall('zcode','A/model_a');
  assert.throws(()=>prepared.stream(),{code:ZCODE_STREAM_FAIL_CLOSED});
  await ctx.fiber.dispose();
});

test('the model seat leaves a native session on the original official command',async()=>{
  const calls=[];
  const original=async request=>{calls.push(request);return {selected:{provider:request.provider,model:request.model}}};
  const commands={selectModel:original};
  const controller={commands,resolveAgent:async()=>({agent:{id:'native'}})};
  const ctx={get:name=>name==='sessionController'?controller:undefined,effect:fn=>{fn();return ()=>{}}};
  installModelSeat(ctx,{transport:{}});
  assert.notEqual(controller.commands.selectModel,original);
  assert.deepEqual(await controller.commands.selectModel({sessionId:'native',provider:'deepseek-official',model:'deepseek-flash'}),{selected:{provider:'deepseek-official',model:'deepseek-flash'}});
  assert.deepEqual(calls,[{sessionId:'native',provider:'deepseek-official',model:'deepseek-flash'}]);
});

test('confirmed ZCode ACK releases the official persistence into the real projection',real,async()=>{
  const w=await modelSeatWorld();
  try{
    const result=await w.controller.selectModel({sessionId:'seat-1',provider:'zcode',model:'A/model_a'});
    assert.deepEqual(result.selected,{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'});
    const dispatched=w.writes().filter(command=>command.type==='switchModelConfig');
    assert.equal(dispatched.length,1);
    assert.deepEqual(dispatched[0].payload,{provider:'A',model:'model_a',thought:'medium'});
    // The picker reads exactly this wire value (`next = pending ?? lastUsed`).
    assert.deepEqual(w.projection(),{lastUsed:null,next:{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'}});
    assert.equal(w.events().filter(event=>event.type==='model/selection').length,1);
    assert.deepEqual(w.saved,[{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'}]);
    const catalog=await w.llm.listModels('zcode');
    assert.ok(catalog.some(model=>model.id===w.projection().next.model),'the projected selection stays routable in the picker catalog');
  }finally{await w.close()}
});

test('official persistence and success are published only after the ZCode ACK resolves',real,async()=>{
  const w=await modelSeatWorld();
  try{
    const original=w.peer.request.bind(w.peer);
    const entered=Promise.withResolvers(),release=Promise.withResolvers();
    w.peer.request=async(method,params,options)=>{if(params?.type==='switchModelConfig'){entered.resolve();await release.promise}return original(method,params,options)};
    const pending=w.controller.selectModel({sessionId:'seat-1',provider:'zcode',model:'A/model_a'});
    await entered.promise;await tick();
    assert.equal(w.events().some(event=>event.type==='model/selection'),false,'no durable selection before the ACK');
    assert.deepEqual(w.projection(),{lastUsed:null,next:null});
    assert.equal(w.saved.length,0);
    release.resolve();
    assert.deepEqual((await pending).selected,{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'});
    assert.equal(w.events().some(event=>event.type==='model/selection'),true);
    assert.equal(w.saved.length,1);
  }finally{await w.close()}
});

test('a refused ZCode ACK rejects and writes no official persistence',real,async()=>{
  const w=await modelSeatWorld();
  try{
    const original=w.peer.request.bind(w.peer);
    w.peer.request=async(method,params,options)=>{
      if(params?.type!=='switchModelConfig')return original(method,params,options);
      w.peer.calls.push({method,params:structuredClone(params)});
      return options.onResult({commandId:params.commandId,status:'failed',reasonCode:'official.denied',revisionAtDecision:w.peer.snapshot.revision});
    };
    await assert.rejects(w.controller.selectModel({sessionId:'seat-1',provider:'zcode',model:'A/model_a'}),error=>{
      assert.equal(error.isDSHRemoteError,true);assert.equal(error.code,'session/model-unavailable');
      assert.equal(error.details.outcome,'failed');assert.equal(error.details.reasonCode,'official.denied');return true;
    });
    assert.equal(w.writes().filter(command=>command.type==='switchModelConfig').length,1,'the switch is attempted exactly once');
    assert.equal(w.events().some(event=>event.type==='model/selection'),false);
    assert.deepEqual(w.projection(),{lastUsed:null,next:null});
    assert.equal(w.saved.length,0);
  }finally{await w.close()}
});

test('an outcome-unknown ZCode ACK rejects explicitly and writes no official persistence',real,async()=>{
  const w=await modelSeatWorld();
  try{
    w.peer.loseAck=true;
    await assert.rejects(w.controller.selectModel({sessionId:'seat-1',provider:'zcode',model:'A/model_a'}),error=>{
      assert.equal(error.isDSHRemoteError,true);assert.equal(error.code,'session/model-unavailable');
      assert.equal(error.details.outcome,'outcome-unknown');return true;
    });
    const dispatched=w.writes().filter(command=>command.type==='switchModelConfig');
    assert.equal(dispatched.length,1);
    assert.equal(w.agent.conversation.command(dispatched[0].commandId).state,'outcome-unknown');
    assert.equal(w.events().some(event=>event.type==='model/selection'),false);
    assert.deepEqual(w.projection(),{lastUsed:null,next:null});
    assert.equal(w.saved.length,0);
  }finally{await w.close()}
});

test('occupied default cover saves the first ZCode catalog model and never rewrites a routable one',real,async()=>{
  const w=await modelSeatWorld();
  try{
    assert.deepEqual(w.current(),{provider:'deepseek-account',model:'deepseek-flash'});
    const covered=await coverDefaultModel(w.ctx);
    assert.deepEqual(covered,{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'});
    assert.deepEqual(w.current(),covered);
    assert.deepEqual(await coverDefaultModel(w.ctx),covered);
    assert.equal(w.saved.length,1,'an already routable ZCode default is not rewritten');
    assert.deepEqual(await coverDefaultModel({get:name=>name==='llm'?{listProviders:()=>[{id:'other'}]}:name==='agentDefaultModel'?{saveSelection:async()=>{throw new Error('must not save')}}:undefined}),undefined);
  }finally{await w.close()}
});

test('default cover runs at install and lazily on adapter-registry and profile-config updates',async()=>{
  const saved=[],listeners=new Map();
  const llm={listProviders:()=>[{id:'zcode'}],listModels:async()=>[{id:'A/model_a'}],resolveModelInfo:async()=>({provider:'zcode',id:'A/model_a',reasoning:{efforts:[{id:'low',name:'Low'}],defaultEffort:'low'}})};
  let current={provider:'deepseek-account',model:'deepseek-flash'};
  const ctx={get:name=>name==='llm'?llm:name==='agentDefaultModel'?{currentSelection:()=>({...current}),saveSelection:async selection=>{current={...selection};saved.push({...selection})}}:undefined,
    on(name,listener){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(listener);return ()=>listeners.get(name).delete(listener)},
    effect:fn=>{fn();return ()=>{}}};
  installDefaultModelCover(ctx);
  await tick();
  assert.deepEqual([...listeners.keys()].sort(),['app-boot/config-reload','llm/adapters-updated'],'both the registry and the profile-config re-triggers are subscribed');
  assert.deepEqual(saved,[{provider:'zcode',model:'A/model_a',reasoningEffort:'low'}]);
  // An official initializeDefaultModel-style write moves the default back outside the ZCode catalog.
  current={provider:'deepseek-account',model:'deepseek-flash'};
  for(const listener of listeners.get('app-boot/config-reload'))listener();
  await tick();
  assert.equal(saved.length,2,'the config-reload re-trigger restores the ZCode default');
  assert.deepEqual(saved.at(-1),{provider:'zcode',model:'A/model_a',reasoningEffort:'low'});
  for(const listener of listeners.get('llm/adapters-updated'))listener();
  await tick();
  assert.equal(saved.length,2,'an already routable default is not rewritten');
});

test('a late official initializeDefaultModel reset is re-covered lazily without rewriting a routable default',real,async()=>{
  const w=await modelSeatWorld({cover:true});
  try{
    assert.deepEqual(w.current(),{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'});
    assert.equal(w.saved.length,1);
    // The official client's credential-stored frame makes initializeDefaultModel rewrite the
    // deployment default to the deepseek first model; that profile write settles as a config reload.
    w.resetDefault({provider:'deepseek-account',model:'deepseek-flash'});
    assert.deepEqual(w.current(),{provider:'deepseek-account',model:'deepseek-flash'});
    w.ctx.emit('app-boot/config-reload');
    await tick();await tick();
    assert.deepEqual(w.current(),{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'});
    assert.equal(w.saved.length,2,'the config-reload re-trigger restores the ZCode default');
    w.ctx.emit('app-boot/config-reload');
    await tick();await tick();
    assert.equal(w.saved.length,2,'an already routable default is not rewritten');
    assert.deepEqual(w.projection(),{lastUsed:null,next:null},'default coverage never touches a session selection projection');
  }finally{await w.close()}
});

test('apply() installs the model seat and the lazy default cover onto the live controller',real,async t=>{
  const {registerHooks}=await import('node:module');
  if(typeof registerHooks!=='function'){t.skip('node module.registerHooks is unavailable');return}
  // Bare `@deepseek-ai/*` inside packages/driver/index.mjs resolve against the isolated npm cohort.
  if(!hooksRegistered){
    const anchor=pathToFileURL(join(root,'..','resolve-anchor.js')).href;
    registerHooks({resolve(specifier,context,nextResolve){
      return specifier.startsWith('@deepseek-ai/')?nextResolve(specifier,{...context,parentURL:anchor}):nextResolve(specifier,context);
    }});
    hooksRegistered=true;
  }
  const {apply}=await import('../packages/driver/index.mjs');
  const originals={rename:async()=>({title:'t',seq:1}),updateQueue:async()=>({accepted:true}),cancel:async()=>({accepted:true}),selectModel:async request=>({selected:{provider:request.provider,model:request.model}}),create:async request=>({sessionId:request?.sessionId??'session-stub'})};
  const commands={...originals};
  const controller={commands,resolveAgent:async()=>({agent:{id:'none'}})};
  const titles={config:{maxTitleBytes:120},rename:()=>({title:'t',eventSeq:1})};
  const saved=[];let current={provider:'deepseek-account',model:'deepseek-flash'};
  const listeners=new Map();
  const llm={listProviders:()=>[{id:'zcode'}],listModels:async()=>[{id:'A/model_a'}],resolveModelInfo:async()=>({provider:'zcode',id:'A/model_a',reasoning:{efforts:[{id:'low',name:'Low'}],defaultEffort:'medium'}})};
  const host={driverState:null};
  const ctx={
    zcodeBridgeHost:host,fiber:{assertActive(){}},
    get:name=>({sessionController:controller,sessionTitle:titles,llm,sessionPersistence:undefined,
      agentDefaultModel:{currentSelection:()=>({...current}),saveSelection:async selection=>{current={...selection};saved.push({...selection})}}}[name]),
    effect(callback){const result=callback(),cleanups=[];if(result&&typeof result.next==='function'){let step=result.next();while(!step.done){if(step.value)cleanups.push(step.value);step=result.next()}}else if(typeof result==='function')cleanups.push(result);return ()=>{for(const cleanup of cleanups.splice(0).reverse())try{cleanup()}catch{}}},
    on(name,listener){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(listener);return ()=>listeners.get(name).delete(listener)},
    emit(name,...args){for(const listener of listeners.get(name)??[])listener(...args)},
    inject(_names,callback){return {await:async()=>{await callback(ctx)}}},
    agents:{setFactory(){return ()=>{}}},sessions:{},sessionProjections:{register(){return ()=>{}}},
  };
  await apply(ctx);
  assert.equal(host.driverState.state,'occupied');
  assert.notEqual(commands.rename,originals.rename,'the S02 command seams install beside the model seat');
  assert.notEqual(commands.selectModel,originals.selectModel,'apply installs the model seat');
  assert.deepEqual([...listeners.keys()].sort(),['app-boot/config-reload','llm/adapters-updated']);
  await tick();await tick();
  assert.deepEqual(saved,[{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'}],'apply installs the cover and it runs against the live registry');
  current={provider:'deepseek-account',model:'deepseek-flash'};
  ctx.emit('app-boot/config-reload');
  await tick();await tick();
  assert.deepEqual(current,{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'},'the apply-installed cover survives an official reset');
  ctx.emit('app-boot/config-reload');
  await tick();await tick();
  assert.equal(saved.length,2,'an already routable default is not rewritten');
});

test('later messages carry no create-time modelSelection/mode while the creation options remain intact',async()=>{
  const selection={providerId:'A',modelId:'model_a',options:{reasoningLevel:'high'}};
  const w=await commandWorld('idle',{options:{modelSelection:selection,mode:'plan'}});
  try{
    assert.deepEqual(w.agent.options,{modelSelection:selection,mode:'plan'});
    w.agent.followup(message('follow'));
    await w.drain();
    const send=w.peer.calls.find(call=>call.method==='v4/command'&&call.params.type==='sendText');
    assert.ok(send,'the followup still dispatches a plain sendText');
    assert.equal('modelSelection' in send.params.payload,false);
    assert.equal('mode' in send.params.payload,false);
    assert.equal(send.params.payload.text,'hello');
  }finally{await w.close()}
});

test('request/header carries the session real provider/model/effort instead of the zcode placeholder',async()=>{
  const frozen=JSON.parse(await readFile(new URL('./fixtures/lifecycle-events/transcript.json',import.meta.url),'utf8'));
  const events=[];
  const session={id:'header',get seq(){return events.length},eventAt:seq=>events[seq],snapshotEvents:()=>events,append(type,data,opts){const event={type,data:structuredClone(data),...opts,seq:events.length,time:1};events.push(event);return event}};
  const translator=new ConversationEventTranslator({session,clock:()=>1,dispatch:{emit(){}}});
  for(const snapshot of frozen.snapshots)await translator.enqueue(snapshot);
  const headers=events.filter(event=>event.type==='request/header');
  assert.equal(headers.length,2);
  assert.deepEqual(headers[0].data.header.config,{provider:'deepseek',model:'deepseek-flash',reasoningEffort:'max'});
  await translator.close();
});

/** Real rc.2 assembly: official Context/AgentRegistry/SessionStore/projections/SessionController,
 * a real LlmRuntime carrying the adapter, a driver factory occupied on it, and one live driver
 * session bound to a MockPeer conversation. */
async function modelSeatWorld({cover=false}={}){
  const worldCohort=['cordis','dsh-agent','dsh-session','dsh-session-projection','dsh-scope','dsh-typert-registry','dsh-api-session-controller','dsh-llm'];
  const [{Context},{AgentRegistry,agentEvents},{SessionStore},{default:Projections},{createScope},{default:TypertRegistry},{SessionController},{LlmRuntime}]=await Promise.all(worldCohort.map(name=>import(pathToFileURL(artifact(name)))));
  const ctx=new Context();
  new AgentRegistry(ctx);new SessionStore(ctx);new Projections(ctx);new TypertRegistry(ctx);
  const llm=new LlmRuntime(ctx);
  ctx.provide('fileUploads',{registerAgentResolver:()=>()=>{},retirePrompt(){}});
  ctx.provide('attachments',{imageLimits:{maxImageBytes:100,maxImagesPerMessage:1,maxMessageImageBytes:100,maxImagePixels:100,maxImageDimension:10,mediaTypes:['image/png']}});
  const saved=[];let current={provider:'deepseek-account',model:'deepseek-flash'};
  ctx.provide('agentDefaultModel',{currentSelection:()=>({...current}),saveSelection:async selection=>{current={...selection};saved.push({...selection})}});
  installZCodeLlm(ctx,{discover:async()=>sampleProviders()});
  const controller=new SessionController(ctx,{nativeOpen:false});
  const peer=new MockPeer();
  peer.snapshot=baseSnapshot();peer.snapshot.rows.window=[];peer.snapshot.control.canStop=false;peer.snapshot.control.activeWorks=[];
  const transport={create:async()=>peer.snapshot.sessionId,dispose(){peer.close()},conversation:()=>new V4Conversation(peer,{
    address:{runtime:'zcode',authority:'official-host',workspace:'/workspace',sessionId:peer.snapshot.sessionId},
    workspace:{workspacePath:'/workspace',workspaceKey:'/workspace'},connectionId:peer.connectionId,
    clientId:'model-seat',clientMode:'desktop-continuous',runnable:true,managementAllowed:true,reconnectable:true,
  })};
  let driver;
  const provider=ctx.plugin({apply(owner){
    driver=installDriver(owner,{transport,createScope,agentEvents});
    installModelSeat(owner,driver.factory);
    if(cover)installDefaultModelCover(owner);
  }});
  await provider.await();
  const {agent}=await ctx.agents.create({sessionId:'seat-1',meta:{cwd:'/workspace'}});
  await agent.ready();await tick();
  if(cover)await tick();
  return {ctx,llm,controller,peer,agent,
    saved,current:()=>({...current}),
    resetDefault:selection=>{current={...selection}},
    projection:()=>ctx.sessionProjections.snapshot(agent.session,['modelSelection']).values.modelSelection,
    events:()=>Array.from({length:agent.session.seq},(_,seq)=>agent.session.eventAt(seq)),
    writes:()=>peer.calls.filter(call=>call.method==='v4/command').map(call=>call.params),
    async close(){await provider.dispose();await ctx.fiber.dispose()},
  };
}
