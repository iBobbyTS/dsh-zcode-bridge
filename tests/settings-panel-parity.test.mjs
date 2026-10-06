import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BridgeSettings} from '../packages/host/bridge-settings.mjs';
import {ParityController} from '../packages/client/parity.mjs';
import {parityWorld,fixtures,tick,row} from './helpers/settings-panel-parity.mjs';
const command=(snapshot,kind,params)=>({domain:'command',operation:'submit',kind,params,baseRevision:snapshot.revision,baseLogEpoch:snapshot.logEpoch});
const native=id=>({id,role:'user',source:{kind:'user',rpcId:id},content:[{type:'text',text:'Held native input'}]});
function held(snapshot){snapshot=structuredClone(snapshot);snapshot.seq++;snapshot.inputRouting.mode='choice';snapshot.queue.autoDrain=false;snapshot.queue.items=[{sourceCommandId:'official-queue-command',queueItemId:'held-q',clientId:'gui',kind:'sendText',text:'held official input',attachments:[],delivery:{requested:'queue',admitted:'queue'},order:{admissionSeq:1},steer:{state:'notRequested'},dispatch:{state:'queued'},admittedAt:0}];return snapshot}

test('Parity catalog panels read MCP/plugins/skills and every non-deleting management facade through the production launcher',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc);try{
  await controller.catalog.refresh();assert.equal(controller.catalog.getSnapshot().error,null);assert.ok(w.calls.some(c=>c.name==='listPlugins'));assert.equal(controller.catalog.getSnapshot().sections.reference.value.plugins.length,fixtures.catalog.pluginReference.plugins.length);
  for(const [kind,params] of [['setEnabled',{pluginId:'catalog-demo@catalog-local',enabled:false}],['install',{pluginName:'catalog-demo',marketplace:'catalog-local'}],['marketplaceAdd',{source:'fixture'}],['marketplaceUpdate',{marketplace:'catalog-local'}],['update',{pluginId:'catalog-demo@catalog-local'}],['restoreBuiltin',{pluginId:'catalog-demo@catalog-local'}],['configure',{pluginId:'catalog-demo@catalog-local',options:{}}],['resetConfig',{pluginId:'catalog-demo@catalog-local'}],['cancelOperation',{operationId:'unknown'}]])await controller.call('catalog','operate',kind,params,{operationId:'fixture-'+kind});
  await controller.call('catalog','read','pluginReferenceWithCategory');await controller.call('catalog','operate','resolveSuggestedReference',{stableId:'official-suggestion',operationId:'suggestion',clientMode:'desktop-continuous',deliveryKind:'desktop-continuous'});
  await controller.catalog.describe({pluginName:'catalog-demo',marketplace:'catalog-local'});await controller.catalog.validate({pluginName:'catalog-demo',marketplace:'catalog-local'});
  assert.equal(controller.catalog.getSnapshot().sections.overview.value.installedPlugins[0].enabled,true); // source reread, never a fabricated toggle
  for(const kind of ['uninstall','marketplaceRemove','delete'])await assert.rejects(controller.call('catalog','operate',kind,{}));
  assert.equal(w.calls.some(c=>/delete|uninstall|removePluginMarketplace/i.test(c.name)),false);
 }finally{controller.dispose();await w.close()}
});

test('Parity catalog unknown capabilities retry instead of becoming permanently unavailable; caller identities never replace owners',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc);try{
  w.responses.set('getPluginsOverview',Object.assign(new Error('temporary'),{code:'method-not-found'}));await controller.catalog.refresh();assert.equal(controller.catalog.getSnapshot().sections.overview.value,null);
  w.responses.delete('getPluginsOverview');await controller.catalog.refresh();assert.equal(controller.catalog.getSnapshot().sections.overview.error,null);
  for(const key of ['workspace','workspacePath','workspaceIdentity','sessionId','connectionId','__zcodeTrustedV4Connection'])await assert.rejects(controller.call('catalog','read','mcpList',{[key]:'foreign'}),{code:'invalid-payload'});
  await assert.rejects(w.relay.request('plugins/uninstall',{workspace:{workspacePath:'/execution',workspaceKey:'/execution'},pluginId:'x'}),{code:'execution-method-denied'});
 }finally{controller.dispose();await w.close()}
});

test('Parity insights validate usage/processes and explicit provider connectivity; merely opening diagnostics makes zero model dispatches',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});try{
  await controller.insights.refresh();assert.equal(controller.insights.getSnapshot().usage.summary.totalTokens,fixtures.diagnostics.nonEmptyUsage.summary.totalTokens);assert.equal(controller.insights.getSnapshot().diagnostics.processes.length,fixtures.diagnostics.childProcessesNonEmpty.processes.length);
  assert.equal(controller.insights.getSnapshot().account.state,'unknown');assert.equal(w.calls.some(c=>c.name==='testModelConnectivity'),false);
  await controller.call('insights','operate','testModelConnectivity',{selection:{providerId:'A',modelId:'model_a'}});assert.deepEqual(w.calls.find(c=>c.name==='testModelConnectivity').args[0],{selection:{providerId:'A',modelId:'model_a'},workspacePath:'/execution'});
  const usage=await w.peer.request('v4/conversation/usage',{workspace:{workspacePath:'/execution',workspaceKey:'/execution'},sessionId:'one'});assert.equal(usage.totalTokens,fixtures.diagnostics.nonEmptySessionUsage.totalTokens);
 }finally{controller.dispose();await w.close()}
});

test('Parity automation lists actual official cron/off-peak store state and projects no ticket; create/update use official Host DTOs',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc);try{
  const cron=await controller.call('automation','read','list'),offPeak=await controller.call('automation','read','offPeakList');assert.equal(cron.automations[0].lifecycleStatus,'active');assert.ok(offPeak.tasks.length);assert.equal(JSON.stringify(offPeak).includes('PRIVATE-TICKET'),false);
  await controller.call('automation','operate','create',{title:'Test',cronExpr:'0 9 * * *',prompt:'Mock'});await controller.call('automation','operate','update',{automationId:'fixture',prompt:'Mock'});
  await controller.call('automation','operate','offPeakCreate',{title:'Test',prompt:'Mock',model:'A/model_a',thoughtLevel:'high'});
  assert.deepEqual(w.calls.find(c=>c.name==='createTask').args[0].modelSelection,{providerId:'A',modelId:'model_a',options:{reasoningLevel:'high'}});
  w.responses.set('list',Object.assign(new Error('temporary'),{code:'capability-unknown'}));await assert.rejects(controller.call('automation','read','offPeakList'));w.responses.delete('list');assert.ok((await controller.call('automation','read','offPeakList')).tasks.length);
  await assert.rejects(controller.call('automation','operate','delete',{automationId:'fixture'}));assert.equal(w.calls.some(c=>c.name==='deleteAutomation'),false);
 }finally{controller.dispose();await w.close()}
});

test('Parity saved workflow directory/runs and all v4 run queries use the mirrored session/workspace through launcher',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});try{
  await controller.workflowManage('list',{scope:'project'});await controller.workflowManage('get',{scope:'project',name:'review'});await controller.workflowManage('runs',{scope:'project',limit:50});
  for(const [kind,params] of [['runs',{}],['runEvents',{runId:'fixture-run',limit:100}],['runArtifacts',{runId:'fixture-run'}],['runArtifactData',{runId:'fixture-run',artifactId:'fixture-table',limit:100}],['runArtifactRead',{runId:'fixture-run',artifactId:'fixture-markdown',version:1,offset:0,limit:65536}],['runWorkspace',{runId:'fixture-run'}],['runNodeResult',{runId:'fixture-run',siteId:'node-1',ordinal:0}]])await controller.workflowRead(kind,params);
  assert.equal(w.calls.filter(c=>c.name.startsWith('conversationWorkflow')).length,7);for(const c of w.calls.filter(c=>c.name.startsWith('conversationWorkflow')))assert.equal(c.args[0].sessionId,'one');
  await controller.workflowManage('updateMeta',{scope:'project',name:'review',meta:{description:'Test'}});await controller.workflowManage('move',{name:'review'});await assert.rejects(controller.workflowManage('delete',{name:'review'}));
 }finally{controller.dispose();await w.close()}
});

test('Parity workflow start/resume/amend/cancel retain actual receipts and lifecycle authority, with no local completion or replay',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});try{
  const running=structuredClone(w.official.snapshot);running.seq++;running.workflowRuns=structuredClone(fixtures.workflow.initial.frame.payload.snapshot.workflowRuns);w.official.publish(running);await tick();
  for(const [type,payload] of [['startSavedWorkflow',{name:'review',scope:'project'}],['resumeWorkflowRun',{workId:'fixture-run'}],['amendWorkflowRunSettings',{workId:'fixture-run',maxConcurrency:2}],['cancelBackgroundWork',{workId:'fixture-run'}]]){
    const result=await controller.submit({type,payload});assert.equal(result.ack.status,'accepted');assert.notEqual(result.state,'completed');assert.ok(w.store.records.get(w.id).operations[result.commandId]);
  }
  const count=w.official.calls.filter(c=>c.method==='v4/command').length;w.official.loseAck=true;const uncertain=await controller.submit({type:'resumeWorkflowRun',payload:{workId:'fixture-run'}});assert.equal(uncertain.state,'outcome-unknown');assert.equal(w.official.calls.filter(c=>c.method==='v4/command').length,count+1);
 }finally{controller.dispose();await w.close()}
});

test('Parity official interaction preferences preserve the other official value and only sync after setting write/readback',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc);try{
  const initial=await controller.call('preferences','read');assert.deepEqual(initial,{askUserQuestionAutoResolutionEnabled:true,modelIoFullRetentionEnabled:false});
  const result=await controller.call('preferences','update',undefined,{modelIoFullRetentionEnabled:true});assert.equal(result.scope,'official-app-active-workspaces');assert.equal(result.preferences.askUserQuestionAutoResolutionEnabled,true);
  assert.deepEqual(w.calls.filter(c=>['update','get','syncAppRuntimePreferences'].includes(c.name)).slice(-3).map(c=>c.name),['update','get','syncAppRuntimePreferences']);await assert.rejects(controller.call('preferences','update',undefined,{runtimeDefault:'native'}));
 }finally{controller.dispose();await w.close()}
});

test('Parity settings default ON persist, OFF stops only the background timer; startup and refresh-before-open are still mandatory',async()=>{
 const root=await mkdtemp(join(tmpdir(),'settings-'));const file=join(root,'settings.json');try{const first=new BridgeSettings(file);await first.load();assert.equal(first.value.catalogSync,true);await first.update({catalogSync:false});const next=new BridgeSettings(file);await next.load();assert.equal(next.value.catalogSync,false);await assert.rejects(next.update({catalogSync:false,runtimeDefault:'native'}));
 const cold=await parityWorld({catalogSync:false});try{assert.equal(cold.runtime.directoryTimer,undefined);assert.equal(cold.store.records.size,1)}finally{await cold.close()}
 const w=await parityWorld();try{assert.ok(w.runtime.directoryTimer);await w.runtime.bridgeSettings({catalogSync:false});let reads=0;const original=w.host.listSessions;w.host.listSessions=async()=>{reads++;return original()};assert.equal(w.runtime.directoryTimer?._destroyed,true);await w.runtime.open(w.id);assert.ok(reads>=1);assert.equal((await w.runtime.bridgeSettings()).runtimeDefault,'zcode');await w.runtime.bridgeSettings({catalogSync:true});assert.equal(w.runtime.directoryTimer._destroyed,false)}finally{await w.close()}
 }finally{await rm(root,{recursive:true,force:true})}
});

test('Parity native held choice captures queue identity and reuses original native command after confirmed disposition; stale/repeated confirmation sends nothing',async()=>{
 const w=await parityWorld();try{
  const s=held(w.official.snapshot);w.official.publish(s);await tick();const agent=w.runtime.agents.get(w.id);agent.followup(native('held-request'));await tick();await tick();
  const operation=Object.values(agent.record.operations).find(op=>op.requestId==='held-request');assert.equal(operation.state,'held');assert.equal(w.official.calls.filter(c=>c.method==='v4/command'&&c.params.type==='sendText').length,0);
  assert.equal(w.runtime.info(w.id).lifecycle.heldInputs[0].commandId,operation.commandId);
  const changed=structuredClone(s);changed.seq++;changed.queue.items[0].sourceCommandId='replacement-command';w.official.publish(changed);await tick();await assert.rejects(agent.confirmHeldInput({commandId:operation.commandId,disposition:'keepQueueAndSend'}),{code:'held-queue-confirmation-stale'});
  s.seq=changed.seq+1;w.official.publish(s);await tick();const result=await agent.confirmHeldInput({commandId:operation.commandId,disposition:'keepQueueAndSend'});assert.equal(result.commandId,operation.commandId);const sent=w.official.calls.find(c=>c.params?.type==='sendText');assert.equal(sent.params.commandId,operation.commandId);assert.deepEqual(sent.params.payload.expectedHeldQueueItemIds,['held-q']);assert.equal(agent.commands.nativeRequestId(operation.commandId),'held-request');
  await assert.rejects(agent.confirmHeldInput({commandId:operation.commandId,disposition:'keepQueueAndSend'}),{code:'held-input-unconfirmed'});assert.equal(w.official.calls.filter(c=>c.params?.type==='sendText').length,1);
 }finally{await w.close()}
});

test('Parity held cancellation is local not-sent; no queue deletion or model command is dispatched',async()=>{
 const w=await parityWorld();try{w.official.publish(held(w.official.snapshot));await tick();const agent=w.runtime.agents.get(w.id);agent.followup(native('cancel-request'));await tick();await tick();const op=Object.values(agent.record.operations).find(op=>op.requestId==='cancel-request');await w.runtime.handle({operation:'heldInput',sessionId:w.id,commandId:op.commandId,disposition:'cancel'});assert.equal(op.state,'not-sent');assert.equal(w.official.calls.some(c=>c.method==='v4/command'),false);assert.equal(w.runtime.info(w.id).lifecycle.queue.items.length,1)}finally{await w.close()}
});

test('Parity feedback binds official row plus shown revision/epoch, and cannot cross a replacement snapshot',async()=>{
 const w=await parityWorld();try{const s=structuredClone(w.official.snapshot);s.seq++;s.rows.window=[row('assistantText',2,{text:'answer',state:'complete'})];w.official.publish(s);await tick();const payload={target:{rowId:2,entityId:'row-2'},feedback:'like'};const result=await w.runtime.parity.handle({...command(s,'setAssistantFeedback',payload),sessionId:w.id});assert.equal(result.state,'completed');
 const next=structuredClone(s);next.seq++;next.revision++;w.official.publish(next);await tick();await assert.rejects(w.runtime.parity.handle({...command(s,'setAssistantFeedback',payload),sessionId:w.id}),{code:'parity-projection-stale'});assert.equal(w.official.calls.filter(c=>c.params?.type==='setAssistantFeedback').length,1);
 }finally{await w.close()}
});

test('Parity attachment begins/chunks/commits through the launcher, only committed session refs can be sent and failed uploads abort',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});try{
  const bytes=new Uint8Array(400000).fill(65),file={name:'note.txt',type:'text/plain',arrayBuffer:async()=>bytes.buffer};const ref=await controller.upload(file);assert.equal(ref.ref,'official-ref');assert.equal(w.calls.filter(c=>c.name==='attachmentChunkV4').length,2);
  const snapshot=(await controller.call('snapshot','read')).snapshot;const result=await controller.command('sendText',{text:'with attachment',modelSelection:snapshot.config.modelSelection,mode:snapshot.config.mode,attachments:[ref]},snapshot);assert.equal(result.ack.status,'accepted');
  await assert.rejects(controller.command('sendText',{text:'bad',attachments:[{ref:'foreign'}]},snapshot));
  w.responses.set('attachmentChunkV4',Object.assign(new Error('failure'),{code:'mock-chunk-failed'}));await assert.rejects(controller.upload(file));assert.ok(w.calls.some(c=>c.name==='attachmentAbortV4'));
  await assert.rejects(new ParityController(w.rpc,{sessionId:'foreign'}).call('attachment','read',undefined,{ref:'official-ref'}),{code:'runtime-identity-locked'});
 }finally{controller.dispose();await w.close()}
});

test('Parity connection generation fences a late official reply; unchanged unknown is never a persistent capability decision',async()=>{
 const changes=new Set();const gate=Promise.withResolvers(),controller=new ParityController({call:()=>gate.promise},{connectionGeneration:{subscribe:fn=>{changes.add(fn);return ()=>changes.delete(fn)}}});try{const read=controller.call('automation','read','list');for(const change of changes)change();gate.resolve({ok:true,value:{automations:[{title:'stale'}]}});await assert.rejects(read,{code:'parity-owner-replaced'})}finally{controller.dispose()}
});

test('Parity attachment preview/stat/text reads are session-bound and use the official typed v4 results',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});try{
  const s=structuredClone(w.official.snapshot);s.seq++;s.rows.window=[row('userInput',1,{origin:'realUser',text:'attached',attachments:[{ref:'projected-ref',fileName:'note.txt',mime:'text/plain',bytes:2}]})];w.official.publish(s);await tick();
  const params={ref:'projected-ref',target:{rowId:1,entityId:'row-1'},attachmentIndex:0};
  assert.deepEqual(await controller.call('attachment','preview',undefined,params),{kind:'chunked'});
  assert.equal((await controller.call('attachment','stat',undefined,params)).totalBytes,2);
  assert.equal((await controller.call('attachment','conversationRead',undefined,{...params,offset:0,limit:65536})).dataBase64,'b2s=');
  assert.equal((await controller.call('attachment','read',undefined,{...params,offset:0,limit:65536})).mediaType,'image/png');
  for(const name of ['attachmentPreviewSourceV4','conversationAttachmentStatV4','conversationAttachmentReadV4','attachmentReadV4'])assert.equal(w.calls.find(c=>c.name===name).args[0].sessionId,'one');
 }finally{controller.dispose();await w.close()}
});

test('Parity queue reorder/auto-drain/follow-up/goal controls are ACK-settled and do not exhaust session-directory transient control capacity',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});try{
  const s=held(w.official.snapshot);s.inputRouting.mode='enqueue';s.availability.queueEdit={allowed:true};s.availability.pauseGoal={allowed:true};s.availability.resumeGoal={allowed:true};w.official.publish(s);await tick();
  for(let i=0;i<140;i++){const result=await controller.command('setAutoDrain',{autoDrain:true},s);assert.equal(result.state,'completed')}
  for(const [kind,params]of [['reorderQueueItem',{queueItemId:'held-q',beforeQueueItemId:null}],['setFollowupMode',{mode:'queue'}],['pauseGoal',{}],['resumeGoal',{}]])assert.equal((await controller.command(kind,params,s)).state,'completed');
  assert.ok(Object.keys(w.store.records.get(w.id).operations).length>=144);assert.ok(w.runtime.agents.get(w.id).conversation.state.commands.length<=128);assert.equal(w.runtime.info(w.id).lifecycle.queue.autoDrain,false); // ACK never edits the queue projection
 }finally{controller.dispose();await w.close()}
});

test('Parity automation task binding is read from the official complete workspace list, with no local binding cache',async()=>{
 const w=await parityWorld(),controller=new ParityController(w.rpc);try{w.responses.set('listAutomations',[{...fixtures.automation.frames.automationList.automations[0],targetTaskId:'one'}]);assert.deepEqual(await controller.call('automation','read','checkTaskBinding',{targetTaskId:'one'}),{bound:true});w.responses.set('listAutomations',[]);assert.deepEqual(await controller.call('automation','read','checkTaskBinding',{targetTaskId:'one'}),{bound:false})}finally{controller.dispose();await w.close()}
});

test('Parity held confirmation rechecks its claim after async readiness; double-confirm, cancellation and disposal cannot replay an input',async()=>{
 for(const action of ['double','cancel','dispose']){
  const w=await parityWorld();try{w.official.publish(held(w.official.snapshot));await tick();const agent=w.runtime.agents.get(w.id);agent.followup(native('race-'+action));await tick();await tick();const op=Object.values(agent.record.operations).find(value=>value.requestId==='race-'+action),gate=Promise.withResolvers();agent.connect=()=>gate.promise;
   const first=agent.confirmHeldInput({commandId:op.commandId,disposition:'keepQueueAndSend'});let other;
   if(action==='double')other=agent.confirmHeldInput({commandId:op.commandId,disposition:'clearQueueAndSend'});
   else if(action==='cancel')await agent.confirmHeldInput({commandId:op.commandId,disposition:'cancel'});
   else other=agent.dispose();
   const settling=Promise.allSettled([first,...(other?[other]:[])]);gate.resolve();const results=await settling;
   assert.equal(w.official.calls.filter(call=>call.params?.type==='sendText').length,action==='double'?1:0);
   if(action==='double'){assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.code,'held-input-unconfirmed')}
   else assert.equal(results[0].status,'rejected');
  }finally{await w.close()}
 }
});

test('Parity held disposition fences an official queue identity replacement during durable persistence before dispatch',async()=>{
 const w=await parityWorld();try{const s=held(w.official.snapshot);w.official.publish(s);await tick();const agent=w.runtime.agents.get(w.id);agent.followup(native('persist-race'));await tick();await tick();const op=Object.values(agent.record.operations).find(value=>value.requestId==='persist-race'),gate=Promise.withResolvers(),saving=Promise.withResolvers(),original=agent.persist.bind(agent);let once=true;
  agent.persist=async()=>{if(once){once=false;saving.resolve();await gate.promise}return original()};
  const confirming=agent.confirmHeldInput({commandId:op.commandId,disposition:'clearQueueAndSend'}),rejected=assert.rejects(confirming,{code:'held-queue-confirmation-stale'});await saving.promise;const next=structuredClone(s);next.seq++;next.queue.items[0].sourceCommandId='replacement';w.official.publish(next);await tick();gate.resolve();await rejected;assert.equal(w.official.calls.some(call=>call.params?.type==='sendText'),false);assert.equal(op.state,'held');
 }finally{await w.close()}
});
