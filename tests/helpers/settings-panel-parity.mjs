import {readFileSync} from 'node:fs';
import {world,catalogRow,directory,tick} from './conversation-runtime.mjs';
import {MockPeer,row} from './zcode-runtime-fixture.mjs';
import {createExecutionRelay,LauncherPeer} from '../../packages/host/launcher/execution.mjs';
export {tick,row};
export const fixtures={
  catalog: JSON.parse(readFileSync(new URL('../fixtures/catalog-management/directory.json',import.meta.url))),
  catalogOps: JSON.parse(readFileSync(new URL('../fixtures/catalog-management/operations.json',import.meta.url))),
  workflow: JSON.parse(readFileSync(new URL('../fixtures/workflow-management/lifecycle.json',import.meta.url))),
  diagnostics: JSON.parse(readFileSync(new URL('../fixtures/account-usage-diagnostics/usage.json',import.meta.url))),
  automation: JSON.parse(readFileSync(new URL('../fixtures/automation-offpeak/projection.json',import.meta.url))),
};
export async function parityWorld({catalogSync=true,path='/execution',sessionPath=path}={}){
 const official=new MockPeer(),events=new Set(),states=new Set(),calls=[],responses=new Map();
 const d=fixtures.catalog,o=fixtures.catalogOps,w=fixtures.workflow,i=fixtures.diagnostics,a=fixtures.automation.frames;
 let preferences={askUserQuestionAutoResolutionEnabled:true,modelIoFullRetentionEnabled:false};
 const defaults={listMcpServerStatuses:d.mcpList,listPlugins:d.pluginsListInstalled,getPluginsOverview:d.pluginsOverviewInstalled,getPluginReferenceCatalog:d.pluginReference,getSkillReferenceCatalog:d.skillsReference,validatePlugin:d.validateBare,describePlugin:o.describe,setPluginEnabled:o.setDisabled,installPlugin:o.install,configurePlugin:o.configure,resetPluginConfig:o.configure,restoreBuiltinPlugin:o.restoreBuiltin,addPluginMarketplace:o.marketplaceAdd,updatePluginMarketplace:o.marketplaceAdd,updatePlugin:o.install,cancelPluginOperation:o.cancelUnknown,resolveSuggestedPluginReference:{stableId:'official-suggestion',status:'unavailable',diagnostics:[]},
 listSavedWorkflows:w.directory,getSavedWorkflow:w.definition,listSavedWorkflowRuns:{runs:[]},updateSavedWorkflowMeta:{ok:true,path:'/fixture/workflow'},moveSavedWorkflow:{ok:true,from:'/global/review',to:'/execution/review'},conversationWorkflowRunsV4:{runs:[{runId:'fixture-run',status:'running',resumable:false,toolCallId:'fixture-workflow-tool'}]},conversationWorkflowRunEventsV4:w.events,conversationWorkflowRunArtifactsV4:w.artifacts,conversationWorkflowRunArtifactDataV4:w.data,conversationWorkflowRunArtifactReadV4:w.content,conversationWorkflowRunWorkspaceV4:w.workspace,conversationWorkflowRunNodeResultV4:w.nodeResult,
 getAppUsageStats:i.nonEmptyUsage,getTaskTokenUsage:i.nonEmptySessionUsage,collectLocalRuntimeChildProcesses:[{pid:900,children:i.childProcessesNonEmpty.processes}],testModelConnectivity:{success:true},listAutomations:a.automationList.automations,createAutomation:a.automationCreate.automation,updateAutomation:a.automationUpdate.automation,
 list:a.offPeakList.tasks.map(task=>({...task,workspacePath:path,serverTicketId:'PRIVATE-TICKET'})),createTask:{...a.offPeakCreate,task:{...a.offPeakCreate.task,serverTicketId:'PRIVATE-TICKET'}},
 attachmentBeginV4:{uploadId:'',state:'staging',nextChunkIndex:0},attachmentCommitV4:{ref:'official-ref'},attachmentAbortV4:undefined,attachmentPreviewSourceV4:{kind:'chunked'},attachmentReadV4:{dataBase64:'b2s=',mediaType:'image/png',totalBytes:2,nextOffset:null},conversationAttachmentStatV4:{mediaType:'text/plain',totalBytes:2},conversationAttachmentReadV4:{dataBase64:'b2s=',mediaType:'text/plain',totalBytes:2,nextOffset:null}};
 const names={helloConversationV4:'hello',initializeConversationV4:'initialize',subscribeConversationV4:'v4/conversation/subscribe',resyncConversationV4:'v4/conversation/resync',unsubscribeConversationV4:'v4/conversation/unsubscribe',queryConversationCommandsV4:'v4/commands/query',sendConversationCommandV4:'v4/command'};
 const channel={listen:(_service,name,listener,target)=>{if(name==='onDynamicPluginOperationProgress')return ()=>{};return ()=>{}},call:async(service,name,args=[])=>{
  calls.push({service,name,args:structuredClone(args)});const p=args[0];
  if(responses.has(name)){const response=responses.get(name);if(response instanceof Error)throw response;return typeof response==='function'?response(p):structuredClone(response)}
  if(name==='listSavedWorkflows')return {...w.directory,workflows:w.directory.workflows.filter(entry=>entry.scope===(p.scope??'project'))};
  if(name==='getSavedWorkflow')return {...w.definition,scope:p.scope??'project'};
  if(name==='get')return preferences;if(name==='update'){preferences={...preferences,...p};return}if(name==='syncAppRuntimePreferences')return;
  if(names[name]){
    const method=names[name];let params=p;
    if(method==='v4/conversation/subscribe')params={topic:'conversation/'+p.sessionId};
    else if(method==='v4/command')params=p.envelope;
    else if(method==='v4/conversation/resync'||method==='v4/conversation/unsubscribe')params={...p,topic:[...official.subscriptions].find(([,id])=>id===p.subscriptionId)?.[0]};
    let result=await official.request(method,params);
    if(['startSavedWorkflow','amendWorkflowRunSettings'].includes(params?.type)){result={...result,result:{type:params.type,runId:'fixture-successor',toolCallId:'fixture-new-tool'}};official.acks.set(params.commandId,result)}
    return result;
  }
  if(name==='attachmentBeginV4')return {...defaults[name],uploadId:p.uploadId};
  if(name==='attachmentChunkV4')return {uploadId:p.uploadId,nextChunkIndex:p.chunkIndex+1};
  if(Object.hasOwn(defaults,name))return structuredClone(defaults[name]);
  throw Object.assign(new Error('method not found'),{code:'method-not-found'});
 }};
 const relay=createExecutionRelay({channel,workspacePath:path,resolveWorkspace:async path=>({workspaceIdentity:path}),emit:event=>{for(const listener of events)listener(event)}});
 official.onNotification(event=>{for(const listener of events)listener(event)});
 const launcher={state:{phase:'ready',auth:'authenticated',executionWorkspace:path},subscribe:fn=>{states.add(fn);return ()=>states.delete(fn)},onExecutionEvent:fn=>{events.add(fn);return ()=>events.delete(fn)},execution:(method,params)=>relay.request(method,params),read:()=>official.listProviders()};
 const peer=new LauncherPeer(launcher),worldState=await world({catalog:async()=>directory([catalogRow('one','Queue guide parity fixture',sessionPath)])});
 worldState.host.launcher=launcher;worldState.host.status.installation={version:'3.14.4',verified:true};worldState.runtime.peerFactory=()=>peer;worldState.host.taskUsage=async address=>({address,usage:await peer.request('v4/conversation/usage',{sessionId:address.sessionId,workspace:{workspacePath:address.workspace,workspaceKey:address.workspace}})});official.registerSession('one');
 worldState.runtime.settings.value={catalogSync};
 await worldState.runtime.start();const id=[...worldState.store.records.keys()][0];await worldState.runtime.open(id);await tick();
 const rpc={call:async(_channel,endpoint,payload,signal)=>{try{return {ok:true,value:endpoint==='parity'?await worldState.runtime.parity.handle(payload,signal):endpoint==='bridgeSettings'?await worldState.runtime.bridgeSettings(payload):await worldState.runtime.handle(payload)}}catch(error){return {ok:false,error:{code:error.code??'mock-failure',message:error.message}}}}};
 return {...worldState,id,peer,official,relay,calls,responses,rpc,async close(){await worldState.runtime.dispose();relay.dispose();peer.close()}};
}
