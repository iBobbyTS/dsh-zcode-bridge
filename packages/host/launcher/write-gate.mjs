// Admission is evaluated at each proposed write event. Opening a view never claims a lease.
// Shared task metadata is the source; raw sessions-index is deliberately absent.
//
// P28 (main ruling): a terminal shared task (completed/error) can never be promoted to `idle`
// across Hosts. The official tasks-index only records terminal transitions, and a session that
// is resumed and running again does not rewrite `running`; `getTaskMeta`/`listSessions` read the
// same cold store, so the other Host's live turn is indistinguishable from an idle session
// (see docs/probes/checks/s03-p2-resume/active-stimulus/result.json). We therefore expose an
// honest fourth state `unverifiable` (blind spot) that requires an explicit, per-view
// acknowledgement before any future write may proceed.
export const DEFAULT_ACTIVITY_WINDOW_MS=5000;
export const MIN_ACTIVITY_WINDOW_MS=2000;
export const MAX_ACTIVITY_WINDOW_MS=15000;
export const BLIND_SPOT='cross-host-live-turn-undetectable';
const TERMINAL_STATUSES=['completed','error'];
export function decideSharedWrite({task,observedAt,now=Date.now(),owned=false,confirmed=false,maxObservationAgeMs=5000,maxActiveAgeMs=120000}={}) {
  const warning=task?.cronAutomationId||task?.offPeakTaskId?'automation-bound-session-may-run-in-background':null;
  const base={readOnlyOpen:true,kickOtherOwner:false,warning,lastActivityAt:task?.lastActivityAt??task?.updatedAt??null,lastActivitySource:task?.lastActivityAt===undefined?'task.updatedAt':'task.lastActivityAt'};
  const result=(decision,reason,owner,allowed=false,extra={})=>({...base,decision,reason,owner,allowed,requiresConfirmation:false,...extra});
  if(owned)return result('active','own-turn-busy','ours');
  if(!task||!Number.isFinite(observedAt)||observedAt>now||now-observedAt>maxObservationAgeMs||!Number.isFinite(base.lastActivityAt)||base.lastActivityAt>now)return result('unknown','shared-task-signal-unavailable-or-stale','unknown');
  if(task.status==='running')return now-base.lastActivityAt>maxActiveAgeMs?result('unknown','shared-running-signal-stale','unknown'):result('active','official-gui-active-turn','other');
  if(TERMINAL_STATUSES.includes(task.status)){
    // A terminal status is not proof of idleness: the other Host may have revived the session and
    // be waiting inside a long tool call. Only an explicit operator acknowledgement may proceed.
    if(confirmed)return result('idle','shared-terminal-task-operator-confirmed','none',true);
    return result('unverifiable','shared-terminal-task-liveness-unverifiable','none',false,{requiresConfirmation:true,blindSpot:BLIND_SPOT});
  }
  return result('unknown','shared-task-status-unconfirmed','unknown');
}
export class SharedWriteGate {
  constructor({readTask,readActivity,isOwned=()=>false,isConfirmed=()=>false,clock=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms)),windowMs=DEFAULT_ACTIVITY_WINDOW_MS}={}){
    if(!Number.isSafeInteger(windowMs)||windowMs<MIN_ACTIVITY_WINDOW_MS||windowMs>MAX_ACTIVITY_WINDOW_MS)throw Error('activity-window-invalid');
    Object.assign(this,{readTask,readActivity,isOwned,isConfirmed,clock,wait,windowMs});
  }
  async preflight(target){
    const decide=(task,extra={})=>({...decideSharedWrite({task,observedAt:this.clock(),now:this.clock(),owned:this.isOwned(target),confirmed:this.isConfirmed(target)}),...extra});
    const moved=(task,reason,activity)=>({...decide(task),decision:'active',reason,owner:'other',allowed:false,requiresConfirmation:false,blindSpot:undefined,activity});
    try{
      if(this.isOwned(target))return decide();
      const task0=await this.readTask(target);
      const initial=decide(task0);
      // Only the blind-spot state is worth a second look; running/unknown/idle/own are already decided.
      if(initial.decision!=='unverifiable'||!this.readActivity)return initial;
      // Auxiliary heuristic (not a guarantee): sample the official session usage across a bounded
      // window. Movement proves the other Host is consuming a model request, so writing is blocked
      // without any confirmation path. Stationary usage proves nothing and stays `unverifiable`.
      const before=usageActivity(await this.readActivity(target),target.sessionId);
      await this.wait(this.windowMs);
      if(this.isOwned(target))return decide();
      const task1=await this.readTask(target);
      const after=usageActivity(await this.readActivity(target),target.sessionId);
      const changed=Object.keys(before).filter(k=>before[k]!==after[k]);
      if(changed.length)return moved(task0,'official-session-usage-moved',{signal:'sessionUsage',windowMs:this.windowMs,changed});
      const updatedAtMoved=Number.isFinite(task0?.updatedAt)&&Number.isFinite(task1?.updatedAt)&&task0.updatedAt!==task1.updatedAt;
      const final=decide(task1);
      if(updatedAtMoved&&final.decision==='unverifiable')return moved(task1,'official-session-activity-moved',{signal:'task.updatedAt',windowMs:this.windowMs,changed:['updatedAt']});
      // Nothing moved: the shared store still only says "terminal", so the blind spot remains.
      return final.decision==='unverifiable'?{...final,activity:{signal:'sessionUsage',windowMs:this.windowMs,changed:[]}}:final;
    }catch{
      if(this.isOwned(target))return decide();
      return {...decide(),reason:'shared-task-or-activity-signal-unavailable'};
    }
  }
  // No dispatch/stop/resume exists here. S03 tests exercise decisions with zero writes.
}
// The live-usage surface reports per-session counters. Any missing or mismatched value fails closed
// instead of being treated as "no movement".
const USAGE_COUNTERS=['totalTokens','inputTokens','outputTokens','reasoningTokens','cacheCreationTokens','cacheReadTokens','modelRequestCount','modelErrorCount'];
export function usageActivity(value,sessionId){
  if(!sessionId||value?.sessionId!==sessionId||USAGE_COUNTERS.some(k=>!Number.isFinite(value[k])||value[k]<0))throw Error('activity-signal-invalid');
  return Object.fromEntries(USAGE_COUNTERS.map(k=>[k,value[k]]));
}
