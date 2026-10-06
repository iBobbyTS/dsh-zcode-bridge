import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {hookWorld,hookSnapshot,tick} from './helpers/hook-review.mjs';
import {ParityController} from '../packages/client/parity.mjs';
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom'),{buildSync}=require('esbuild');
const React=require('react'),{createRoot}=require('react-dom/client'),{Simulate}=require('react-dom/test-utils');
function bundle(path){const code=buildSync({entryPoints:[path],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text,mod={exports:{}};vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,mod,mod.exports);return mod.exports}
const {HookReviewPanel}=bundle('packages/client/hook-review.jsx'),{SessionParityPanel,installParityPanels}=bundle('packages/client/parity-controls.jsx');
function mount(){const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const root=createRoot(document.getElementById('root'));return {root,async close(){await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT}}}
const buttons=label=>[...document.querySelectorAll('button')].filter(button=>button.textContent===label);
const click=async button=>React.act(async()=>{Simulate.click(button);await tick()});
const writes=w=>w.calls.filter(call=>call.name==='sendConversationCommandV4').map(call=>call.args[0].envelope);

test('published session dock renders review/banner and routes four actions through /zcode-bridge parity → native driver → Main',async()=>{
 const w=await hookWorld(),view=mount(),info={runtime:'zcode',officialAddress:{sessionId:'one'}},store={};
 const controls={infos:new Map([[w.agent.id,info]]),subscribe:()=>()=>{},getSnapshot:()=>store};
 try{
  await React.act(async()=>{view.root.render(React.createElement(SessionParityPanel,{rpc:w.rpc,sessionId:w.agent.id,controls}));await tick()});
  const banner=document.querySelector('[data-zcode-hook-trust-banner]');assert.match(banner.textContent,/2 pending/);assert.equal(banner.closest('details'),null,'review must be visible outside collapsed resource panels');
  assert.match(document.querySelector('[data-zcode-hook-card]').textContent,/execute shell commands/);assert.match(document.querySelector('[data-zcode-hook-card]').textContent,/Project Root Workspace/);
  assert.equal(document.querySelector('[aria-label="Enable Audit Session Termination"]').disabled,true);
  assert.equal(writes(w).length,0,'rendering remains fail-closed');
  await click(buttons('Request Review')[0]);assert.equal(writes(w).at(-1).type,'requestWorkspaceHookReview');assert.deepEqual(writes(w).at(-1).payload,{sessionId:'one',workspaceIdentity:'/workspace/project-root',bundleDigest:'a'.repeat(64)});
  const checkbox=document.querySelector('[data-zcode-hook-item="item-lint-hook"] input');assert.ok(checkbox,document.querySelector('[data-zcode-hook-review]').innerHTML);await React.act(async()=>{Simulate.change(checkbox,{target:{checked:false}});await tick()});assert.equal(writes(w).at(-1).type,'toggleWorkspaceHookReviewItem');assert.equal(writes(w).at(-1).payload.enabled,false);assert.equal(checkbox.checked,true,'ACK alone must not optimistically toggle config');
  await click(buttons('Trust Hook')[0]);assert.equal(writes(w).at(-1).type,'respondWorkspaceHookReview');assert.deepEqual(writes(w).at(-1).payload.decision,{action:'trust_selected',reviewItemIds:['item-lint-hook']});assert.match(document.querySelector('[data-zcode-hook-item="item-lint-hook"]').textContent,/pending_trust/);
  await click(buttons('Revoke Trust')[0]);assert.equal(writes(w).at(-1).type,'revokeWorkspaceHookTrust');assert.deepEqual(writes(w).at(-1).payload.reviewItemIds,['item-audit-hook']);assert.match(document.querySelector('[data-zcode-hook-item="item-audit-hook"]').textContent,/trusted_persistent/);
  await click(buttons('Trust All Pending')[0]);assert.deepEqual(writes(w).at(-1).payload.decision.reviewItemIds,['item-lint-hook','item-untrusted-script']);
  // SOURCE_INSPECTED v4.mjs:2688-2694 forbids autoResolution on hook review.
  // The real wire fixture has deadlineAt but no timer: no synthetic snooze.
  assert.equal(writes(w).some(c=>c.type==='snoozeInteractionAutoResolution'),false);
  assert.equal(w.agent.conversation.state.snapshot.pendingInteractions.length,1);
  await React.act(async()=>{await w.publish(s=>{s.pendingInteractions[0].payload.items[1].trustState='revoked';s.pendingInteractions[0].payload.summary.pendingCount=3;s.workspaceHookAdmission.pendingCount=3})});await click(buttons('Refresh hook review')[0]);
  assert.match(document.querySelector('[data-zcode-hook-item="item-audit-hook"]').textContent,/revoked/);assert.equal(buttons('Revoke Trust').length,0);
  w.responses.set('sendConversationCommandV4',p=>({commandId:p.envelope.commandId,status:'rejected',reasonCode:'workspace_hooks_snapshot_mismatch',revisionAtDecision:w.official.snapshot.revision}));await click(buttons('Trust Hook')[0]);assert.match(document.querySelector('[data-zcode-hook-review]').textContent,/workspace_hooks_snapshot_mismatch/);assert.match(document.querySelector('[data-zcode-hook-item="item-lint-hook"]').textContent,/pending_trust/);
 }finally{await view.close();await w.close()}
});

test('hook review is installed in the retained conversation input dock',()=>{
 const slots=[],ctx={effect(){},slots:{inject:(_name,task)=>task(),register:(options,component)=>slots.push({options,component})}};installParityPanels(ctx,{},{});
 assert.equal(slots.find(row=>row.options.name==='conversation.input.dock').component,SessionParityPanel);
});

test('unknown interaction kinds expose refusal only; late replies cannot cross panel owners',async()=>{
 const view=mount(),gate=Promise.withResolvers(),writes=[],snapshot=hookSnapshot();snapshot.pendingInteractions=[{interactionId:'future-1',kind:'futureUnknown',payload:{}}];snapshot.workspaceHookAdmission=null;
 // Render defense uses a deliberately impossible future-kind DTO. The real v4
 // parser rejects this kind before publishing; no production wire fixture is weakened.
 const value={snapshot,admission:{allowed:true},managementAdmission:{allowed:true}},rpc={call:async(_channel,_endpoint,payload)=>{if(payload.domain==='command'){writes.push(payload);return {ok:true,value:{ack:{status:'accepted'}}}}return {ok:true,value}}};
 const old=new ParityController({call:()=>gate.promise}),current=new ParityController(rpc);
 try{
  await React.act(async()=>{view.root.render(React.createElement(HookReviewPanel,{controller:old,pollMs:0}));await tick()});
  await React.act(async()=>{view.root.render(React.createElement(HookReviewPanel,{controller:current,pollMs:0}));await tick()});
  assert.match(document.querySelector('[data-zcode-hook-review]').textContent,/Interaction unavailable: futureUnknown/);assert.equal(buttons('Trust Hook').length,0);assert.equal(writes.length,0);
  await React.act(async()=>{gate.resolve({ok:true,value:{snapshot:hookSnapshot(),admission:{allowed:true},managementAdmission:{allowed:true}}});await tick()});assert.equal(document.querySelector('[data-zcode-hook-card]'),null);
 }finally{old.dispose();current.dispose();await view.close()}
});

test('first action snoozes an actually supplied timer and uses the refreshed CAS, never deadlineAt alone',async()=>{
 const view=mount(),snapshot=hookSnapshot(),calls=[];snapshot.pendingInteractions[0].autoResolution={state:'visibleCountdown',startedAt:0,visibleAt:1,deadlineAt:100};
 const updated=structuredClone(snapshot);updated.revision++;updated.pendingInteractions[0].autoResolution={state:'snoozed',startedAt:0,snoozedAt:2};let value=snapshot;
 // Defensive hook only: current v4 rejects a hook-review timer. This component
 // fixture verifies the parent first-operation invariant without claiming wire support.
 const rpc={call:async(_channel,_endpoint,payload)=>{calls.push(payload);if(payload.domain==='command'){if(payload.kind==='snoozeInteractionAutoResolution')value=updated;return {ok:true,value:{state:'accepted-awaiting-terminal',ack:{status:'accepted'}}}}return {ok:true,value:{snapshot:value,admission:{allowed:true},managementAdmission:{allowed:true}}}}};
 const controller=new ParityController(rpc);
 try{
  await React.act(async()=>{view.root.render(React.createElement(HookReviewPanel,{controller,pollMs:0}));await tick()});await click(buttons('Trust Hook')[0]);const commands=calls.filter(c=>c.domain==='command');assert.deepEqual(commands.map(c=>c.kind),['snoozeInteractionAutoResolution','respondWorkspaceHookReview']);assert.equal(commands[0].baseRevision,snapshot.revision);assert.equal(commands[1].baseRevision,updated.revision);
 }finally{controller.dispose();await view.close()}
});
