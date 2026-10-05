// S02 Q1-final closure + selection-path repair: official ModelSelect fed by a registered `zcode`
// provider, additive badge/locked slots, per-session default binding, and one coherent selection
// owner (identity translation, ACK outcome propagation, no native-default save, durable projection).
// All mock: no model stream is ever executed.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {ZCODE_PROVIDER,ZCODE_STREAM_FAIL_CLOSED,createZCodeAdapter,installZCodeLlm,zcodeModels} from '../packages/host/zcode-llm.mjs';
import {guardController,installMirrorGuards} from '../packages/host/mirror-guards.mjs';
import {resolveIdentity,resolveMirrorSelection,resolveDiscovered,selectionOutcome,selectionFailure,officialSelection} from '../packages/host/model-selection.mjs';
import {ZCodeAgent} from '../packages/host/zcode-agent.mjs';
import {ZCodeRuntime} from '../packages/host/zcode-runtime.mjs';
import {RuntimeControls} from '../packages/client/runtime.mjs';
import {ProviderBadge,RuntimeLockedLabel,installRuntimeControls} from '../packages/client/runtime-controls.mjs';
import {MockPeer,sampleProviders,row,tick} from './helpers/zcode-runtime-fixture.mjs';
import {V4Conversation} from '../packages/host/conversation.mjs';

const EFFORT_LEVELS={'A/model_a':['low','medium','high'],'A/model_b':['low','medium','high'],'B/model_c':['low']};
const effortDefault=model=>model.startsWith('B/')?'low':model==='A/model_b'?'high':'medium';
const fakeLlm=()=>({
  listModels:async provider=>provider===ZCODE_PROVIDER?Object.keys(EFFORT_LEVELS).map(id=>({provider:ZCODE_PROVIDER,id,name:id})):[],
  resolveModelInfo:async(provider,model)=>({provider,id:model,name:model,reasoning:{efforts:(EFFORT_LEVELS[model]??[]).map(id=>({id,name:id})),defaultEffort:effortDefault(model)}}),
  resolveCallConfig:async config=>{const levels=EFFORT_LEVELS[config.model]??[];const effective=config.reasoningEffort??effortDefault(config.model);if(config.reasoningEffort!==undefined&&!levels.includes(config.reasoningEffort))throw Object.assign(new Error(`unsupported ${config.reasoningEffort}`),{code:'UNSUPPORTED_REASONING_EFFORT'});return {...config,reasoningEffort:effective}},
});

test('S02-Q1 discovery maps sample providers A/B into the zcode route with efforts and fails closed',async()=>{
 const models=zcodeModels(sampleProviders());
 assert.deepEqual(models.map(model=>model.id),['A/model_a','A/model_b','B/model_c']);
 assert.ok(models.every(model=>model.provider===ZCODE_PROVIDER&&model.name===model.id));
 assert.deepEqual(models[0].reasoning.efforts.map(effort=>effort.id),['low','medium','high','xhigh','max']);
 assert.equal(models[0].reasoning.defaultEffort,'medium');
 const adapter=createZCodeAdapter({discover:async()=>sampleProviders()});
 assert.deepEqual(adapter.providerInfo(ZCODE_PROVIDER),{id:'zcode',name:'Zcode'});
 assert.deepEqual((await adapter.listModels(ZCODE_PROVIDER)).map(model=>model.id),['A/model_a','A/model_b','B/model_c']);
 const resolved=await adapter.resolveModel(ZCODE_PROVIDER,'B/model_c');
 assert.equal(resolved.provider,ZCODE_PROVIDER);assert.equal(resolved.id,'B/model_c');assert.equal(resolved.reasoning.defaultEffort,'low');
 for(const method of ['providerInfo','providerRetryPolicy','imageRequestPricing','listModels','resolveModel','prepareCall','stream'])assert.equal(typeof adapter[method],'function',method);
 const prepared=await adapter.prepareCall(ZCODE_PROVIDER,'A/model_a');
 assert.equal(prepared.model.id,'A/model_a');assert.throws(()=>prepared.stream(),{code:ZCODE_STREAM_FAIL_CLOSED});
 assert.throws(()=>adapter.stream(),{code:ZCODE_STREAM_FAIL_CLOSED});
});

test('S02-Q1 install registers exactly one zcode route on the official LLM registry',()=>{
 const calls=[];const ctx={llm:{registerAdapter:(providers,adapter)=>{calls.push({providers,adapter});return ()=>{}}}};
 const installed=installZCodeLlm(ctx,{discover:async()=>sampleProviders()});
 assert.deepEqual(calls.map(call=>call.providers),[['zcode']]);
 assert.equal(typeof installed.adapter.listModels,'function');
 assert.throws(()=>installZCodeLlm({},{discover:async()=>[]}),{code:'llm-unavailable'});
});

test('S02-Q1 B1 identity translation: display route unwraps to the real provider/model',async()=>{
 assert.deepEqual(resolveIdentity({provider:'zcode',model:'A/model_a'}),{display:{provider:'zcode',model:'A/model_a'},official:{provider:'A',model:'model_a',reasoningEffort:undefined}});
 assert.deepEqual(resolveIdentity({provider:'deepseek-official',model:'deepseek-flash'}).official,{provider:'deepseek-official',model:'deepseek-flash',reasoningEffort:undefined});
 const resolved=await resolveMirrorSelection(fakeLlm(),{provider:'zcode',model:'B/model_c'});
 assert.deepEqual(resolved.official,{provider:'B',model:'model_c',reasoningEffort:'low'});
 assert.deepEqual(resolved.display,{provider:'zcode',model:'B/model_c',reasoningEffort:'low'});
 assert.throws(()=>resolveIdentity({provider:'zcode',model:'malformed'}),{code:'session/model-unavailable'});
 await assert.rejects(resolveMirrorSelection(fakeLlm(),{provider:'zcode',model:'A/missing'}),{code:'session/model-unavailable'});
 await assert.rejects(resolveMirrorSelection(undefined,{provider:'zcode',model:'A/model_a'}),{code:'session/model-unavailable'});
 assert.deepEqual(resolveDiscovered({provider:'zcode',model:'A/model_a'},sampleProviders()).official,{provider:'A',model:'model_a',reasoningEffort:'medium'});
 assert.throws(()=>resolveDiscovered({provider:'zcode',model:'Z/model_z'},sampleProviders()),{code:'session/model-unavailable'});
});

test('S02-Q1 B1 structural: MockPeer rejects identities outside its advertised registry',async()=>{
 const peer=new MockPeer();
 const accepted=await peer.request('v4/command',{commandId:'c1',type:'switchModelConfig',payload:{provider:'A',model:'model_a',thought:'low'}});
 assert.equal(accepted.status,'accepted');
 const wrongProvider=await peer.request('v4/command',{commandId:'c2',type:'switchModelConfig',payload:{provider:'zcode',model:'A/model_a',thought:''}});
 assert.equal(wrongProvider.status,'failed');assert.equal(wrongProvider.reasonCode,'provider.notInRegistry');
 const wrongModel=await peer.request('v4/command',{commandId:'c3',type:'switchModelConfig',payload:{provider:'A',model:'missing',thought:''}});
 assert.equal(wrongModel.status,'failed');assert.equal(wrongModel.reasonCode,'model.notInRegistry');
 const wrongEffort=await peer.request('v4/command',{commandId:'c4',type:'switchModelConfig',payload:{provider:'A',model:'model_a',thought:'ultra'}});
 assert.equal(wrongEffort.status,'failed');assert.equal(wrongEffort.reasonCode,'effort.unavailable');
});

test('S02-Q1 B5 unsupported effort is rejected before any dispatch or projection write',async()=>{
 const world=guardWorld(async()=>({outcome:'confirmed',ack:{status:'accepted'}}));
 await assert.rejects(world.controller.selectModel({sessionId:'z1',provider:'zcode',model:'B/model_c',reasoningEffort:'max'}),{code:'session/model-unavailable'});
 assert.equal(world.calls.length,0,'no switchModelConfig dispatch');
 assert.equal(world.confirmed.length,0,'no projection write');
 // The same validation runs on the legacy bridge entry against the discovered effort list.
 assert.throws(()=>resolveDiscovered({provider:'zcode',model:'A/model_a',reasoningEffort:'ultra'},sampleProviders()),{code:'session/model-unavailable'});
});

test('S02-Q1 B5 metadata-resolution failure is Remote-recognized with no dispatch or projection',async()=>{
 const failing={listModels:async()=>[{provider:'zcode',id:'A/model_a',name:'A/model_a'}],resolveCallConfig:async()=>{throw Object.assign(new Error('metadata source down'),{code:'METADATA_FAILED'})}};
 const world=guardWorld(async()=>({outcome:'confirmed',ack:{status:'accepted'}}),{llm:failing});
 await assert.rejects(world.controller.selectModel({sessionId:'z1',provider:'zcode',model:'A/model_a'}),{code:'session/model-unavailable'});
 assert.equal(world.calls.length,0);assert.equal(world.confirmed.length,0);
 // Fallback path (no resolveCallConfig): validate the explicit effort against the discovered metadata.
 const fallback={listModels:async()=>[{provider:'zcode',id:'A/model_a',name:'A/model_a'}],resolveModelInfo:async(provider,model)=>({provider,id:model,name:model,reasoning:{efforts:[{id:'low',name:'Low'}],defaultEffort:'low'}})};
 const world2=guardWorld(async()=>({outcome:'confirmed',ack:{status:'accepted'}}),{llm:fallback});
 await assert.rejects(world2.controller.selectModel({sessionId:'z1',provider:'zcode',model:'A/model_a',reasoningEffort:'high'}),{code:'session/model-unavailable'});
 assert.equal(world2.calls.length,0);assert.equal(world2.confirmed.length,0);
});

test('S02-Q1 B2 outcome classification covers every ACK category',()=>{
 assert.equal(selectionOutcome({ack:{status:'accepted'}}).outcome,'confirmed');
 assert.equal(selectionOutcome({ack:{status:'duplicate'}}).outcome,'confirmed');
 assert.equal(selectionOutcome({ack:{status:'noop',reasonCode:'config.unchanged'}}).outcome,'unchanged');
 assert.equal(selectionOutcome({ack:{status:'noop',reasonCode:'other'}}).outcome,'failed');
 assert.equal(selectionOutcome({ack:{status:'failed',reasonCode:'provider.notInRegistry'}}).outcome,'failed');
 assert.equal(selectionOutcome({ack:{status:'rejected',reasonCode:'x'}}).outcome,'failed');
 assert.equal(selectionOutcome({ack:{status:'stale',reasonCode:'x'}}).outcome,'stale');
 assert.equal(selectionOutcome({state:'outcome-unknown'}).outcome,'outcome-unknown');
 assert.equal(selectionFailure({outcome:'failed',ack:{status:'failed',reasonCode:'provider.notInRegistry'}}).isDSHRemoteError,true);
});

test('S02-Q1 B2 guard propagates non-confirmed outcomes and never commits the projection',async()=>{
 for(const [ack,outcome] of [[{status:'failed',reasonCode:'provider.notInRegistry'},'failed'],[{status:'rejected',reasonCode:'x'},'failed'],[{status:'stale',reasonCode:'x'},'stale'],[undefined,'outcome-unknown']]){
  const {controller,confirmed,calls}=guardWorld(async()=>({outcome,ack,state:ack?'accepted':'outcome-unknown'}));
  await assert.rejects(controller.selectModel({sessionId:'z1',provider:'zcode',model:'A/model_a'}),{code:'session/model-unavailable'});
  assert.equal(calls.length,1);assert.equal(confirmed.length,0,`no confirmation for ${outcome}`);
 }
 const accepted=guardWorld(async()=>({outcome:'confirmed',ack:{status:'accepted'},state:'accepted'}));
 const result=await accepted.controller.selectModel({sessionId:'z1',provider:'zcode',model:'A/model_a'});
 assert.deepEqual(result,{selected:{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'}});
 assert.deepEqual(accepted.calls[0],{providerId:'A',modelId:'model_a',options:{reasoningLevel:'medium'}});
 assert.equal(accepted.confirmed.length,1);
 const unchanged=guardWorld(async()=>({outcome:'unchanged',ack:{status:'noop',reasonCode:'config.unchanged'},state:'accepted-awaiting-terminal'}));
 assert.deepEqual((await unchanged.controller.selectModel({sessionId:'z1',provider:'zcode',model:'A/model_a'})).selected.model,'A/model_a');
 assert.equal(unchanged.confirmed.length,1);
});

test('S02-Q1 B3 mirrored selections never enqueue a native deployment-default save',async()=>{
 const thrown=guardWorld(async()=>{throw Object.assign(new Error('boom'),{code:'transport'})});
 await assert.rejects(thrown.controller.selectModel({sessionId:'z1',provider:'zcode',model:'A/model_a'}));
 assert.equal(thrown.saved,0,'throw path must not save');
 const effortOnly=guardWorld(async()=>({outcome:'confirmed',ack:{status:'accepted'}}));
 await effortOnly.controller.selectModel({sessionId:'z1',provider:'zcode',model:'A/model_a',reasoningEffort:'high'});
 assert.equal(effortOnly.calls[0].options.reasoningLevel,'high');
 assert.equal(effortOnly.saved,0,'effort-only mirrored selection must not save');
 // A concurrent native selection keeps the official default save (original command runs untouched).
 await effortOnly.controller.selectModel({sessionId:'native',provider:'deepseek-official',model:'deepseek-flash'});
 assert.equal(effortOnly.saved,1,'native selection keeps the official default save');
});

test('S02-Q1 B4 confirmed selection persists the display projection and executes the official identity',async()=>{
 const peer=new MockPeer();const events=[];const session={id:'z1',seq:0,snapshotEvents:()=>events,append(type,data,opts){const event={type,data,...opts,seq:this.seq++,time:0};events.push(event);return event}};
 const record={id:'z1',officialId:'official-session',workspace:'/w',authority:'official-host',events:[],selection:null};
 const agent=new ZCodeAgent({},session,record,{peer,createScope:(ctx,key)=>({ctx:{key,inject(){}},dispose:async()=>{}}),agentEvents:()=>({emit(){},waterfall:()=>Promise.resolve('unavailable')})});
 await agent.connect();await tick();
 const resolved=await resolveMirrorSelection(fakeLlm(),{provider:'zcode',model:'A/model_a'});
 const outcome=await agent.select(officialSelection(resolved.official));
 assert.equal(outcome.outcome,'confirmed');
 agent.confirmSelection(resolved);
 assert.deepEqual(record.selection,{providerId:'A',modelId:'model_a',options:{reasoningLevel:'medium'}});
 const projection=events.find(event=>event.type==='model/selection')?.data;
 assert.deepEqual(projection,{provider:'zcode',model:'A/model_a',reasoningEffort:'medium'});
 assert.ok((record.events??[]).some(event=>event.type==='model/selection'&&event.data.model==='A/model_a'),'record.events captures the projection');
 // Restart: seeding a fresh session with the persisted events restores the picker projection.
 const restored=[];const restoredSession={id:'z1',seq:0,snapshotEvents:()=>restored,append(type,data,opts){const event={type,data,...opts,seq:this.seq++,time:0};restored.push(event);return event}};
 for(const event of record.events)restoredSession.append(event.type,event.data,event.opts);
 assert.ok(restoredSession.snapshotEvents().some(event=>event.type==='model/selection'&&event.data.provider==='zcode'));
 // Execution keeps the official identity for the next prompt.
 agent.followup({content:[{type:'text',text:'after selection'}]});await tick();
 const send=peer.calls.find(call=>call.params?.type==='sendText');
 assert.deepEqual(send.params.payload.modelSelection,{providerId:'A',modelId:'model_a',options:{reasoningLevel:'medium'}});
});

test('S02-Q1 default binding uses the official selection service for a new ZCode session',async()=>{
 const bound=[];const original=async options=>options?.sessionId??'native-new';
 const sessions={create:original,list:{getSnapshot:()=>({byId:{}})}};
 const controls=new RuntimeControls({call:async(channel,endpoint,payload)=>({ok:true,value:payload.operation==='create'?{sessionId:'zcode-created'}:{runtime:'zcode',locked:true}})},{});
 const restore=controls.install(sessions,{defaultSelection:async id=>{bound.push(id)}});
 try{
  assert.equal(await sessions.create(),'zcode-created');
  await controls.bindings.get('zcode-created');
  assert.deepEqual(bound,['zcode-created']);
  controls.stage('native');assert.equal(await sessions.create(),'native-new');assert.deepEqual(bound,['zcode-created']);
 }finally{restore();controls.dispose()}
});

test('S02-Q1 badge switches whale/Z by selection provider and the global store drives it',()=>{
 const store=state=>{let current=state;return {getSnapshot:()=>current,subscribe:()=>()=>{}}};
 const zcode=store({current:{provider:'zcode',model:'A/model_a'}});
 const deepseek=store({current:{provider:'deepseek-account',model:'deepseek-flash'}});
 assert.match(renderToStaticMarkup(createElement(ProviderBadge,{store:zcode})),/data-zcode-provider-badge="zcode"/);
 assert.match(renderToStaticMarkup(createElement(ProviderBadge,{store:deepseek})),/data-zcode-provider-badge="whale"/);
 assert.equal(renderToStaticMarkup(createElement(ProviderBadge,{store:null})),'');
});

test('S02-Q1 locked-runtime display shows DSH for native and the locked hint for zcode',()=>{
 const controls=sessionId=>runtime=>({subscribe:()=>()=>{},getSnapshot:()=>({}),infos:new Map([[sessionId,runtime]]),info:async()=>runtime});
 const zcode=renderToStaticMarkup(createElement(RuntimeLockedLabel,{controls:controls('z')({runtime:'zcode',hint:'官方 GUI 可能正在运行本会话'}),sessionId:'z'}));
 assert.match(zcode,/data-zcode-runtime-locked="zcode"/);assert.match(zcode,/官方 GUI 可能正在运行本会话/);
 const native=renderToStaticMarkup(createElement(RuntimeLockedLabel,{controls:controls('n')({runtime:'native',locked:true}),sessionId:'n'}));
 assert.match(native,/data-zcode-runtime-locked="native"/);assert.match(native,/>DSH</);assert.equal(native.includes('官方 GUI'),false);
 const bound=renderToStaticMarkup(createElement(RuntimeLockedLabel,{controls:controls('b')({runtime:'zcode',hint:'官方 GUI 可能正在运行本会话',bindingHint:'Session created in the ZCode execution workspace; the picked workspace applies to native sessions only.'}),sessionId:'b'}));
 assert.match(bound,/data-zcode-binding-hint/);assert.match(bound,/ZCode execution workspace/);
});

test('S02-Q1 wave5: two sessions receive independent per-session live frames',async()=>{
 const peer=new MockPeer();const first=peer.registerSession('s1'),second=peer.registerSession('s2');
 const workspace={workspacePath:'/fixture/workspace',workspaceKey:'/fixture/workspace'};
 const make=sessionId=>new V4Conversation(peer,{address:{runtime:'zcode',authority:'fixture',workspace:workspace.workspacePath,sessionId},workspace,clientId:'client-'+sessionId,connectionId:'client-'+sessionId,runnable:true});
 const a=make('s1'),b=make('s2');
 try{
  await a.connect();await b.connect();await tick();await tick();
  assert.equal(a.state.status,'live');assert.equal(b.state.status,'live');
  assert.equal(a.state.snapshot.sessionId,'s1');assert.equal(b.state.snapshot.sessionId,'s2');
  const firstNext={...structuredClone(first),seq:1,revision:1,rows:{...first.rows,window:[row('assistantText',1,{text:'one',state:'streaming'})]}};
  peer.publish(firstNext);await tick();await tick();
  assert.equal(a.state.snapshot.rows.window.at(-1)?.text,'one');
  assert.equal(b.state.snapshot.rows.window.length,0,'s2 must not receive s1 frames');
  const secondNext={...structuredClone(second),seq:1,revision:1,rows:{...second.rows,window:[row('assistantText',1,{text:'two',state:'streaming'})]}};
  peer.publish(secondNext);await tick();await tick();
  assert.equal(b.state.snapshot.rows.window.at(-1)?.text,'two');
  assert.equal(a.state.snapshot.rows.window.at(-1)?.text,'one','s1 must not receive s2 frames');
 }finally{await a.cancel();await b.cancel()}
});

test('S02-Q1 wave4: zcode create binds the execution workspace and hints on a mismatched picker choice',async()=>{
 const peer=new MockPeer();const registryAgents=new Map(),sessions=new Map(),workspaces=new Map(),created=[];
 const registry={
  resolveByPath:async path=>[...workspaces.values()].find(workspace=>workspace.path===path),
  create:async(path,name)=>{created.push({path,name});const workspace={id:'ws-'+created.length,path,name,sessionIds:[],attachSession:async id=>{workspace.sessionIds.push(id)}};workspaces.set(workspace.id,workspace);return workspace},
  get:id=>workspaces.get(id),
 };
 const ctx={
  sessions:{prepare:(id,options)=>({id,seq:(options.seed??[]).length,snapshotEvents:()=>[],append(type,data,opts){return {type,data,...opts,seq:this.seq++,time:0}}}),enter:session=>{sessions.set(session.id,session);return ()=>sessions.delete(session.id)},get:id=>sessions.get(id)},
  agents:{get:id=>registryAgents.get(id),register:async agent=>{registryAgents.set(agent.id,agent);return ()=>registryAgents.delete(agent.id)}},
  workspaceRegistry:registry,
 };
 const store={records:new Map(),load:async()=>{},save:async()=>{},writing:Promise.resolve()};
 const host={launcher:{state:{phase:'ready',auth:'authenticated',executionWorkspace:'/exec/workspace'},subscribe:()=>()=>{}},connect:async()=>{}};
 const runtime=new ZCodeRuntime(ctx,host,{store,createScope:(scopeCtx,key)=>({ctx:{key,inject(){}},dispose:async()=>{}}),agentEvents:()=>({emit(){},waterfall:()=>Promise.resolve('unavailable')}),peerFactory:()=>peer});
 try{
  const mismatched=await runtime.create({sessionId:'z1',workspaceId:'picked-ws'});
  assert.equal(mismatched.workspaceId,'ws-1');
  assert.match(mismatched.hint,/execution workspace/);
  const record=store.records.get('z1');
  assert.equal(record.workspaceId,'ws-1');assert.equal(record.workspace,'/exec/workspace');assert.equal(record.cwd,'/exec/workspace');
  assert.match(record.bindingHint,/execution workspace/);assert.equal(runtime.info('z1').bindingHint,record.bindingHint);
  assert.deepEqual(workspaces.get('ws-1').sessionIds,['z1']);
  const matched=await runtime.create({sessionId:'z2',workspaceId:'ws-1'});
  assert.equal(matched.hint,null);assert.equal(store.records.get('z2').bindingHint,null);
  assert.deepEqual(created,[{path:'/exec/workspace',name:'ZCode'}],'the execution workspace is registered once');
  // A stale/picked workspaceId on a restored record cannot move the session.
  const restored={id:'z3',officialId:'official-session',workspace:'/exec/workspace',cwd:'/exec/workspace',workspaceId:'picked-ws',authority:'official-host',events:[]};
  store.records.set('z3',restored);await runtime.register(restored);
  assert.deepEqual(workspaces.get('ws-1').sessionIds,['z1','z2','z3']);
 }finally{await runtime.dispose()}
});

test('S02-Q1 installation registers additive badge/locked slots and never shadows conversation.input.model',()=>{
 const registered=[];const sessions={create:async()=>'id',list:{getSnapshot:()=>({byId:{}})}};
 const slots={inject:(name,apply)=>{apply({register:options=>{registered.push(options)}})},register:options=>{registered.push(options)}};
 const ctx={connection:{rpc:{},generation:{subscribe:()=>()=>{}}},sessions,effect:()=>{},uiWorkspace:{openSession:()=>{}},get:()=>undefined,
  slots,inject:(keys,apply)=>{apply({slots,modelDirectories:{directoryFor:()=>({store:{getSnapshot:()=>({}),subscribe:()=>()=>{}}})}})}};
 const controls=installRuntimeControls(ctx);
 try{
  const names=registered.map(options=>options.name);
  assert.ok(names.includes('conversation.hero.agentPreset'));
  assert.ok(names.includes('conversation.input.right'));
  assert.ok(names.includes('conversation.input.left'));
  assert.equal(names.includes('conversation.input.model'),false);
  assert.equal(registered.find(options=>options.name==='conversation.input.right').registrant,'zcode-runtime-badge');
  assert.equal(registered.find(options=>options.name==='conversation.input.left').registrant,'zcode-runtime-locked');
 }finally{controls.dispose()}
});

/** installMirrorGuards harness with a fake sessionController, LLM catalog and default-model service.
 * The native original command emulates the official default save; mirrored selections must not. */
function guardWorld(agentSelect,{llm=fakeLlm()}={}){
 const calls=[],confirmed=[];let saved=0;
 const agent={select:async selection=>{calls.push(selection);return agentSelect(selection)},confirmSelection:resolved=>{confirmed.push(resolved)}};
 const defaults={currentSelection:()=>({provider:'deepseek-official',model:'deepseek-flash'}),saveSelection:async()=>{saved++}};
 const controller={selectModel:async request=>{if(request.sessionId==='native')await defaults.saveSelection({provider:request.provider,model:request.model});return {original:request}},rename:async()=>{},fork:async()=>{}};
 const scope={sessionController:controller,get:name=>name==='llm'?llm:name==='agentDefaultModel'?defaults:undefined,effect:()=>{}};
 const runtime={store:{records:new Map([['z1',{}]])},agents:{get:id=>id==='z1'?agent:undefined},ctx:{workspaceRegistry:{get:()=>undefined}}};
 const ctx={inject:(keys,apply)=>{apply(keys.includes('workspaceController')?{workspaceController:{},effect:()=>{}}:scope)},effect:()=>{}};
 installMirrorGuards(ctx,runtime);
 return {controller,runtime,calls,confirmed,get saved(){return saved}};
}
