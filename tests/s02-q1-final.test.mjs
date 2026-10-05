// S02 Q1-final closure: official ModelSelect fed by a registered `zcode` provider, additive
// badge/locked-runtime slots, per-session default binding, and official selectModel routing.
// All mock: no model stream is ever executed.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {ZCODE_PROVIDER,ZCODE_STREAM_FAIL_CLOSED,createZCodeAdapter,installZCodeLlm,zcodeModels} from '../packages/host/zcode-llm.mjs';
import {guardController,installMirrorGuards} from '../packages/host/mirror-guards.mjs';
import {RuntimeControls} from '../packages/client/runtime.mjs';
import {ProviderBadge,RuntimeLockedLabel,installRuntimeControls} from '../packages/client/runtime-controls.mjs';
import {sampleProviders} from './helpers/zcode-runtime-fixture.mjs';

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
 // Every method the built official registry calls unguarded must exist on the plain adapter.
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

test('S02-Q1 official selectModel on a zcode session commits officially then routes switchModelConfig',async()=>{
 const routed=[];const commits=[];const original=async function(request){commits.push(request);return {selected:{provider:request.provider,model:request.model}}};
 const controller={selectModel:original,rename:original,fork:original};
 const runtime={store:{records:new Map([['z1',{}]])},agents:{get:id=>id==='z1'?{select:async selection=>{routed.push(selection)}}:undefined},ctx:{workspaceRegistry:{get:()=>undefined}}};
 const restore=guardController(controller,runtime,['selectModel','rename','fork'],{selectModel:async function(original,request,...args){const result=await original.call(this,request,...args);const agent=runtime.agents.get(request.sessionId);if(!agent)throw Object.assign(new Error('unavailable'),{code:'session/official-route-unavailable'});await agent.select({providerId:request.provider,modelId:request.model,...(request.reasoningEffort===undefined?{}:{options:{reasoningLevel:request.reasoningEffort}})});return result}});
 try{
  const result=await controller.selectModel({sessionId:'z1',provider:'zcode',model:'A/model_a',reasoningEffort:'high'});
  assert.deepEqual(result,{selected:{provider:'zcode',model:'A/model_a'}});
  assert.deepEqual(commits,[{sessionId:'z1',provider:'zcode',model:'A/model_a',reasoningEffort:'high'}]);
  assert.deepEqual(routed,[{providerId:'zcode',modelId:'A/model_a',options:{reasoningLevel:'high'}}]);
  assert.throws(()=>controller.rename({sessionId:'z1'}),{code:'session/official-route-unavailable'});
  // Native sessions keep the untouched official method.
  assert.deepEqual(await controller.selectModel({sessionId:'native',provider:'deepseek',model:'x'}),{selected:{provider:'deepseek',model:'x'}});
  assert.equal(routed.length,1);
 }finally{restore();assert.equal(controller.selectModel,original)}
});
test('S02-Q1 native selectModel passes through when no override applies',async()=>{
 const original=async request=>({native:request.sessionId});const controller={selectModel:original};
 const runtime={store:{records:new Map([['z1',{}]])},ctx:{workspaceRegistry:{get:()=>undefined}}};
 const restore=guardController(controller,runtime,['selectModel']);
 try{assert.deepEqual(await controller.selectModel({sessionId:'n1',provider:'deepseek',model:'x'}),{native:'n1'})}finally{restore()}
});

test('S02-Q1 zcode session creation binds the first discovered model through the official selection service',async()=>{
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
 const store=state=>{let current=state;return {getSnapshot:()=>current,subscribe:()=>()=>{},setState:next=>{current=next}}};
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
