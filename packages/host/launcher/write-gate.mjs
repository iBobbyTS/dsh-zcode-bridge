// Admission is evaluated at each proposed write event. Opening a view never claims a lease.
// Shared task metadata is the source; raw sessions-index is deliberately absent.
export function decideSharedWrite({task,observedAt,now=Date.now(),owned=false,maxObservationAgeMs=5000,maxActiveAgeMs=120000}={}) {
  const warning=task?.cronAutomationId||task?.offPeakTaskId?'automation-bound-session-may-run-in-background':null;
  const base={readOnlyOpen:true,kickOtherOwner:false,warning,lastActivityAt:task?.lastActivityAt??task?.updatedAt??null,lastActivitySource:task?.lastActivityAt===undefined?'task.updatedAt':'task.lastActivityAt'};
  const result=(decision,reason,owner,allowed=false)=>({...base,decision,reason,owner,allowed});
  if(owned)return result('active','own-turn-busy','ours');
  if(!task||!Number.isFinite(observedAt)||observedAt>now||now-observedAt>maxObservationAgeMs||!Number.isFinite(base.lastActivityAt)||base.lastActivityAt>now)return result('unknown','shared-task-signal-unavailable-or-stale','unknown');
  if(task.status==='running')return now-base.lastActivityAt>maxActiveAgeMs?result('unknown','shared-running-signal-stale','unknown'):result('active','official-gui-active-turn','other');
  if(['completed','error'].includes(task.status))return result('idle','shared-task-confirmed-idle','none',true);
  return result('unknown','shared-task-status-unconfirmed','unknown');
}
export class SharedWriteGate {
  constructor({readTask,isOwned=()=>false,clock=Date.now}={}){this.readTask=readTask;this.isOwned=isOwned;this.clock=clock;}
  async preflight(target){
    try{const task=await this.readTask(target);return decideSharedWrite({task,observedAt:this.clock(),now:this.clock(),owned:this.isOwned(target)});}
    catch{return decideSharedWrite({owned:this.isOwned(target),now:this.clock()});}
  }
  // No dispatch/stop/resume exists here. S03 tests exercise decisions with zero writes.
}
