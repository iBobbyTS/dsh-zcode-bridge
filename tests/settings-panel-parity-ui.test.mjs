import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
import React from 'react';
import {ParityController} from '../packages/client/parity.mjs';
import {parityWorld,fixtures,tick,row} from './helpers/settings-panel-parity.mjs';
const require=createRequire(import.meta.url),{buildSync}=require('esbuild'),{JSDOM}=require('jsdom'),{createRoot}=require('react-dom/client'),{Simulate}=require('react-dom/test-utils');
function load(path){const code=buildSync({entryPoints:[resolve(path)],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text,mod={exports:{}};vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,mod,mod.exports);return mod.exports}
const ui=load('packages/client/parity-controls.jsx'),workflow=load('packages/client/workflow-view.jsx'),catalog=load('packages/client/catalog-view.jsx');
const history=JSON.parse(require('node:fs').readFileSync(new URL('./fixtures/history-management/success.json',import.meta.url)));
async function mount(Component,props){
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const root=createRoot(document.getElementById('root'));
 await React.act(async()=>{root.render(React.createElement(Component,props));for(let i=0;i<5;i++)await tick()});
 return {root,dom,button:text=>[...document.querySelectorAll('button')].find(button=>button.textContent===text),async click(button){assert.ok(button);assert.equal(button.disabled,false);await React.act(async()=>{button.click();for(let i=0;i<5;i++)await tick()})},async change(label,value){const element=document.querySelector(`[aria-label="${label}"]`);assert.ok(element);await React.act(async()=>Simulate.change(element,{target:{value}}))},async close(){await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT}};
}

test('Additive official slot registrations include settings.section and bundle config, with no shadow/replace seat',()=>{
 const entries=[],ctx={effect:fn=>fn(),locale:{register:()=>()=>{}},connection:{rpc:{}},slots:{inject:(_name,fn)=>fn(),register:(options,component)=>{entries.push({options,component});return ()=>{}}}};
 ui.installParityPanels(ctx,{},{});assert.deepEqual(entries.map(entry=>entry.options.name),['plugins.bundle.config','settings.section','conversation.input.dock']);assert.ok(entries.every(entry=>entry.options.priority===undefined&&entry.options.replace===undefined));assert.equal(entries[1].options.id,'zcode-bridge');assert.equal(entries[0].options.key,'@dsh-zcode/bridge');
 for(const language of ['zh','en'])for(const key of ['connection','version','sync','syncNote','diagnostics','runtime'])assert.ok(ui.parityLocales[language][key]);
});

test('Settings section clicks persist OFF/ON, runtime default is read-only and diagnostics entry opens',async()=>{
 const w=await parityWorld();let mounted,opened=0;try{mounted=await mount(ui.BridgeSettingsPanel,{rpc:{call:(channel,endpoint,payload,signal)=>{assert.ok(payload&&typeof payload==='object','official gateway requires a JSON payload');return w.rpc.call(channel,endpoint,payload,signal)}},status:{state:'authenticated',installation:{version:'3.14.4'}},onDiagnostics:()=>opened++});assert.ok(document.body.textContent.includes('3.14.4'));assert.ok(document.body.textContent.includes('Default runtime: zcode'));
 const checkbox=document.querySelector('input[type="checkbox"]');await React.act(async()=>{Simulate.change(checkbox,{target:{checked:false}});await tick();await tick()});assert.equal(w.runtime.settings.value.catalogSync,false);assert.equal(checkbox.checked,false);
 await React.act(async()=>{Simulate.change(checkbox,{target:{checked:true}});await tick();await tick()});assert.equal(w.runtime.settings.value.catalogSync,true);await mounted.click(mounted.button('Diagnostics'));assert.equal(opened,1);assert.equal(document.querySelectorAll('select').length,0);
 }finally{await mounted?.close();await w.close()}
});

test('Settings section stays server-owned: catalog sync toggle only, no local display toggles',async()=>{
 const w=await parityWorld();let mounted;try{
  mounted=await mount(ui.BridgeSettingsPanel,{rpc:{call:(channel,endpoint,payload,signal)=>w.rpc.call(channel,endpoint,payload,signal)},status:{state:'authenticated',installation:{version:'3.14.4'}}});
  const boxes=[...document.querySelectorAll('input[type="checkbox"]')];
  assert.equal(boxes.length,1,'catalog sync is the only toggle; the waiting note is transcript data, not a display preference');
  assert.equal(boxes[0].getAttribute('aria-label'),'Sync official task directory in the background');
  assert.equal(ui.parityLocales.zh.waitingTail,undefined);
  assert.equal(ui.parityLocales.en.waitingTail,undefined);
 }finally{await mounted?.close();await w.close()}
});

test('Catalog UI displays official enable state and actual list status; enable click rereads instead of optimistically toggling',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc);let mounted;try{mounted=await mount(catalog.ZCodeCatalogPanel,{sources:controller.catalog});assert.ok(document.querySelector('[data-installed-plugin]'));assert.ok(document.body.textContent.includes('source status'));
 await mounted.click(mounted.button('Disable'));assert.equal(w.calls.find(c=>c.name==='setPluginEnabled').args[0].enabled,false);assert.ok(document.body.textContent.includes('Enabled'));assert.equal([...document.querySelectorAll('button')].some(b=>/^(Delete|Remove|Uninstall)$/.test(b.textContent)),false);
 w.responses.set('getPluginsOverview',Object.assign(new Error('unknown'),{code:'capability-unknown'}));await mounted.click(mounted.button('Refresh official directory'));assert.ok(document.body.textContent.includes('capability-unknown'));w.responses.delete('getPluginsOverview');await mounted.click(mounted.button('Refresh official directory'));assert.ok(document.querySelector('[data-installed-plugin]'));
 }finally{await mounted?.close();controller.dispose();await w.close()}
});

test('Diagnostics UI requires an explicit connectivity click; usage/session reads never test a model',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted;try{mounted=await mount(ui.DiagnosticsExtras,{controller,sessionId:w.id});await mounted.click(mounted.button('Refresh usage and processes'));assert.equal(w.calls.some(c=>c.name==='testModelConnectivity'),false);await mounted.change('Connectivity provider','A');await mounted.change('Connectivity model','model_a');await mounted.click(mounted.button('Test model connectivity'));assert.ok(document.body.textContent.includes('"success": true'));await mounted.click(mounted.button('Read session usage'));assert.ok(w.calls.some(c=>c.name==='getTaskTokenUsage'));assert.equal(w.calls.filter(c=>c.name==='testModelConnectivity').length,1);
 }finally{await mounted?.close();controller.dispose();await w.close()}
});

test('Automation UI reads cron and off-peak lists, then explicitly creates/updates official schedules without a deletion entry',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc);let mounted;try{mounted=await mount(ui.AutomationPanel,{controller});assert.ok(document.body.textContent.includes('Fixture scheduled task'));assert.ok(document.body.textContent.includes('offPeakTaskId'));await mounted.change('Automation title','Mock schedule');await mounted.change('Automation prompt','Mock prompt');await mounted.click(mounted.button('Create cron automation'));assert.ok(w.calls.some(c=>c.name==='createAutomation'));await mounted.change('Existing automation','automation-fixture-task');await mounted.click(mounted.button('Update automation'));assert.ok(w.calls.some(c=>c.name==='updateAutomation'));assert.equal(/delete|uninstall|remove/i.test(document.body.textContent),false);
 }finally{await mounted?.close();controller.dispose();await w.close()}
});

test('Workflow UI lists/opens definitions and renders runs, start/resume/amend/cancel clicks reach receipt owner',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted;try{const s=structuredClone(w.official.snapshot);s.seq++;s.workflowRuns=structuredClone(fixtures.workflow.initial.frame.payload.snapshot.workflowRuns);w.official.publish(s);await tick();const state=w.runtime.agents.get(w.id).conversation.state;
 mounted=await mount(workflow.ZCodeWorkflowPanel,{state,controller});await mounted.click(mounted.button('List project workflows'));await mounted.click(mounted.button('review · project'));await mounted.click(mounted.button('Open official definition'));assert.ok(document.body.textContent.includes('Saved script'));await mounted.click(mounted.button('Run saved workflow'));
 await mounted.click([...document.querySelectorAll('button')].find(button=>button.textContent==='fixture-run · running'));await mounted.click(mounted.button('Resume workflow'));await mounted.change('Workflow concurrency','2');await mounted.click(mounted.button('Amend run settings'));await mounted.click(mounted.button('Cancel official run'));
 for(const type of ['startSavedWorkflow','resumeWorkflowRun','amendWorkflowRunSettings','cancelBackgroundWork'])assert.ok(w.official.calls.some(c=>c.params?.type===type));assert.equal(document.body.textContent.includes('Delete definition'),false);assert.ok(document.body.textContent.includes('ACK does not fabricate'));
 }finally{await mounted?.close();controller.dispose();await w.close()}
});

test('Preferences UI writes and reads official values; feedback click targets an official assistant row',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted;try{mounted=await mount(ui.PreferencesPanel,{controller});assert.ok(document.body.textContent.includes('active workspaces'));await mounted.click([...document.querySelectorAll('button')].find(b=>b.textContent==='Disable'));assert.equal(w.calls.find(c=>c.name==='update').args[0].askUserQuestionAutoResolutionEnabled,false);await mounted.close();mounted=null;
 const s=structuredClone(w.official.snapshot);s.seq++;s.rows.window=[row('assistantText',2,{text:'official answer',state:'complete'})];w.official.publish(s);await tick();mounted=await mount(ui.FeedbackPanel,{controller,snapshot:s});await mounted.click(mounted.button('Like'));const sent=w.official.calls.find(c=>c.params?.type==='setAssistantFeedback');assert.deepEqual(sent.params.payload,{target:{rowId:2,entityId:'row-2'},feedback:'like'});assert.equal(sent.params.baseRevision,s.revision);
 }finally{await mounted?.close();controller.dispose();await w.close()}
});

test('Attachment file UI commits through v4 before input and shows no sent attachment when upload fails',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted;try{const state=await controller.call('snapshot','read');mounted=await mount(ui.AttachmentPanel,{controller,snapshot:state.snapshot});const input=document.querySelector('[aria-label="ZCode attachment files"]');
 await React.act(async()=>{Simulate.change(input,{target:{files:[{name:'note.txt',type:'text/plain',arrayBuffer:async()=>new Uint8Array([65,66]).buffer}],value:'x'}});const deadline=Date.now()+2000;while(!w.calls.some(c=>c.name==='attachmentCommitV4')&&Date.now()<deadline)await tick();await tick()});assert.ok(document.body.textContent.includes('note.txt · 2 bytes · committed'));assert.equal(w.official.calls.some(c=>c.params?.type==='sendText'),false);await mounted.click(mounted.button('Send attachment input'));assert.equal(w.official.calls.find(c=>c.params?.type==='sendText').params.payload.attachments[0].ref,'official-ref');
 w.responses.set('attachmentChunkV4',Object.assign(new Error('fail'),{code:'mock-upload-failure'}));await React.act(async()=>{Simulate.change(input,{target:{files:[{name:'failed.txt',arrayBuffer:async()=>new Uint8Array([1]).buffer}]}});const deadline=Date.now()+2000;while(!w.calls.some(c=>c.name==='attachmentAbortV4')&&Date.now()<deadline)await tick();await tick()});assert.ok(document.body.textContent.includes('mock-upload-failure'));assert.equal(document.body.textContent.includes('failed.txt ·'),false);assert.ok(w.calls.some(c=>c.name==='attachmentAbortV4'));
 }finally{await mounted?.close();controller.dispose();await w.close()}
});

test('Queue preference UI reorders and changes drain mode through official commands without changing the projected queue',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted;try{
  const s=structuredClone(w.official.snapshot);s.seq++;s.queue.autoDrain=false;s.availability.queueEdit={allowed:true};s.queue.items=['a','b'].map((id,i)=>({sourceCommandId:'command-'+id,queueItemId:id,clientId:'gui',kind:'sendText',text:'Queue '+id,attachments:[],delivery:{requested:'queue',admitted:'queue'},order:{admissionSeq:i+1},steer:{state:'notRequested'},dispatch:{state:'queued'},admittedAt:0}));w.official.publish(s);await tick();
  mounted=await mount(ui.QueuePreferencesPanel,{controller,snapshot:s});await mounted.click(mounted.button('Resume auto drain'));await mounted.click([...document.querySelectorAll('button')].find(b=>b.textContent==='Move down'&&!b.disabled));const sent=w.official.calls.find(c=>c.params?.type==='reorderQueueItem');assert.deepEqual(sent.params.payload,{queueItemId:'a',beforeQueueItemId:null});assert.equal(document.body.textContent.indexOf('Queue a')<document.body.textContent.indexOf('Queue b'),true);assert.equal(/delete|remove|uninstall/i.test(document.body.textContent),false);
 }finally{await mounted?.close();controller.dispose();await w.close()}
});

test('Mode picker sends official command without optimistic mode and exposes all switchable modes',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted;
 try{const snapshot=w.runtime.agents.get(w.id).conversation.state.snapshot;mounted=await mount(ui.QueuePreferencesPanel,{controller,snapshot});
 const select=document.querySelector('[aria-label="ZCode collaboration mode"]');assert.deepEqual([...select.options].map(option=>option.value),['build','edit','plan','yolo']);
 await mounted.change('ZCode collaboration mode','plan');assert.equal(w.official.calls.find(c=>c.params?.type==='switchCollaborationMode').params.payload.mode,'plan');assert.equal(select.value,'build');
 }finally{await mounted?.close();controller.dispose();await w.close()}
});
test('History panel reads plans/diffs/preview through production owners and hides replaced results',async()=>{
 const w=await parityWorld({sessionPath:'/imported'}),controller=new ParityController(w.rpc,{sessionId:w.id});let mounted;
 try{const snapshot=structuredClone(history.initial.frame.payload.snapshot);snapshot.sessionId='one';snapshot.seq=w.official.snapshot.seq+1;w.official.publish(snapshot);await tick();
 w.responses.set('conversationPlansV4',{plans:[row('toolCall',10,{toolCallId:'plan-call',toolName:'ExitPlanMode',inputText:'Official plan body',status:'success'})],atSeq:snapshot.seq,atLogEpoch:snapshot.logEpoch});w.responses.set('conversationFileChangesV4',history.fileChanges);w.responses.set('conversationFileRewindPreviewV4',history.preview);
 mounted=await mount(ui.HistoryResourcesPanel,{controller,snapshot});await mounted.click(mounted.button('Read official plans'));assert.ok(document.body.textContent.includes('Official plan body'));await mounted.click(mounted.button('Read file changes · 1'));assert.ok(document.body.textContent.includes('sample.txt'));assert.ok(document.body.textContent.includes('-version 1\n+version 2'));
 await mounted.click(mounted.button('Preview file rewind · 1'));assert.ok(document.body.textContent.includes('safe to apply'));assert.equal(w.official.calls.some(c=>c.method==='v4/command'),false);
 await React.act(async()=>mounted.root.render(React.createElement(ui.HistoryResourcesPanel,{controller,snapshot:{...snapshot,revision:snapshot.revision+1}})));assert.equal(document.body.textContent.includes('sample.txt'),false);assert.equal(document.body.textContent.includes('Official plan body'),false);
 assert.equal([...document.querySelectorAll('button')].some(button=>/apply|delete|remove|uninstall/i.test(button.textContent)),false);
 }finally{await mounted?.close();controller.dispose();await w.close()}
});
