// Presentation metadata from the two already-authorized task list carriers.
// Pinned membership is authoritative from listPinnedTasks; no additional RPC.
export function projectTask(t){
  if(!t||typeof t.taskId!=='string'||typeof t.workspacePath!=='string'||typeof t.title!=='string')throw Object.assign(new Error('route-b-task-invalid'),{code:'route-b-task-invalid'});
  return Object.fromEntries(['taskId','workspacePath','workspaceIdentity','title','titleSource','titleOverridden','status','updatedAt','createdAt','traceId','cronAutomationId','offPeakTaskId','archived','deleted'].filter(k=>t[k]!==undefined).map(k=>[k,t[k]]));
}
export function projectTaskCatalog(regular,pinned){
  if(!Array.isArray(regular)||!Array.isArray(pinned))throw Object.assign(new Error('route-b-tasks-invalid'),{code:'route-b-tasks-invalid'});
  const rows=new Map();
  for(const [items,isPinned] of [[regular,false],[pinned,true]])for(const item of items){
    const task=projectTask(item),key=JSON.stringify([task.workspacePath,task.taskId]);
    rows.set(key,{...task,pinned:isPinned});
  }
  return [...rows.values()].filter(task=>task.deleted!==true);
}
