import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forkWorld,real,writes,tick} from './helpers/fork-compact.mjs';
import {BINDING_EVENT,boundConversationId} from '../packages/driver/factory.mjs';
import {forkBoundary,FORK_PROJECTION_EVENT} from '../packages/driver/fork.mjs';
import {compactAgent} from '../packages/driver/compact.mjs';
import {ROUTED_COMMANDS} from '../packages/driver/commands.mjs';
import {EXECUTION_COMMANDS} from '../packages/host/launcher/execution.mjs';
import {inputSubmission,heldConfirmation,confirmHeld} from '../packages/client/input-controls.mjs';
import {parseCommandEnvelope} from '../packages/host/vendor/zcode/v4.mjs';
import {ParityController} from '../packages/client/parity.mjs';
import {parityWorld} from './helpers/settings-panel-parity.mjs';
const ends=agent=>agent.session.snapshotEvents().filter(event=>event.type==='turn/end');
const transcript=agent=>agent.session.snapshotEvents().filter(event=>['user/message','assistant/message','tool/call','tool/result'].includes(event.type));
const commandEvents=agent=>agent.session.snapshotEvents().filter(event=>event.type==='command/done');
function compactTurn(snapshot,commandId,state='completedSuccess'){
 const turnId='compact-'+commandId,base=Math.max(...snapshot.rows.window.map(row=>row.rowId),0)+1;
 snapshot.control.phase=state;snapshot.rows.window.push({kind:'turnHeader',rowId:base,entityId:'compact-header-'+commandId,turnId,createdAt:1,createdAtSeq:snapshot.seq,origin:'userInput',executionKind:'controlOnly',state,startedAt:1,sourceCommandId:commandId});snapshot.rows.totalCount=snapshot.rows.window.length;
}

test('real SessionController fork creates the exact seeded prefix and real ACK-bound child, without replay or duplicate rendering',real,async()=>{
 const w=await forkWorld();
 try{
  const boundary=ends(w.source)[0].seq,prefix=w.source.session.snapshotEvents().slice(0,boundary+1),result=await w.controller.fork({sessionId:'source',atSeq:boundary}),child=w.ctx.agents.get(result.sessionId);
  await child.ready();await child.translator.tail;
  assert.deepEqual(w.ctx.sessionProjections.snapshot(child.session,['modelSelection']).values.modelSelection,w.ctx.sessionProjections.snapshot(w.source.session,['modelSelection']).values.modelSelection);
  assert.equal(child.session.header.parentSession,'source');assert.equal(child.session.header.isSeeded,true);assert.equal(child.session.inheritedEventCount,boundary+1);
  assert.deepEqual(child.session.snapshotEvents().slice(0,boundary+1),prefix);
  const wire=writes(w).find(c=>c.type==='forkAssistant');assert.deepEqual(wire.payload.target,{rowId:3,entityId:'reply-1'});assert.equal(wire.baseRevision,w.source.conversation.state.snapshot.revision);assert.equal(wire.baseLogEpoch,w.source.conversation.state.snapshot.logEpoch);assert.ok(parseCommandEnvelope(wire).ok);
  assert.equal(child.zcodeConversationId,'branch-1');assert.equal(child.conversation.state.snapshot.sessionId,'branch-1');assert.deepEqual(child.conversation.state.snapshot.rows.window.filter(row=>row.kind==='assistantText').map(row=>row.text),['Wrote version 1']);
  assert.equal(boundConversationId(child.id,child.session.snapshotEvents(),child.session.inheritedEventCount),'branch-1');
  assert.ok(child.session.snapshotEvents().some(event=>event.type===BINDING_EVENT&&event.data.sessionId===child.id&&event.data.zcodeConversationId==='branch-1'&&event.ignorable));
  assert.ok(child.session.snapshotEvents().some(event=>event.type===FORK_PROJECTION_EVENT&&event.ignorable));
  assert.equal(transcript(child).length,prefix.filter(event=>['user/message','assistant/message','tool/call','tool/result'].includes(event.type)).length,'child epoch/row ids must not replay inherited messages');
  assert.equal(writes(w).some(c=>['createSession','sendText'].includes(c.type)),false);
 }finally{await w.close()}
});

test('default sidebar fork, nested inherited-boundary fork and cold resume retain independent child bindings',real,async()=>{
 const w=await forkWorld();
 try{
  const {sessionId}=await w.controller.fork({sessionId:'source'}),child=w.ctx.agents.get(sessionId);await child.ready();await child.translator.tail;
  assert.deepEqual(child.conversation.state.snapshot.rows.window.filter(row=>row.kind==='assistantText').map(row=>row.text),['Wrote version 1','Wrote version 2']);assert.deepEqual(transcript(child),transcript(w.source));
  const first=ends(child)[0].seq,{sessionId:grandId}=await w.controller.fork({sessionId,atSeq:first}),grand=w.ctx.agents.get(grandId);await grand.ready();await grand.translator.tail;
  assert.equal(grand.zcodeConversationId,'branch-2');assert.deepEqual(grand.conversation.state.snapshot.rows.window.filter(row=>row.kind==='assistantText').map(row=>row.text),['Wrote version 1']);
  const childEntry=w.driver.factory.transactions;assert.ok(childEntry.size>=3);
  // SessionController returns id; scope disposal removes that child without the source.
  await w.handles.get(child.id).dispose();const resumed=await w.ctx.agents.resume({resumeSessionId:sessionId});await resumed.agent.ready();await resumed.agent.translator.tail;
  assert.equal(resumed.agent.zcodeConversationId,'branch-1');assert.deepEqual(transcript(resumed.agent),transcript(w.source));
 }finally{await w.close()}
});

test('unreachable cut and denied ZCode canFork fail the actual official fork surface with explicit guard reason',real,async()=>{
 const w=await forkWorld();
 try{
  const start=w.source.session.snapshotEvents().find(event=>event.type==='turn/start');
  await assert.rejects(w.controller.fork({sessionId:'source',atSeq:start.seq}),error=>error.message.includes('guard.forkAssistantOnly'));assert.equal(writes(w).length,0);
  const boundary=ends(w.source)[0].seq;await w.publish('parent',s=>{delete s.rows.window.find(row=>row.rowId===3).actions.canFork});
  await assert.rejects(w.controller.fork({sessionId:'source',atSeq:boundary}),error=>error.message.includes('guard.actionUnavailable'));assert.equal(writes(w).length,0);
  assert.equal(w.ctx.agents.list().length,1);
 }finally{await w.close()}
});

test('source seed tampering and workspace divergence reject before issuing forkAssistant',real,async()=>{
 const w=await forkWorld();
 try{
  const count=ends(w.source)[0].seq+1,prefix=w.source.session.snapshotEvents().slice(0,count),options={seed:[...prefix,{type:'session/end-seed',seq:count,time:0,data:{inherited:true}}],inheritedEventCount:count,meta:{parentSession:'source',isSeeded:true,cwd:'/workspace'}};
  assert.equal(forkBoundary(w.source,options).target.rowId,3);
  const tampered=structuredClone(options);tampered.seed.find(e=>e.type==='user/message').data.content[0].text='tampered';assert.throws(()=>forkBoundary(w.source,tampered),{code:'guard.forkTargetAmbiguous'});
  assert.throws(()=>forkBoundary(w.source,{...options,meta:{...options.meta,cwd:'/foreign'}}),{code:'guard.forkTargetAmbiguous'});assert.equal(writes(w).length,0);
 }finally{await w.close()}
});

test('ACK pointing to unrelated branch history refuses publication rather than pretending inheritance succeeded',real,async()=>{
 const w=await forkWorld();
 try{
  w.responses.set('conversationRowsRangeV4',p=>{const s=w.official.snapshots.get(p.sessionId);return {rows:p.sessionId==='parent'?s.rows.window:[],hasMore:false,atSeq:s.seq,atRevision:s.revision,atLogEpoch:s.logEpoch}});
  await assert.rejects(w.controller.fork({sessionId:'source'}),error=>error.message.includes('guard.forkTargetAmbiguous'));assert.equal(w.ctx.agents.list().length,1);assert.equal(w.ctx.sessions.list().length,1);assert.equal(writes(w).filter(c=>c.type==='forkAssistant').length,1);
 }finally{await w.close()}
});

test('per-agent compact shadow uses real CommandRuntime; ACK waits for matching terminal turn and global native compaction stays intact',real,async()=>{
 const w=await forkWorld();let globalCalls=0;
 try{
  const release=w.ctx.commands.register({definitionId:'native-compact',name:'compact',description:'Native compact',handler:async()=>{globalCalls++;return {kind:'success',text:'native'}}});
  const native={id:'other',session:w.source.session};assert.equal(w.commands.find(native,'compact').definitionId,'native-compact');assert.equal(w.commands.find(w.source,'compact').definitionId,'@dsh-zcode/driver/compact');
  let settled=false;const pending=w.commands.execute(w.source,'/compact',[],new AbortController().signal);pending.then(()=>{settled=true},()=>{settled=true});await tick();
  const wire=writes(w).at(-1);assert.equal(wire.type,'compact');assert.equal(settled,false);assert.equal(commandEvents(w.source).length,0);assert.equal(globalCalls,0);
  await w.publish('parent',s=>compactTurn(s,'unrelated-command'));assert.equal(settled,false,'another terminal turn cannot settle this compact');
  await w.publish('parent',s=>compactTurn(s,wire.commandId));const result=await pending;assert.equal(result.result.kind,'success');assert.equal(commandEvents(w.source).at(-1).data.kind,'success');assert.equal(w.source.session.eventAt(result.result.sourceEventSeq).type,'turn/end');
  assert.equal(w.source.conversation.command(wire.commandId).state,'completed');assert.equal(globalCalls,0);release();
 }finally{await w.close()}
});

test('compact arguments, rejection, interrupted turn, ACK loss and unload fail explicitly without fabricated command success',real,async()=>{
 for(const mode of ['arguments','rejected','interrupted','lost','unload']){
  const w=await forkWorld();
  try{
   if(mode==='rejected')w.responses.set('sendConversationCommandV4',p=>({commandId:p.envelope.commandId,status:'rejected',reasonCode:'compactOperationLock',revisionAtDecision:0}));
   if(mode==='lost')w.responses.set('sendConversationCommandV4',Object.assign(new Error('lost ACK'),{code:'execution-outcome-unknown'}));
   const pending=w.commands.execute(w.source,mode==='arguments'?'/compact instructions':'/compact',[],new AbortController().signal);
   if(mode==='arguments'){assert.equal((await pending).result.kind,'error');assert.equal(writes(w).length,0);continue}
   const observed=pending.catch(error=>error);await tick();const wire=writes(w).at(-1);
   if(mode==='interrupted')await w.publish('parent',s=>compactTurn(s,wire.commandId,'completedInterrupted'));
   if(mode==='unload')await w.sourceHandle.dispose();
   const error=await observed;assert.ok(error instanceof Error,mode);if(mode!=='unload')assert.equal(error.code,({rejected:'compactOperationLock',interrupted:'compact-interrupted',lost:'command-outcome-unknown'})[mode]);assert.ok(commandEvents(w.source).every(e=>e.data.kind==='error'));assert.equal(writes(w).length,1);
  }finally{await w.close()}
 }
});

test('compact timeout is an explicit unknown outcome and does not fabricate terminal ledger state',real,async()=>{
 const w=await forkWorld();try{await assert.rejects(w.source.track(compactAgent(w.source,{timeoutMs:5})),{code:'compact-outcome-unknown'});const wire=writes(w).at(-1);assert.equal(w.source.conversation.command(wire.commandId).state,'accepted-awaiting-terminal');assert.equal(ends(w.source).length,2)}finally{await w.close()}
});

test('three command gates admit fork/compact/selection-side-session and fourth parity gate admits compact on native and mirror sessions',async()=>{
 for(const type of ['forkAssistant','compact','createSelectionSideSession']){assert.ok(ROUTED_COMMANDS.has(type));assert.ok(EXECUTION_COMMANDS.has(type))}
 for(const native of [false,true]){
  const w=await parityWorld(),agent=w.runtime.agents.get(w.id),id=native?'native-compact':w.id;
  // Native ingress is separately exercised through the real assembled driver below.
  if(native){const realWorld=await forkWorld();try{
   const {ParityService}=await import('../packages/host/parity.mjs');const parity=new ParityService({ctx:realWorld.ctx,disposed:false});
   const snapshot=realWorld.source.conversation.state.snapshot;const result=await parity.handle({domain:'command',operation:'submit',kind:'compact',params:{},sessionId:'source',baseRevision:snapshot.revision,baseLogEpoch:snapshot.logEpoch});assert.equal(result.ack.status,'accepted');assert.equal(writes(realWorld).at(-1).type,'compact');
   await assert.rejects(parity.handle({domain:'command',operation:'submit',kind:'compact',params:{},sessionId:'source',baseRevision:snapshot.revision+1,baseLogEpoch:snapshot.logEpoch}),{code:'parity-projection-stale'});
  }finally{await realWorld.close();await w.close()}continue}
  const ui=new ParityController(w.rpc,{sessionId:id});try{const state=await ui.call('snapshot','read');const snapshot=structuredClone(state.snapshot);snapshot.seq++;snapshot.availability.compact={allowed:true};w.official.publish(snapshot);await tick();const result=await ui.command('compact',{},agent.conversation.state.snapshot);assert.equal(result.ack.status,'accepted');assert.equal(w.calls.filter(c=>c.name==='sendConversationCommandV4').at(-1).args[0].envelope.type,'compact')}finally{ui.dispose();await w.close()}
 }
});

test('plugin /compact and /compress map to compact with no model input, while unsupported payloads fail explicitly',()=>{
 for(const text of ['/compact',' /compress '])assert.deepEqual(inputSubmission(null,text),{type:'compact',payload:{}});
 assert.throws(()=>inputSubmission(null,'/compact arbitrary summary'),/compact-arguments-unavailable/);assert.throws(()=>inputSubmission(null,'/compact',{attachments:[{ref:'x'}]}),/compact-attachments-unavailable/);assert.throws(()=>inputSubmission(null,'/compact',{sharedContextRefs:[{}]}),/compact-attachments-unavailable/);
});

test('fork rejection and lost ACK keep the original ledger id and never create or publish a replacement Session',real,async()=>{
 for(const lost of [false,true]){
  const w=await forkWorld();try{
   w.responses.set('sendConversationCommandV4',lost?Object.assign(new Error('single ACK lost'),{code:'execution-outcome-unknown'}):p=>({commandId:p.envelope.commandId,status:'rejected',reasonCode:'guard.forkTargetNotStable',revisionAtDecision:0}));
   await assert.rejects(w.controller.fork({sessionId:'source'}),error=>error.message.includes(lost?'command-outcome-unknown':'guard.forkTargetNotStable'));
   const wire=writes(w)[0];assert.equal(w.source.conversation.command(wire.commandId).state,lost?'outcome-unknown':'rejected');assert.equal(w.ctx.agents.list().length,1);assert.equal(w.stored.size,1);
   if(lost){await assert.rejects(w.controller.fork({sessionId:'source'}),error=>error.message.includes('command-outcome-unknown'));assert.equal(writes(w).length,1)}
  }finally{await w.close()}
 }
});

test('fork fences changed history revision before dispatch and CAS changed while issuing the branch',real,async()=>{
 for(const duringRead of [true,false]){
  const w=await forkWorld();try{
   w.responses.set('conversationRowsRangeV4',async p=>{const snapshot=w.official.snapshots.get(p.sessionId),result={rows:structuredClone(snapshot.rows.window),hasMore:false,atSeq:snapshot.seq,atRevision:snapshot.revision,atLogEpoch:snapshot.logEpoch};if(duringRead)result.atRevision++;else await w.publish('parent',()=>{});return result});
   await assert.rejects(w.controller.fork({sessionId:'source'}),error=>error.message.includes(duringRead?'guard.forkTargetNotStable':'proto.staleRevision'));assert.equal(writes(w).length,0);assert.equal(w.ctx.agents.list().length,1);
  }finally{await w.close()}
 }
});

test('fork copies reasoning/tool context and a later child turn appends once without changing the parent',real,async()=>{
 const w=await forkWorld();try{
  await w.publish('parent',s=>{const base={turnId:'tool-turn',createdAt:1,createdAtSeq:s.seq};s.rows.window.push(
   {...base,kind:'turnHeader',rowId:7,entityId:'tool-header',origin:'userInput',state:'completedSuccess',startedAt:1},
   {...base,kind:'userInput',rowId:8,entityId:'tool-input',origin:'realUser',text:'Read a file'},
   {...base,kind:'reasoning',rowId:9,entityId:'tool-thinking',assistantResponseId:'response-tools',text:'Inspect contents',state:'complete'},
   {...base,kind:'toolCall',rowId:10,entityId:'tool-call',assistantResponseId:'response-tools',toolCallId:'call-read',toolName:'Read',inputText:'{}',status:'success',output:{text:'contents'}},
   {...base,kind:'assistantText',rowId:11,entityId:'tool-reply',assistantResponseId:'response-tools',text:'Read complete',state:'complete',actions:{canFork:true}});s.rows.totalCount=s.rows.window.length});
  const {sessionId}=await w.controller.fork({sessionId:'source'}),child=w.ctx.agents.get(sessionId);await child.ready();await child.translator.tail;const before=transcript(child),parent=transcript(w.source);
  assert.deepEqual(before,parent);assert.ok(before.some(event=>event.type==='tool/result'));assert.ok(before.some(event=>event.type==='assistant/message'&&event.data.message.content.some(part=>part.type==='reasoning')));
  child.followup({id:'child-followup',role:'user',source:{kind:'user'},content:[{type:'text',text:'Child continuation'}]});await Promise.allSettled([...child.tasks]);const wire=writes(w).at(-1);assert.equal(wire.sessionId,'branch-1');assert.equal(wire.type,'sendText');
  await w.publish('branch-1',s=>{const base={turnId:'child-new-turn',createdAt:2,createdAtSeq:s.seq,sourceCommandId:wire.commandId};s.rows.window.push(
   {...base,kind:'turnHeader',rowId:112,entityId:'child-new-header',origin:'userInput',state:'completedSuccess',startedAt:2},
   {...base,kind:'userInput',rowId:113,entityId:'child-new-input',origin:'realUser',text:'Child continuation'},
   {...base,kind:'assistantText',rowId:114,entityId:'child-new-assistant',state:'complete',text:'Child answer',actions:{canFork:true}});s.rows.totalCount=s.rows.window.length});await child.translator.tail;
  assert.deepEqual(transcript(child).slice(0,before.length),before);assert.equal(transcript(child).length,before.length+2);assert.deepEqual(transcript(w.source),parent);
 }finally{await w.close()}
});

test('compact cancellation and denied availability surface failure, preserve global compaction service and clean the shadow on unload',real,async()=>{
 const w=await forkWorld();try{
  const compaction={compactNow:async()=>{throw Error('native compaction must not be used')}};w.ctx.provide('compaction',compaction);assert.equal(w.ctx.get('compaction'),compaction);
  const abort=new AbortController(),pending=w.commands.execute(w.source,'/compact',[],abort.signal),observed=pending.catch(error=>error);await tick();abort.abort();assert.ok(await observed instanceof Error);assert.equal(writes(w).length,1);assert.equal(w.ctx.get('compaction'),compaction);
  await w.sourceHandle.dispose();assert.equal(w.commands.find(w.source,'compact'),undefined,'scope disposal unregisters the per-agent shadow');
 }finally{await w.close()}
 const denied=await forkWorld();try{await denied.publish('parent',s=>{s.availability.compact={allowed:false,reasonCode:'idleCannotCompact'}});await assert.rejects(denied.commands.execute(denied.source,'/compact',[],new AbortController().signal),{code:'idleCannotCompact'});assert.equal(writes(denied).length,0);assert.equal(commandEvents(denied.source).at(-1).data.kind,'error')}finally{await denied.close()}
});

test('inherited bindings cannot route a restored fork without its own live binding',()=>{
 const inherited={type:BINDING_EVENT,seq:0,ignorable:true,data:{sessionId:'parent',zcodeConversationId:'parent-remote'}};
 assert.throws(()=>boundConversationId('child',[inherited],1),/fork binding missing/);assert.throws(()=>boundConversationId('child',[inherited],2),/inherited binding boundary/);
 assert.equal(boundConversationId('child',[inherited,{type:BINDING_EVENT,seq:1,ignorable:true,data:{sessionId:'child',zcodeConversationId:'child-remote'}}],1),'child-remote');
});

test('cancelled fork setup drains a late ACK and never publishes or subscribes the orphan branch',real,async()=>{
 const w=await forkWorld(),gate=Promise.withResolvers(),issued=Promise.withResolvers();
 try{
  w.responses.set('sendConversationCommandV4',p=>{issued.resolve(p.envelope);return gate.promise});
  const count=ends(w.source)[0].seq+1,seed=[...w.source.session.snapshotEvents().slice(0,count),{type:'session/end-seed',seq:count,time:0,data:{inherited:true}}],abort=new AbortController();
  const pending=w.ctx.agents.create({sessionId:'cancelled-child',seed,inheritedEventCount:count,meta:{parentSession:'source',isSeeded:true,cwd:'/workspace'},signal:abort.signal});const observed=pending.catch(error=>error),wire=await issued.promise;abort.abort();assert.ok(await observed instanceof Error);
  gate.resolve({commandId:wire.commandId,status:'accepted',revisionAtDecision:0,result:{type:'forkAssistant',sessionId:'orphan-branch'}});await Promise.allSettled([...w.source.tasks]);await tick();
  assert.equal(w.ctx.agents.get('cancelled-child'),undefined);assert.equal(w.ctx.sessions.get('cancelled-child'),undefined);assert.equal(w.stored.has('cancelled-child'),false);assert.equal(w.calls.some(call=>call.name==='subscribeConversationV4'&&call.args[0].sessionId==='orphan-branch'),false);assert.equal(writes(w).length,1);
 }finally{gate.resolve({});await w.close()}
});

test('cold source fork resumes through the occupied factory and still branches its persisted completed context',real,async()=>{
 const w=await forkWorld();try{
  const prefix=transcript(w.source);await w.sourceHandle.dispose();assert.equal(w.ctx.agents.get('source'),undefined);
  const {sessionId}=await w.controller.fork({sessionId:'source'}),child=w.ctx.agents.get(sessionId);await child.ready();await child.translator.tail;
  assert.ok(w.ctx.agents.get('source'),'cold source is resumed for guarded branching');assert.deepEqual(transcript(child),prefix);assert.equal(child.zcodeConversationId,'branch-1');assert.deepEqual(writes(w).map(c=>c.type),['forkAssistant']);
 }finally{await w.close()}
});

test('selection-side-session passes the actual driver/launcher command path without opening an excluded product surface',real,async()=>{
 const w=await forkWorld();try{const result=await w.source.submitControl({type:'createSelectionSideSession',payload:{}});assert.equal(result.ack.status,'accepted');assert.equal(result.branchAddress.sessionId,'side');const wire=writes(w).at(-1);assert.equal(wire.type,'createSelectionSideSession');assert.ok(parseCommandEnvelope(wire).ok);assert.equal(w.ctx.agents.list().length,1)}finally{await w.close()}
});

test('compact held-queue confirmation preserves the typed FIFO payload and refuses unsupported clear/preempt intent',()=>{
 const snapshot={logEpoch:'held-epoch',inputRouting:{mode:'choice'},queue:{items:[{queueItemId:'held',sourceCommandId:'held-command'}]}},command=inputSubmission(null,'/compact'),confirmation=heldConfirmation(snapshot,command);
 assert.deepEqual(confirmHeld(snapshot,confirmation,'keepQueueAndSend'),{type:'compact',payload:{}});assert.throws(()=>confirmHeld(snapshot,confirmation,'clearQueueAndSend'),/compact-queue-disposition-unavailable/);
});

test('branch readback with regrouped turn associations cannot pass the context consistency proof',real,async()=>{
 const w=await forkWorld();try{
  w.responses.set('conversationRowsRangeV4',p=>{const s=w.official.snapshots.get(p.sessionId),rows=structuredClone(s.rows.window);if(p.sessionId!=='parent')rows.find(row=>row.kind==='userInput').turnId='unrelated-turn';return {rows,hasMore:false,atSeq:s.seq,atRevision:s.revision,atLogEpoch:s.logEpoch}});
  await assert.rejects(w.controller.fork({sessionId:'source'}),error=>error.message.includes('guard.forkTargetAmbiguous'));assert.equal(w.ctx.agents.list().length,1);assert.equal(writes(w).length,1);
 }finally{await w.close()}
});

test('unmapped or malformed durable projection identity returns a ZCode guard reason instead of a parser exception',()=>{
 const prefix=[{type:'turn/start',seq:0,data:{turn:1,zcode:{turnKey:'invalid-json'}}},{type:'turn/end',seq:1,data:{turn:1,reason:{kind:'completed'}}}],parent={id:'source',session:{header:{cwd:'/workspace'},snapshotEvents:()=>prefix},conversation:{address:{workspace:'/workspace'},state:{snapshot:{}}}};
 assert.throws(()=>forkBoundary(parent,{meta:{isSeeded:true,parentSession:'source',cwd:'/workspace'},inheritedEventCount:2,seed:[...prefix,{type:'session/end-seed',seq:2,data:{inherited:true}}]}),{code:'guard.forkTargetAmbiguous'});
});
