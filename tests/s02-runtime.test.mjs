import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {ZCodeAgent,approvalAnswer} from '../packages/host/zcode-agent.mjs';
import {RuntimeStore,ZCodeRuntime} from '../packages/host/zcode-runtime.mjs';
import {MirrorState} from '../packages/host/mirror-state.mjs';
import {createExecutionRelay} from '../packages/host/launcher/execution.mjs';
import {agentFixture,baseSnapshot,row,tick} from './helpers/zcode-runtime-fixture.mjs';
async function opened(options={}){const fixture=agentFixture();const agent=new ZCodeAgent({},fixture.session,fixture.record,{...fixture.dependencies,...options});await agent.connect();await tick();return {...fixture,agent}}

test('S02 official Agent scope, stream/tools/approval, selected model/effort, stop and disposal',async()=>{
 const f=await opened({approval:async()=> 'allowed-once'});
 try{
  assert.equal(f.agent.ctx.key,f.agent);
  f.agent.followup({content:[{type:'text',text:'mock prompt'}]});await tick();
  const send=f.peer.calls.find(call=>call.params?.type==='sendText');assert.deepEqual(send.params.payload.modelSelection,f.record.selection);
  const snapshot=structuredClone(f.peer.snapshot);snapshot.seq=1;snapshot.rows.window=[row('turnHeader',1,{origin:'userInput',state:'running',startedAt:0,sourceCommandId:send.params.commandId}),row('userInput',2,{text:'mock prompt',origin:'realUser'}),row('assistantText',3,{text:'Hello',state:'streaming'}),row('toolCall',4,{toolCallId:'call-1',toolName:'Bash',status:'pendingApproval',inputText:'{}'})];
  snapshot.control.canStop=true;snapshot.control.activeWorks=[{kind:'primaryTurn',startedAt:0,foregroundExecutionId:'run-1'}];
  snapshot.pendingInteractions=[{interactionId:'permission-1',kind:'permission',anchorRowId:4,createdAt:0,payload:{kind:'permission',toolCallId:'call-1',toolName:'Bash',summary:'Run?',detail:{},options:[{kind:'allowOnce',optionId:'once',label:'Once'}]}}];
  f.peer.publish(snapshot);await tick();await tick();
  const answer=f.peer.calls.find(call=>call.params?.type==='resolveInteraction');assert.deepEqual(answer.params.payload.answer,{optionId:'once',action:'accept'});assert.equal(f.record.approval.settlement,'assumed-single-answerer');
  f.agent.cancel();await tick();assert.equal(f.peer.calls.filter(call=>call.params?.type==='stop').length,1);
  await f.agent.select({providerId:'new-provider',modelId:'new-model',options:{reasoningLevel:'medium'}});
  assert.deepEqual(f.peer.calls.find(call=>call.params?.type==='switchModelConfig').params.payload,{provider:'new-provider',model:'new-model',thought:'medium'});
  assert.ok(f.publications.some(event=>event.type==='agent/assistant-stream'&&event.frame.chunk?.text==='Hello'));
  snapshot.seq=2;snapshot.pendingInteractions=[];snapshot.rows.window[2].text='Hello world';snapshot.rows.window[2].state='complete';snapshot.rows.window[3].status='success';snapshot.rows.window[3].output={text:'done'};
  f.peer.publish(snapshot);await tick();assert.ok(f.events.some(event=>event.type==='assistant/message'&&event.data.message.content[0].text==='Hello world'));assert.ok(f.events.some(event=>event.type==='tool/result'));
  assert.throws(()=>f.agent.inbox.remove('x'),{code:'official-inbox-edit-unavailable'});
 }finally{await f.agent.dispose();assert.equal(f.scopeDisposals.length,1)}
});

test('S02 permission mapping closes four outcomes; userInput cannot fabricate an approval',()=>{
 const interaction={kind:'permission',payload:{options:[{kind:'allowOnce',optionId:'once'},{kind:'deny',optionId:'deny'}]}};
 assert.deepEqual(approvalAnswer(interaction,'allowed-once'),{optionId:'once',action:'accept'});assert.deepEqual(approvalAnswer(interaction,'rejected'),{optionId:'deny',action:'decline'});assert.deepEqual(approvalAnswer(interaction,'cancelled'),{action:'cancel'});assert.equal(approvalAnswer(interaction,'unavailable'),null);assert.throws(()=>approvalAnswer({kind:'userInput'},'allowed-once'),{code:'interaction-mapping-unavailable'});
});

test('TRACE lost ACK/reconnect query: one official send, held text survives, query never resends',async()=>{
 const f=await opened();try{
  f.peer.loseAck=true;f.agent.followup({content:[{type:'text',text:'once'}]});await tick();assert.equal(f.agent.conversation.state.commands[0].state,'outcome-unknown');
  const snapshot=structuredClone(f.peer.snapshot);snapshot.seq=1;snapshot.rows.window=[row('assistantText',1,{text:'held prefix',state:'streaming'})];f.peer.publish(snapshot);await tick();
  f.peer.disconnect();assert.ok(f.events.some(event=>event.data.message?.content[0].text==='held prefix'));
  await f.agent.reconnect();await tick();
  assert.equal(f.peer.calls.filter(call=>call.params?.type==='sendText').length,1);assert.equal(f.peer.calls.filter(call=>call.method==='v4/commands/query').length,1);assert.equal(f.agent.conversation.state.commands[0].ack.status,'accepted');
  assert.equal(f.events.filter(event=>event.data.message?.content[0].text==='held prefix').length,1);
 }finally{await f.agent.dispose()}
});

test('TRACE external official deletion/stale directory: confirmed read removes row, older read cannot revive it',()=>{
 const mirror=new MirrorState();const session={sessionId:'official-session'};assert.equal(mirror.acceptDirectory(1,[session]),true);assert.equal(mirror.hasSession(session.sessionId),true);
 assert.equal(mirror.acceptDirectory(3,[]),true);assert.equal(mirror.acceptDirectory(2,[session]),false);assert.equal(mirror.hasSession(session.sessionId),false);assert.equal(mirror.directoryGeneration,3);
 // All operations in this trace are authoritative reads. There is no delete carrier.
});

test('TRACE official history replacement during refresh invalidates old row target before any write',()=>{
 const mirror=new MirrorState(),snapshot=baseSnapshot();snapshot.rows.window=[row('userInput',1,{text:'old',origin:'realUser'})];mirror.accept(snapshot);const target=mirror.target(1);
 const replacement=structuredClone(snapshot);replacement.logEpoch='replacement';replacement.revision=1;replacement.rows.window[0].text='new';assert.equal(mirror.accept(replacement).replaced,true);assert.throws(()=>mirror.assertTarget(target),{code:'history-target-stale'});assert.equal(mirror.snapshot.rows.window[0].text,'new');
});

test('S02 RuntimeStore atomically persists mirror data and owns no official storage',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s02-store-'));try{const store=new RuntimeStore(root);await store.load();store.records.set('mirror',{id:'mirror',officialId:'official',workspace:'/scratch',events:[]});await store.save();const loaded=new RuntimeStore(root);await loaded.load();assert.deepEqual([...loaded.records.values()],[...store.records.values()])}finally{await rm(root,{recursive:true,force:true})}
});

test('S02 execution relay validates commands and bounds concurrent official RPC calls',async()=>{
 let resolve;const relay=createExecutionRelay({workspacePath:'/scratch',emit(){},maxPending:1,channel:{call:()=>new Promise(done=>resolve=done),listen:()=>()=>{}}});
 const pending=relay.request('hello');await assert.rejects(relay.request('hello'),{code:'execution-pending-limit'});resolve({});await pending;
 await assert.rejects(relay.request('v4/command',{type:'deleteSession'}),{code:'execution-command-denied'});await assert.rejects(relay.request('unknown',{}),{code:'execution-method-denied'});relay.dispose();await assert.rejects(relay.request('hello'),{code:'execution-disposed'});
});

test('S02 send waits for durable operation identity; disk failure causes zero official commands',async()=>{
 let persist;const f=await opened({onPersist:()=>new Promise(resolve=>persist=resolve)});
 try{f.agent.followup({content:[{type:'text',text:'durable first'}]});await tick();assert.equal(f.peer.calls.filter(call=>call.params?.type==='sendText').length,0);persist();await tick();assert.equal(f.peer.calls.filter(call=>call.params?.type==='sendText').length,1)}finally{await f.agent.dispose()}
 const g=await opened();try{g.agent.onPersist=()=>Promise.reject(Object.assign(new Error('disk'),{code:'disk-failed'}));g.agent.followup({content:[{type:'text',text:'never sent'}]});await tick();assert.equal(g.peer.calls.filter(call=>call.params?.type==='sendText').length,0);g.agent.onPersist=()=>{}}finally{await g.agent.dispose()}
});

test('S02 async official registration: publish awaited; disposal, boot and unknown create recovery query exact ID',async()=>{
 const f=agentFixture(),registry=new Map(),sessions=new Map();let pendingRegister,releaseCount=0;
 const ctx={sessions:{prepare:(id,options)=>({id,seq:options.seed.length,append(type,data,opts){return {type,data,...opts,seq:this.seq++,time:0}}}),enter:session=>{sessions.set(session.id,session);return ()=>sessions.delete(session.id)},get:id=>sessions.get(id)},agents:{get:id=>registry.get(id),register:async agent=>{await new Promise(resolve=>pendingRegister=resolve);registry.set(agent.id,agent);return async()=>{registry.delete(agent.id);releaseCount++}}},workspaceRegistry:{get:()=>({attachSession:async()=>{}}),resolveByPath:async()=>({attachSession:async()=>{}})}};
 const store={records:new Map(),load:async()=>{},save:async()=>{},writing:Promise.resolve()};const launcher={state:{phase:'ready',auth:'authenticated',executionWorkspace:f.record.workspace},subscribe:()=>()=>{}};const host={launcher,connect:async()=>{}};
 const runtime=new ZCodeRuntime(ctx,host,{store,createScope:f.dependencies.createScope,agentEvents:f.dependencies.agentEvents,peerFactory:()=>f.peer});
 const registration=runtime.register(f.record);await tick();assert.equal(runtime.agents.size,0);pendingRegister();await registration;assert.equal(registry.get(f.record.id),runtime.agents.get(f.record.id));await runtime.dispose();assert.equal(releaseCount,1);assert.equal(sessions.size,0);
 const pending={id:'recovered',officialId:'',workspace:f.record.workspace,authority:'official-host',createCommandId:'lost-create',workspaceId:'ws',events:[]};store.records.set(pending.id,pending);f.peer.closed=false;f.peer.acks.set('lost-create',{commandId:'lost-create',status:'accepted',revisionAtDecision:0,result:{type:'createSession',sessionId:f.peer.snapshot.sessionId}});
 const boot=new ZCodeRuntime(ctx,host,{store,createScope:f.dependencies.createScope,agentEvents:f.dependencies.agentEvents,peerFactory:()=>f.peer});const starting=boot.start();await tick();pendingRegister();await starting;assert.equal(pending.officialId,f.peer.snapshot.sessionId);assert.equal(f.peer.calls.filter(call=>call.params?.type==='createSession').length,0);assert.deepEqual(f.peer.calls.find(call=>call.method==='v4/commands/query').params.commands,[{sessionId:null,commandId:'lost-create'}]);await boot.dispose();assert.equal(releaseCount,2);
});

test('S02 reachable native mutations cannot write mirror state; native methods remain unchanged',async()=>{
 const {guardController}=await import('../packages/host/mirror-guards.mjs');const calls=[];const original=function(request){calls.push(request.sessionId);return 'native'};const controller={fork:original,pinSession:original,rename:original};const runtime={store:{records:new Map([['zcode',{}]])},ctx:{workspaceRegistry:{get:id=>id==='mixed'?{sessionIds:['native','zcode']}:undefined}}};const restore=guardController(controller,runtime,['fork','pinSession','rename']);
 try{for(const method of ['fork','pinSession','rename'])assert.throws(()=>controller[method]({sessionId:'zcode'}),{code:'session/official-route-unavailable'});assert.throws(()=>controller.rename({workspaceId:'mixed'}),{code:'session/official-route-unavailable'});assert.equal(controller.fork({sessionId:'native'}),'native');assert.deepEqual(calls,['native'])}finally{restore();assert.equal(controller.fork,original)}
});
