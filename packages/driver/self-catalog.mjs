import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {homedir} from 'node:os';

const diagnose=(logger,event)=>{try{if(typeof logger==='function')logger(event);else logger?.warn?.(event)}catch{ /* Diagnostics cannot break catalog reads. */ }};
const nonempty=value=>typeof value==='string'&&value.length>0;
const metadata=source=>({
  ...(typeof source.createdAt==='number'?{createdAt:source.createdAt}:{}),
  ...(typeof source.updatedAt==='number'?{updatedAt:source.updatedAt}:{}),
  ...(source.archived===true||source.archived===1?{archived:true}:{}),
});
/** Read-only official index plus already-live peers. This path never acquires an executor. */
export async function readSelfManagedCatalog({pool,store,sqlitePath=join(homedir(),'.zcode','v2','tasks-index.sqlite'),logger,authority,titleFor}={}){
  const rows=new Map();let dropped=0,failed=false,database;
  const add=(sessionId,workspacePath,source={},workspaceIdentity=workspacePath)=>{
    if(!nonempty(workspacePath)){dropped++;return}
    if(!nonempty(sessionId))return;
    const row={sessionId,workspacePath,workspaceIdentity,authority,...(typeof source.title==='string'?{title:source.title}:{}),...metadata(source)};
    const key=JSON.stringify([workspacePath,sessionId]);const merged={...rows.get(key),...row};
    if(source.archived===false||source.archived===0)delete merged.archived;
    rows.set(key,merged);
  };
  try{
    database=new DatabaseSync(sqlitePath,{readOnly:true});
    for(const task of database.prepare('SELECT workspace_path,workspace_identity,task_id,title,created_at,updated_at,archived,deleted FROM tasks').all()){
      if(task.deleted!==0)continue;
      add(task.task_id,task.workspace_path,{title:task.title,createdAt:task.created_at,updatedAt:task.updated_at,archived:task.archived},task.workspace_identity??task.workspace_path);
    }
  }catch(error){failed=true;rows.clear();diagnose(logger,{event:'catalog-sqlite-unavailable',code:error.code??'sqlite-read-failed'})}
  finally{try{database?.close()}catch(error){diagnose(logger,{event:'catalog-sqlite-close-failed',code:error.code})}}
  const live=pool?.live?.()??[],supplement=[];let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,live.length)},async()=>{
    while(cursor<live.length){
      const {facade,workspacePath}=live[cursor++];
      try{
        const request=facade.requestIfLive('session/list',{workspace:{workspacePath,workspaceKey:workspacePath},limit:50});
        if(request===null)continue;
        const result=await request;
        if(!Array.isArray(result?.sessions))throw Object.assign(new Error('sessions-invalid'),{code:'sessions-invalid'});
        for(const session of result.sessions)supplement.push({session,workspacePath});
      }catch(error){diagnose(logger,{event:'catalog-live-unavailable',workspacePath,code:error.code??'session-list-failed'})}
    }
  }));
  if(failed){
    // Factory creation bindings carry executionWorkspace; resumed bindings carry their own project.
    for(const [id,binding] of Object.entries(store?.value?.bindings??{})){
      if(typeof binding!=='string'&&typeof binding?.sessionId!=='string')continue;
      const owner=typeof binding==='string'?binding:binding.sessionId;
      let title;try{title=await titleFor?.(owner)}catch{ /* Missing DSH projection leaves a placeholder. */ }
      add(id,typeof binding==='object'?binding.workspace:undefined,{title});
    }
  }
  // Apply live values last even when fallback discovery runs after the live read phase.
  for(const {session,workspacePath} of supplement)add(session.sessionId,workspacePath,session);
  if(dropped)diagnose(logger,{event:'catalog-row-dropped',count:dropped});
  return [...rows.values()];
}
