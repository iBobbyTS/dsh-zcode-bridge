import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PassThrough} from 'node:stream';
import {ProtocolPeer} from '../packages/host/protocol.mjs';
import {V4Conversation,newCommandId} from '../packages/host/conversation.mjs';
import {requestWorkflow} from '../packages/host/workflow.mjs';
import {RemoteConversation} from '../packages/client/remote-conversation.mjs';
const load=name=>JSON.parse(readFileSync(`tests/fixtures/s12/${name}.json`));
const lifecycle=load('lifecycle'),empty=load('empty');
const tick=()=>new Promise(r=>setTimeout(r,5));
function owner({runnable=false,managementAllowed=true,timeoutMs=80}={}){
 const input=new PassThrough(),output=new PassThrough(),sent=[];output.on('data',b=>sent.push(JSON.parse(b)));
 const peer=new ProtocolPeer(input,output,{timeoutMs});
 const conversation=new V4Conversation(peer,{address:{runtime:'zcode',authority:'fixture',workspace:'/fixture/workspace',sessionId:'fixture-session'},workspace:{workspacePath:'/fixture/workspace',workspaceKey:'/fixture/workspace'},clientId:'fixture',connectionId:'fixture',runnable,managementAllowed});
 const reply=(request,result)=>input.write(JSON.stringify({id:request.id,result})+'\n');
 const wire=frame=>input.write(JSON.stringify({method:'v4/conversation/frame',params:frame})+'\n');
 async function open(){const p=conversation.connect();reply(sent.at(-1),lifecycle.ack);wire(lifecycle.initial);await p;assert.equal(conversation.state.status,'live')}
 return {conversation,peer,input,sent,reply,wire,open,close:()=>peer.close()};
}

test('S12 management uses official workspace and explicit scope; same names stay distinct',async()=>{
 const f=owner();try{await f.open();for(const scope of ['project','global']){
 const p=f.conversation.workflowManage('get',{name:'review',scope});const q=f.sent.at(-1);
 assert.equal(q.method,'workflows/get');assert.deepEqual(q.params,{name:'review',scope,workspace:f.conversation.workspace});
 f.reply(q,{...lifecycle.definition,scope});assert.equal((await p).scope,scope);
 }assert.equal(f.conversation.state.admission.allowed,false);assert.equal(f.conversation.state.workflowAdmission.reads.allowed,true)}finally{f.close()}
});
test('S12 metadata writes, delete, move and history preserve formal results including expired identity',async()=>{
 const f=owner();try{await f.open();for(const [kind,params,result] of [
 ['updateMeta',{name:'missing',scope:'global',meta:{description:'edit'}},empty.rejections.metaUnknown],
 ['delete',{name:'missing',scope:'project'},empty.rejections.deleteUnknown],
 ['move',{name:'missing'},empty.rejections.moveUnknown],['runs',{limit:50,scope:'project'},{runs:[],truncated:true}],['list',{scope:'global'},empty.global],
 ]){const p=f.conversation.workflowManage(kind,params);const q=f.sent.at(-1);assert.equal(q.method,`workflows/${kind}`);f.reply(q,result);assert.deepEqual(await p,result)}}finally{f.close()}
});
test('S12 all seven journal read carriers are session-scoped, validated and reachable without model admission',async()=>{
 const f=owner();try{await f.open();for(const [kind,params,result] of [
 ['runs',{limit:64},{runs:[{runId:'fixture-run',status:'stopped',resumable:true,stopReason:'interrupted'}]}],
 ['runEvents',{runId:'fixture-run',afterSequence:0,limit:100},lifecycle.events],
 ['runArtifacts',{runId:'fixture-run'},lifecycle.artifacts],
 ['runArtifactData',{runId:'fixture-run',artifactId:'report',limit:100},lifecycle.data],
 ['runArtifactRead',{runId:'fixture-run',artifactId:'report',version:1,offset:0,limit:64*1024},lifecycle.content],
 ['runWorkspace',{runId:'fixture-run'},lifecycle.workspace],
 ['runNodeResult',{runId:'fixture-run',siteId:'read#1',ordinal:0},lifecycle.nodeResult],
 ]){const p=f.conversation.workflowRead(kind,params);const q=f.sent.at(-1);assert.equal(q.params.sessionId,'fixture-session');assert.equal(q.method,`v4/conversation/workflow${kind[0].toUpperCase()+kind.slice(1)}`);f.reply(q,result);assert.deepEqual(await p,result)}}finally{f.close()}
});
test('S12 unknown kinds, absent save/graph, foreign identity and malformed params fail closed before wire',async()=>{
 const f=owner();try{await f.open();const count=f.sent.length;for(const [kind,params,manage] of [
 ['save',{},true],['graph',{},true],['__proto__',{},false],['get',{name:'x',workspace:{workspacePath:'/foreign'}},true],['runs',{sessionId:'foreign'},false],['runArtifacts',{runId:'r',path:'/secret'},false],['runArtifactRead',{runId:'r',artifactId:'a',version:1,offset:0,limit:99999999},false],
 ])await assert.rejects(manage?f.conversation.workflowManage(kind,params):f.conversation.workflowRead(kind,params),/workflow-(carrier-unavailable|params-invalid)/);assert.equal(f.sent.length,count)}finally{f.close()}
});
test('S12 invalid nested result/unknown artifact type and wrong get identity are visible errors',async()=>{
 const f=owner();try{await f.open();let p=f.conversation.workflowRead('runArtifacts',{runId:'r'});f.reply(f.sent.at(-1),{artifacts:[{...lifecycle.artifacts.artifacts[0],kind:'future-kind'}]});await assert.rejects(p,/workflow-result-invalid/);
 p=f.conversation.workflowManage('get',{name:'review',scope:'global'});f.reply(f.sent.at(-1),lifecycle.definition);await assert.rejects(p,/workflow-result-identity-mismatch/);
 p=f.conversation.workflowRead('runArtifactRead',{runId:'r',artifactId:'report',version:1,offset:0,limit:4});f.reply(f.sent.at(-1),lifecycle.content);await assert.rejects(p,/workflow-result-invalid/);
 }finally{f.close()}
});
test('S12 restricted start/resume/amend reject before wire; settings restart is gated',async()=>{
 const f=owner();try{await f.open();const count=f.sent.length;for(const [type,payload] of [['startSavedWorkflow',{name:'review',scope:'project'}],['resumeWorkflowRun',{workId:'fixture-run'}],['amendWorkflowRunSettings',{workId:'fixture-run',subagentModel:null,maxConcurrency:null}]])await assert.rejects(f.conversation.submit({type,payload}),/runtime-restricted/);
 assert.equal(f.sent.length,count);assert.equal(f.conversation.state.workflowAdmission.save.allowed,false)}finally{f.close()}
});
test('S12 verified command fixtures preserve ACK failure and settings tri-state payload without completing runs',async()=>{
 const f=owner({runnable:true});try{await f.open();for(const [type,payload] of [['startSavedWorkflow',{name:'missing',scope:'global'}],['resumeWorkflowRun',{workId:'missing'}],['amendWorkflowRunSettings',{workId:'missing',maxConcurrency:null,subagentModel:null}]]){
 const p=f.conversation.submit({type,payload});const q=f.sent.at(-1);assert.deepEqual(q.params.payload,payload);assert.equal(q.params.baseRevision,undefined);
 f.reply(q,{...empty.rejections[type],commandId:q.params.commandId});const record=await p;assert.equal(record.state,'failed');assert.match(record.ack.reasonCode,/not_found$/);
 }}finally{f.close()}
});
test('S12 lost start ACK is outcome unknown; query uses same id and never resends',async()=>{
 const f=owner({runnable:true,timeoutMs:25});try{await f.open();const id=newCommandId();const p=f.conversation.submit({type:'startSavedWorkflow',payload:{name:'fixture'},commandId:id});assert.equal((await p).state,'outcome-unknown');
 const query=f.conversation.queryCommand(id);const q=f.sent.at(-1);assert.equal(q.method,'v4/commands/query');f.reply(q,{results:[{key:{sessionId:'fixture-session',commandId:id},result:'unknown'}]});assert.equal((await query).state,'outcome-unknown');assert.equal(f.sent.filter(q=>q.method==='v4/command').length,1)}finally{f.close()}
});
test('S12 sent write timeout/abort is outcome unknown; a read abort is cancellation',async()=>{
 const f=owner({timeoutMs:25});try{await f.open();await assert.rejects(f.conversation.workflowManage('updateMeta',{name:'review',meta:{description:'edited'}}),/workflow-outcome-unknown/);
 const abort=new AbortController();const p=f.conversation.workflowManage('delete',{name:'review'},{signal:abort.signal});abort.abort();await assert.rejects(p,/workflow-outcome-unknown/);
 const readAbort=new AbortController();const read=f.conversation.workflowRead('runs',{}, {signal:readAbort.signal});readAbort.abort();await assert.rejects(read,/cancelled/)}finally{f.close()}
});
test('S12 late read reply after owner closes cannot be consumed',async()=>{
 const f=owner();try{await f.open();const p=f.conversation.workflowRead('runs',{});const request=f.sent.at(-1);const cancel=f.conversation.cancel();const unsubscribe=f.sent.at(-1);f.reply(unsubscribe,{});f.reply(request,{runs:[]});await assert.rejects(p,/workflow-owner-replaced/);await cancel;assert.equal(f.conversation.state.status,'closed')}finally{f.close()}
});
test('S12 old subscription workflow notifications cannot replace current run identity',async()=>{
 const f=owner();try{await f.open();const late=structuredClone(lifecycle.initial);late.subscriptionId='retired-sub';late.frame.subscriptionId='retired-sub';late.frame.payload.snapshot.workflowRuns.runs=[lifecycle.completed];f.wire(late);await tick();assert.equal(f.conversation.state.snapshot.workflowRuns.runs[0].status,'running')}finally{f.close()}
});
test('S12 cancellation ACK waits for workflow projection; observed interrupted/stopped is authoritative',async()=>{
 const f=owner();try{await f.open();const p=f.conversation.submit({type:'cancelBackgroundWork',payload:{workId:'fixture-run'}});const q=f.sent.at(-1);f.reply(q,{commandId:q.params.commandId,status:'accepted',revisionAtDecision:0});assert.equal((await p).state,'running');
 const next=structuredClone(lifecycle.initial);next.deliveryKind='online';next.logicalFrameId+='next';next.logicalFrameOrdinal=2;next.frame.toSeq=1;next.frame.payload.snapshot.seq=1;next.frame.payload.snapshot.workflowRuns.runs=[lifecycle.stopped];f.wire(next);await tick();assert.equal(f.conversation.command(q.params.commandId).state,'completed');assert.equal(f.conversation.state.snapshot.workflowRuns.runs[0].resumable,true)}finally{f.close()}
});
test('S12 read failure and write admission never imply a saved definition or available runtime',async()=>{
 const f=owner({managementAllowed:false});try{await f.open();await assert.rejects(f.conversation.workflowManage('delete',{name:'x'}),/management-unverified/);const p=f.conversation.workflowRead('runArtifactRead',{runId:'foreign',artifactId:'a',version:1,offset:0,limit:1024});f.input.write(JSON.stringify({id:f.sent.at(-1).id,error:{code:-32603,message:'not authorized'}})+'\n');await assert.rejects(p,e=>e.protocolCode===-32603);assert.equal(f.conversation.state.admission.allowed,false)}finally{f.close()}
});
test('S12 remote carrier sends only handle, kind and params; model command remains a server decision',async()=>{
 const calls=[];const rpc={call:async(_channel,_endpoint,payload)=>{calls.push(payload);return {ok:true,value:payload.operation==='open'?{handle:'owned',state:{status:'live',commands:[]}}:{runs:[]}}}};
 const remote=new RemoteConversation(rpc,{runtime:'zcode',authority:'a',workspace:'w',sessionId:'s'});try{await remote.connect();await remote.workflowRead('runs',{});assert.deepEqual(calls.at(-1),{operation:'workflowRead',handle:'owned',kind:'runs',params:{}});await remote.workflowManage('get',{name:'same',scope:'global'});assert.equal(calls.at(-1).params.scope,'global')}finally{await remote.cancel()}
});
test('S12 direct request does not accept array params or unknown prototypes',async()=>{
 const peer={request:()=>assert.fail('unexpected wire')};await assert.rejects(requestWorkflow(peer,{kind:'runs',params:[],sessionId:'s'}),/workflow-params-invalid/);await assert.rejects(requestWorkflow(peer,{kind:'constructor',sessionId:'s'}),/workflow-carrier-unavailable/);
});

test('S12 start/amend follow only ACK run identity; resumed incarnation requires newer journal watermarks',async()=>{
 const f=owner({runnable:true});try{await f.open();
 let p=f.conversation.submit({type:'amendWorkflowRunSettings',payload:{workId:'fixture-run',maxConcurrency:2}});let q=f.sent.at(-1);f.reply(q,{commandId:q.params.commandId,status:'accepted',revisionAtDecision:0,result:{type:'amendWorkflowRunSettings',runId:'fixture-successor',toolCallId:'fixture-new-tool',supersededRunId:'fixture-run'}});assert.equal((await p).state,'accepted-awaiting-terminal');
 function update(runs,seq){const frame=structuredClone(lifecycle.initial);frame.deliveryKind='online';frame.logicalFrameId+=seq;frame.logicalFrameOrdinal=seq+1;frame.frame.toSeq=seq;frame.frame.payload.snapshot.seq=seq;frame.frame.payload.snapshot.workflowRuns.runs=runs;f.wire(frame)}
 update([lifecycle.completed],1);await tick();assert.equal(f.conversation.command(q.params.commandId).state,'accepted-awaiting-terminal');
 update([lifecycle.completed,lifecycle.successor],2);await tick();assert.equal(f.conversation.command(q.params.commandId).state,'running');
 update([lifecycle.stopped],3);await tick();p=f.conversation.submit({type:'resumeWorkflowRun',payload:{workId:'fixture-run'}});q=f.sent.at(-1);f.reply(q,{commandId:q.params.commandId,status:'accepted',revisionAtDecision:0});assert.equal((await p).state,'accepted-awaiting-terminal');
 update([{...lifecycle.running,lastEventSequence:6}],4);await tick();assert.equal(f.conversation.command(q.params.commandId).state,'running');update([{...lifecycle.completed,lastEventSequence:7}],5);await tick();assert.equal(f.conversation.command(q.params.commandId).state,'completed');
 }finally{f.close()}
});
test('S12 accepted workflow result with wrong command type remains outcome unknown',async()=>{
 const f=owner({runnable:true});try{await f.open();const p=f.conversation.submit({type:'startSavedWorkflow',payload:{name:'fixture'}});const q=f.sent.at(-1);f.reply(q,{commandId:q.params.commandId,status:'accepted',revisionAtDecision:0,result:{type:'amendWorkflowRunSettings',runId:'other',toolCallId:'other'}});assert.equal((await p).state,'outcome-unknown')}finally{f.close()}
});

test('S12 all six official artifact kinds preserve metadata; binary/file paths stay opaque',async()=>{
 const f=owner();try{await f.open();const p=f.conversation.workflowRead('runArtifacts',{runId:'fixture-run'});f.reply(f.sent.at(-1),{artifacts:Object.values(lifecycle.artifactKinds)});const list=await p;assert.deepEqual(list.artifacts.map(a=>a.kind),['file','markdown','chart','table','metrics','board']);assert.equal(list.artifacts[0].sourcePath,'output/report.bin')}finally{f.close()}
});
