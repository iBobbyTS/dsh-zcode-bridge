import React,{useState,useMemo,useEffect,useSyncExternalStore} from 'react';
import {ZCodeConversationView,ConversationController} from './conversation-view.jsx';
import {SessionUsage} from './insights-view.jsx';

export const directoryLocales={en:{directory:'ZCode sessions',search:'Search sessions',refresh:'Refresh',open:'Open / continue',previous:'Previous',next:'Next',shared:'Official GUI shared sessions: unverified',scope:'Bridge-owned store · valid for this running instance',partial:'Catalog is incomplete: official limit reached. Search covers the loaded prefix.',restricted:'Model execution remains restricted. Opening reads official history.',ungrouped:'Ungrouped',group:'DSH-only group (local display)',rename:'Rename',title:'Session title',delete:'Delete',confirm:'Confirm official deletion',cancel:'Cancel',disconnect:'Disconnect view',unverified:'Archive / pin unavailable: official carrier unverified',archive:'Archive',pin:'Pin',empty:'Select a ZCode session in the sidebar.',queryOutcome:'Query official outcome',pending:'Official command accepted; terminal outcome is not inferred.',failure:'Official operation failed',settings:'Local group settings could not be saved',catalogEntry:'MCP, plugins and skills',insightsEntry:'Account, usage and diagnostics'},zh:{directory:'ZCode 会话',search:'搜索会话',refresh:'刷新',open:'打开 / 继续',previous:'上一页',next:'下一页',shared:'官方 GUI 共享会话：未验证',scope:'bridge 自有 store · 仅在本实例存活期间有效',partial:'目录不完整：已达到官方 limit。搜索仅覆盖已加载前缀。',restricted:'模型执行仍受限。打开只读取官方历史。',ungrouped:'未分组',group:'DSH-only 分组（本地展示）',rename:'重命名',title:'会话标题',delete:'删除',confirm:'确认官方删除',cancel:'取消',disconnect:'断开视图',unverified:'归档 / 置顶不可用：官方 carrier 未核实',archive:'归档',pin:'置顶',empty:'请在侧栏选择 ZCode 会话。',queryOutcome:'查询官方结果',pending:'官方已受理；未推断执行终态。',failure:'官方操作失败',settings:'本地分组设置未能保存',catalogEntry:'MCP、插件与 Skills',insightsEntry:'账号、用量与诊断'}};
const fallback=key=>directoryLocales.en[key];
/** Occupies the existing sidebar's runtime-directory seam. All identities are full keys. */
export function ZCodeDirectory({sources,onOpen,onOpenCatalog,onOpenInsights,t=fallback}){
  const state=useSyncExternalStore(sources.directory.subscribe,sources.directory.getSnapshot,sources.directory.getSnapshot);
  const availability=useSyncExternalStore(sources.zcodeAvailability.subscribe,sources.zcodeAvailability.getSnapshot,sources.zcodeAvailability.getSnapshot);
  const [busy,setBusy]=useState(false),[error,setError]=useState(null);
  const act=async action=>{setBusy(true);setError(null);try{await action()}catch(e){setError(e.code??e.message)}finally{setBusy(false)}};
  return <section aria-label={t('directory')} style={{padding:8,overflowWrap:'anywhere'}}>
    <h4><span role="img" aria-label="ZCode">Z</span> {t('directory')}</h4>
    <p>{t('shared')}</p><p>{t('scope')}</p>
    <input aria-label={t('search')} value={state.query} onChange={e=>sources.setDirectory({query:e.target.value})}/>
    <button disabled={busy} onClick={()=>void act(()=>sources.refresh())}>{t('refresh')}</button>
    {onOpenCatalog&&<button type="button" onClick={()=>onOpenCatalog()}>{t('catalogEntry')}</button>}
    {onOpenInsights&&<button type="button" onClick={()=>onOpenInsights()}>{t('insightsEntry')}</button>}
    {availability.state==='unavailable'&&<p role="alert">{t('failure')}: {availability.reason}</p>}
    {state.catalog.truncated&&<p role="alert">{t('partial')}</p>}
    {state.settingsError&&<p role="alert">{t('settings')}: {state.settingsError}</p>}
    {error&&<p role="alert">{t('failure')}: {error}</p>}
    {[...new Set(state.rows.map(row=>row.group))].map(group=><div key={group}><h5>{group||t('ungrouped')}</h5><ul>{state.rows.filter(row=>row.group===group).map(row=><li key={row.key} data-session-key={row.key}>
      <button disabled={busy} onClick={()=>void act(async()=>{await sources.open(row.address);onOpen?.()})} title={t('open')}>{row.title||row.address.sessionId}</button>
      <GroupInput row={row} sources={sources} t={t}/>
    </li>)}</ul></div>)}
    <button disabled={state.page===0} onClick={()=>sources.setDirectory({page:state.page-1})}>{t('previous')}</button>
    <span>{state.page+1} / {Math.max(1,Math.ceil(state.total/state.pageSize))} · {state.total}</span>
    <button disabled={(state.page+1)*state.pageSize>=state.total} onClick={()=>sources.setDirectory({page:state.page+1})}>{t('next')}</button>
    <p>{t('restricted')}</p>
  </section>;
}
function GroupInput({row,sources,t}){
  const [draft,setDraft]=useState(row.group);
  useEffect(()=>{setDraft(row.group)},[row.group]);
  const commit=()=>{
    const trimmed=draft.trim();
    if(trimmed!==row.group)sources.setGroup(row.address,trimmed);
    else setDraft(row.group);
  };
  return <label>{t('group')}<input aria-label={`${t('group')}: ${row.title||row.address.sessionId}`} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit()}}/></label>;
}
function Management({sources,selected,t}){
  const controller=useMemo(()=>new ConversationController(selected.conversation),[selected.conversation]);
  useEffect(()=>()=>controller.dispose(),[controller]);
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const [title,setTitle]=useState(''),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState(null);
  const enabled=state.managementAdmission?.allowed===true;
  const run=async(type,payload)=>{setBusy(true);setResult(null);try{const result=await sources.manage(selected.address,type,payload);setResult(result);if(result.ack?.status!=='accepted'&&result.ack?.status!=='duplicate')setTitle('')}catch(error){setResult({state:'failed',error:error.code??error.message});setTitle('')}finally{setBusy(false);setConfirm(false)}};
  return <section aria-label={t('title')}>
    <input aria-label={t('title')} value={title} disabled={!enabled||busy} onChange={e=>setTitle(e.target.value)}/>
    <button disabled={!enabled||busy||!title.trim()} onClick={()=>void run('renameSession',{title:title.trim()})}>{t('rename')}</button>
    <button disabled={!enabled||busy} onClick={()=>setConfirm(true)}>{t('delete')}</button>
    {confirm&&<div role="dialog" aria-label={t('confirm')}><button disabled={busy} onClick={()=>void run('deleteSession',{})}>{t('confirm')}</button><button disabled={busy} onClick={()=>setConfirm(false)}>{t('cancel')}</button></div>}
    <button disabled title={t('unverified')}>{t('archive')}</button><button disabled title={t('unverified')}>{t('pin')}</button><p>{t('unverified')}</p>
    {result?.state==='outcome-unknown'&&<button disabled={busy} onClick={()=>{setBusy(true);void sources.queryManagement(result.commandId).then(setResult,error=>setResult({...result,error:error.code??error.message})).finally(()=>setBusy(false))}}>{t('queryOutcome')}</button>}
    {result&&<p role="status">{result.state} · {result.ack?.reasonCode??result.error??t('pending')}</p>}
  </section>;
}
/** Bridge panel uses the same foreign conversation renderer, with a separately owned view. */
export function ZCodeSessionPanel({sources,t=fallback}){
  const selected=useSyncExternalStore(sources.selection.subscribe,sources.selection.getSnapshot,sources.selection.getSnapshot);
  if(!selected)return <p>{t('empty')}</p>;
  return <div key={JSON.stringify(selected.address)} style={{height:'100%',overflow:'auto'}}><p>{t('shared')} · {t('scope')}</p>
    <Management sources={sources} selected={selected} t={t}/>
    <SessionUsage conversation={selected.conversation}/>
    <button onClick={()=>void sources.disconnect()}>{t('disconnect')}</button>
    <ZCodeConversationView conversation={selected.conversation}/>
  </div>;
}
