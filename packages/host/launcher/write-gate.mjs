// D4-a: official task identity/availability guards admission. Activity is informational;
// neither another GUI's possible turn nor our own lease invents a local queue lock.
// The official command receipt is the execution outcome; allowed is only permission to send.
// Retained config bounds support existing launcher configurations (preflight no longer waits).
export const DEFAULT_ACTIVITY_WINDOW_MS=5000;
export const MIN_ACTIVITY_WINDOW_MS=2000;
export const MAX_ACTIVITY_WINDOW_MS=15000;
export const BLIND_SPOT='cross-host-live-turn-undetectable';
const TERMINAL_STATUSES=['completed','error'];
export function decideSharedWrite({task,target,observedAt,now=Date.now(),owned=false,maxObservationAgeMs=5000,maxActiveAgeMs=120000}={}) {
  const warning=task?.cronAutomationId||task?.offPeakTaskId?'automation-bound-session-may-run-in-background':null;
  const base={readOnlyOpen:true,kickOtherOwner:false,warning,concurrencyWarning:'official-gui-may-be-running-session',lastActivityAt:task?.lastActivityAt??task?.updatedAt??null,lastActivitySource:task?.lastActivityAt===undefined?'task.updatedAt':'task.lastActivityAt'};
  const result=(decision,reason,owner,allowed=false,extra={})=>({...base,decision,reason,owner,allowed,requiresConfirmation:false,...extra});
  if(!task||typeof task.taskId!=='string'||!task.taskId||!Number.isFinite(observedAt)||observedAt>now||now-observedAt>maxObservationAgeMs)return result('unknown','shared-task-signal-unavailable-or-stale','unknown');
  if(task.deleted===true)return result('unknown','official-task-deleted','unknown');
  if(target&&((target.sessionId!==undefined&&target.sessionId!==task.taskId)||(target.workspace!==undefined&&target.workspace!==task.workspacePath)))return result('unknown','official-task-address-mismatch','unknown');
  if(owned)return result('active','own-turn-busy','ours',true);
  if(task.status==='running'&&Number.isFinite(base.lastActivityAt)&&base.lastActivityAt<=now&&now-base.lastActivityAt<=maxActiveAgeMs)return result('active','official-gui-active-turn','other',true);
  if(TERMINAL_STATUSES.includes(task.status))return result('unverifiable','shared-terminal-task-liveness-unverifiable','none',true,{blindSpot:BLIND_SPOT});
  return result('unknown','shared-task-liveness-unknown','unknown',true);
}
export class SharedWriteGate {
  constructor({readTask,isOwned=()=>false,clock=Date.now,windowMs=DEFAULT_ACTIVITY_WINDOW_MS}={}){
    if(!Number.isSafeInteger(windowMs)||windowMs<MIN_ACTIVITY_WINDOW_MS||windowMs>MAX_ACTIVITY_WINDOW_MS)throw Error('activity-window-invalid');
    Object.assign(this,{readTask,isOwned,clock,windowMs});
  }
  async preflight(target){
    try{
      const task=await this.readTask(target),now=this.clock();
      return decideSharedWrite({task,target,observedAt:now,now,owned:this.isOwned(target)});
    }catch{
      return {...decideSharedWrite(),reason:'shared-task-signal-unavailable'};
    }
  }
  // No dispatch/stop/resume exists here; no activity sampling or operator confirmation gate.
}
// The live-usage surface reports per-session counters. Any missing or mismatched value fails closed
// instead of being treated as "no movement".
const USAGE_COUNTERS=['totalTokens','inputTokens','outputTokens','reasoningTokens','cacheCreationTokens','cacheReadTokens','modelRequestCount','modelErrorCount'];
export function usageActivity(value,sessionId){
  if(!sessionId||value?.sessionId!==sessionId||USAGE_COUNTERS.some(k=>!Number.isFinite(value[k])||value[k]<0))throw Error('activity-signal-invalid');
  return Object.fromEntries(USAGE_COUNTERS.map(k=>[k,value[k]]));
}
