import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hookWorld,hookSnapshot,tick} from './helpers/hook-review.mjs';
import {HOOK_REVIEW_COMMANDS,TRUST_GRANT_REASONS,translateTrustGrant,grantWorkspaceHookTrust,hookReviewTarget} from '../packages/driver/hook-review.mjs';
import {ROUTED_COMMANDS} from '../packages/driver/commands.mjs';
import {EXECUTION_COMMANDS,EXECUTION_CALLS,createExecutionRelay} from '../packages/host/launcher/execution.mjs';
import {PARITY_METHODS} from '../packages/host/launcher/parity.mjs';
import {ParityController} from '../packages/client/parity.mjs';
import {DriverTransport} from '../packages/driver/transport.mjs';
import {BridgeHost} from '../packages/host/runtime.mjs';
import {parseCommandEnvelope} from '../packages/host/vendor/zcode/v4.mjs';
const hashes={bundleDigest:'a'.repeat(64),hookDeclarationDigest:'b'.repeat(64)};
const writes=w=>w.calls.filter(call=>call.name==='sendConversationCommandV4').map(call=>call.args[0].envelope);
function command(kind,snapshot){const review=snapshot.pendingInteractions[0].payload,target=hookReviewTarget(review);return {type:kind,payload:kind==='requestWorkspaceHookReview'?{sessionId:snapshot.sessionId,workspaceIdentity:review.workspaceIdentity,bundleDigest:review.bundleDigest}:kind==='respondWorkspaceHookReview'?{...target,decision:{action:'trust_selected',reviewItemIds:['item-lint-hook']}}:kind==='toggleWorkspaceHookReviewItem'?{...target,reviewItemId:'item-lint-hook',enabled:false}:{...target,reviewItemIds:['item-audit-hook']}}}

test('hook trust grant translates the full frozen reason vocabulary without local admission',async()=>{
  assert.deepEqual(translateTrustGrant({accepted:true}),{accepted:true,outcome:'confirmed'});
  for(const [reasonCode,outcome] of Object.entries(TRUST_GRANT_REASONS))assert.deepEqual(translateTrustGrant({accepted:false,reasonCode}),{accepted:false,reasonCode,outcome});
  assert.deepEqual(translateTrustGrant({accepted:false}),{accepted:false,outcome:'rejected'});
  for(const result of [{accepted:true,reasonCode:'workspace_hooks_bundle_changed'},{accepted:true,trustState:'trusted_persistent'},{accepted:false,reasonCode:'invented'}])assert.throws(()=>translateTrustGrant(result),{code:'hook-trust-result-invalid'});
});

test('grant wire maps to the allowlisted read-only Host facade with scoped digests and explicit outcomes',async()=>{
 const w=await hookWorld(),ui=new ParityController(w.rpc,{sessionId:w.agent.id});
 try{
  assert.equal(PARITY_METHODS['workspace/hooks/trustGrant'],'grantWorkspaceHookTrust');assert.ok(EXECUTION_CALLS.includes('zcode-agent.grantWorkspaceHookTrust'));
  for(const raw of [{accepted:true},...Object.keys(TRUST_GRANT_REASONS).map(reasonCode=>({accepted:false,reasonCode}))]){
   w.responses.set('grantWorkspaceHookTrust',raw);
   const result=await ui.call('hooks','grant',undefined,hashes);
   assert.deepEqual(result,translateTrustGrant(raw));
   const call=w.calls.at(-1);assert.equal(call.service,'zcode-agent');assert.equal(call.name,'grantWorkspaceHookTrust');assert.deepEqual(call.args,[{...hashes,workspacePath:'/execution'}]);
   assert.equal(w.agent.conversation.state.snapshot.pendingInteractions[0].payload.items[0].trustState,'pending_trust');
  }
  const count=w.calls.length;
  for(const params of [{...hashes,hookDeclarationDigest:'item-lint-hook'},{...hashes,bundleDigest:'Z'.repeat(64)},{...hashes,extra:true},{...hashes,workspace:{workspacePath:'/foreign',workspaceKey:'/foreign'}}])await assert.rejects(ui.call('hooks','grant',undefined,params));
  assert.equal(w.calls.length,count,'invalid/item-id-as-digest never reaches Main');
  w.responses.set('grantWorkspaceHookTrust',{accepted:true,extra:true});await assert.rejects(ui.call('hooks','grant',undefined,hashes),{code:'hook-trust-outcome-unknown'});
 }finally{ui.dispose();await w.close()}
});

test('grant stale generation, cancellation and lost response remain explicit outcome-unknown',async()=>{
 const workspace={workspacePath:'/execution',workspaceKey:'/execution'};
 const gate=Promise.withResolvers(),peer={generation:1,request:()=>gate.promise};
 const pending=grantWorkspaceHookTrust(peer,workspace,hashes);peer.generation++;gate.resolve({accepted:true});await assert.rejects(pending,{code:'hook-trust-outcome-unknown'});
 for(const error of [Object.assign(new Error('timeout'),{code:'timeout'}),Object.assign(new Error('not sent'),{sent:false,code:'not-sent'})])await assert.rejects(grantWorkspaceHookTrust({request:async()=>{throw error}},workspace,hashes),{code:error.sent===false?'not-sent':'hook-trust-outcome-unknown'});
 const abort=new AbortController();abort.abort();let called=false;await assert.rejects(grantWorkspaceHookTrust({request:()=>{called=true}},workspace,hashes,{signal:abort.signal}));assert.equal(called,false);
});

for(const kind of HOOK_REVIEW_COMMANDS)test(`review ${kind} passes driver, root parity, launcher and vendored wire schema`,async()=>{
 const w=await hookWorld(),ui=new ParityController(w.rpc,{sessionId:w.agent.id});
 try{
  assert.ok(ROUTED_COMMANDS.has(kind));assert.ok(EXECUTION_COMMANDS.has(kind));const snapshot=w.agent.conversation.state.snapshot,c=command(kind,snapshot);
  const result=await ui.command(kind,c.payload,snapshot);assert.equal(result.ack.status,'accepted');assert.equal(result.state,'accepted-awaiting-terminal','review ACK is not an invented terminal turn');
  const wire=writes(w).at(-1);assert.equal(wire.type,kind);assert.deepEqual(wire.payload,c.payload);assert.ok(parseCommandEnvelope(wire).ok);assert.equal(wire.sessionId,'one');assert.equal(wire.commandId,result.commandId);
  assert.equal(w.agent.conversation.state.snapshot.pendingInteractions.length,1,'unanswered/ACK-only review stays pending');assert.equal(w.errors.some(e=>e.type==='agent/error'),false);
 }finally{ui.dispose();await w.close()}
});

test('review admission rejects unconfirmed items, readonly toggles, stale target/generation and malformed decisions before dispatch',async()=>{
 const w=await hookWorld(),ui=new ParityController(w.rpc,{sessionId:w.agent.id});
 try{
  const snapshot=w.agent.conversation.state.snapshot,respond=command('respondWorkspaceHookReview',snapshot),toggle=command('toggleWorkspaceHookReviewItem',snapshot),revoke=command('revokeWorkspaceHookTrust',snapshot);
  for(const [kind,payload,code] of [
   [respond.type,{...respond.payload,interactionId:'missing'},'interaction-unconfirmed'],
   [respond.type,{...respond.payload,generation:2},'hook-review-stale'],
   [respond.type,{...respond.payload,workspaceIdentity:'/foreign'},'hook-review-stale'],
   [respond.type,{...respond.payload,decision:{action:'trust_selected',reviewItemIds:['foreign']}},'hook-review-item-unconfirmed'],
   [respond.type,{...respond.payload,decision:{action:'trust_selected',reviewItemIds:['item-audit-hook']}},'hook-review-item-not-trustable'],
   [respond.type,{...respond.payload,decision:{action:'trust_selected',reviewItemIds:['item-lint-hook','item-lint-hook']}},'command-invalid'],
   [toggle.type,{...toggle.payload,reviewItemId:'item-audit-hook'},'hook-review-item-readonly'],
   [revoke.type,{...revoke.payload,interactionId:'missing'},'interaction-unconfirmed'],
  ])await assert.rejects(ui.command(kind,payload,snapshot),{code});
  const request=command('requestWorkspaceHookReview',snapshot);await assert.rejects(ui.command(request.type,{...request.payload,bundleDigest:'b'.repeat(64)},snapshot),{code:'hook-review-stale'});
  const nonflow={sessionId:'one',workspaceIdentity:snapshot.workspaceHookAdmission.workspaceIdentity,bundleDigest:hashes.bundleDigest,hookDeclarationDigests:[hashes.hookDeclarationDigest]};
  await assert.rejects(ui.command('revokeWorkspaceHookTrust',{...nonflow,remoteSessionId:'unbound'},snapshot),{code:'hook-review-stale'});
  assert.equal(writes(w).length,0);
  const current=await w.publish();await assert.rejects(ui.command(respond.type,respond.payload,snapshot),{code:'parity-projection-stale'});
  const revoked=await ui.command('revokeWorkspaceHookTrust',nonflow,current);assert.equal(revoked.ack.status,'accepted');
 }finally{ui.dispose();await w.close()}
});

test('revoke and trust results use authoritative subsequent snapshots; rejection never changes local trust',async()=>{
 const w=await hookWorld(),ui=new ParityController(w.rpc,{sessionId:w.agent.id});
 try{
  let snapshot=w.agent.conversation.state.snapshot;
  const c=command('revokeWorkspaceHookTrust',snapshot);await ui.command(c.type,c.payload,snapshot);
  assert.equal(w.agent.conversation.state.snapshot.pendingInteractions[0].payload.items[1].trustState,'trusted_persistent');
  snapshot=await w.publish(s=>{s.pendingInteractions[0].payload.items[1].trustState='revoked';s.pendingInteractions[0].payload.summary.pendingCount=3;s.workspaceHookAdmission.pendingCount=3});
  assert.equal(snapshot.pendingInteractions[0].payload.items[1].trustState,'revoked');
  w.responses.set('sendConversationCommandV4',p=>({commandId:p.envelope.commandId,status:'rejected',reasonCode:'workspace_hooks_bundle_changed',revisionAtDecision:snapshot.revision}));
  const respond=command('respondWorkspaceHookReview',snapshot);await assert.rejects(ui.command(respond.type,respond.payload,snapshot),{code:'workspace_hooks_bundle_changed'});
  assert.ok(w.errors.some(item=>item.type==='agent/error'&&item.payload.error.code==='workspace_hooks_bundle_changed'));
  assert.equal(w.agent.conversation.state.snapshot.pendingInteractions[0].payload.items[0].trustState,'pending_trust');
 }finally{ui.dispose();await w.close()}
});

test('native hook ingress avoids mirror ownership and keeps userInput explicit refusal',async()=>{
 const w=await hookWorld(),ui=new ParityController(w.rpc,{sessionId:w.agent.id});
 try{
  assert.equal(w.store.records.has(w.agent.id),false);const state=await ui.call('snapshot','read');assert.equal(state.snapshot.sessionId,'one');
  await assert.rejects(w.agent.submitControl({type:'resolveInteraction',payload:{interactionId:'hook-flow-1',answer:{optionId:'allow'}}}),{code:'interaction-mapping-unavailable'});
  await assert.rejects(ui.call('command','submit','unknownHook',{}),{code:'runtime-identity-locked'});
 }finally{ui.dispose();await w.close()}
});

test('driver negotiates hook review UI only when advertised by official hello',async()=>{
 for(const supported of [true,false]){
  const calls=[],relay=createExecutionRelay({workspacePath:'/execution',channel:{call:async(_service,name,args)=>{calls.push({name,args});return name==='helloConversationV4'?{kind:'hello',protocolVersion:3,connectionId:'negotiated',clientMode:'desktop-continuous',deliveryProfile:'continuous',serverTime:0,capabilities:{nativeDialogs:true,localTerminal:true,binaryFrames:false,compression:'none',workspaceHookReview:supported},auth:{}}:undefined}}});
  const launcher={state:{phase:'ready',auth:'authenticated',executionWorkspace:'/execution'},subscribe:()=>()=>{},onExecutionEvent:()=>()=>{},execution:(method,params)=>relay.request(method,params)};
  const transport=new DriverTransport({launcher,connect:async()=>{}});
  try{await transport.ready('/execution',new AbortController().signal);assert.equal(calls.find(c=>c.name==='initializeConversationV4').args[0].capabilities?.workspaceHookReviewUi,supported?true:undefined)}finally{transport.dispose();relay.dispose()}
 }
});

test('actual conversation operation boundary admits resolve/snooze and all reviews to real V4 guards/ledger',async()=>{
 const w=await hookWorld();
 // Inject only projection ownership into BridgeHost; the public opaque-handle router
 // and V4 guards/command ledger are real, no duplicated whitelist in this harness.
 class ScopedHost extends BridgeHost{createConversation(){return w.agent.conversation}}
 const host=new ScopedHost();
 try{
  const owner=await host.openConversation({});await tick();const snapshot=w.agent.conversation.state.snapshot;
  for(const kind of HOOK_REVIEW_COMMANDS){const result=await host.conversationOperation({handle:owner.handle,operation:'command',command:command(kind,snapshot)});assert.equal(result.ack.status,'accepted')}
  await w.publish(s=>s.pendingInteractions.push({interactionId:'question-1',kind:'userInput',anchorRowId:null,createdAt:0,payload:{kind:'userInput',prompt:'Proceed?',freeText:true}}));
  for(const type of ['snoozeInteractionAutoResolution','resolveInteraction']){
   const payload={interactionId:'question-1',...(type==='resolveInteraction'?{answer:{action:'decline'}}:{})};
   const result=await host.conversationOperation({handle:owner.handle,operation:'command',command:{type,payload}});assert.equal(result.ack.status,'accepted');
   await assert.rejects(host.conversationOperation({handle:owner.handle,operation:'command',command:{type,payload:{...payload,interactionId:'missing'}}}),{code:'interaction-unconfirmed'});
  }
  await assert.rejects(host.conversationOperation({handle:owner.handle,operation:'command',command:{type:'unknownHook',payload:{}}}),{code:'management-command-unavailable'});
 }finally{await host.dispose();await w.close()}
});

for(const kind of HOOK_REVIEW_COMMANDS)test(`legacy root parity gate also admits ${kind} with the same immutable review target`,async()=>{
 const w=await hookWorld(),ui=new ParityController(w.rpc,{sessionId:w.id});
 try{const snapshot=w.agent.conversation.state.snapshot,c=command(kind,snapshot),result=await ui.command(kind,c.payload,snapshot);assert.equal(result.ack.status,'accepted');assert.equal(writes(w).at(-1).type,kind);assert.deepEqual(writes(w).at(-1).payload,c.payload)}finally{ui.dispose();await w.close()}
});

test('lost review ACK with live subscription preserves command id, explicit error and readable pending snapshot',async()=>{
 const w=await hookWorld(),ui=new ParityController(w.rpc,{sessionId:w.agent.id});
 try{
  const snapshot=w.agent.conversation.state.snapshot,c=command('respondWorkspaceHookReview',snapshot);
  w.responses.set('sendConversationCommandV4',()=>{throw Object.assign(new Error('single ACK lost'),{code:'execution-outcome-unknown'})});
  await assert.rejects(ui.command(c.type,c.payload,snapshot),{code:'command-outcome-unknown'});
  const sent=writes(w).at(-1);assert.ok(w.errors.some(item=>item.type==='agent/error'&&item.payload.error.code==='command-outcome-unknown'));
  const current=await ui.call('snapshot','read');assert.equal(current.status,'live');assert.equal(current.snapshot.pendingInteractions.length,1);assert.equal(current.snapshot.pendingInteractions[0].payload.items[0].trustState,'pending_trust');
  assert.equal(current.commands.find(item=>item.commandId===sent.commandId).state,'outcome-unknown');
  await assert.rejects(ui.command(c.type,c.payload,snapshot),{code:'command-outcome-unknown'});assert.equal(writes(w).length,1,'no replacement command id or automatic resend');
 }finally{ui.dispose();await w.close()}
});

test('workspace grant does not require a task, review item id or selected model',async()=>{
 const w=await hookWorld(),ui=new ParityController(w.rpc);
 try{w.responses.set('grantWorkspaceHookTrust',{accepted:true});assert.equal((await ui.call('hooks','grant',undefined,hashes)).outcome,'confirmed');const call=w.calls.at(-1);assert.deepEqual(call.args,[{...hashes,workspacePath:'/execution'}]);assert.equal(writes(w).length,0)}finally{ui.dispose();await w.close()}
});

test('trust launcher validates original workspace reference before translation, never strips malformed or foreign bindings',async()=>{
 const w=await hookWorld();
 try{
  const count=w.calls.filter(c=>c.name==='grantWorkspaceHookTrust').length;
  for(const [workspace,code] of [
   [{workspacePath:'/execution',workspaceKey:'/execution',extra:true},'hook-trust-params-invalid'],
   [{workspacePath:'/execution',workspaceKey:'/execution',workspaceIdentity:7},'hook-trust-params-invalid'],
   [{workspacePath:'/execution',workspaceKey:'/execution',workspaceIdentity:'/foreign'},'execution-workspace-denied'],
   [{workspacePath:'/execution',workspaceKey:'/execution',remoteSessionId:'unbound-remote'},'execution-workspace-denied'],
  ])await assert.rejects(w.peer.request('workspace/hooks/trustGrant',{...hashes,workspace}),error=>error.code===code&&error.sent===false);
  assert.equal(w.calls.filter(c=>c.name==='grantWorkspaceHookTrust').length,count);
 }finally{await w.close()}
});
