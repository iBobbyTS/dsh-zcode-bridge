export const ROUTE_B_READ_CALLS=Object.freeze(['oauth.restoreCachedSessionState','oauth.getActiveProvider','oauth.getProviders','provider-settings.getView','setting.get','zcode-task.listTasks','zcode-task.listPinnedTasks','zcode-task.getTaskMeta','zcode-agent.listSessions','zcode-agent.getAppUsageStats']);
export function usageProjection(value){
  if(value?.source!=='agent-db'||!Array.isArray(value.models))throw Error('usage-observation-invalid');
  const keys=['totalTokens','inputTokens','outputTokens','totalSessions','totalTurns','toolCallCount'];
  const counters=Object.fromEntries(keys.map(k=>[k,value.summary?.[k]]));
  counters.requestCount=value.models.reduce((n,m)=>n+m.requestCount,0);
  if(Object.values(counters).some(n=>!Number.isFinite(n)||n<0))throw Error('usage-observation-invalid');
  return counters;
}
export function compareObservation(before,after){
  if(!before||!after||!Array.isArray(before.tasks)||!Array.isArray(after.tasks)||!Array.isArray(before.rpc)||!Array.isArray(after.rpc)||!before.usage||!after.usage)return {pass:false,reason:'observation-unavailable'};
  const usageKeys=['totalTokens','inputTokens','outputTokens','totalSessions','totalTurns','toolCallCount','requestCount'];
  const usageUnchanged=usageKeys.every(k=>Number.isFinite(before.usage[k])&&before.usage[k]===after.usage[k]);
  const key=t=>JSON.stringify([t.workspaceIdentity??t.workspacePath,t.taskId]);
  const known=new Map(before.tasks.map(t=>[key(t),t]));
  const newRuns=after.tasks.filter(t=>!known.has(key(t))||(t.status==='running'&&(known.get(key(t)).status!=='running'||t.traceId!==known.get(key(t)).traceId)));
  const whitelistUnchanged=before.rpc.every(c=>ROUTE_B_READ_CALLS.includes(c))&&after.rpc.every(c=>ROUTE_B_READ_CALLS.includes(c));
  return {pass:usageUnchanged&&newRuns.length===0&&whitelistUnchanged,usageUnchanged,newRunCount:newRuns.length,whitelistUnchanged,reason:!usageUnchanged?'shared-usage-changed-attribution-unknown':newRuns.length?'shared-task-new-run-observed':!whitelistUnchanged?'rpc-whitelist-violated':null};
}
export function authProjection(cached,active,view){
  const status=cached?.status;
  if(!['signed-out','authenticated','reauthentication-required'].includes(status))throw Error('auth-state-unconfirmed');
  const providers=(view?.providers??[]).map(p=>({id:p.providerId,status:p.accountState?.availability==='available'?'connected':p.accountState?.unavailableReason==='not-connected'?'not-connected':p.accountState?.availability??'unknown',current:p.accountState?.current===true,entitled:p.accountState?.entitled===true,executable:p.executable===true}));
  const executableProviders=providers.filter(p=>p.executable).length;
  const executableAccountProviders=providers.filter(p=>p.id?.startsWith('account:')&&p.status==='connected'&&p.current&&p.executable).length;
  return {auth:status==='authenticated'&&active!==null&&executableAccountProviders>0?'authenticated':status==='authenticated'?'unconfirmed':status,oauthStatus:status,activeProviderPresent:active!==null,executableProviders,executableAccountProviders,providers};
}
