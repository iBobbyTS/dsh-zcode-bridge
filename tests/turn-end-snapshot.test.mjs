import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ConversationEventTranslator,isTurnEndSnapshotRow,turnEndSnapshotImages} from '../packages/driver/events.mjs';

// A real 1x1 PNG: sniffImageType must recognize the magic bytes so the fake store sees the
// sniffed media type exactly like the official attachment store would.
const png1x1='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pngBytes=Buffer.from(png1x1,'base64');

function fixture({history=false,store}={}){
  const events=[];
  const session={id:'snapshot-turn-end',get seq(){return events.length},eventAt:seq=>events[seq],snapshotEvents:()=>events,
    append(type,data,opts){const event={type,data:structuredClone(data),...opts,seq:events.length,time:1};events.push(event);return event}};
  const attachments=store===undefined?undefined:()=>store;
  const translator=new ConversationEventTranslator({session,attachments,dispatch:{emit(){}},
    input:()=>undefined,claim:()=>{},syncInbox:()=>{},history});
  return {events,session,translator};
}
let clock=0;
const snap=(phase,rows)=>({seq:++clock,logEpoch:'ep-test',control:{phase},backgroundWorks:[],
  rows:{window:rows.map(row=>({createdAtSeq:++clock,...row}))}});
const header=state=>({rowId:'h1',turnId:'t1',kind:'turnHeader',state});
const userRow={rowId:'u1',turnId:'t1',kind:'userInput',text:'run it',origin:'realUser'};
const textRow=(rowId,state,text)=>({rowId,turnId:'t1',kind:'assistantText',state,text});
const bashRow={rowId:'k1',turnId:'t1',kind:'toolCall',toolCallId:'call_bash',toolName:'Bash',status:'success',inputText:'{"command":"ls"}',output:{text:'ok'}};
const snapToolRow=(rowId='te1')=>({rowId,turnId:'t1',kind:'toolCall',toolCallId:`tool_${rowId}`,toolName:'mcp__node_repl__js',status:'completed',
  inputText:'{"source":"browser_turn_end"}',display:{kind:'node_repl_images',source:'browser_turn_end',images:[{base64:png1x1,mimeType:'image/png'}]}});
const messages=events=>events.filter(event=>event.type==='assistant/message');

test('detection matches only the IAB end-of-turn snapshot row',()=>{
  assert.equal(isTurnEndSnapshotRow(snapToolRow()),true);
  assert.equal(isTurnEndSnapshotRow({...snapToolRow(),inputText:'{"title":"mid turn"}',display:{kind:'node_repl_images'}}),false);
  assert.equal(isTurnEndSnapshotRow(bashRow),false);
  assert.equal(isTurnEndSnapshotRow({...bashRow,toolName:'mcp__node_repl__js'}),false);
  const images=turnEndSnapshotImages([textRow('a1','complete','x'),snapToolRow(),{kind:'toolCall',toolName:'Bash'}]);
  assert.equal(images.length,1);assert.equal(images[0].base64,png1x1);
  assert.deepEqual(turnEndSnapshotImages([textRow('a1','complete','x')]),[]);
});

test('live closing group holds until the terminal state, then settles text plus screenshot',async()=>{
  const store={saved:[],async saveImages(inputs){this.saved.push(...inputs);return inputs.map((input,index)=>({attachmentId:`sha256:test-${index}`,mediaType:input.mediaType,bytes:input.data.byteLength,width:1280,height:720,name:input.name}))}};
  const f=fixture({store});
  await f.translator.enqueue(snap('running',[header('running'),userRow,textRow('a1','streaming','Ans')]));
  await f.translator.enqueue(snap('running',[header('running'),userRow,textRow('a1','complete','Answer done')]));
  assert.equal(messages(f.events).length,0,'a text-only closing group of a running turn holds its settle');
  await f.translator.enqueue(snap('completedSuccess',[header('completedSuccess'),userRow,textRow('a1','complete','Answer done'),snapToolRow()]));
  const settled=messages(f.events);
  assert.equal(settled.length,1);
  const content=settled[0].data.message.content;
  assert.deepEqual(content.map(block=>block.type),['text','image']);
  assert.deepEqual(content[1].attachment,{attachmentId:'sha256:test-0',mediaType:'image/png',bytes:pngBytes.length,width:1280,height:720,name:'browser-turn-end-1.png'});
  assert.equal(store.saved.length,1);assert.equal(store.saved[0].data.byteLength,pngBytes.length);assert.equal(store.saved[0].mediaType,'image/png');
  assert.equal(f.events.some(event=>event.type==='tool/call'||event.type==='tool/result'),false,'the snapshot is not a model tool action');
  const chunks=settled[0].data.stream.map(record=>record.chunk);
  assert.ok(chunks.some(chunk=>chunk.type==='block-start'&&chunk.blockType==='image'&&chunk.index===1));
  assert.ok(chunks.some(chunk=>chunk.type==='block-end'&&chunk.index===1&&chunk.block.type==='image'));
  assert.equal(settled[0].surfaceOp,'append');
  assert.equal(f.events.find(event=>event.type==='turn/end').data.reason.kind,'completed');
  const before=f.events.length;await f.translator.close();assert.equal(f.events.length,before);
});

test('a closing group carrying real tool calls still settles eagerly while the turn runs',async()=>{
  const f=fixture();
  await f.translator.enqueue(snap('running',[header('running'),userRow,textRow('a1','complete','Running a check'),{...bashRow,status:'running',output:undefined}]));
  const settled=messages(f.events);
  assert.equal(settled.length,1);
  assert.deepEqual(settled[0].data.message.content.map(block=>block.type),['text','tool-call']);
  assert.equal(f.events.filter(event=>event.type==='tool/call').length,1);
  await f.translator.close();
});

test('history windows keep the eager settle and terminal windows fold in one pass',async()=>{
  const running=fixture({history:true});
  await running.translator.enqueue(snap('running',[header('running'),userRow,textRow('a1','complete','Answer done')]));
  assert.equal(messages(running.events).length,1,'history replay never waits for a live terminal state');
  await running.translator.close();

  const store={saved:[],async saveImages(inputs){return inputs.map((input,index)=>({attachmentId:`sha256:h-${index}`,mediaType:input.mediaType,bytes:input.data.byteLength,width:1,height:1}))}};
  const f=fixture({history:true,store});
  await f.translator.enqueue(snap('completedSuccess',[header('completedSuccess'),userRow,textRow('a1','complete','Answer done'),snapToolRow()]));
  const settled=messages(f.events);
  assert.equal(settled.length,1);
  assert.deepEqual(settled[0].data.message.content.map(block=>block.type),['text','image']);
  const before=f.events.length;await f.translator.close();assert.equal(f.events.length,before);
});

test('a newer group supersedes the hold and settles the earlier message cleanly',async()=>{
  const f=fixture();
  await f.translator.enqueue(snap('running',[header('running'),userRow,textRow('a1','complete','First answer')]));
  assert.equal(messages(f.events).length,0);
  await f.translator.enqueue(snap('running',[header('running'),userRow,textRow('a1','complete','First answer'),textRow('a2','streaming','Sec')]));
  const first=messages(f.events);
  assert.equal(first.length,1);assert.equal(first[0].data.message.content[0].text,'First answer');
  assert.equal(first[0].data.interrupted,undefined);
  await f.translator.enqueue(snap('running',[header('running'),userRow,textRow('a1','complete','First answer'),textRow('a2','complete','Second answer')]));
  assert.equal(messages(f.events).length,1,'the new closing group holds in turn');
  await f.translator.enqueue(snap('completedSuccess',[header('completedSuccess'),userRow,textRow('a1','complete','First answer'),textRow('a2','complete','Second answer'),snapToolRow('te2')]));
  const settled=messages(f.events);
  assert.equal(settled.length,2);
  // No attachment store in this fixture: the superseded message and the terminal settle stay
  // text-only (the screenshot degrades to nothing, never a failed settle).
  assert.deepEqual(settled.map(event=>event.data.message.content.map(block=>block.type)),[['text'],['text']]);
  await f.translator.close();
});

test('close() releases a held closing message without the interrupted marker',async()=>{
  const f=fixture();
  await f.translator.enqueue(snap('running',[header('running'),userRow,textRow('a1','complete','Answer done')]));
  await f.translator.close();
  const settled=messages(f.events);
  assert.equal(settled.length,1);assert.equal(settled[0].data.interrupted,undefined);
});

test('a mixed closing group keeps real tool blocks and events, drops the snapshot row, keeps its image',async()=>{
  const store={saved:[],async saveImages(inputs){return inputs.map((input,index)=>({attachmentId:`sha256:m-${index}`,mediaType:input.mediaType,bytes:input.data.byteLength,width:1,height:1}))}};
  const f=fixture({store});
  await f.translator.enqueue(snap('completedSuccess',[header('completedSuccess'),userRow,textRow('a1','complete','Backgrounding'),bashRow,snapToolRow()]));
  const settled=messages(f.events);
  assert.equal(settled.length,1);
  assert.deepEqual(settled[0].data.message.content.map(block=>block.type),['text','tool-call','image']);
  const calls=f.events.filter(event=>event.type==='tool/call');
  assert.deepEqual(calls.map(event=>event.data.callId),['call_bash']);
  assert.equal(f.events.filter(event=>event.type==='tool/result').length,1);
  await f.translator.close();
});
