import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forkWorld,real,writes,tick} from './helpers/fork-compact.mjs';
import {forkProjection,FORK_PROJECTION_EVENT} from '../packages/driver/fork.mjs';

// SOURCE_INSPECTED: v4.mjs:2009-2174 freezes the nine row kinds. The four
// projection cards below are not user/assistant/tool transcript events in the
// driver translator. product-projection.ts:4601-4632 emits compact markers.
const cards={
 timelineMarker:{kind:'timelineMarker',lane:'assistantWork',marker:{type:'compact',origin:'manual',status:'success',tokensBefore:100,tokensAfter:20,summaryRef:'summary-ref'}},
 hookInvocation:{kind:'hookInvocation',hookInvocationId:'hook-invocation',hookEventName:'UserPromptSubmit',hookCount:1,state:'completed',startedAt:1,endedAt:2,durationMs:1,lane:'assistantWork',executions:[{hookRunId:'hook-run',hookIndex:0,didExecute:true,state:'completed',outcome:'success',startedAt:1,endedAt:2,durationMs:1,displayName:'Prompt hook',sourceKind:'project'}]},
 artifact:{kind:'artifact',artifactVersionId:'artifact-version',logicalArtifactKey:'artifact-key',displayName:'Report',artifactType:'text',mimeType:'text/plain',sizeBytes:3,sha256:'a'.repeat(64),ref:'artifact-ref',state:'current'},
 subagent:{kind:'subagent',parentToolCallId:'parent-tool',subagentType:'default',status:'success',summaryText:'Subagent completed',childSessionId:'subagent-session'},
};
const transcript=agent=>agent.session.snapshotEvents().filter(event=>['user/message','assistant/message','tool/call','tool/result'].includes(event.type));
const card=(kind,rowId,turnId='turn-1',createdAtSeq=1)=>({rowId,entityId:kind+'-'+rowId,turnId,createdAt:1,createdAtSeq,...structuredClone(cards[kind])});

for(const kind of Object.keys(cards))test(`official fork accepts a canFork prefix containing ${kind}, with unchanged inherited transcript`,real,async()=>{
 const w=await forkWorld();try{
  await w.publish('parent',s=>{s.rows.window.push(card(kind,7));s.rows.totalCount=s.rows.window.length});
  assert.equal(w.source.conversation.state.status,'live','vendored parser must accept the card fixture');assert.equal(w.source.conversation.state.snapshot.rows.window.find(row=>row.rowId===6).actions.canFork,true);
  const before=transcript(w.source),{sessionId}=await w.controller.fork({sessionId:'source'}),child=w.ctx.agents.get(sessionId);await child.ready();await child.translator.tail;
  assert.deepEqual(transcript(child),before);assert.equal(child.zcodeConversationId,'branch-1');assert.ok(child.conversation.state.snapshot.rows.window.some(row=>row.kind===kind));assert.deepEqual(writes(w).map(command=>command.type),['forkAssistant']);
  const projection=child.session.snapshotEvents().find(event=>event.type===FORK_PROJECTION_EVENT).data;
  assert.equal(projection.users.length,2);assert.equal(projection.responses.length,2);
 }finally{await w.close()}
});

test('real compact shadow completes, then an official fork after the next successful turn inherits the compact timeline marker',real,async()=>{
 const w=await forkWorld();try{
  const pending=w.commands.execute(w.source,'/compact',[],new AbortController().signal);await tick();const command=writes(w).at(-1);assert.equal(command.type,'compact');
  await w.publish('parent',s=>{
   const turnId='compact-turn',base={turnId,createdAt:1,createdAtSeq:s.seq};
   s.rows.window.push({...base,kind:'turnHeader',rowId:7,entityId:'compact-header',origin:'userInput',executionKind:'controlOnly',state:'completedSuccess',startedAt:1,sourceCommandId:command.commandId},card('timelineMarker',8,turnId,s.seq));s.rows.totalCount=s.rows.window.length;
  });assert.equal((await pending).result.kind,'success');
  await w.publish('parent',s=>{
   const base={turnId:'after-compact',createdAt:2,createdAtSeq:s.seq};s.rows.window.push(
    {...base,kind:'turnHeader',rowId:9,entityId:'after-compact-header',origin:'userInput',state:'completedSuccess',startedAt:2},
    {...base,kind:'userInput',rowId:10,entityId:'after-compact-user',origin:'realUser',text:'Continue after compact'},
    {...base,kind:'assistantText',rowId:11,entityId:'after-compact-assistant',state:'complete',text:'Post-compact answer',model:s.config.model,actions:{canFork:true}});s.rows.totalCount=s.rows.window.length;
  });
  const prefix=transcript(w.source),{sessionId}=await w.controller.fork({sessionId:'source'}),child=w.ctx.agents.get(sessionId);await child.ready();await child.translator.tail;
  assert.deepEqual(transcript(child),prefix);assert.ok(child.conversation.state.snapshot.rows.window.some(row=>row.kind==='timelineMarker'&&row.marker.type==='compact'));assert.equal(writes(w).at(-1).payload.target.rowId,11);assert.equal(child.zcodeConversationId,'branch-1');
 }finally{await w.close()}
});

function proof(){
 const base={turnId:'turn-1',createdAt:1,createdAtSeq:1};
 const source=[{...base,kind:'turnHeader',rowId:1,entityId:'header',origin:'userInput',state:'completedSuccess',startedAt:1},{...base,kind:'userInput',rowId:2,entityId:'user',origin:'realUser',text:'Question'},{...base,kind:'assistantText',rowId:3,entityId:'assistant',text:'Answer',state:'complete',actions:{canFork:true}}];
 const prefix=[{type:'turn/start',data:{turn:1,zcode:{turnKey:JSON.stringify(['source-epoch','turn-1'])}}},{type:'user/message',data:{turn:1,content:[{type:'text',text:'Question'}],zcode:{rowKey:JSON.stringify(['source-epoch',2])}}},{type:'assistant/message',data:{turn:1,zcode:{responseKey:JSON.stringify(['source-epoch',3]),rows:[source[2]]}}}];
 const binding={prefix,resolve:(_kind,key,rows)=>({key,rows})},branch=source.map(row=>({...structuredClone(row),rowId:row.rowId+100,entityId:'branch-'+row.entityId,turnId:'child-turn'}));
 return {source,branch,binding,snapshot:{logEpoch:'child-epoch'}};
}

test('symmetric transcript views pair identities even when projection cards occupy different positions on either side',()=>{
 const w=proof(),source=[w.source[0],card('hookInvocation',4),w.source[1],card('timelineMarker',5),w.source[2]],branch=[card('artifact',104,'child-turn'),w.branch[0],w.branch[1],w.branch[2],card('subagent',105,'child-turn')];
 const result=forkProjection(w.binding,source,branch,w.snapshot);
 assert.deepEqual(result.users,[{from:JSON.stringify(['source-epoch',2]),to:JSON.stringify(['child-epoch',102])}]);assert.deepEqual(result.responses[0].rows,[w.branch[2]]);assert.equal(result.turns[0].to,JSON.stringify(['child-epoch','child-turn']));
});

for(const mutation of ['text','missing','extra','order','turn','retyped','unknown'])test(`projection cards cannot hide a ${mutation} transcript mismatch`,()=>{
 const w=proof();w.source.splice(1,0,card('timelineMarker',4));w.branch.splice(1,0,card('hookInvocation',104,'child-turn'));
 const user=w.branch.find(row=>row.kind==='userInput');
 if(mutation==='text')user.text='Changed question';
 if(mutation==='missing')w.branch=w.branch.filter(row=>row.kind!=='assistantText');
 if(mutation==='extra')w.branch.push({...w.branch.at(-1),rowId:110,entityId:'extra-assistant'});
 if(mutation==='order')w.branch.reverse();
 if(mutation==='turn')user.turnId='other-turn';
 if(mutation==='retyped')Object.assign(user,cards.timelineMarker);
 if(mutation==='unknown')w.branch.push({...card('timelineMarker',110,'child-turn'),kind:'futureRow'});
 assert.throws(()=>forkProjection(w.binding,w.source,w.branch,w.snapshot),{code:'guard.forkTargetAmbiguous'});
});

test('absent user row text or identity still fails with an explicit guard, never a property access exception',()=>{
 for(const missing of ['text','identity']){
  const w=proof();if(missing==='text'){delete w.source[1].text;delete w.branch[1].text}else w.binding.prefix[1].data.zcode.rowKey=JSON.stringify(['source-epoch',999]);
  assert.throws(()=>forkProjection(w.binding,w.source,w.branch,w.snapshot),{code:'guard.forkTargetAmbiguous'});
 }
});
