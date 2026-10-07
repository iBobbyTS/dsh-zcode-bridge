// Model selection closure + selection-path repair: official ModelSelect fed by a registered `zcode`
// provider, additive badge/locked slots, per-session default binding, and one coherent selection
// owner (identity translation, ACK outcome propagation, no native-default save, durable projection).
// All mock: no model stream is ever executed.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {ZCODE_PROVIDER,ZCODE_STREAM_FAIL_CLOSED,createZCodeAdapter,installZCodeLlm,zcodeModels} from '../packages/host/zcode-llm.mjs';
import {resolveIdentity,resolveMirrorSelection,resolveDiscovered,selectionOutcome,selectionFailure,officialSelection} from '../packages/host/model-selection.mjs';
import {ZCodeAgent} from '../packages/host/zcode-agent.mjs';
import {MockPeer,sampleProviders,row,tick} from './helpers/zcode-runtime-fixture.mjs';
import {V4Conversation} from '../packages/host/conversation.mjs';

const EFFORT_LEVELS={'A/model_a':['low','medium','high'],'A/model_b':['low','medium','high'],'B/model_c':['low']};
const effortDefault=model=>model.startsWith('B/')?'low':model==='A/model_b'?'high':'medium';
const fakeLlm=()=>({
  listModels:async provider=>provider===ZCODE_PROVIDER?Object.keys(EFFORT_LEVELS).map(id=>({provider:ZCODE_PROVIDER,id,name:id})):[],
  resolveModelInfo:async(provider,model)=>({provider,id:model,name:model,reasoning:{efforts:(EFFORT_LEVELS[model]??[]).map(id=>({id,name:id})),defaultEffort:effortDefault(model)}}),
  resolveCallConfig:async config=>{const levels=EFFORT_LEVELS[config.model]??[];const effective=config.reasoningEffort??effortDefault(config.model);if(config.reasoningEffort!==undefined&&!levels.includes(config.reasoningEffort))throw Object.assign(new Error(`unsupported ${config.reasoningEffort}`),{code:'UNSUPPORTED_REASONING_EFFORT'});return {...config,reasoningEffort:effective}},
});

test('Model selection discovery maps sample providers A/B into the zcode route with efforts and fails closed',async()=>{
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

test('Model selection install registers exactly one zcode route on the official LLM registry',()=>{
 const calls=[];const ctx={llm:{registerAdapter:(providers,adapter)=>{calls.push({providers,adapter});return ()=>{}}}};
 const installed=installZCodeLlm(ctx,{discover:async()=>sampleProviders()});
 assert.deepEqual(calls.map(call=>call.providers),[['zcode']]);
 assert.equal(typeof installed.adapter.listModels,'function');
 assert.throws(()=>installZCodeLlm({},{discover:async()=>[]}),{code:'llm-unavailable'});
});

test('Model selection B1 identity translation: display route unwraps to the real provider/model',async()=>{
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

test('Model selection B1 structural: MockPeer rejects identities outside its advertised registry',async()=>{
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

test('Model selection B5 unsupported effort is rejected before any dispatch or projection write',async()=>{
 // The live validation runs against the adapter-owned catalog; a legacy discovered-registry entry
 // keeps the same rejection for the retired bridge selection path.
 await assert.rejects(resolveMirrorSelection(fakeLlm(),{provider:'zcode',model:'B/model_c',reasoningEffort:'max'}),{code:'session/model-unavailable'});
 assert.throws(()=>resolveDiscovered({provider:'zcode',model:'A/model_a',reasoningEffort:'ultra'},sampleProviders()),{code:'session/model-unavailable'});
});
test('Model selection B5 metadata-resolution failure is Remote-recognized with no dispatch or projection',async()=>{
 const failing={listModels:async()=>[{provider:'zcode',id:'A/model_a',name:'A/model_a'}],resolveCallConfig:async()=>{throw Object.assign(new Error('metadata source down'),{code:'METADATA_FAILED'})}};
 await assert.rejects(resolveMirrorSelection(failing,{provider:'zcode',model:'A/model_a'}),{code:'session/model-unavailable'});
 const fallback={listModels:async()=>[{provider:'zcode',id:'A/model_a',name:'A/model_a'}],resolveModelInfo:async(provider,model)=>({provider,id:model,name:model,reasoning:{efforts:[{id:'low',name:'Low'}],defaultEffort:'low'}})};
 await assert.rejects(resolveMirrorSelection(fallback,{provider:'zcode',model:'A/model_a',reasoningEffort:'high'}),{code:'session/model-unavailable'});
});
test('Model selection B2 outcome classification covers every ACK category',()=>{
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

test('Model selection B4 confirmed selection persists the display projection and executes the official identity',async()=>{
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

test('Model selection wave5: two sessions receive independent per-session live frames',async()=>{
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
