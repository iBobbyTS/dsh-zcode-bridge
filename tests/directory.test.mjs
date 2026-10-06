import {test} from 'node:test';import assert from 'node:assert/strict';import {tmpdir} from 'node:os';
import {BridgeHost} from '../packages/host/runtime.mjs';import {V4Conversation} from '../packages/host/conversation.mjs';import {ProtocolPeer} from '../packages/host/protocol.mjs';import {readFileSync} from 'node:fs';
import {controlledStore} from './fixtures/session-lifecycle-store.mjs';
const inspect=async()=>({launcher:'fixture',cjs:'fixture',providerConfig:'fixture',verified:true});
const create=async(store,options={})=>{const host=new BridgeHost({workspacePath:tmpdir(),inspect,spawnProcess:()=>store.child(),...options});await host.connect();return host};
test('B02 directory grows past the official 50 prefix and declares saturated limits',async()=>{
 const store=controlledStore({count:125}),host=await create(store);
 try{const value=await host.listSessions();assert.equal(value.sessions.length,125);assert.equal(value.catalog.complete,true);assert.deepEqual(store.requests.filter(r=>r.method==='session/list').map(r=>r.params.limit),[5,50,100,200]);assert.equal(value.catalog.sharedGui,'unverified');assert.equal(value.availability.state,'restricted');assert.equal(value.management.archive,false);assert.equal(value.management.renameCas,false)}finally{await host.dispose()}
 const capped=await create(store,{catalogLimit:100});try{const value=await capped.listSessions();assert.equal(value.sessions.length,100);assert.equal(value.catalog.truncated,true);assert.equal(value.catalog.complete,false)}finally{await capped.dispose()}
});
test('controlled two views alternate and concurrently rename, then disconnect/reopen against the same store',async()=>{
 const store=controlledStore(),host=await create(store);
 try{
  const address=(await host.listSessions()).sessions[0].address,a=await host.openConversation(address),b=await host.openConversation(address);
  const op=(handle,title)=>host.conversationOperation({handle,operation:'command',command:{type:'renameSession',payload:{title}}});
  await op(a.handle,'A');assert.equal((await host.conversationOperation({handle:b.handle,operation:'state'})).snapshot.meta.title,'A');
  await Promise.all([op(a.handle,'B'),op(b.handle,'C')]);
  const left=await host.conversationOperation({handle:a.handle,operation:'state'}),right=await host.conversationOperation({handle:b.handle,operation:'state'});
  assert.equal(left.snapshot.meta.title,'C');assert.deepEqual(left.snapshot,right.snapshot);assert.equal(left.admission.allowed,false);assert.equal(left.managementAdmission.allowed,true);
  await host.conversationOperation({handle:a.handle,operation:'release'});assert.equal(store.rows.size,1);
  await op(b.handle,'offline rename');const reopened=await host.openConversation(address);assert.equal(reopened.state.snapshot.meta.title,'offline rename');
  assert.equal(store.requests.some(r=>r.method==='session/close'||r.params.type==='sendText'),false);
 }finally{await host.dispose()}
});
test('accepted deletion fences every view, held frames and catalog replies; a failed command does not delete',async()=>{
 const lateFixture=JSON.parse(readFileSync('tests/fixtures/session-lifecycle/lateframe.json','utf8'));
 const store=controlledStore({holdFrames:true}),host=await create(store);
 try{
  const address=(await host.listSessions()).sessions[0].address,a=await host.openConversation(address),b=await host.openConversation(address);
  const ownedChild=[...store.slots.values()][0].child;
  const late=structuredClone(lateFixture.frame);late.topic=late.frame.topic='conversation/'+address.sessionId;late.subscriptionId=late.frame.subscriptionId=a.state.subscriptionId;late.frame.payload.snapshot.sessionId=address.sessionId;
  await host.conversationOperation({handle:a.handle,operation:'command',command:{type:'renameSession',payload:{title:'late title'}}});
  const deleted=await host.conversationOperation({handle:b.handle,operation:'command',command:{type:'deleteSession',payload:{}}});assert.equal(deleted.ack.status,'accepted');
  store.flush();ownedChild.stdout.write(JSON.stringify({method:'v4/conversation/frame',params:late})+'\n');for(const handle of [a.handle,b.handle]){const state=await host.conversationOperation({handle,operation:'state'});assert.equal(state.status,'closed');assert.equal(state.error,'session-deleted');assert.notEqual(state.snapshot.meta.title,'late title')}
  // A stale official listing is injected after the accepted removal.
  store.rows.set('s0',{id:'s0',title:'late resurrect',seq:9,revision:9});assert.equal((await host.listSessions()).sessions.length,0);
  await assert.rejects(host.openConversation(address),{code:'session-deleted'});assert.deepEqual((await host.listSessions()).catalog.deleted,['s0']);
 }finally{await host.dispose()}
});
test('controlled official CAS conflict keeps the winning revision and does not resend',async()=>{
 const store=controlledStore({holdFrames:true}),child=store.child(),peer=new ProtocolPeer(child.stdout,child.stdin);
 const address={runtime:'zcode',authority:'controlled-store',workspace:'/fixture/workspace',sessionId:'s0'},workspace={workspacePath:address.workspace,workspaceKey:address.workspace};
 const a=new V4Conversation(peer,{address,workspace,clientId:'a',connectionId:'a',runnable:true}),b=new V4Conversation(peer,{address,workspace,clientId:'b',connectionId:'b',runnable:true});
 try{
  await a.connect();await b.connect();const winning=await a.submit({type:'setFollowupMode',payload:{mode:'queue'}}),stale=await b.submit({type:'setFollowupMode',payload:{mode:'guide'}});
  assert.equal(winning.ack.status,'accepted');assert.equal(stale.state,'stale');assert.equal(stale.ack.reasonCode,'proto.staleRevision');assert.equal(stale.ack.revisionAtDecision,1);store.flush();assert.equal(a.state.snapshot.revision,1);assert.equal(b.state.snapshot.revision,1);
  const before=store.requests.filter(r=>r.method==='v4/command').length;await b.queryCommand(stale.commandId);assert.equal(store.requests.filter(r=>r.method==='v4/command').length,before);
 }finally{await a.cancel();await b.cancel();peer.close();child.stdin.end()}
});
test('restricted management never grants model execution, and unverified installations fail before writes',async()=>{
 const store=controlledStore(),host=await create(store,{inspect:async()=>({...await inspect(),verified:false})});
 try{const address=(await host.listSessions()).sessions[0].address,opened=await host.openConversation(address);await assert.rejects(host.conversationOperation({handle:opened.handle,operation:'command',command:{type:'renameSession',payload:{title:'invalid'}}}),{code:'management-unverified'});await assert.rejects(host.conversationOperation({handle:opened.handle,operation:'command',command:{type:'sendText',payload:{text:'forbidden'}}}),{code:'runtime-restricted'});assert.equal(store.requests.filter(r=>r.method==='v4/command').length,0)}finally{await host.dispose()}
});

test('lost official delete ACK stays unknown until same-id query confirms removal without resend',async t=>{
 const store=controlledStore({dropCommandAck:true}),host=await create(store);
 try{const address=(await host.listSessions()).sessions[0].address,a=await host.openConversation(address),b=await host.openConversation(address);t.mock.timers.enable({apis:['setTimeout']});
  const pending=host.conversationOperation({handle:a.handle,operation:'command',command:{type:'deleteSession',payload:{}}});t.mock.timers.tick(5001);const result=await pending;assert.equal(result.state,'outcome-unknown');assert.equal((await host.conversationOperation({handle:b.handle,operation:'state'})).status,'live');
  const query=await host.conversationOperation({handle:a.handle,operation:'query',commandId:result.commandId});assert.equal(query.ack.status,'accepted');assert.equal((await host.conversationOperation({handle:b.handle,operation:'state'})).error,'session-deleted');assert.equal(store.requests.filter(r=>r.method==='v4/command').length,1);
 }finally{t.mock.timers.reset();await host.dispose()}
});
