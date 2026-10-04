const time=row=>Number.isFinite(row.sharedTask?.lastActivityAt)?row.sharedTask.lastActivityAt:0;
// Sort before slicing so refresh/address reads cannot move a recent task to the tail.
export function sortDirectoryRows(rows){
  return [...rows].sort((a,b)=>Number(b.sharedTask?.pinned===true)-Number(a.sharedTask?.pinned===true)||time(b)-time(a)||a.key.localeCompare(b.key));
}
export function directorySections(rows){
  const sections=new Map();
  for(const row of rows){
    const pinned=row.sharedTask?.pinned===true,workspace=row.address.workspace;
    const key=JSON.stringify([pinned,workspace,row.group??'']);
    if(!sections.has(key))sections.set(key,{key,pinned,workspace,group:row.group??'',rows:[]});
    sections.get(key).rows.push(row);
  }
  return [...sections.values()];
}
