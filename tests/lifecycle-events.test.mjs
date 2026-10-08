import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ConversationEventTranslator,turnEndReason,mergeEventWindows} from '../packages/driver/events.mjs';
import {V4Conversation} from '../packages/host/conversation.mjs';
import {installDriver} from '../packages/driver/factory.mjs';
import {turnBoundaryProjectionDefinition,inboxProjectionDefinition} from '../packages/driver/projections.mjs';
import {MockPeer,baseSnapshot,row,tick} from './helpers/zcode-runtime-fixture.mjs';
import {officialAvailable,loadOfficial,officialChatConsumer} from './helpers/official-chat-consumer.mjs';
const frozen=JSON.parse(await readFile(new URL('./fixtures/lifecycle-events/transcript.json',import.meta.url),'utf8'));
const real={skip:officialAvailable?false:'requires official source and rc.2 npm artifacts'};
function fixture(){
  const events=[],frames=[];
  const session={id:'translation',get seq(){return events.length},eventAt:seq=>events[seq],snapshotEvents:()=>events,append(type,data,opts){const event={type,data:structuredClone(data),...opts,seq:events.length,time:1};events.push(event);return event}};
  const translator=new ConversationEventTranslator({session,clock:()=>1,dispatch:{emit(type,{frame}){assert.equal(type,'agent/assistant-stream');frames.push(structuredClone(frame));if(frame.type==='end'&&frame.outcome.kind==='committed')assert.equal(events[frame.outcome.seq].type,frame.outcome.eventType)}}});
  return {events,frames,session,translator};
}
const types=f=>f.events.map(event=>event.type);
const sequence=f=>assert.deepEqual(f.events.map(event=>event.seq),f.events.map((_,index)=>index));

// Fixtures are injected onto an official captured snapshot. They freeze mappings,
// not a live ZCode model oracle. assistant/attempt is intentionally omitted;
// interrupted usage remains absent, as allowed by the parent TASK.
test('frozen frames translate message/tool topology, usage and gap-free native events',async()=>{
  const f=fixture();for(const snapshot of frozen.snapshots)await f.translator.enqueue(snapshot);
  assert.deepEqual(types(f),['turn/start','step/start','request/header','user/message','assistant/message','tool/call','tool/result','step/end','step/start','request/header','assistant/message','step/end','turn/end']);
  assert.equal(f.events.find(event=>event.type==='turn/end').data.reason.kind,'completed');
  const messages=f.events.filter(event=>event.type==='assistant/message');assert.equal(messages.length,2);
  assert.deepEqual(messages[0].data.message.content.map(block=>block.type),['reasoning','text','tool-call']);
  assert.deepEqual(messages.map(event=>event.data.usage.totalTokens),[14,13]);
  assert.deepEqual(f.events.find(event=>event.type==='tool/result').data.meta.zcode.display,{kind:'bash_output',output:'ok',truncated:false});
  assert.deepEqual(f.frames.map(frame=>frame.revision),f.frames.map((_,index)=>index+1));
  const committed=f.frames.filter(frame=>frame.type==='end');assert.equal(committed.length,2);
  assert.ok(committed.every(frame=>f.events[frame.outcome.seq].type==='assistant/message'));sequence(f);
  const count=f.events.length;await f.translator.enqueue(frozen.snapshots.at(-1));assert.equal(f.events.length,count);
  await f.translator.close();
});

test('turn/phase terminal mapping and stale running header close abort/error conservatively',async()=>{
  const table={running:null,draft:null,prewarming:null,completedSuccess:'completed',completedInterrupted:'aborted',failed:'error',error:'error'};
  for(const [state,kind] of Object.entries(table))assert.equal(turnEndReason(state)?.kind??null,kind);
  for(const [phase,reason] of [['completedInterrupted','aborted'],['error','error']]){
    const f=fixture();await f.translator.enqueue(frozen.snapshots[0]);await f.translator.enqueue(frozen.snapshots[1]);
    const stopped=structuredClone(frozen.snapshots[1]);stopped.seq++;stopped.control.phase=phase;stopped.control.canStop=false;stopped.control.activeWorks=[];
    await f.translator.enqueue(stopped);
    assert.equal(f.events.at(-1).data.reason.kind,reason);
    assert.equal(f.events.find(event=>event.type==='assistant/message').data.interrupted,true);
    assert.equal(f.events.find(event=>event.type==='assistant/message').data.usage,undefined);
    assert.equal(types(f).includes('assistant/attempt'),false);sequence(f);await f.translator.close();
  }
});

test('observed cumulative usage is measured from the response baseline, not its last partial frame',async()=>{
  const f=fixture();await f.translator.enqueue(frozen.snapshots[0]);
  const partial=structuredClone(frozen.snapshots[1]);partial.usage.cumulative={inputTokens:10,outputTokens:1,cacheReadTokens:2,cacheWriteTokens:0};
  await f.translator.enqueue(partial);await f.translator.enqueue(frozen.snapshots[2]);
  assert.deepEqual(f.events.find(event=>event.type==='assistant/message').data.usage,{inputTokens:10,outputTokens:4,cacheReadTokens:2,cacheWriteTokens:0,totalTokens:14});
  await f.translator.close();
});

test('arbitrary overlapping historical windows replay through one mapper and durable indexes survive reconstruction',async()=>{
  const final=frozen.snapshots.at(-1),a=structuredClone(final),b=structuredClone(final);a.rows.window=final.rows.window.slice(0,4);b.rows.window=final.rows.window.slice(3);
  assert.equal(mergeEventWindows([b,a]).rows.window.length,final.rows.window.length);
  const f=fixture();await f.translator.replay([b,a]);sequence(f);
  const count=f.events.length;
  const restored=new ConversationEventTranslator({session:f.session,dispatch:{emit(){}}});await restored.replay([a,b]);assert.equal(f.events.length,count);
  assert.ok(f.events.filter(event=>event.type==='assistant/message').every(event=>event.data.usage===undefined),'a historical aggregate is not falsely assigned to individual responses');
  assert.throws(()=>mergeEventWindows([a,{...b,logEpoch:'other'}]),{code:'event-window-owner-mismatch'});await restored.close();
});

test('append failure emits abandoned, never a committed frame naming a nonexistent seq',async()=>{
  const f=fixture();await f.translator.enqueue(frozen.snapshots[1]);
  const append=f.session.append;f.session.append=(type,...args)=>{if(type==='assistant/message')throw Error('EIO');return append(type,...args)};
  await assert.rejects(f.translator.enqueue(frozen.snapshots[2]),/EIO/);
  assert.equal(f.frames.at(-1).outcome.kind,'abandoned');assert.equal(f.events.some(event=>event.type==='assistant/message'),false);
  f.session.append=append;await f.translator.enqueue(frozen.snapshots[2]);sequence(f);await f.translator.close();
});

test('official ui-chat and stream followers consume translated durable/live events without rebaseline',real,async()=>{
  const [{Context},{SessionStore},{default:Projections}]=await Promise.all(['cordis','dsh-session','dsh-session-projection'].map(loadOfficial));
  const ctx=new Context();new SessionStore(ctx);new Projections(ctx);ctx.sessionProjections.register(turnBoundaryProjectionDefinition);ctx.sessionProjections.register(inboxProjectionDefinition);
  const consumer=await officialChatConsumer(ctx),session=ctx.sessions.prepare('official-consumption');ctx.sessions.enter(session);
  ctx.on('session/event',(owner,event)=>{if(owner===session)consumer.durable(event)});
  const frames=[];
  const translator=new ConversationEventTranslator({session,dispatch:{emit(_type,{frame}){frames.push(frame);consumer.frame(frame,session.seq-1)}}});
  try{
    await translator.enqueue(frozen.snapshots[0]);await translator.enqueue(frozen.snapshots[1]);
    assert.ok(consumer.snapshot().legacy.partial,'real official builder displays live assistant output');
    for(const snapshot of frozen.snapshots.slice(2))await translator.enqueue(snapshot);
    const snapshot=consumer.snapshot();
    assert.equal(snapshot.legacy.partial,null);assert.equal(snapshot.legacy.runningCalls.length,0);
    assert.ok(snapshot.legacy.nodes.some(node=>node.kind==='user'&&node.content[0].text==='Run a check'));
    assert.ok(snapshot.legacy.nodes.some(node=>node.kind==='assistant'&&node.blocks.some(block=>block.kind==='text'&&block.text==='Done')));
    assert.ok(snapshot.legacy.nodes.some(node=>node.kind==='tool-result'&&node.callId==='tool-one'));
    assert.equal(ctx.sessionProjections.stateOf(session,'turnBoundary').openTurnStartSeq,null);
    const restored=ctx.sessions.prepare('official-cold',{seed:session.snapshotEvents()});const cold=consumer.read(restored.snapshotEvents());
    assert.equal(cold.legacy.nodes.length,snapshot.legacy.nodes.length);
    assert.ok(frames.filter(frame=>frame.type==='end').every(frame=>session.eventAt(frame.outcome.seq).type===frame.outcome.eventType));
  }finally{await translator.close();await consumer.close();await ctx.fiber.dispose()}
});

test('transport interruption commits prefix once; official reader accepts suffix-only continuation segments',real,async()=>{
  const [{Context},{SessionStore}]=await Promise.all(['cordis','dsh-session'].map(loadOfficial));const ctx=new Context();new SessionStore(ctx);
  const consumer=await officialChatConsumer(ctx),session=ctx.sessions.prepare('prefix');ctx.sessions.enter(session);
  ctx.on('session/event',(owner,event)=>{if(owner===session)consumer.durable(event)});
  const translator=new ConversationEventTranslator({session,dispatch:{emit(_type,{frame}){consumer.frame(frame,session.seq-1)}}});
  try{
    await translator.enqueue(frozen.snapshots[1]);await translator.interrupt();assert.equal(consumer.snapshot().legacy.partial,null);
    await translator.enqueue(frozen.snapshots[2]);await translator.enqueue(frozen.snapshots[3]);
    assert.equal(consumer.snapshot().legacy.partial,null);assert.equal(session.snapshotEvents().some(event=>event.surfaceOp?.op==='replace'),false);
    const text=session.snapshotEvents().filter(event=>event.type==='assistant/message').flatMap(event=>event.data.message.content).filter(block=>block.type==='text').map(block=>block.text).join('');assert.equal(text,'CheckingDone');
    const visible=consumer.snapshot().legacy.nodes.filter(node=>node.kind==='assistant').flatMap(node=>node.blocks).filter(block=>block.kind==='text').map(block=>block.text).join('');assert.equal(visible,'CheckingDone');
    assert.equal(consumer.snapshot().legacy.nodes.length>0,true);
  }finally{await translator.close();await consumer.close();await ctx.fiber.dispose()}
});

test('render leg commits image/file bytes to the official attachment backend and Remote reads the image',real,async()=>{
  const scratch=await mkdtemp(join(tmpdir(),'zcode-render-attachments-'));
  const [{Context},{SessionStore},{default:Projections},{AgentRegistry},{default:TypertRegistry},{SessionController},{LocalAttachmentStore}]=await Promise.all(['cordis','dsh-session','dsh-session-projection','dsh-agent','dsh-typert-registry','dsh-api-session-controller','dsh-attachment-local'].map(loadOfficial));
  const ctx=new Context();new SessionStore(ctx);new Projections(ctx);new AgentRegistry(ctx);new TypertRegistry(ctx);
  ctx.provide('fileUploads',{registerAgentResolver:()=>()=>{}});
  const store=new LocalAttachmentStore(ctx,{dshHome:scratch}),api=new SessionController(ctx,{nativeOpen:false});
  const consumer=await officialChatConsumer(ctx),session=ctx.sessions.prepare('attachment-view');ctx.sessions.enter(session);
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4z8AAAAMBAQCc479ZAAAAAElFTkSuQmCC','base64'),file=Buffer.from('native file bytes');
  const peer=new MockPeer(),snapshot=baseSnapshot();snapshot.control.phase='completedSuccess';snapshot.control.canStop=false;snapshot.control.activeWorks=[];
  snapshot.rows.window=[row('turnHeader',1,{origin:'userInput',state:'completedSuccess',startedAt:0}),row('userInput',2,{origin:'realUser',text:'Attachments',attachments:[{ref:'image-ref',fileName:'one.png',mime:'image/png',bytes:image.length},{ref:'file-ref',fileName:'note.txt',mime:'text/plain',bytes:file.length}]})];
  peer.snapshot=snapshot;const request=peer.request.bind(peer);
  peer.request=async(method,params,options)=>{
    if(method!=='v4/conversation/attachmentRead')return request(method,params,options);
    peer.calls.push({method,params});const bytes=params.ref==='image-ref'?image:file;
    const chunk=bytes.subarray(params.offset,Math.min(bytes.length,params.offset+16)),next=params.offset+chunk.length;
    return {dataBase64:chunk.toString('base64'),mediaType:params.ref==='image-ref'?'image/png':'text/plain',totalBytes:bytes.length,nextOffset:next===bytes.length?null:next};
  };
  const conversation=new V4Conversation(peer,{address:{runtime:'zcode',authority:'official-host',workspace:'/workspace',sessionId:snapshot.sessionId},workspace:{workspacePath:'/workspace',workspaceKey:'/workspace'},connectionId:peer.connectionId,clientId:'render-test',runnable:true,managementAllowed:true});
  await conversation.connect();await tick();
  const translator=new ConversationEventTranslator({session,conversation,attachments:()=>store,dispatch:{emit(){}}});
  try{
    await translator.enqueue(snapshot);
    const message=session.snapshotEvents().find(event=>event.type==='user/message');const [,imageBlock,fileBlock]=message.data.content;
    assert.equal(imageBlock.type,'image');assert.equal(fileBlock.type,'file');
    const result=await api.attachment({sessionId:session.id,attachmentId:imageBlock.attachment.attachmentId});
    assert.equal(result.attachment.width,1);assert.equal(result.attachment.height,1);assert.ok(Buffer.from(result.data,'base64').length>0);
    const parts=[];for await(const bytes of store.readFileStream(fileBlock.attachment))parts.push(bytes);assert.deepEqual(Buffer.concat(parts),file);
    const rendered=consumer.read(session.snapshotEvents());assert.ok(rendered.legacy.nodes.some(node=>node.kind==='user'&&node.content.some(block=>block.type==='image')));
    assert.ok(peer.calls.filter(call=>call.method==='v4/conversation/attachmentRead').every(call=>call.params.target.rowId===2&&call.params.target.entityId==='row-2'));
    await assert.rejects(api.attachment({sessionId:session.id,attachmentId:'unreferenced'}),error=>error.code==='session/attachment-invalid');
  }finally{await translator.close();await conversation.cancel();await consumer.close();await ctx.fiber.dispose();await rm(scratch,{recursive:true,force:true})}
});

test('invalid attachment read progress fails explicitly without fabricating a user attachment event',async()=>{
  const f=fixture(),snapshot=structuredClone(frozen.snapshots[3]);snapshot.rows.window[1].attachments=[{ref:'bad',fileName:'bad.txt',mime:'text/plain',bytes:2}];
  f.translator.conversation={conversationAttachmentRead:async()=>({dataBase64:'YQ==',mediaType:'text/plain',totalBytes:2,nextOffset:null})};
  f.translator.attachments=()=>({async saveFileStream({data}){for await(const _part of data){};throw Error('unreachable')}});
  await assert.rejects(f.translator.enqueue(snapshot),{code:'attachment-render-progress-invalid'});
  assert.equal(f.events.some(event=>event.type==='user/message'),false);sequence(f);await f.translator.close();
});

test('resume owns the JSONL write handle, persists official conservative tool closers before publication',real,async()=>{
  const scratch=await mkdtemp(join(tmpdir(),'zcode-resume-events-'));
  const [{Context},{SessionStore,interruptedTurnClosers},{default:Projections},{AgentRegistry,agentEvents},{createScope},{default:Jsonl}]=await Promise.all(['cordis','dsh-session','dsh-session-projection','dsh-agent','dsh-scope','dsh-session-persistence-jsonl'].map(loadOfficial));
  const ctx=new Context();new SessionStore(ctx);new Projections(ctx);new AgentRegistry(ctx);new Jsonl(ctx,{root:scratch,compression:'none'});
  const session=ctx.sessions.prepare('crash-tail');
  session.append('turn/start',{turn:1,zcode:{turnKey:'stored-turn'}});session.append('step/start',{turn:1,step:1,zcode:{responseKey:'stored-response'}});
  session.append('assistant/message',{turn:1,step:1,message:{id:'request',role:'assistant',source:{kind:'model',provider:'zcode',model:'model_a'},content:[{type:'tool-call',id:'pending-call',name:'Bash',arguments:'{}'}]},stream:[]},{surfaceOp:'append'});
  session.append('tool/call',{turn:1,step:1,callId:'pending-call',name:'Bash',arguments:'{}'});
  const writer=await ctx.sessionPersistence.create(session.header);await writer.append(session.snapshotEvents());await writer.close();
  const driver=installDriver(ctx,{createScope,agentEvents,interruptedTurnClosers,transport:{resume:async()=>{},dispose(){}}});
  const consumer=await officialChatConsumer(ctx);
  let observed;
  ctx.on('agent/created',({agent})=>{if(agent.id==='crash-tail')observed=agent.session.snapshotEvents()});
  try{
    const {agent,dispose}=await ctx.agents.resume({resumeSessionId:'crash-tail'});
    const events=agent.session.snapshotEvents();assert.equal(events.findLast(event=>event.type==='turn/end').data.reason.kind,'aborted');
    assert.equal(events.findLast(event=>event.type==='tool/result').data.error.code,'TOOL_OUTCOME_UNKNOWN');
    assert.ok(observed.some(event=>event.type==='turn/end'),'closers are present before the creation announcement');
    assert.equal(ctx.sessionProjections.stateOf(agent.session,'turnBoundary').openTurnStartSeq,null);
    const rendered=consumer.read(events);assert.equal(rendered.legacy.runningCalls.length,0);assert.equal(rendered.legacy.partial,null);
    await dispose();const reader=await ctx.sessionPersistence.open('crash-tail','write');
    try{const cold=await reader.read(0);assert.ok(cold.events.some(event=>event.type==='turn/end'));assert.equal(interruptedTurnClosers(cold.events).length,0)}finally{await reader.close()}
  }finally{await driver.dispose();await consumer.close();await ctx.fiber.dispose();await rm(scratch,{recursive:true,force:true})}
});

test('historical merge keeps the newest row version regardless of window arrival order',()=>{
  const older=structuredClone(frozen.snapshots[1]),newer=structuredClone(frozen.snapshots[3]);
  assert.equal(mergeEventWindows([newer,older]).rows.window.find(row=>row.rowId===4).text,'Checking');
  assert.equal(mergeEventWindows([newer,older]).control.phase,'completedSuccess');
});

test('a resumed still-running source turn opens a fresh native boundary without duplicating durable prefixes',async()=>{
  const f=fixture();await f.translator.enqueue(frozen.snapshots[1]);await f.translator.close();
  const restored=new ConversationEventTranslator({session:f.session,dispatch:{emit(){}}});
  const continued=structuredClone(frozen.snapshots[1]);continued.seq++;continued.rows.window[3].text='Checking after restart';
  await restored.enqueue(continued);
  assert.deepEqual(f.events.filter(event=>event.type==='turn/start').map(event=>event.data.turn),[1,2]);
  const final=structuredClone(continued);final.seq++;final.control.phase='completedInterrupted';final.control.canStop=false;final.control.activeWorks=[];
  await restored.enqueue(final);
  const text=f.events.filter(event=>event.type==='assistant/message').flatMap(event=>event.data.message.content).filter(block=>block.type==='text').map(block=>block.text).join('');
  assert.equal(text,'Checking after restart');assert.equal(f.events.at(-1).data.reason.kind,'aborted');sequence(f);await restored.close();
});

test('stop closes recorded pending tools with unknown outcome before native step/turn ends',real,async()=>{
  const [{Context},{SessionStore}]=await Promise.all(['cordis','dsh-session'].map(loadOfficial));const ctx=new Context();new SessionStore(ctx);
  const consumer=await officialChatConsumer(ctx),session=ctx.sessions.prepare('stop-tool');ctx.sessions.enter(session);
  ctx.on('session/event',(owner,event)=>{if(owner===session)consumer.durable(event)});
  const translator=new ConversationEventTranslator({session,dispatch:{emit(_type,{frame}){consumer.frame(frame,session.seq-1)}}});
  try{
    for(const snapshot of frozen.snapshots.slice(0,3))await translator.enqueue(snapshot);
    assert.equal(consumer.snapshot().legacy.runningCalls.length,1);
    const stopped=structuredClone(frozen.snapshots[2]);stopped.seq++;stopped.control.phase='completedInterrupted';stopped.control.canStop=false;stopped.control.activeWorks=[];
    await translator.enqueue(stopped);
    const events=session.snapshotEvents(),result=events.findLast(event=>event.type==='tool/result');
    assert.equal(result.data.message.isError,true);assert.equal(result.data.error.code,'TOOL_OUTCOME_UNKNOWN');
    assert.ok(result.seq<events.findLast(event=>event.type==='step/end').seq);assert.equal(consumer.snapshot().legacy.runningCalls.length,0);
    assert.equal(consumer.snapshot().legacy.partial,null);
  }finally{await translator.close();await consumer.close();await ctx.fiber.dispose()}
});

test('a guided ZCode row feeds durable next-step claims and the official steering node',real,async()=>{
  const [{Context},{SessionStore},{default:Projections}]=await Promise.all(['cordis','dsh-session','dsh-session-projection'].map(loadOfficial));const ctx=new Context();new SessionStore(ctx);new Projections(ctx);ctx.sessionProjections.register(inboxProjectionDefinition);
  const consumer=await officialChatConsumer(ctx),session=ctx.sessions.prepare('guide-consumption');ctx.sessions.enter(session);
  ctx.on('session/event',(owner,event)=>{if(owner===session)consumer.durable(event)});
  const translator=new ConversationEventTranslator({session,dispatch:{emit(_type,{frame}){consumer.frame(frame,session.seq-1)}}});
  try{
    const snapshot=structuredClone(frozen.snapshots[3]);snapshot.rows.window[1].guided=true;
    await translator.enqueue(snapshot);
    assert.ok(consumer.snapshot().legacy.nodes.some(node=>node.kind==='steering'&&node.content[0].text==='Run a check'));
    assert.deepEqual(ctx.sessionProjections.stateOf(session,'inbox'),{'next-turn':[],'next-step':[]});
  }finally{await translator.close();await consumer.close();await ctx.fiber.dispose()}
});

test('snapshot meta.title mirrors the authoritative conversation title over a stale catalog title',async()=>{
  const events=[];
  const session={id:'title-sync',get seq(){return events.length},eventAt:seq=>events[seq],snapshotEvents:()=>events,append(type,data){const event={type,data:structuredClone(data),seq:events.length,time:1};events.push(event);return event}};
  // The persisted/backfilled log carries the task-registry title; the live conversation was
  // re-titled in ZCode (e.g. an automation resume) and the registry never caught up.
  session.append('session/title',{title:'pppms: 修复section编号泄露',messageSeqs:[],source:{kind:'user'}});
  const translator=new ConversationEventTranslator({session,dispatch:{emit(){}}});
  try{
    const snapshot=baseSnapshot('title-sync');
    snapshot.meta={title:'计时全量导入监控（70 分钟后检查）',titleSource:'custom'};
    await translator.enqueue(snapshot);
    assert.equal(events.at(-1).type,'session/title','the snapshot title is mirrored into the session');
    assert.equal(events.at(-1).data.title,'计时全量导入监控（70 分钟后检查）');
    const count=events.length;
    await translator.enqueue(structuredClone(snapshot));
    assert.equal(events.length,count,'an unchanged title never re-appends');
    const bare=structuredClone(snapshot);delete bare.meta;
    await translator.enqueue(bare);
    assert.equal(events.length,count,'a snapshot without meta leaves the title alone');
    const renamed=structuredClone(snapshot);renamed.meta={title:'later rename',titleSource:'custom'};
    await translator.enqueue(renamed);
    assert.equal(events.at(-1).data.title,'later rename','later ZCode-side renames keep propagating');
  }finally{await translator.close()}
});

test('a restarted runtime re-keys dedupe indexes to the fresh log epoch instead of re-emitting',async()=>{
  const f=fixture();
  await f.translator.enqueue(frozen.snapshots[0]);
  const count=f.events.length;
  // Same rows under a new epoch: what the first snapshot after a process restart carries.
  // Row ids are stable across epochs; re-emitting would duplicate the transcript with
  // sync-moment timestamps and poison durations and the list's lastPromptAt.
  const reepoched=structuredClone(frozen.snapshots[0]);
  reepoched.logEpoch='epoch-after-restart';
  await f.translator.enqueue(reepoched);
  assert.equal(f.events.length,count,'identical rows under a new epoch append nothing');
  // A genuinely new row in the new epoch still emits normally.
  const extended=structuredClone(frozen.snapshots[1]);
  extended.logEpoch='epoch-after-restart';
  await f.translator.enqueue(extended);
  assert.ok(f.events.length>count,'new rows in the new epoch still emit');
  sequence(f);
  await f.translator.close();
});

test('a seed spanning several log epochs normalizes every cohort on the next snapshot',async()=>{  const f=fixture();
  // First process lifetime: the turn streams under the original epoch.
  await f.translator.enqueue(frozen.snapshots[1]);
  // A restart mints a new epoch; the same rows come back completed plus the turn's tail —
  // exactly what a session that stayed open across one restart persists.
  const restartOne=structuredClone(frozen.snapshots[2]);restartOne.logEpoch='epoch-two';
  const restartTwo=structuredClone(frozen.snapshots[3]);restartTwo.logEpoch='epoch-two';
  await f.translator.enqueue(restartOne);
  await f.translator.enqueue(restartTwo);
  await f.translator.close();
  const cohortEpochs=[...new Set(f.events.map(event=>{const key=event.data?.zcode?.turnKey??event.data?.zcode?.responseKey??event.data?.zcode?.rowKey;if(typeof key==='string'){try{return JSON.parse(key)[0]}catch{}}return null}).filter(value=>typeof value==='string'))];
  assert.deepEqual(cohortEpochs,[frozen.snapshots[1].logEpoch,'epoch-two'],'the seed spans two epochs');
  // Rebuild the fold from that mixed-epoch event log (exactly what the backfill does) and
  // move to a third epoch: EVERY cohort must re-key, not just the seed's first one.
  const restored=new ConversationEventTranslator({session:f.session,dispatch:{emit(){}}});
  const third=structuredClone(frozen.snapshots[3]);third.logEpoch='epoch-three';
  const before=f.events.length;
  await restored.enqueue(third);
  assert.equal(f.events.length,before,'a third epoch re-keys every cohort instead of re-emitting');
  sequence(f);
  await restored.close();
});

const automationSnapshot=({origin='backgroundResult',epoch='epoch-x',turnId='turn-bg'}={})=>{
  const window=[
    {rowId:1,kind:'turnHeader',turnId,origin,state:'completedSuccess',startedAt:0,createdAtSeq:1,sourceCommandId:'cmd-bg'},
    {rowId:2,kind:'assistantText',turnId,assistantResponseId:'resp-bg',text:'monitoring result',state:'complete',model:'model_a',createdAtSeq:2},
  ];
  return {protocolVersion:3,sessionId:'automation',logEpoch:epoch,seq:5,revision:1,
    control:{phase:'completedSuccess',canStop:false,activeWorks:[],lastError:null},
    availability:{},inputRouting:{mode:'startNow'},queue:{items:[],autoDrain:true},pendingInteractions:[],
    rows:{window}};
};

test('an automation-origin turn without a user row gets one synthetic trigger marker, replay-safe',async()=>{
  const f=fixture();
  await f.translator.enqueue(automationSnapshot());
  const markers=f.events.filter(event=>event.type==='assistant/message'&&event.data.message.content[0].text.startsWith('⟳'));
  assert.equal(markers.length,1,'exactly one trigger marker');
  assert.equal(markers[0].data.message.source.provider,'zcode');
  assert.equal(markers[0].data.message.content[0].text,'⟳ ZCode 后台任务结果触发');
  const work=f.events.findIndex(event=>event.type==='assistant/message'&&event.data.message.content.some(block=>block.text==='monitoring result'));
  assert.ok(f.events.indexOf(markers[0])<work,'the marker precedes the turn content');
  // A replay of the same window adds nothing; a goalContinuation turn gets its own wording.
  await f.translator.enqueue(automationSnapshot());
  assert.equal(f.events.filter(event=>event.type==='assistant/message'&&event.data.message.content[0]?.text.startsWith('⟳')).length,1,'the marker never duplicates');
  await f.translator.enqueue(automationSnapshot({origin:'goalContinuation',turnId:'turn-goal'}));
  const texts=f.events.filter(event=>event.type==='assistant/message'&&event.data.message.content[0]?.text.startsWith('⟳')).map(event=>event.data.message.content[0].text);
  assert.deepEqual(texts,['⟳ ZCode 后台任务结果触发','⟳ ZCode 自动继续']);
  sequence(f);
  await f.translator.close();
});

test('the official ui-chat consumer renders the synthetic trigger marker as a user node',real,async()=>{
  const [{Context},{SessionStore},{default:Projections}]=await Promise.all(['cordis','dsh-session','dsh-session-projection'].map(loadOfficial));
  const ctx=new Context();new SessionStore(ctx);new Projections(ctx);ctx.sessionProjections.register(turnBoundaryProjectionDefinition);ctx.sessionProjections.register(inboxProjectionDefinition);
  const consumer=await officialChatConsumer(ctx),session=ctx.sessions.prepare('trigger-marker');ctx.sessions.enter(session);
  ctx.on('session/event',(owner,event)=>{if(owner===session)consumer.durable(event)});
  const translator=new ConversationEventTranslator({session,dispatch:{emit(){}}});
  try{
    await translator.enqueue(automationSnapshot());
    const live=consumer.snapshot().legacy.nodes;
    assert.ok(live.some(node=>node.kind==='assistant'&&node.blocks.some(block=>block.kind==='text'&&block.text==='⟳ ZCode 后台任务结果触发')),'the marker renders as a visible assistant node');
    assert.ok(live.some(node=>node.kind==='assistant'),'the turn content still renders');
    const restored=ctx.sessions.prepare('trigger-cold',{seed:session.snapshotEvents()});
    const cold=consumer.read(restored.snapshotEvents());
    assert.ok(cold.legacy.nodes.some(node=>node.kind==='assistant'&&node.blocks.some(block=>block.kind==='text'&&block.text==='⟳ ZCode 后台任务结果触发')),'cold reads keep the marker');
  }finally{await translator.close();await consumer.close();await ctx.fiber.dispose()}
});
