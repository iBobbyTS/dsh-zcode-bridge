import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { readFileSync } from 'node:fs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { HostTools } from '../packages/host/host-tools.mjs';
import { CatalogClient } from '../packages/host/catalog.mjs';
import { conversationTopicFrameSchema } from '../packages/host/vendor/zcode/v4.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
const lifecycle=JSON.parse(readFileSync('tests/fixtures/browser-computer-use/lifecycle.json','utf8'));
const empty=JSON.parse(readFileSync('tests/fixtures/browser-computer-use/empty.json','utf8'));
const official=JSON.parse(readFileSync('tests/fixtures/browser-computer-use/official.json','utf8'));
const workspace={workspacePath:'/fixture/browser-workspace',workspaceKey:'/fixture/browser-workspace'};
const tick=()=>new Promise(r=>setTimeout(r,10));
function fixture({browserExecutor,timeoutMs=200}={}){
 const input=new PassThrough(),output=new PassThrough(),sent=[];
 output.on('data',b=>sent.push(JSON.parse(b.toString())));
 const peer=new ProtocolPeer(input,output,{timeoutMs}),catalog=new CatalogClient(peer,{workspace}),host=new HostTools(peer,{workspace,catalog,browserExecutor});
 const wire=m=>input.write(JSON.stringify(m)+'\n');
 return {peer,host,sent,wire,output,dispose:()=>{peer.close();catalog.dispose();host.dispose()}};
}

test('Browser computer use capture distinguishes real registration, actual reverse prefs, absent executor and reverse direction',()=>{
 assert.equal(official.status,'PASS');assert.equal(official.provenance.paidModelCalls,0);
 assert.equal(official.probes.cuaSdkSelfCheck.result.setup,'unavailable');assert.equal(official.packagedCua.helper.present,true);assert.equal(official.packagedCua.helper.launched,false);
 assert.equal(empty.plugins.plugins.find(p=>p.name==='browser-use').enabled,true);
 assert.equal(empty.plugins.plugins.some(p=>p.id==='zcode-cua@zcode-plugins-official'),false);
 assert.deepEqual(empty.mcpStatus.statuses,{});
 assert.equal(official.probes.browserListOutbound.error.protocolCode,-32601);
 assert.equal(official.probes.browserExecuteOutbound.error.protocolCode,-32601);
 assert.equal(official.reverseRequests.some(r=>r.method==='session/requestRuntimePreferences'),true);
 assert.equal(official.reverseRequests.some(r=>r.method.startsWith('interaction/browser')),false);
 for(const carrier of Object.values(official.installedCarrierStrings))assert.ok(carrier.offset>0);
});

test('Browser computer use production fallback responds on the same official reverse id, never fabricates an executable backend',async()=>{
 const f=fixture();try{
 f.wire(lifecycle.requests.list);f.wire(lifecycle.requests.execute);await tick();
 assert.deepEqual(f.sent.find(m=>m.id===lifecycle.requests.list.id).result,{browsers:[]});
 assert.deepEqual(f.sent.find(m=>m.id===lifecycle.requests.execute.id).result,lifecycle.results.missing);
 const state=f.host.snapshot('browser-session');assert.equal(state.browser.state,'gated');assert.equal(state.computer.permissions,'unknown');assert.equal(state.records[1].status,'failed');assert.equal(state.records[1].reason,'backend_unavailable');
 assert.equal(f.peer.reversePendingCount,0);
 }finally{f.dispose()}
});

test('Browser computer use callback params reject malformed/foreign workspace and do not invoke an executor',async()=>{
 let calls=0;const f=fixture({browserExecutor:{execute:()=>{calls++;return lifecycle.results.screenshot}}});try{
 for(const [i,params] of [{...lifecycle.requests.execute.params,command:{method:'future'}},{...lifecycle.requests.execute.params,workspacePath:'/foreign'},{...lifecycle.requests.execute.params,workspaceIdentity:'foreign'},{...lifecycle.requests.list.params,unexpected:true}].entries())f.wire({id:'invalid-'+i,method:i===3?'interaction/browserList':'interaction/browserExecute',params});
 await tick();assert.equal(calls,0);assert.equal(f.sent.length,4);for(const m of f.sent)assert.equal(m.error.code,-32602);
 assert.equal(f.host.snapshot('browser-session').records.length,2);for(const record of f.host.snapshot('browser-session').records){assert.equal(record.status,'rejected');assert.equal(record.protocolCode,-32602)}
 }finally{f.dispose()}
});

test('Browser computer use reverse callbacks cannot satisfy forward requests even when ids collide; auth fallback remains closed',async()=>{
 const f=fixture();try{
 const forward=f.peer.request('fixture/read',{});const outgoing=f.sent[0];f.wire({...lifecycle.requests.execute,id:outgoing.id});await tick();assert.equal(f.peer.pendingCount,1);
 f.wire({id:outgoing.id,result:{read:true}});assert.deepEqual(await forward,{read:true});
 f.wire({id:'auth-fixture',method:'interaction/requestProviderRuntimeHeaders',params:{requestId:'auth',sessionId:'browser-session',providerId:'fixture',modelSelection:{},workspace:{}}});await tick();assert.equal(f.sent.at(-1).result.headersApplied,false);
 }finally{f.dispose()}
});

test('Browser computer use validated executor-result seam preserves exact browser target and image, but stays unverified',async()=>{
 const f=fixture({browserExecutor:{execute:async p=>{assert.equal(p.browserId,'iab:fixture');assert.equal(p.browserGeneration,7);return lifecycle.results.screenshot}}});try{
 f.wire(lifecycle.requests.execute);await tick();assert.deepEqual(f.sent[0].result,lifecycle.results.screenshot);
 const state=f.host.snapshot('browser-session');assert.equal(state.browser.state,'gated');assert.equal(state.browser.executionVerified,false);assert.equal(state.records[0].result.meta.browserId,'iab:fixture');assert.ok(state.records[0].result.image);
 }finally{f.dispose()}
});

test('Browser computer use official structured target-closed/permission/cancel failures stay failures and retain reason/uncertainty',async()=>{
 for(const result of [lifecycle.results.targetClosed,lifecycle.results.permissionDenied,lifecycle.results.cancelled]){
 const f=fixture({browserExecutor:{execute:async()=>result}});try{f.wire(lifecycle.requests.execute);await tick();assert.deepEqual(f.sent[0].result,result);const record=f.host.snapshot('browser-session').records[0];assert.equal(record.status,'failed');assert.equal(record.result.error.code,result.error.code);assert.equal(record.result.error.sideEffect,result.error.sideEffect)}finally{f.dispose()}
 }
});

test('Browser computer use B05 timeout reports an unknown outcome, aborts waiter, discards late success and never retries',async()=>{
 let resolve,signal,calls=0;const f=fixture({timeoutMs:20,browserExecutor:{execute:(_,{signal:s})=>{calls++;signal=s;return new Promise(r=>resolve=r)}}});try{
 f.wire(lifecycle.requests.execute);await new Promise(r=>setTimeout(r,40));assert.equal(f.sent[0].error.code,-32000);assert.equal(signal.aborted,true);assert.equal(f.host.snapshot('browser-session').records[0].status,'outcome-unknown');assert.equal(f.peer.reversePendingCount,0);
 resolve(lifecycle.results.screenshot);await tick();assert.equal(f.sent.length,1);assert.equal(calls,1);assert.equal(f.host.snapshot('browser-session').records[0].status,'outcome-unknown');
 }finally{f.dispose()}
});

test('Browser computer use transport failure after dispatch keeps unknown outcome and isolates a successor owner',async()=>{
 let resolve;const f=fixture({browserExecutor:{execute:()=>new Promise(r=>resolve=r)}});f.wire(lifecycle.requests.execute);await tick();f.peer.close('transport-eof');assert.equal(f.host.snapshot('browser-session').records[0].status,'outcome-unknown');
 const successor=fixture();try{resolve(lifecycle.results.screenshot);await tick();assert.equal(f.sent.length,0);assert.equal(successor.host.snapshot('browser-session').records.length,0);assert.equal(successor.host.snapshot('browser-session').browser.state,'gated')}finally{f.dispose();successor.dispose()}
});

test('Browser computer use invalid or thrown executor results reject instead of manufacturing success',async()=>{
 for(const execute of [async()=>({ok:true}),async()=>{throw Error('private executor diagnostic')}]){
 const f=fixture({browserExecutor:{execute}});try{f.wire(lifecycle.requests.execute);await tick();assert.equal(f.sent[0].error.code,-32603);assert.equal(f.host.snapshot('browser-session').records[0].status,'rejected');assert.equal(JSON.stringify(f.sent).includes('private executor diagnostic'),false)}finally{f.dispose()}
 }
});

test('Browser computer use CUA event/permission observations are scoped, deduplicated and do not claim tool execution',async()=>{
 const f=fixture();try{
 for(const m of Object.values(lifecycle.notifications))f.wire(m);f.wire(lifecycle.notifications.permission);f.wire({method:'computer-use/operation-event',params:{...lifecycle.notifications.scheduled.params,kind:'future'}});
 await tick();const state=f.host.snapshot('browser-session');assert.equal(state.records.length,4);assert.equal(state.records[0].event.computerUse,true);assert.equal(state.records[1].event.computerUse,undefined);assert.equal(state.records[3].event.permissionStatus.accessibility,'denied');assert.equal(state.computer.state,'gated');assert.deepEqual(f.host.snapshot('another-session').records,[]);assert.equal(f.sent.length,0);
 }finally{f.dispose()}
});

test('Browser computer use record retention is bounded and peer release removes callbacks and ignores late notifications',async()=>{
 const f=fixture();for(let i=0;i<80;i++)f.wire({...lifecycle.notifications.scheduled,params:{...lifecycle.notifications.scheduled.params,eventId:'bounded-'+i}});await tick();assert.equal(f.host.snapshot('browser-session').records.length,32);f.dispose();f.wire(lifecycle.notifications.permission);assert.equal(f.host.snapshot('browser-session').records.length,32);assert.equal(f.host.snapshot('browser-session').observation.allowed,false);
});

test('Browser computer use registration uses fresh official scoped catalogs, with no connect/enable/model side effects',async()=>{
 const f=fixture();try{
 const reading=f.host.registration();await tick();assert.deepEqual(f.sent.map(m=>m.method),['plugins/list','mcp/list']);for(const m of f.sent){assert.deepEqual(m.params.workspace,workspace);f.wire({id:m.id,result:m.method==='plugins/list'?empty.plugins:empty.mcpStatus})}
 const result=await reading;assert.equal(result.plugins.length,2);assert.equal(result.plugins.find(p=>p.id.startsWith('browser-use')).enabled,true);assert.deepEqual(result.mcpStatuses,{});assert.equal(f.host.snapshot('browser-session').browser.state,'gated');
 }finally{f.dispose()}
});

test('Browser computer use conversation observation survives restricted model admission and releases its own listener',async()=>{
 const f=fixture();const owner=new V4Conversation(f.peer,{address:{runtime:'zcode',authority:'fixture',workspace:workspace.workspacePath,sessionId:'browser-session'},workspace,clientId:'fixture',connectionId:'fixture',hostTools:f.host});
 try{assert.equal(owner.state.admission.allowed,false);assert.equal(owner.state.hostTools.browser.state,'gated');await assert.rejects(owner.hostRegistration(),e=>e.code==='projection-unconfirmed');let changes=0;owner.subscribe(()=>changes++);f.wire(lifecycle.notifications.scheduled);await tick();assert.equal(owner.state.hostTools.records.length,1);assert.ok(changes>0);await owner.cancel();const before=changes;f.wire(lifecycle.notifications.permission);await tick();assert.equal(changes,before)}finally{f.dispose()}
});


test('Browser computer use response queued behind backpressure remains pending and becomes unknown on disconnect',async()=>{
 const f=fixture();try{
 const write=f.output.write.bind(f.output);f.output.write=(...args)=>{write(...args);return false};
 const forward=f.peer.request('fixture/block',{}).catch(()=>{});f.wire(lifecycle.requests.execute);await tick();
 assert.equal(f.sent.length,1);assert.equal(f.host.snapshot('browser-session').records[0].status,'pending');assert.ok(f.peer.queuedBytes>0);
 f.peer.close('transport-eof');await forward;assert.equal(f.host.snapshot('browser-session').records[0].status,'outcome-unknown');assert.equal(f.sent.length,1);
 }finally{f.dispose()}
});

test('Browser computer use draining a queued reverse response records its actual write once',async()=>{
 const f=fixture();try{
 const write=f.output.write.bind(f.output);f.output.write=(...args)=>{write(...args);return false};
 const forward=f.peer.request('fixture/block',{}).catch(()=>{});f.wire(lifecycle.requests.execute);await tick();assert.equal(f.host.snapshot('browser-session').records[0].status,'pending');
 f.output.emit('drain');assert.equal(f.sent.length,2);assert.equal(f.host.snapshot('browser-session').records[0].status,'failed');assert.equal(f.peer.queuedBytes,0);f.peer.close();await forward;
 }finally{f.dispose()}
});

test('Browser computer use result for another backend/generation is rejected instead of presenting a wrong target',async()=>{
 const f=fixture({browserExecutor:{execute:async()=>({...lifecycle.results.screenshot,meta:{...lifecycle.results.screenshot.meta,browserGeneration:8}})}});try{f.wire(lifecycle.requests.execute);await tick();assert.equal(f.sent[0].error.code,-32603);assert.match(f.sent[0].error.message,/target mismatch/);assert.equal(f.host.snapshot('browser-session').records[0].result,undefined)}finally{f.dispose()}
});


test('Browser computer use injected CUA/node_repl visual rows pass the official v4 schema without stripping images/permissions',()=>{
 const parsed=conversationTopicFrameSchema.parse(lifecycle.projection.frame);const rows=parsed.payload.snapshot.rows.window;assert.equal(rows[0].display.images[0].mimeType,'image/png');assert.equal(rows[1].output.display.permissionStatus.accessibility,'denied');assert.equal(rows[1].output.display.errorCode,'permission_denied');
});
