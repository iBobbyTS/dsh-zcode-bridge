import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {ParityController} from '../packages/client/parity.mjs';
import {parityWorld,fixtures,tick,row} from './helpers/settings-panel-parity.mjs';
const require=createRequire(import.meta.url),{buildSync}=require('esbuild'),{JSDOM}=require('jsdom'),{createRoot}=require('react-dom/client'),{Simulate}=require('react-dom/test-utils');
function load(path){const code=buildSync({entryPoints:[path],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text,mod={exports:{}};vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,mod,mod.exports);return mod.exports}
const ui=load('packages/client/parity-controls.jsx'),workflow=load('packages/client/workflow-view.jsx');
async function until(predicate){const deadline=Date.now()+3000;while(!predicate()&&Date.now()<deadline)await tick();assert.ok(predicate(),'bounded condition did not arrive')}
async function mount(Component,props){const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const root=createRoot(document.getElementById('root'));await React.act(async()=>{root.render(React.createElement(Component,props));for(let i=0;i<5;i++)await tick()});return {button:text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text),async click(text){await React.act(async()=>{const b=this.button(text);assert.ok(b);assert.equal(b.disabled,false);b.click();for(let i=0;i<5;i++)await tick()})},async change(label,value){await React.act(async()=>Simulate.change(document.querySelector(`[aria-label="${label}"]`),{target:{value}}))},async close(){await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT}}}
function heldSnapshot(w){const snapshot=structuredClone(w.official.snapshot);snapshot.seq++;snapshot.inputRouting.mode='choice';snapshot.queue.autoDrain=false;snapshot.queue.items=[{queueItemId:'held-q',sourceCommandId:'original-source',clientId:'gui',kind:'sendText',text:'Confirmed original content',attachments:[],delivery:{requested:'queue',admitted:'queue'},order:{admissionSeq:1},steer:{state:'notRequested'},dispatch:{state:'queued'},admittedAt:0}];w.official.publish(snapshot);return snapshot}
function pausePersist(agent){const entered=Promise.withResolvers(),gate=Promise.withResolvers(),original=agent.persist.bind(agent);let first=true;agent.persist=async()=>{if(first){first=false;entered.resolve();await gate.promise}return original()};return {entered,gate}}
const sends=w=>w.official.calls.filter(c=>c.params?.type==='sendText');
async function attachmentDialog(w,controller){const snapshot=heldSnapshot(w);await tick();const mounted=await mount(ui.AttachmentPanel,{controller,snapshot});await React.act(async()=>{Simulate.change(document.querySelector('[aria-label="ZCode attachment files"]'),{target:{files:[{name:'note.txt',type:'text/plain',arrayBuffer:async()=>new Uint8Array([65,66]).buffer}]}});await until(()=>w.calls.some(c=>c.name==='attachmentCommitV4'));await tick()});await mounted.change('Attachment input text','Held attachment input');await mounted.click('Send attachment input');assert.ok(document.querySelector('[aria-label="Attachment input queue disposition"]'));return {mounted,snapshot}}

test('Protocol repair A-M1 workspace presentation is admitted and read-only for execution and imported remote workspaces',async()=>{
 const w=await parityWorld({sessionPath:'/remote/project'}),controller=new ParityController(w.rpc);let mounted;try{
  w.responses.set('readWorkspacePresentation',p=>({workspace:{workspacePath:p.workspacePath,workspaceKey:p.workspaceIdentity??p.workspacePath},mode:'plan',slashCommands:[{name:'review',description:'Official review command'}]}));
  const value=await controller.call('workspace','read');assert.deepEqual(value.presentations.map(p=>p.workspace).sort(),['/execution','/remote/project']);
  assert.equal(typeof ui.WorkspacePresentationPanel,'function');mounted=await mount(ui.WorkspacePresentationPanel,{controller});assert.ok(document.body.textContent.includes('/remote/project'));assert.ok(document.body.textContent.includes('plan'));assert.ok(document.body.textContent.includes('Official review command'));
  assert.equal(w.official.calls.some(c=>c.method==='v4/command'),false);assert.ok(w.calls.filter(c=>c.name==='readWorkspacePresentation').every(c=>c.args[0].workspacePath));
 }finally{await mounted?.close();controller.dispose();await w.close()}
});

test('settings-panel repair protocol ledger assigns readPresentation mandatory settings-panel and retain historical owner',()=>{
 for(const file of ['docs/protocol-coverage.md']){const text=readFileSync(file,'utf8'),row=text.split('\n').find(line=>line.startsWith('| `workspace/readPresentation`'));assert.match(row,/\| 3600 \| queue-guide-goal \|/);assert.deepEqual(row.split('|').slice(5,9).map(cell=>cell.trim()),['Y','Y','Y','settings-panel']);assert.equal(row.includes('延期'),false)}
});

test('Protocol repair B-M1 attachment disposition rechecks original source identity after paused persistence',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted,barrier;try{
  const dialog=await attachmentDialog(w,controller);mounted=dialog.mounted;barrier=pausePersist(w.runtime.agents.get(w.id));await mounted.click('Clear confirmed queue and send');await barrier.entered.promise;
  const replacement=structuredClone(dialog.snapshot);replacement.seq++;replacement.queue.items[0].sourceCommandId='replaced-source';replacement.queue.items[0].text='Unconfirmed replacement';w.official.publish(replacement);await tick();
  await React.act(async()=>{barrier.gate.resolve();await until(()=>w.runtime.agents.get(w.id).dispatches.size===0);for(let i=0;i<5;i++)await tick()});assert.equal(sends(w).length,0,'replaced source must never be cleared');assert.ok(document.body.textContent.includes('held-queue-confirmation-stale'));
 }finally{barrier?.gate.resolve();await mounted?.close();controller.dispose();await w.close()}
});

for(const phase of ['readiness','persistence'])test(`Protocol repair B-M2 cancel is unavailable once attachment send is claimed during ${phase}, with explicit pending state`,async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted,barrier;try{
  ({mounted}=await attachmentDialog(w,controller));const agent=w.runtime.agents.get(w.id);if(phase==='readiness'){const entered=Promise.withResolvers(),gate=Promise.withResolvers();agent.connect=async()=>{entered.resolve();await gate.promise};barrier={entered,gate}}else barrier=pausePersist(agent);await mounted.click('Keep queue and send');await barrier.entered.promise;
  assert.equal(mounted.button('Cancel confirmation').disabled,true);assert.ok(document.body.textContent.includes('Sending confirmed input'));
  await React.act(async()=>{mounted.button('Cancel confirmation').click();barrier.gate.resolve();await until(()=>sends(w).length===1);await tick()});assert.equal(sends(w).length,1);assert.equal(sends(w)[0].params.payload.attachments[0].ref,'official-ref');
 }finally{barrier?.gate.resolve();await mounted?.close();controller.dispose();await w.close()}
});

for(const phase of ['readiness','persistence'])test(`Protocol repair B-M2 attachment owner disposal during ${phase} aborts before dispatch`,async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted,barrier;try{
  ({mounted}=await attachmentDialog(w,controller));const agent=w.runtime.agents.get(w.id);
  if(phase==='readiness'){const entered=Promise.withResolvers(),gate=Promise.withResolvers();agent.connect=async()=>{entered.resolve();await gate.promise};barrier={entered,gate}}else barrier=pausePersist(agent);
  await mounted.click('Clear confirmed queue and send');await barrier.entered.promise;await mounted.close();mounted=null;controller.dispose();barrier.gate.resolve();await until(()=>agent.dispatches.size===0);for(let i=0;i<5;i++)await tick();assert.equal(sends(w).length,0,'disposed attachment owner must not send later');
 }finally{barrier?.gate.resolve();await mounted?.close();controller.dispose();await w.close()}
});

test('Protocol repair B-M3 all seven workflow run queries retain imported official workspace outside execution',async()=>{
 const w=await parityWorld({sessionPath:'/remote/project'}),controller=new ParityController(w.rpc,{sessionId:w.id});try{
  for(const [kind,params] of [['runs',{}],['runEvents',{runId:'fixture-run',limit:100}],['runArtifacts',{runId:'fixture-run'}],['runArtifactData',{runId:'fixture-run',artifactId:'a',limit:100}],['runArtifactRead',{runId:'fixture-run',artifactId:'a',version:1,offset:0,limit:65536}],['runWorkspace',{runId:'fixture-run'}],['runNodeResult',{runId:'fixture-run',siteId:'node-1',ordinal:0}]])await controller.workflowRead(kind,params);
  const calls=w.calls.filter(c=>c.name.startsWith('conversationWorkflow'));assert.equal(calls.length,7);assert.deepEqual(calls.map(c=>({name:c.name,workspace:c.args[0].workspacePath,identity:c.args[0].workspaceIdentity,sessionId:c.args[0].sessionId})),calls.map(c=>({name:c.name,workspace:'/remote/project',identity:'/remote/project',sessionId:'one'})));
 }finally{controller.dispose();await w.close()}
});

test('Protocol repair B-M4 partial automation update preserves omitted title and other official fields',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc);try{
  let official=structuredClone(fixtures.automation.frames.automationList.automations[0]);const original=structuredClone(official);
  w.responses.set('updateAutomation',p=>{official={...official,...Object.fromEntries(Object.entries(p).filter(([key,value])=>Object.hasOwn(official,key)&&value!==undefined))};return official});
  await controller.call('automation','operate','update',{automationId:official.automationId,prompt:'Only prompt changed'});const sent=w.calls.find(c=>c.name==='updateAutomation').args[0];assert.equal(Object.hasOwn(sent,'title'),false);assert.equal(official.title,original.title);assert.equal(official.cronExpr,original.cronExpr);assert.equal(official.prompt,'Only prompt changed');
  await controller.call('automation','operate','create',{cronExpr:'0 9 * * *',prompt:'Create without title'});assert.equal(w.calls.find(c=>c.name==='createAutomation').args[0].title,'');
 }finally{controller.dispose();await w.close()}
});

test('Protocol repair workflow receipt labels identify resume, amendment and cancellation separately',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted;try{
  const s=structuredClone(w.official.snapshot);s.seq++;s.workflowRuns=structuredClone(fixtures.workflow.initial.frame.payload.snapshot.workflowRuns);w.official.publish(s);await tick();mounted=await mount(workflow.ZCodeWorkflowPanel,{controller,state:w.runtime.agents.get(w.id).conversation.state});await mounted.click('fixture-run · running');await mounted.click('Resume workflow');assert.ok(document.body.textContent.includes('Resume accepted-awaiting-terminal'));
  await mounted.change('Workflow concurrency','2');await mounted.click('Amend run settings');assert.ok(document.body.textContent.includes('Amend accepted-awaiting-terminal'));await mounted.click('Cancel official run');assert.ok(document.body.textContent.includes('Cancel running'));
 }finally{await mounted?.close();controller.dispose();await w.close()}
});

test('Protocol repair A-M1 workspace tab displays partial official failures and retries unknown availability without caching denial',async()=>{
 const w=await parityWorld({sessionPath:'/remote/project'}),snapshot={status:{state:'authenticated',installation:{version:'3.14.4'}}},status={subscribe:()=>()=>{},getSnapshot:()=>snapshot};let mounted;try{
  let available=false;w.responses.set('readWorkspacePresentation',p=>{if(p.workspacePath==='/remote/project'&&!available)throw Object.assign(new Error('temporary'),{code:'capability-unknown'});return {workspace:{workspacePath:p.workspacePath,workspaceKey:p.workspaceIdentity??p.workspacePath},mode:'build',slashCommands:[{name:'inspect',description:'Official inspection'}]}});
  mounted=await mount(ui.BridgeParityPage,{controller:status,rpc:w.rpc});await mounted.click('Workspace presentations');assert.ok(document.body.textContent.includes('/execution'));assert.ok(document.body.textContent.includes('/remote/project'));assert.ok(document.body.textContent.includes('capability-unknown'));assert.ok(document.body.textContent.includes('Official inspection'));
  available=true;await mounted.click('Refresh workspace presentations');assert.equal(document.body.textContent.includes('capability-unknown'),false);assert.equal(document.querySelectorAll('[data-zcode-workspace-presentations] article').length,2);assert.equal(w.official.calls.some(call=>call.method==='v4/command'),false);
 }finally{await mounted?.close();await w.close()}
});

test('Protocol repair B-M1 held attachment admission rejects missing/spoofed queue source claims before preparing a command',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});try{const s=heldSnapshot(w);await tick();const params={text:'Untrusted held input',heldQueueDisposition:'clearQueueAndSend',expectedHeldQueueItemIds:['held-q']};
  await assert.rejects(controller.command('sendText',params,s),{code:'held-queue-confirmation-required'});
  await assert.rejects(controller.command('sendText',params,s,{heldQueue:{logEpoch:s.logEpoch,items:[{queueItemId:'held-q',sourceCommandId:'spoofed-source'}]}}),{code:'held-queue-confirmation-stale'});
  assert.equal(sends(w).length,0);assert.equal(Object.keys(w.runtime.agents.get(w.id).record.operations).length,0);
 }finally{controller.dispose();await w.close()}
});
