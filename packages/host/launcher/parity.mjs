import { fault } from './config.mjs';

// Public official Host facades only. This table extends the nonce-bound launcher channel;
// it never exposes a generic service/method call to the browser or reads credentials.
export const PARITY_METHODS = Object.freeze({
  'mcp/list':'listMcpServerStatuses', 'plugins/list':'listPlugins',
  'plugins/referenceCatalog':'getPluginReferenceCatalog', 'plugins/referenceCatalogWithCategory':'getPluginReferenceCatalog',
  'skills/referenceCatalog':'getSkillReferenceCatalog', 'plugins/overview':'getPluginsOverview',
  'plugins/resolveSuggestedReference':'resolveSuggestedPluginReference', 'plugins/setEnabled':'setPluginEnabled',
  'plugins/marketplace/add':'addPluginMarketplace', 'plugins/marketplace/update':'updatePluginMarketplace',
  'plugins/install':'installPlugin', 'plugins/cancelOperation':'cancelPluginOperation',
  'plugins/update':'updatePlugin', 'plugins/restoreBuiltin':'restoreBuiltinPlugin',
  'plugins/configure':'configurePlugin', 'plugins/resetConfig':'resetPluginConfig',
  'plugins/validate':'validatePlugin', 'plugins/describe':'describePlugin',
  'workflows/list':'listSavedWorkflows', 'workflows/get':'getSavedWorkflow',
  'workflows/updateMeta':'updateSavedWorkflowMeta', 'workflows/runs':'listSavedWorkflowRuns', 'workflows/move':'moveSavedWorkflow',
  'v4/conversation/workflowRuns':'conversationWorkflowRunsV4',
  'v4/conversation/workflowRunEvents':'conversationWorkflowRunEventsV4',
  'v4/conversation/workflowRunArtifacts':'conversationWorkflowRunArtifactsV4',
  'v4/conversation/workflowRunArtifactData':'conversationWorkflowRunArtifactDataV4',
  'v4/conversation/workflowRunArtifactRead':'conversationWorkflowRunArtifactReadV4',
  'v4/conversation/workflowRunWorkspace':'conversationWorkflowRunWorkspaceV4',
  'v4/conversation/workflowRunNodeResult':'conversationWorkflowRunNodeResultV4',
  'v4/usage/stats':'getAppUsageStats', 'v4/conversation/usage':'getTaskTokenUsage',
  'provider/testModelConnectivity':'testModelConnectivity',
  'workspace/readPresentation':'readWorkspacePresentation',
  'workspace/generateText':'generateWorkspaceText',
  'v4/attachment/begin':'attachmentBeginV4', 'v4/attachment/chunk':'attachmentChunkV4',
  'v4/attachment/commit':'attachmentCommitV4', 'v4/attachment/abort':'attachmentAbortV4',
  'v4/attachment/read':'attachmentReadV4', 'v4/attachment/previewSource':'attachmentPreviewSourceV4',
  'v4/conversation/attachmentRead':'conversationAttachmentReadV4',
  'v4/conversation/attachmentStat':'conversationAttachmentStatV4',
});
export const PARITY_CALLS = Object.freeze([...new Set(Object.values(PARITY_METHODS))].map(name=>'zcode-agent.'+name).concat([
  'zcode-agent.collectLocalRuntimeChildProcesses','zcode-agent.listAutomations',
  'zcode-agent.createAutomation','zcode-agent.updateAutomation','off-peak-task.list',
  'off-peak-task.createTask','setting.get','setting.update','zcode-agent.syncAppRuntimePreferences',
]));
const automationKeys=['automationId','title','cronExpr','prompt','modelSelection','mode','targetTaskId','enabled','lifecycleStatus','recurring','maxRuns','runCount','nextRunAt','lastRunAt','scheduleRule'];
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
const preferenceKeys=['askUserQuestionAutoResolutionEnabled','modelIoFullRetentionEnabled'];
/** Host returns actual store/service facts. Different Host DTOs are projected to their protocol
 * counterparts, without manufacturing entitlement, successful execution or empty lists on error. */
export async function requestParity(channel,method,params,target,emit=()=>{}) {
  if(!params||typeof params!=='object'||Array.isArray(params))throw fault('parity-params-invalid');
  if(Object.keys(params).some(key=>['workspacePath','workspaceIdentity','__zcodeTrustedV4Connection','deliveryProfile','subscriberScope'].includes(key)))throw fault('parity-identity-denied');
  const {workspace:_workspace,connectionId:_connection,...body}=params;
  const call=(service,name,args=[])=>channel.call(service,name,args,{timeoutMs:25000});
  if(Object.hasOwn(PARITY_METHODS,method)) {
    const off=body.operationId&&method!=='plugins/cancelOperation'?channel.listen('zcode-agent','onDynamicPluginOperationProgress',params=>emit({method:'plugins/operationProgress',params}),body.operationId):null;
    try{const raw=await call('zcode-agent',PARITY_METHODS[method],[{...body,...target}]);return method==='v4/attachment/abort'?{}:raw}finally{off?.()}
  }
  if(method==='process/childProcesses'){
    const processes=await call('zcode-agent','collectLocalRuntimeChildProcesses');
    return {processes:processes.flatMap(group=>group.children)};
  }
  if(method==='automation/checkTaskBinding'){
    // Same workspace + target predicate as AutomationRepo.hasTaskBinding, projected from the
    // public Host's complete workspace list; no private DB access or local binding registry.
    const automations=await call('zcode-agent','listAutomations',[target]);
    return {bound:automations.some(automation=>automation.targetTaskId===body.targetTaskId)};
  }
  if(method==='automation/list')return {automations:(await call('zcode-agent','listAutomations',[target])).map(value=>pick(value,automationKeys))};
  if(method==='automation/create'||method==='automation/update'){
    // Only the shared GUI subset is accepted here; unsupported binding/interval fields are never silently dropped.
    if(['targetTaskId','botDeliveryTarget','interval','intervalUnit'].some(key=>body[key]!==undefined))throw fault('automation-host-params-unsupported');
    const raw=await call('zcode-agent',method.endsWith('create')?'createAutomation':'updateAutomation',[{...body,title:body.title??'',...target}]);
    return {automation:pick(raw,automationKeys)};
  }
  if(method==='offPeak/list')return {tasks:(await call('off-peak-task','list')).filter(task=>(task.workspaceIdentity?.trim()||task.workspacePath)===(target.workspaceIdentity?.trim()||target.workspacePath)).map(task=>pick(task,['offPeakTaskId','title','status','queuePosition','sessionId','createdAt']))};
  if(method==='offPeak/create'){
    const separator=body.model?.indexOf('/')??-1;if(separator<1)throw fault('off-peak-model-required');
    const modelSelection={providerId:body.model.slice(0,separator),modelId:body.model.slice(separator+1),...(body.thoughtLevel?{options:{reasoningLevel:body.thoughtLevel}}:{})};
    const raw=await call('off-peak-task','createTask',[{title:body.title,prompt:body.prompt,permissionMode:body.permissionMode??'build',modelSelection,...target}]);
    return raw.ok?{ok:true,task:pick(raw.task,['offPeakTaskId','title','status','queuePosition','sessionId','createdAt'])}:pick(raw,['ok','failureStage','errorCategory','errorCode']);
  }
  if(method==='bridge/preferences/read')return pick(await call('setting','get'),preferenceKeys);
  if(method==='bridge/preferences/update'){
    if(!Object.keys(body).length||Object.entries(body).some(([key,value])=>!preferenceKeys.includes(key)||typeof value!=='boolean'))throw fault('preferences-invalid');
    // Same setting -> sync flow as the official GUI. Scope is explicitly app-wide, propagated by
    // the official Host to its active workspaces; no per-workspace read or ACK is invented.
    await call('setting','update',[body]);
    const settings=await call('setting','get');
    const preferences={askUserQuestionAutoResolutionEnabled:settings.askUserQuestionAutoResolutionEnabled!==false,modelIoFullRetentionEnabled:settings.modelIoFullRetentionEnabled===true};
    await call('zcode-agent','syncAppRuntimePreferences',[preferences]);
    return {scope:'official-app-active-workspaces',preferences};
  }
  throw fault('execution-method-denied');
}
