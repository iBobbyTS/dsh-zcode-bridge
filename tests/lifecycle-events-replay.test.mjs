import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ConversationEventTranslator} from '../packages/driver/events.mjs';
import {inboxProjectionDefinition,turnBoundaryProjectionDefinition} from '../packages/driver/projections.mjs';
import {baseSnapshot,row} from './helpers/zcode-runtime-fixture.mjs';
import {commandWorld,message as commandMessage} from './helpers/lifecycle-commands.mjs';

const message=id=>({id,role:'user',source:{kind:'user',rpcId:id},content:[{type:'text',text:'same text'}]});
function fixture(seed=[],completedSeed=[]){
  const events=structuredClone(seed),frames=[],inboxes=[],completedInputs=[...completedSeed];
  const session={id:'replay',get seq(){return events.length},eventAt:seq=>events[seq],snapshotEvents:()=>events,
    append(type,data,opts){const event={type,data:structuredClone(data),...opts,seq:events.length,time:1};events.push(event);return event}};
  const translator=new ConversationEventTranslator({session,clock:()=>1,input:message,
    completedInputs:new Set(completedInputs),onInputCompleted:commandId=>completedInputs.push(commandId),
    syncInbox:snapshot=>inboxes.push(structuredClone(snapshot.rows.window)),
    dispatch:{emit(type,{frame}){assert.equal(type,'agent/assistant-stream');frames.push(structuredClone(frame))}}});
  return {events,frames,inboxes,session,translator,completedInputs};
}
function snapshot(rows,{epoch='epoch-original',phase='completedSuccess',shuffle=false}={}){
  const value=baseSnapshot('replay');value.logEpoch=epoch;
  value.control={...value.control,phase,canStop:phase==='running',activeWorks:[],lastError:null};
  value.rows.window=shuffle?[...rows].reverse():structuredClone(rows);return value;
}
function inputRows({turnId='original',headerId=1,userId=2,answerId=3,commandId='C',text='original reply',state='completedSuccess',fallback=false}={}){
  return [
    row('turnHeader',headerId,{turnId,sourceCommandId:commandId,origin:'userInput',state,startedAt:0}),
    row('userInput',userId,{turnId,...(!fallback?{sourceCommandId:commandId}:{}),origin:'realUser',text:'same text'}),
    row('assistantText',answerId,{turnId,assistantResponseId:`response-${answerId}`,text,state:state==='running'?'streaming':'complete',model:'model_a'}),
  ];
}
const answers=f=>f.events.filter(event=>event.type==='assistant/message').flatMap(event=>event.data.message.content).filter(block=>block.type==='text').map(block=>block.text);
const users=f=>f.events.filter(event=>event.type==='user/message').map(event=>event.data.id);
const keys=f=>[...f.completedInputs];
function sequence(f){
  assert.deepEqual(f.events.map(event=>event.seq),f.events.map((_,index)=>index));
  let boundary=turnBoundaryProjectionDefinition.init(),inbox=inboxProjectionDefinition.init();
  for(const event of f.events){boundary=turnBoundaryProjectionDefinition.apply(boundary,event);inbox=inboxProjectionDefinition.apply(inbox,event)}
  assert.equal(boundary.openTurnStartSeq,null);
  assert.deepEqual(inbox,{'next-turn':[],'next-step':[]});
  for(const frame of f.frames)if(frame.type==='end'&&frame.outcome.kind==='committed')assert.equal(f.events[frame.outcome.seq].type,'assistant/message');
}
async function finishOriginal(f,{fallback=false}={}){
  await f.translator.enqueue(snapshot(inputRows({state:'running',fallback}),{phase:'running'}));
  assert.deepEqual(keys(f),[],'streamed/projected input is not a completed input');
  await f.translator.enqueue(snapshot(inputRows({fallback})));
  assert.deepEqual(keys(f),['C'],'terminal row data records completion even though the user row is already deduped');
  assert.deepEqual(answers(f),['original reply']);
}

// AC1/AC4: distinguish rehydrated user rows from fresh row identities, and reused
// turn IDs (late-reopen) from new turns. Cold fixtures contain only durable events.
for(const freshRows of [false,true])for(const reusedTurn of [false,true])for(const cold of [false,true])for(const shuffle of [false,true]){
  test(`completed input replay: ${freshRows?'fresh':'rehydrated'} user / ${reusedTurn?'reused':'new'} turn / ${cold?'cold':'live'} / ${shuffle?'shuffled':'ordered'}`,async()=>{
    const original=fixture();await finishOriginal(original,{fallback:true});
    const f=cold?fixture(original.events,original.completedInputs):original;
    try{
      const replay=inputRows({turnId:reusedTurn?'original':'replay',headerId:freshRows?10:1,userId:freshRows?11:2,answerId:12,text:'replayed reply',fallback:true});
      const before=f.events.length,frameCount=f.frames.length;
      await f.translator.enqueue(snapshot(replay,{epoch:'epoch-resumed',shuffle}));
      assert.equal(f.events.length,before,'no new turn, user, answer, or completion event');
      assert.equal(f.frames.length,frameCount,'no transient replay answer');
      assert.deepEqual(answers(f),['original reply']);assert.deepEqual(users(f),['C']);assert.deepEqual(keys(f),['C']);
      assert.equal(f.inboxes.at(-1).length,replay.length,'suppression still reconciles input consumption');
      sequence(f);
    }finally{await original.translator.close();if(cold)await f.translator.close()}
  });
}

test('a true resend with a new command/rpc ID projects identical text and survives another restart',async()=>{
  const f=fixture();await finishOriginal(f);
  try{
    const resend=inputRows({turnId:'resend',headerId:10,userId:11,answerId:12,commandId:'D',text:'original reply'});
    await f.translator.enqueue(snapshot(resend,{epoch:'epoch-resumed'}));
    assert.deepEqual(users(f),['C','D']);assert.deepEqual(answers(f),['original reply','original reply']);assert.deepEqual(keys(f),['C','D']);
    const cold=fixture(f.events,f.completedInputs);
    try{const before=cold.events.length;await cold.translator.enqueue(snapshot(resend,{epoch:'epoch-next'}));assert.equal(cold.events.length,before);sequence(cold)}finally{await cold.translator.close()}
    sequence(f);
  }finally{await f.translator.close()}
});

test('completed user-row sourceCommandId suppresses replay even with an unmatched header sourceCommandId',async()=>{
  const f=fixture();await finishOriginal(f);
  try{
    const rows=inputRows({turnId:'replay',headerId:10,userId:11,answerId:12,text:'replayed reply'});
    rows[0].sourceCommandId='different-header-command';
    const before=f.events.length;await f.translator.enqueue(snapshot(rows));
    assert.equal(f.events.length,before);assert.deepEqual(answers(f),['original reply']);
  }finally{await f.translator.close()}
});

for(const delayed of [false,true])test(`completed header protects replay prefix without a rehydrated user row: ${delayed?'delayed':'same batch'} guide`,async()=>{
  const f=fixture();await finishOriginal(f);
  try{
    const prefix=inputRows({turnId:'replay',answerId:12,text:'replayed reply',state:'running'}).filter(row=>row.kind!=='userInput');
    prefix[1].state='complete';
    if(delayed){const before=f.events.length;await f.translator.enqueue(snapshot(prefix,{phase:'running'}));assert.equal(f.events.length,before)}
    prefix[0].state='completedSuccess';
    await f.translator.enqueue(snapshot([...prefix,
      row('userInput',13,{turnId:'replay',sourceCommandId:'D',guided:true,origin:'realUser',text:'same text'}),
      row('assistantText',14,{turnId:'replay',assistantResponseId:'guide-response',text:'guide reply',state:'complete',model:'model_a'})]));
    assert.deepEqual(users(f),['C','D']);assert.deepEqual(answers(f),['original reply','guide reply']);assert.deepEqual(keys(f),['C','D']);sequence(f);
  }finally{await f.translator.close()}
});

test('a single snapshot containing the original completion and its replay emits one reply',async()=>{
  const f=fixture();
  try{
    const replay=inputRows({turnId:'replay',headerId:10,userId:11,answerId:12,text:'replayed reply'});
    await f.translator.enqueue(snapshot([...inputRows(),...replay],{shuffle:true}));
    assert.deepEqual(users(f),['C']);assert.deepEqual(answers(f),['original reply']);assert.deepEqual(keys(f),['C']);sequence(f);
  }finally{await f.translator.close()}
});

// AC3 joint oracle: the replay answer stays absent AND the new guide/answer are
// visible. Use the SAME response ID across the prefix and suffix to prove that
// filtering happens at row granularity, before grouping responses.
for(const delayed of [false,true])for(const reusedTurn of [false,true])for(const cold of [false,true]){
  test(`replay prefix plus guide: ${delayed?'delayed':'same batch'} / ${reusedTurn?'reused':'new'} turn / ${cold?'cold':'live'}`,async()=>{
    const original=fixture();await finishOriginal(original);
    const f=cold?fixture(original.events,original.completedInputs):original,turnId=reusedTurn?'original':'replay';
    const prefix=inputRows({turnId,answerId:12,text:'replayed reply',state:'running'});
    prefix[2].state='complete';prefix[2].assistantResponseId='mixed-response';
    const guide=row('userInput',13,{turnId,sourceCommandId:'D',guided:true,origin:'realUser',text:'same text'});
    const reply=row('assistantText',14,{turnId,assistantResponseId:'mixed-response',text:'guide reply',state:'complete',model:'model_a'});
    try{
      if(delayed){
        const before=f.events.length,frameCount=f.frames.length;
        await f.translator.enqueue(snapshot(prefix,{epoch:'epoch-resumed',phase:'running',shuffle:true}));
        assert.equal(f.events.length,before);assert.equal(f.frames.length,frameCount);
        assert.deepEqual(keys(f),['C']);
      }
      const mixed=[...prefix,guide,reply];
      await f.translator.enqueue(snapshot(mixed,{epoch:'epoch-resumed',phase:'running',shuffle:true}));
      assert.deepEqual(users(f),['C','D'],'guide with fresh command/rpc ID is visible');
      assert.deepEqual(keys(f),['C'],'guide is not complete merely because its reply row is ready');
      assert.ok(!f.frames.some(frame=>frame.chunk?.text?.includes('replayed reply')),'no transient replay prefix');
      mixed[0].state='completedSuccess';
      await f.translator.enqueue(snapshot(mixed,{epoch:'epoch-resumed',shuffle:true}));
      assert.deepEqual(answers(f),['original reply','guide reply'],'joint oracle: only new suffix is settled');
      assert.deepEqual(keys(f),['C','D']);
      const before=f.events.length;
      await f.translator.enqueue(snapshot(mixed,{epoch:'epoch-next'}));assert.equal(f.events.length,before);
      const restarted=fixture(f.events,f.completedInputs);
      try{
        mixed.push(row('userInput',15,{turnId,sourceCommandId:'E',guided:true,origin:'realUser',text:'same text'}),
          row('assistantText',16,{turnId,assistantResponseId:'mixed-response',text:'next guide reply',state:'complete',model:'model_a'}));
        await restarted.translator.enqueue(snapshot(mixed,{epoch:'epoch-next',shuffle:true}));
        assert.deepEqual(users(restarted),['C','D','E']);assert.deepEqual(answers(restarted),['original reply','guide reply','next guide reply']);
        assert.deepEqual(keys(restarted),['C','D','E']);sequence(restarted);
      }finally{await restarted.translator.close()}
      sequence(f);
    }finally{await original.translator.close();if(cold)await f.translator.close()}
  });
}

test('a completed user-input header alone dedupes fresh assistant rows after reconstruction',async()=>{
  const f=fixture(),rows=inputRows().filter(row=>row.kind!=='userInput');
  try{
    await f.translator.enqueue(snapshot(rows));assert.deepEqual(keys(f),['C']);
    const cold=fixture(f.events,f.completedInputs);
    try{
      rows[0].turnId=rows[1].turnId='replay';rows[1].rowId=12;rows[1].assistantResponseId='new-response';
      const before=cold.events.length;await cold.translator.enqueue(snapshot(rows,{epoch:'epoch-resumed'}));assert.equal(cold.events.length,before);
    }finally{await cold.translator.close()}
  }finally{await f.translator.close()}
});

for(const state of ['completedInterrupted','failed','running'])test(`completion keys are not written for ${state} or local disposal`,async()=>{
  const f=fixture();
  await f.translator.enqueue(snapshot(inputRows({state}),{phase:state}));await f.translator.close();
  assert.deepEqual(keys(f),[]);sequence(f);
});

test('driver subscription consumes new guide input while suppressing a resumed replay prefix',async()=>{
  const w=await commandWorld();
  const publish=async(rows,phase='completedSuccess')=>{
    const next=snapshot(rows,{epoch:'epoch-driver',phase});next.sessionId=w.peer.snapshot.sessionId;next.seq=w.peer.snapshot.seq+1;next.revision=w.peer.snapshot.revision+1;
    w.peer.publish(next);await w.drain();
  };
  try{
    w.agent.followup(commandMessage('original','same text'));await w.drain();
    const commandId=w.agent.inputs.get('original').commandId;
    await publish(inputRows({commandId,state:'running'}),'running');await publish(inputRows({commandId}));
    const before=w.events.length,streams=()=>w.notifications.filter(item=>item.type==='agent/assistant-stream').length,frameCount=streams();
    const prefix=inputRows({turnId:'replay',commandId,answerId:12,text:'replayed reply',state:'running'});prefix[2].state='complete';
    await publish(prefix,'running');assert.equal(w.events.length,before);assert.equal(streams(),frameCount);
    w.agent.steer(commandMessage('guide','same text'));await w.drain();
    const guideCommand=w.agent.inputs.get('guide').commandId;
    prefix[0].state='completedSuccess';
    await publish([...prefix,row('userInput',13,{turnId:'replay',sourceCommandId:guideCommand,guided:true,origin:'realUser',text:'same text'}),
      row('assistantText',14,{turnId:'replay',assistantResponseId:'guide-response',text:'guide reply',state:'complete',model:'model_a'})]);
    assert.deepEqual(users(w),['original','guide']);assert.deepEqual(answers(w),['original reply','guide reply']);
    assert.equal(w.agent.inbox.nextTurn.length,0);assert.equal(w.agent.inbox.nextStep.length,0);
    assert.equal(w.agent.conversation.state.observerErrors,0);assert.deepEqual([...w.agent.recovery.completedInputsOf(w.agent.id)],[commandId,guideCommand]);
  }finally{await w.close()}
});
