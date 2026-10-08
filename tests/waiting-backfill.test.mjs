import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseWaitingMarkerText,waitingNoteText,buildWaitingNoteEvent} from '../packages/driver/events.mjs';
import {spliceWaitingNotes} from '../packages/driver/legacy-directory.mjs';

const markerEvent=(turn,text,epoch='ep1')=>[
  {type:'turn/start',data:{turn}},
  // user/message events carry id/role/source/content FLAT on data (assistant nests under .message).
  {type:'user/message',data:{id:JSON.stringify([epoch,`trigger:msg-${turn}`]),role:'user',source:{kind:'user',zcodeTrigger:true},content:[{type:'text',text}]}},
];
const bashCall=(turn,description,command)=>({type:'tool/call',data:{turn,step:1,name:'Bash',arguments:JSON.stringify({command,description})}});

test('parseWaitingMarkerText inverts the synthesized marker wording',()=>{
  assert.deepEqual(parseWaitingMarkerText('后台Subagent完成：A 槽位有界复核 PLAN v5 变化锥区'),{kind:'subagent',title:'A 槽位有界复核 PLAN v5 变化锥区'});
  assert.deepEqual(parseWaitingMarkerText('后台终端命令完成：查日志后重启 web 容器并等待就绪'),{kind:'bash',title:'查日志后重启 web 容器并等待就绪'});
  assert.deepEqual(parseWaitingMarkerText('  后台Workflow完成：review run '),{kind:'workflow',title:'review run'});
  assert.equal(parseWaitingMarkerText('后台任务结果触发'),null,'generic triggers carry no identity');
  assert.equal(parseWaitingMarkerText('Goal 自动继续'),null);
  assert.equal(parseWaitingMarkerText(null),null);
});

test('waitingNoteText lists launched works, commands for bash, and the auto-resume footer',()=>{
  assert.equal(waitingNoteText([{kind:'subagent',title:'A 单点复核'}]),
    '本轮结束时仍有 1 个后台任务未交卷，等待结果中：\n已启动 后台Subagent《A 单点复核》\n完成后 agent 自动接管。');
  assert.equal(waitingNoteText([{kind:'bash',title:'容器内全量测试',command:'docker-compose exec web bun test'}]),
    '本轮结束时仍有 1 个后台任务未交卷，等待结果中：\n以后台执行命令：\n```bash\ndocker-compose exec web bun test\n```\n完成后 agent 自动接管。');
  const two=waitingNoteText([{kind:'bash',title:'x',command:'sleep 120'},{kind:'workflow',title:'review'}]);
  assert.match(two,/仍有 2 个后台任务/);
  assert.match(two,/以后台执行命令：\n```bash\nsleep 120\n```\n已启动 后台Workflow《review》/);
  const note=buildWaitingNoteEvent({turn:38,step:4,works:[{kind:'bash',title:'t'}],epoch:'ep9'});
  assert.equal(note.type,'assistant/message');
  assert.equal(note.data.turn,38);
  assert.equal(note.data.message.id,'zcode-waiting:ep9:38','the id is deterministic for re-import dedupe');
  assert.equal(note.surfaceOp,'append','surface-eligible events must carry the append marker');
  assert.deepEqual(note.data.stream.map(chunk=>chunk.chunk.type),['block-start','text-delta','block-end'],'the note embeds a minimal settled text stream');
});

test('spliceWaitingNotes inserts the note as the waiting turn final assistant message',()=>{
  const events=[
    {type:'turn/start',data:{turn:6}},
    {type:'step/start',data:{turn:6,step:2}},
    bashCall(6,'容器内全量测试','docker-compose exec web bun test'),
    {type:'turn/end',time:1791400000000,data:{turn:6}},
    ...markerEvent(7,'后台终端命令完成：容器内全量测试'),
    {type:'turn/start',data:{turn:8}},
    {type:'turn/end',data:{turn:8}},
  ];
  const out=spliceWaitingNotes(events);
  assert.equal(out.length,events.length+3,'an exclusive step wraps the note: start, message, end');
  const noteIndex=out.findIndex(event=>event?.type==='assistant/message'&&String(event.data?.message?.id??'').startsWith('zcode-waiting:'));
  const turnEndIndex=out.findIndex(event=>event?.type==='turn/end'&&event.data?.turn===6);
  assert.ok(noteIndex>0&&noteIndex<turnEndIndex,'the note is the LAST message of turn 6, before its turn/end');
  assert.deepEqual([out[noteIndex-1]?.type,out[noteIndex+1]?.type],['step/start','step/end'],'the note attaches to its own open step');
  const note=out[noteIndex];
  assert.equal(note.data.turn,6);
  assert.equal(note.data.step,3,'the note step follows the turn last real step');
  assert.match(note.data.message.content[0].text,/以后台执行命令：\n```bash\ndocker-compose exec web bun test\n```/,'the bash command is rejoined by description and fenced');
  assert.equal(note.data.message.id,'zcode-waiting:ep1:6','the epoch comes from the marker identity');
  assert.equal(note.time,1791400000000,'the note inherits the waiting turn end time — a committed event must carry time');
});

test('spliceWaitingNotes skips markers whose waiting turn is not in the batch and dedupes works',()=>{
  const events=[
    // turn 5 closed in a PREVIOUS batch: its marker here must not splice anything for it.
    ...markerEvent(6,'后台终端命令完成：旧批次任务'),
    {type:'turn/start',data:{turn:9}},
    {type:'turn/end',data:{turn:9}},
    ...markerEvent(10,'后台Subagent完成：A 槽单点复核'),
    ...markerEvent(11,'后台Subagent完成：A 槽单点复核'),
  ];
  const out=spliceWaitingNotes(events);
  const notes=out.filter(event=>event?.type==='assistant/message'&&String(event.data?.message?.id??'').startsWith('zcode-waiting:'));
  assert.equal(out.length,events.length+3,'one wrapped note per waiting turn');
  assert.equal(notes.length,1,'turn 9 gets ONE note; the stale turn-5 marker and the duplicate work are skipped');
  assert.equal(notes[0].data.turn,9);
  assert.match(notes[0].data.message.content[0].text,/已启动 后台Subagent《A 槽单点复核》/);
  assert.deepEqual(spliceWaitingNotes([]),[]);
  assert.deepEqual(spliceWaitingNotes(undefined),[]);
});
