import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forkWorld,real,writes} from './helpers/fork-compact.mjs';
import {forkBoundary,forkProjection,FORK_PROJECTION_EVENT} from '../packages/driver/fork.mjs';
const transcript=agent=>agent.session.snapshotEvents().filter(event=>['user/message','assistant/message','tool/call','tool/result'].includes(event.type));
async function tools(w){
 await w.publish('parent',s=>{const base={turnId:'tools-turn',createdAt:1,createdAtSeq:s.seq};s.rows.window.push(
  {...base,kind:'turnHeader',rowId:7,entityId:'tools-header',origin:'userInput',state:'completedSuccess',startedAt:1},
  {...base,kind:'userInput',rowId:8,entityId:'tools-user',origin:'realUser',text:'Read both files'},
  {...base,kind:'toolCall',rowId:9,entityId:'tool-a',assistantResponseId:'tools-response',toolCallId:'source-call-a',toolName:'Read',inputText:'{"path":"a"}',status:'success',output:{text:'contents a'}},
  {...base,kind:'toolCall',rowId:10,entityId:'tool-b',assistantResponseId:'tools-response',toolCallId:'source-call-b',toolName:'Read',inputText:'{"path":"b"}',status:'success',output:{text:'contents b'}},
  {...base,kind:'assistantText',rowId:11,entityId:'tools-assistant',assistantResponseId:'tools-response',text:'Both read',state:'complete',model:s.config.model,actions:{canFork:true}});s.rows.totalCount=s.rows.window.length;
 });
}
function associations(agent){
 const events=agent.session.snapshotEvents(),calls=events.filter(event=>event.type==='tool/call');
 for(const result of events.filter(event=>event.type==='tool/result')){
  assert.equal(result.data.message.toolCallId,result.data.message.source.callId);
  const call=calls.find(event=>event.data.callId===result.data.message.source.callId);assert.ok(call);assert.equal(call.data.turn,result.data.turn);assert.equal(call.data.step,result.data.step);
 }
}

test('official tool-bearing fork accepts remapped IDs, preserves exact seed and validates inherited call/result pairs',real,async()=>{
 const w=await forkWorld();try{
  await tools(w);const before=w.source.session.snapshotEvents(),parentTools=w.source.conversation.state.snapshot.rows.window.filter(row=>row.kind==='toolCall');
  const {sessionId}=await w.controller.fork({sessionId:'source'}),child=w.ctx.agents.get(sessionId);await child.ready();await child.translator.tail;
  assert.deepEqual(child.session.snapshotEvents().slice(0,child.session.inheritedEventCount),before.slice(0,child.session.inheritedEventCount));assert.deepEqual(transcript(child),transcript(w.source));associations(child);
  const childTools=child.conversation.state.snapshot.rows.window.filter(row=>row.kind==='toolCall');assert.equal(childTools.length,2);assert.equal(new Set(childTools.map(row=>row.toolCallId)).size,2);
  for(const [index,row] of childTools.entries()){assert.notEqual(row.toolCallId,parentTools[index].toolCallId);assert.equal(row.toolName,parentTools[index].toolName);assert.equal(row.inputText,parentTools[index].inputText);assert.deepEqual(row.output,parentTools[index].output)}
  const checkpoint=child.session.snapshotEvents().find(event=>event.type===FORK_PROJECTION_EVENT).data;
  assert.deepEqual(checkpoint.toolCallIds,parentTools.map((row,index)=>({from:row.toolCallId,to:childTools[index].toolCallId})));assert.deepEqual(writes(w).map(command=>command.type),['forkAssistant']);
 }finally{await w.close()}
});

test('remapped tool ID lineage survives restore and a second remapping on an inherited-boundary fork',real,async()=>{
 const w=await forkWorld();try{
  await tools(w);const {sessionId}=await w.controller.fork({sessionId:'source'}),child=w.ctx.agents.get(sessionId);await child.ready();await child.translator.tail;
  const prefix=transcript(child),firstIds=child.conversation.state.snapshot.rows.window.filter(row=>row.kind==='toolCall').map(row=>row.toolCallId),cut=child.session.snapshotEvents().findLast(event=>event.type==='turn/end').seq;
  await w.handles.get(sessionId).dispose();const {agent:restored}=await w.ctx.agents.resume({resumeSessionId:sessionId});await restored.ready();await restored.translator.tail;assert.deepEqual(transcript(restored),prefix);
  const {sessionId:grandId}=await w.controller.fork({sessionId,atSeq:cut}),grand=w.ctx.agents.get(grandId);await grand.ready();await grand.translator.tail;
  assert.deepEqual(transcript(grand),prefix);associations(grand);assert.ok(grand.conversation.state.snapshot.rows.window.filter(row=>row.kind==='toolCall').every(row=>!firstIds.includes(row.toolCallId)));assert.equal(grand.zcodeConversationId,'branch-2');
 }finally{await w.close()}
});

for(const mutation of ['duplicate-parent','duplicate-child','result-id','result-source','result-row','result-step','assistant-call','input','output','missing-id'])test(`fork tool mapping rejects ${mutation} corruption while accepting identity reassignment`,real,async()=>{
 const w=await forkWorld();try{
  await tools(w);const count=w.source.session.snapshotEvents().findLast(event=>event.type==='turn/end').seq+1,prefix=w.source.session.snapshotEvents().slice(0,count),options={meta:{isSeeded:true,parentSession:'source',cwd:'/workspace'},inheritedEventCount:count,seed:[...prefix,{type:'session/end-seed',seq:count,data:{inherited:true}}]};
  const originalBinding=forkBoundary(w.source,options),binding={...originalBinding,prefix:structuredClone(originalBinding.prefix)},source=structuredClone(binding.snapshot.rows.window),branch=source.map(row=>({...structuredClone(row),rowId:row.rowId+100,entityId:'child-'+row.entityId,turnId:'child-'+row.turnId,...(row.kind==='toolCall'?{toolCallId:'child-'+row.toolCallId}:{})}));
  assert.doesNotThrow(()=>forkProjection(binding,source,branch,{logEpoch:'child-epoch'}));
  const calls=branch.filter(row=>row.kind==='toolCall'),event=binding.prefix.find(event=>event.type==='tool/result');
  if(mutation==='duplicate-parent')source.filter(row=>row.kind==='toolCall')[1].toolCallId=source.filter(row=>row.kind==='toolCall')[0].toolCallId;
  if(mutation==='duplicate-child')calls[1].toolCallId=calls[0].toolCallId;
  if(mutation==='result-id')event.data.message.toolCallId='other-call';
  if(mutation==='result-source')event.data.message.source.callId='other-call';
  if(mutation==='result-row')event.data.zcode.rowKey=JSON.stringify([binding.snapshot.logEpoch,10]);
  if(mutation==='result-step')event.data.step++;
  if(mutation==='assistant-call')binding.prefix.find(event=>event.type==='assistant/message'&&event.data.message.content.some(block=>block.type==='tool-call')).data.message.content.find(block=>block.type==='tool-call').id='other-call';
  if(mutation==='input')calls[0].inputText='{"path":"changed"}';
  if(mutation==='output')calls[0].output.text='changed output';
  if(mutation==='missing-id')delete calls[0].toolCallId;
  assert.throws(()=>forkProjection(binding,source,branch,{logEpoch:'child-epoch'}),{code:'guard.forkTargetAmbiguous'});
 }finally{await w.close()}
});
