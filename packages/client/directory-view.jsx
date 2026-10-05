import React,{useState,useMemo,useEffect,useSyncExternalStore} from 'react';
import {ZCodeConversationView,ConversationController} from './conversation-view.jsx';
import {SessionUsage} from './insights-view.jsx';
import {directorySections} from './directory-presentation.mjs';

export const directoryLocales={en:{directory:'ZCode sessions',search:'Search sessions',refresh:'Refresh',open:'Open / continue',previous:'Previous',next:'Next',shared:'Official GUI shared sessions: unverified',scope:'Bridge-owned store · valid for this running instance',partial:'Catalog is incomplete: official limit reached. Search covers the loaded prefix.',restricted:'Model execution remains restricted. Opening reads official history.',ungrouped:'Ungrouped',group:'DSH-only group (local display)',rename:'Rename',title:'Session title',delete:'Delete',confirm:'Confirm official deletion',cancel:'Cancel',disconnect:'Disconnect view',unverified:'Archive / pin unavailable: official carrier unverified',archive:'Archive',pin:'Pin',readOnly:'Official shared task store · read-only',pinned:'Pinned',archived:'Archived',archiveScope:'Archived tasks are excluded by the current read-only carrier.',recent:'Updated most recently first',custom:'Custom title',default:'Default title',generated:'Generated title',first_input:'First input title',unknown:'Title source unavailable',tools:'Directories and diagnostics',empty:'Select a ZCode session in the sidebar.',queryOutcome:'Query official outcome',pending:'Official command accepted; terminal outcome is not inferred.',failure:'Official operation failed',settings:'Local group settings could not be saved',catalogEntry:'MCP, plugins and skills',insightsEntry:'Account, usage and diagnostics',automationEntry:'Automations and off-peak',remoteEntry:'Remote workspaces and sessions',ownTurnEntry:'Bridge-owned minimal turn (S04)',ownTurnNote:'Creates one new ZCode session inside the bridge scratch workspace and sends exactly one minimal prompt. No shared user session is written; the ownership gate for the new session is shown after creation.',ownTurnRun:'Create session and send one prompt',ownTurnTask:'New task',ownTurnPrompt:'Prompt',ownTurnRequestsBefore:'Requests before',ownTurnTokensBefore:'Tokens before',ownTurnCalls:'Official write calls',ownTurnGate:'Ownership gate',ownTurnReadUsage:'Read session usage',ownTurnSessionUsage:'Session usage',ownTurnUsagePending:'not reported yet',issueButton:'ZCode issue',issueDialogTitle:'ZCode error details',issueClose:'Close',issueAvailability:'Execution source unavailable',issueRuntime:'Official runtime',issueCatalog:'Session catalog',issueSettings:'Local settings',issueAction:'Last operation','reason.not-connected':'Not connected','reason.connecting':'Connecting to the official runtime…','reason.host-unreachable':'Host unreachable; reconnecting automatically','reason.source-unavailable':'Official source not started yet (auto-start pending or stopped)','reason.sessions-invalid':'Official session response incompatible','reason.disposed':'Connection disposed','reason.source-address-mismatch':'Session address does not match the connected source','reason.reference-released':'Session reference released','reason.route-b-temp-socket-path-too-long':'Route B stopped: the scratch Unix socket path exceeds the macOS 103-byte limit','reason.route-b-retry-disabled':'Route B stopped; automatic retry is disabled for this instance (restart to retry)','reason.route-b-authorization-denied-scratch-fallback':'Route B authorization denied; isolated scratch fallback','reason.launcher-configuration-failed':'Launcher configuration failed','reason.launcher-unconfigured':'No launcher is configured','reason.launch-failed':'Official runtime launch failed','reason.official-auth-source-missing':'Official request authentication unavailable'},zh:{directory:'ZCode 会话',search:'搜索会话',refresh:'刷新',open:'打开 / 继续',previous:'上一页',next:'下一页',shared:'官方 GUI 共享会话：未验证',scope:'bridge 自有 store · 仅在本实例存活期间有效',partial:'目录不完整：已达到官方 limit。搜索仅覆盖已加载前缀。',restricted:'模型执行仍受限。打开只读取官方历史。',ungrouped:'未分组',group:'DSH-only 分组（本地展示）',rename:'重命名',title:'会话标题',delete:'删除',confirm:'确认官方删除',cancel:'取消',disconnect:'断开视图',unverified:'归档 / 置顶不可用：官方 carrier 未核实',archive:'归档',pin:'置顶',readOnly:'官方共享目录 · 只读',pinned:'置顶',archived:'已归档',archiveScope:'当前只读通道不加载归档会话。',recent:'最近更新优先',custom:'自定义标题',default:'默认标题',generated:'生成标题',first_input:'首条输入标题',unknown:'标题来源不可得',tools:'目录与诊断',empty:'请在侧栏选择 ZCode 会话。',queryOutcome:'查询官方结果',pending:'官方已受理；未推断执行终态。',failure:'官方操作失败',settings:'本地分组设置未能保存',catalogEntry:'MCP、插件与 Skills',insightsEntry:'账号、用量与诊断',automationEntry:'定时任务与闲时任务',remoteEntry:'远程工作区与会话',ownTurnEntry:'bridge 自有最小轮次（S04）',ownTurnNote:'在 bridge scratch 工作区内新建一个 ZCode 会话并只发送一条最小 prompt。不写任何共享用户会话；新建会话的归属闸门在创建后呈现。',ownTurnRun:'新建会话并发送一条 prompt',ownTurnTask:'新 task',ownTurnPrompt:'Prompt',ownTurnRequestsBefore:'发送前请求数',ownTurnTokensBefore:'发送前 tokens',ownTurnCalls:'官方写入调用',ownTurnGate:'归属闸门',ownTurnReadUsage:'回读会话 usage',ownTurnSessionUsage:'会话 usage',ownTurnUsagePending:'尚未回读',issueButton:'ZCode 异常',issueDialogTitle:'ZCode 错误详情',issueClose:'关闭',issueAvailability:'执行来源不可用',issueRuntime:'官方运行时',issueCatalog:'会话目录',issueSettings:'本地设置',issueAction:'最近操作','reason.not-connected':'未连接','reason.connecting':'正在连接官方运行时…','reason.host-unreachable':'宿主不可达，正在自动重连','reason.source-unavailable':'官方源尚未启动（自动启动未完成或已停止）','reason.sessions-invalid':'官方会话响应不兼容','reason.disposed':'连接已释放','reason.source-address-mismatch':'会话地址与当前来源不匹配','reason.reference-released':'会话引用已释放','reason.route-b-temp-socket-path-too-long':'Route B 已停止：scratch Unix socket 路径超过 macOS 103 字节上限','reason.route-b-retry-disabled':'Route B 已停止；本实例内不再自动重试（重启实例后重试）','reason.route-b-authorization-denied-scratch-fallback':'Route B 授权被拒；已回退隔离 scratch','reason.launcher-configuration-failed':'launcher 配置失败','reason.launcher-unconfigured':'未配置 launcher','reason.launch-failed':'官方运行时启动失败','reason.official-auth-source-missing':'官方请求认证不可用'}};
const fallback=key=>directoryLocales.en[key];
const reasonLabel=(code,t)=>{if(!code)return'';const key='reason.'+code,label=t(key);return label&&label!==key?label:code};
/** Occupies the existing sidebar's runtime-directory seam. All identities are full keys.
 *  The sidebar stays clean: no inline diagnostics. Any problem collapses into one button that
 *  opens a dialog with the specific error; detailed status lives in the plugin config page. */
const idleStatusSnapshot={status:{state:'restricted'},busy:false};
const idleStatus={subscribe:()=>()=>{},getSnapshot:()=>idleStatusSnapshot};
export function ZCodeDirectory({sources,status,onOpen,onOpenCatalog,onOpenInsights,onOpenAutomation,onOpenRemote,t=fallback}){
  const state=useSyncExternalStore(sources.directory.subscribe,sources.directory.getSnapshot,sources.directory.getSnapshot);
  const availability=useSyncExternalStore(sources.zcodeAvailability.subscribe,sources.zcodeAvailability.getSnapshot,sources.zcodeAvailability.getSnapshot);
  const statusController=status??idleStatus;
  const hostStatus=useSyncExternalStore(statusController.subscribe,statusController.getSnapshot,statusController.getSnapshot);
  const [busy,setBusy]=useState(false),[error,setError]=useState(null);
  const act=async action=>{setBusy(true);setError(null);try{await action()}catch(e){setError(e.code??e.message)}finally{setBusy(false)}};
  const shared=state.catalog.readOnly===true;
  const issues=[];
  if(availability.state==='unavailable'&&availability.reason!=='not-connected')issues.push({key:'availability',label:t('issueAvailability'),detail:reasonLabel(availability.reason,t)});
  if(status&&!hostStatus.busy&&hostStatus.status.state==='unavailable')issues.push({key:'runtime',label:t('issueRuntime'),detail:reasonLabel(hostStatus.status.reason,t)});
  if(state.catalog.truncated)issues.push({key:'catalog',label:t('issueCatalog'),detail:t('partial')});
  if(state.settingsError&&!shared)issues.push({key:'settings',label:t('issueSettings'),detail:reasonLabel(state.settingsError,t)});
  if(error)issues.push({key:'action',label:t('issueAction'),detail:reasonLabel(error,t)});
  const rows=<DirectoryRows rows={state.rows} sources={sources} t={t} busy={busy} shared={shared} act={act} onOpen={onOpen}/>;
  const paging=<nav aria-label={t('directory')} style={{display:'flex',alignItems:'center',gap:8,justifyContent:'space-between',marginTop:8}}>
    <button disabled={state.page===0} onClick={()=>sources.setDirectory({page:state.page-1})}>{t('previous')}</button>
    <small>{state.page+1} / {Math.max(1,Math.ceil(state.total/state.pageSize))} · {state.total}</small>
    <button disabled={(state.page+1)*state.pageSize>=state.total} onClick={()=>sources.setDirectory({page:state.page+1})}>{t('next')}</button>
  </nav>;
  return <section aria-label={t('directory')} style={{padding:8,minWidth:0,fontSize:13}}>
    <h4 style={{margin:'8px 0'}}>ZCode</h4>
    {issues.length>0&&<ErrorNotice issues={issues} t={t}/>}
    <div style={{display:'flex',gap:6,margin:'8px 0'}}>
      <input style={{minWidth:0,width:'100%'}} aria-label={t('search')} placeholder={t('search')} value={state.query} onChange={e=>sources.setDirectory({query:e.target.value})}/>
      <button style={{whiteSpace:'nowrap'}} disabled={busy} onClick={()=>void act(()=>sources.refresh())}>{t('refresh')}</button>
    </div>
    <details style={{marginBottom:8}}><summary>{t('tools')}</summary><div style={{display:'flex',flexWrap:'wrap',gap:6,paddingTop:6}}>
      {onOpenCatalog&&<button type="button" onClick={()=>onOpenCatalog()}>{t('catalogEntry')}</button>}
      {onOpenInsights&&<button type="button" onClick={()=>onOpenInsights()}>{t('insightsEntry')}</button>}
      {onOpenRemote&&<button type="button" onClick={()=>onOpenRemote()}>{t('remoteEntry')}</button>}
      {onOpenAutomation&&<button type="button" onClick={()=>onOpenAutomation()}>{t('automationEntry')}</button>}
    </div></details>
    {rows}
    {state.total>state.pageSize&&paging}
    {shared&&<details style={{marginTop:10}}><summary>{t('archived')}</summary><p>{t('archiveScope')}</p></details>}
    {shared&&<OwnMinimalTurn sources={sources} t={t}/>}
  </section>;
}
/** One quiet button while a problem exists; the dialog carries the specifics. */
function ErrorNotice({issues,t}){
  const [open,setOpen]=useState(false);
  return <>
    <button type="button" data-zcode-issue-button onClick={()=>setOpen(true)} style={{display:'block',width:'100%',margin:'4px 0',padding:'4px 8px',border:'1px solid var(--dsw-alias-border-warning, #b58900)',borderRadius:6,background:'transparent',color:'inherit',textAlign:'left'}}>⚠ {t('issueButton')}</button>
    {open&&<div role="dialog" aria-modal="true" aria-label={t('issueDialogTitle')} data-zcode-issue-dialog onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--dsw-alias-bg-surface, #fff)',color:'inherit',borderRadius:8,padding:16,maxWidth:480,margin:16,fontSize:13}}>
        <h4 style={{margin:'0 0 8px'}}>{t('issueDialogTitle')}</h4>
        <ul style={{margin:0,paddingLeft:18}}>{issues.map(issue=><li key={issue.key} style={{marginBottom:6}}><strong>{issue.label}</strong>: {issue.detail}</li>)}</ul>
        <button type="button" onClick={()=>setOpen(false)} style={{marginTop:10}}>{t('issueClose')}</button>
      </div>
    </div>}
  </>;
}
// S04: one bridge-owned model turn, triggered from this sidebar. The Host owns the single-shot claim
// and the new session identity, so this control accepts no address, prompt or model.
function OwnMinimalTurn({sources,t}){
  const [state,setState]=useState({status:'idle',value:null,error:null}),[gate,setGate]=useState(null),[usage,setUsage]=useState(null);
  const readUsage=async address=>{try{const response=await sources.rpc.call('/zcode-bridge','taskUsage',{address});setUsage(response.ok?response.value.usage:{error:response.error.code})}catch(error){setUsage({error:error?.code??'task-usage-unavailable'})}};
  const run=async()=>{
    setState({status:'pending',value:null,error:null});setGate(null);setUsage(null);
    let response;
    try{response=await sources.rpc.call('/zcode-bridge','ownTurn',{})}
    catch(error){setState({status:'error',value:null,error:{code:error?.code??'minimal-turn-unavailable'}});return}
    if(!response?.ok){setState({status:'error',value:null,error:{code:response?.error?.code??'minimal-turn-unavailable'}});return}
    setState({status:'done',value:response.value,error:null});
    try{const preflight=await sources.rpc.call('/zcode-bridge','writePreflight',{address:response.value.address});setGate(preflight.ok?preflight.value:{decision:'unknown',reason:preflight.error.code,owner:'unknown'})}
    catch{setGate({decision:'unknown',reason:'write-preflight-unavailable',owner:'unknown'})}
    await readUsage(response.value.address);
    try{await sources.refresh()}catch{}
  };
  const value=state.value;
  return <details style={{marginTop:10}}><summary>{t('ownTurnEntry')}</summary>
    <p role="note">{t('ownTurnNote')}</p>
    <button type="button" disabled={state.status==='pending'} onClick={()=>void run()}>{t('ownTurnRun')}</button>
    {state.status==='error'&&<p role="alert">{t('failure')}: {state.error.code}</p>}
    {value&&<dl data-own-turn="started" style={{margin:'6px 0'}}>
      <dt>{t('ownTurnTask')}</dt><dd data-own-turn-task={value.taskId}>{value.taskId}</dd>
      <dt>{t('ownTurnPrompt')}</dt><dd>{value.prompt}</dd>
      <dt>{t('ownTurnRequestsBefore')}</dt><dd>{value.usageBefore?.requestCount}</dd>
      <dt>{t('ownTurnTokensBefore')}</dt><dd>{value.usageBefore?.totalTokens}</dd>
      <dt>{t('ownTurnCalls')}</dt><dd>{(value.calls??[]).join(', ')}</dd>
      {gate&&<><dt>{t('ownTurnGate')}</dt><dd data-own-turn-gate={`${gate.decision}·${gate.reason}·${gate.owner}`}>{gate.decision} · {gate.reason} · {gate.owner}</dd></>}
      <dt>{t('ownTurnSessionUsage')}</dt><dd data-own-turn-usage={usage?(usage.error?'error':'loaded'):'none'}>{usage?usage.error?`${t('failure')}: ${usage.error}`:`${usage.modelRequestCount} requests · ${usage.totalTokens} tokens` : t('ownTurnUsagePending')}</dd>
    </dl>}
    {value&&<button type="button" onClick={()=>void readUsage(value.address)}>{t('ownTurnReadUsage')}</button>}
  </details>;
}
function DirectoryRows({rows,sources,t,busy,shared,act,onOpen}){
  return <div style={{maxHeight:'clamp(120px, calc(100dvh - 560px), 55vh)',overflowY:'auto',minWidth:0}}>{directorySections(rows).map(section=><div key={section.key} data-workspace={section.workspace} style={{borderTop:'1px solid var(--dsw-alias-border-primary, #8884)',paddingTop:6,marginTop:8}}>
    <h5 title={section.workspace} style={{margin:'0 0 4px',display:'flex',gap:5,minWidth:0}}>
      {section.pinned&&<span>{t('pinned')} · </span>}
      <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{shared?section.workspace.split('/').filter(Boolean).slice(-2).join('/')||section.workspace:section.group||t('ungrouped')}</span>
    </h5>
    <ul style={{listStyle:'none',margin:0,padding:0}}>{section.rows.map(row=><li key={row.key} data-session-key={row.key} style={{minWidth:0,marginBottom:3}}>
      <button disabled={busy} onClick={()=>void act(async()=>{await sources.open(row.address);onOpen?.()})} title={row.title||row.address.sessionId} style={{display:'block',width:'100%',minWidth:0,textAlign:'left',padding:'6px 8px',border:'1px solid var(--dsw-alias-border-primary, #8884)',borderRadius:6,background:'transparent',color:'inherit'}}>
        <span style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.title||row.address.sessionId}</span>
        {shared&&<small data-title-source={row.sharedTask?.titleSource??'unknown'} style={{display:'block',opacity:0.7,fontSize:11}}>{t(row.sharedTask?.titleSource??'unknown')}</small>}
      </button>
      {!shared&&<GroupInput row={row} sources={sources} t={t}/>}
    </li>)}</ul>
  </div>)}</div>;
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
  if(selected.readOnly)return <SharedTaskPanel key={JSON.stringify(selected.address)} selected={selected} sources={sources}/>;
  return <div key={JSON.stringify(selected.address)} style={{height:'100%',overflow:'auto'}}><p>{t('shared')} · {t('scope')}</p>
    <Management sources={sources} selected={selected} t={t}/>
    <SessionUsage conversation={selected.conversation}/>
    <button onClick={()=>void sources.disconnect()}>{t('disconnect')}</button>
    <ZCodeConversationView conversation={selected.conversation}/>
  </div>;
}

// One acknowledgement per session per DSH web view. A page reload is a new DSH session and must
// ask again; the host gate stays fail-closed and never derives idleness from this local state.
const sharedWriteConfirmations=new Set();
function SharedTaskPanel({selected,sources}){
  const key=JSON.stringify(selected.address);
  const [gate,setGate]=useState({decision:'unknown',allowed:false,reason:'shared-task-signal-unavailable-or-stale'}),[draft,setDraft]=useState('');
  const [acknowledged,setAcknowledged]=useState(()=>sharedWriteConfirmations.has(key)),[promptOpen,setPromptOpen]=useState(()=>!sharedWriteConfirmations.has(key));
  useEffect(()=>{const known=sharedWriteConfirmations.has(key);setAcknowledged(known);setPromptOpen(!known);},[key]);
  useEffect(()=>{
    let live=true,timer,abort;
    const refresh=async()=>{
      abort=new AbortController();
      try{const response=await sources.rpc.call('/zcode-bridge','writePreflight',{address:selected.address},abort.signal);if(live)setGate(response.ok?response.value:{decision:'unknown',allowed:false,reason:response.error.code});}
      catch{if(live)setGate({decision:'unknown',allowed:false,reason:'shared-task-signal-unavailable-or-stale'});}
      if(live)timer=setTimeout(refresh,2000);
    };
    void refresh();return ()=>{live=false;clearTimeout(timer);abort?.abort();};
  },[selected.address,sources]);
  const blindSpot=gate.decision==='unverifiable';
  const needsConfirmation=blindSpot&&!acknowledged;
  // Confirmation only promotes the blind-spot state; a live/unknown signal still blocks.
  const writable=gate.allowed||(blindSpot&&acknowledged);
  const confirm=()=>{sharedWriteConfirmations.add(key);setAcknowledged(true);setPromptOpen(false);};
  return <section aria-label="ZCode read-only session" style={{padding:16}}>
    <h3>{selected.row.title}</h3><p>{selected.address.workspace}</p>
    <p>Official shared session metadata · read-only open · history activation and model requests disabled.</p>
    <p role="status" data-testid="zcode-shared-write-gate">{gate.decision} · {gate.reason}</p>
    {gate.blindSpot&&<p role="note" data-testid="zcode-shared-write-blindspot">对侧实时运行无法完全判定（长工具等待期检测盲区）</p>}
    {gate.warning&&<p role="alert">This session is bound to an automation and may run in the background.</p>}
    {needsConfirmation&&promptOpen&&<div role="dialog" aria-label="Confirm shared write">
      <p>对侧实时运行无法完全判定（长工具等待期检测盲区）。确认后，本 DSH 会话内对该会话的后续写入按 idle 处理；这不证明官方侧已空闲，也不改变官方会话状态。</p>
      <p>Cross-Host live execution cannot be fully determined (long tool-wait detection blind spot). Confirming once enables drafting for this session in this DSH view; it does not prove the official side is idle.</p>
      <button type="button" onClick={confirm}>Confirm blind spot for this session</button>
      <button type="button" onClick={()=>setPromptOpen(false)}>Keep blocked</button>
    </div>}
    {needsConfirmation&&!promptOpen&&<button type="button" onClick={()=>setPromptOpen(true)}>Confirm blind spot for this session</button>}
    <label>Draft<textarea aria-label="Shared session draft" value={draft} disabled={!writable} onChange={e=>setDraft(e.target.value)}/></label>
    <button disabled title="S03: zero model requests">Send</button>
    <p>{writable?'Task is treated as idle in this DSH view after confirmation. S03 model execution remains disabled.':needsConfirmation?'Cross-Host liveness is unverifiable. Confirm the blind spot once to enable drafting; S03 model execution remains disabled.':'Writing is blocked. The view remains open and the draft is retained.'}</p>
    <button onClick={()=>void sources.disconnect()}>Disconnect view</button>
  </section>;
}
