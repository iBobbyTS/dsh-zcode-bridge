import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {operationOutcome} from './catalog.mjs';

export const catalogLocales={en:{
  catalog:'ZCode MCP, plugins and skills',restricted:'Official runtime is restricted; account state stays authoritative.',refresh:'Refresh official directory',unavailable:'Directory unavailable',authUnknown:'Official authentication is unavailable; marketplace and account-gated actions may be denied by the official runtime.',
  mcp:'MCP servers',noMcp:'No MCP server is currently configured.',pluginReference:'Plugin references',skills:'Skill references',marketplaces:'Marketplaces',installed:'Installed plugins',available:'Available plugins',diagnostics:'Official diagnostics',enabled:'Enabled',disabled:'Disabled',
  enable:'Enable',disable:'Disable',install:'Install',uninstall:'Uninstall',update:'Update',configure:'Configure',resetConfig:'Reset config',addMarketplace:'Add marketplace',updateMarketplace:'Refresh',removeMarketplace:'Remove',validate:'Validate',describe:'Describe',cancel:'Cancel',pending:'Awaiting official result',completed:'Official result',failed:'Official operation failed',cancelled:'Cancelled',verifyAndInstall:'Verify and install',pluginName:'Plugin name',marketplace:'Marketplace',scope:'Scope',source:'Marketplace source',options:'Options (JSON)',dryRun:'Dry run',unknownKind:'Unrecognized official entry',noOperations:'No management operation yet.',components:'Components',compatibility:'Compatibility',ok:'Valid',invalid:'Invalid'
},zh:{
  catalog:'ZCode MCP、插件与 Skills',restricted:'官方 runtime 受限；账号状态以官方为准。',refresh:'刷新官方目录',unavailable:'目录不可用',authUnknown:'官方认证不可用；市场与账号门禁操作可能被官方运行时拒绝。',
  mcp:'MCP 服务器',noMcp:'当前没有配置 MCP 服务器。',pluginReference:'插件引用',skills:'Skill 引用',marketplaces:'插件市场',installed:'已安装插件',available:'可安装插件',diagnostics:'官方诊断',enabled:'已启用',disabled:'已禁用',
  enable:'启用',disable:'禁用',install:'安装',uninstall:'卸载',update:'更新',configure:'配置',resetConfig:'重置配置',addMarketplace:'添加市场',updateMarketplace:'刷新',removeMarketplace:'移除',validate:'校验',describe:'详情',cancel:'取消',pending:'等待官方结果',completed:'官方结果',failed:'官方操作失败',cancelled:'已取消',verifyAndInstall:'校验并安装',pluginName:'插件名',marketplace:'市场',scope:'作用域',source:'市场来源',options:'配置项（JSON）',dryRun:'试运行',unknownKind:'未识别的官方条目',noOperations:'尚无管理操作。',components:'组件',compatibility:'兼容性',ok:'有效',invalid:'无效'
}};
const fallback=key=>catalogLocales.en[key];
const newOpId=()=>globalThis.crypto?.randomUUID?.()??`s09-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const rowText=(code,message)=>message?`${code}: ${message}`:code;
const statusLine=status=>`${status.status}${status.failureKind?` · ${status.failureKind}`:''}${status.authorization?` · oauth:${status.authorization.type}`:''}${status.toolCount!==undefined?` · ${status.toolCount} tools`:''}`;

/** Read-mostly official directory with management actions. Nothing here is a second catalog. */
export function ZCodeCatalogPanel({sources,onBack,t=fallback}){
  const state=useSyncExternalStore(sources.subscribe,sources.getSnapshot,sources.getSnapshot);
  const [busy,setBusy]=useState(false),[actionError,setActionError]=useState(null);
  useEffect(()=>{void sources.refresh().catch(()=>{})},[sources]);
  const [pluginName,setPluginName]=useState(''),[marketplace,setMarketplace]=useState(''),[source,setSource]=useState(''),[options,setOptions]=useState('{}');
  const admission=state.admission??{reads:{allowed:false},writes:{allowed:false}};
  const run=async action=>{setBusy(true);setActionError(null);try{return await action()}catch(error){setActionError(rowText(error.code??'catalog-unavailable',error.message));return null}finally{setBusy(false)}};
  const operate=(action,params,id)=>run(()=>sources.operate(action,params,id??newOpId()));
  const section=(name,render)=>{const slot=state.sections?.[name];if(!slot)return <p role="status">{t('pending')}</p>;if(slot.error)return <p role="alert">{t('unavailable')}: {rowText(slot.error.code,slot.error.message)}</p>;return render(slot.value)};
  return <section aria-label={t('catalog')} style={{padding:12,overflowWrap:'anywhere',fontSize:14}}>
    <h3>{t('catalog')}</h3>
    {onBack&&<button type="button" onClick={()=>onBack()}>Back</button>}
    <p role="status">{admission.reads?.allowed?`reads · ${admission.writes?.allowed?'writes':'read-only'}`:`${t('restricted')} (${admission.reads?.reason??'unknown'})`}{state.auth&&state.auth!=='confirmed'?` · ${state.auth}`:''}</p>
    {admission.reads?.allowed&&state.auth!=='confirmed'&&<p role="note">{t('authUnknown')}</p>}
    <button type="button" disabled={busy||!admission.reads?.allowed} onClick={()=>void run(()=>sources.refresh())}>{t('refresh')}</button>
    {state.error&&<p role="alert">{t('failed')}: {rowText(state.error.code,state.error.message)}</p>}
    {actionError&&<p role="alert">{t('failed')}: {actionError}</p>}

    <h4>{t('mcp')}</h4>
    {section('mcp',value=>{const entries=Object.entries(value.statuses??{});return entries.length===0?<p>{t('noMcp')}</p>:<ul>{entries.map(([name,status])=><li key={name} data-mcp-name={name}><strong>{name}</strong> — {statusLine(status)}{status.error&&<span> · {status.error}</span>}</li>)}</ul>})}

    <h4>{t('marketplaces')}</h4>
    {section('overview',value=><>
      {value.capability?.supported===false&&<p role="note">{t('unavailable')}: {value.capability.reason??'official'}</p>}
      <ul>{value.marketplaces.map(m=><li key={m.id} data-marketplace={m.id}>{m.name} · {m.pluginCount} plugins{m.refreshFailure&&<span role="alert"> · {rowText(m.refreshFailure.code,m.refreshFailure.message)}</span>}
        {admission.writes?.allowed&&<><button type="button" disabled={busy} onClick={()=>void operate('marketplaceUpdate',{marketplace:m.id})}>{t('updateMarketplace')}</button><button type="button" disabled={busy} onClick={()=>void operate('marketplaceRemove',{marketplace:m.id})}>{t('removeMarketplace')}</button></>}</li>)}</ul>
      <h5>{t('installed')}</h5>
      <ul>{value.installedPlugins.map(p=><li key={p.id} data-installed-plugin={p.id}>{p.name}@{p.marketplace} · {p.version??'—'} · {p.enabled?t('enabled'):t('disabled')}
        {admission.writes?.allowed&&<><button type="button" disabled={busy} onClick={()=>void operate('setEnabled',{pluginId:p.id,enabled:!p.enabled,scope:'workspace'})}>{p.enabled?t('disable'):t('enable')}</button><button type="button" disabled={busy} onClick={()=>void operate('update',{pluginId:p.id})}>{t('update')}</button><button type="button" disabled={busy} onClick={()=>void operate('resetConfig',{pluginId:p.id,scope:'workspace'})}>{t('resetConfig')}</button><button type="button" disabled={busy} onClick={()=>void operate('uninstall',{pluginId:p.id,removeCache:true})}>{t('uninstall')}</button></>}</li>)}</ul>
      <h5>{t('available')}</h5>
      <ul>{value.availablePlugins.map(p=><li key={p.id} data-available-plugin={p.id}>{p.name}@{p.marketplace} · {p.version??'—'} · {p.installed?t('enabled'):''}
        {admission.writes?.allowed&&!p.installed&&<button type="button" disabled={busy} onClick={()=>void operate('install',{pluginName:p.name,marketplace:p.marketplace,scope:'workspace'})}>{t('install')}</button>}</li>)}</ul>
      {value.diagnostics?.length>0&&<ul aria-label={t('diagnostics')}>{value.diagnostics.map((d,i)=><li key={i} role="alert">{rowText(d.code,d.message)}</li>)}</ul>}
    </>)}

    <h4>{t('pluginReference')}</h4>
    {section('reference',value=><ul>{value.plugins.map(p=><li key={p.pluginId} data-reference-plugin={p.pluginId}>{p.name}@{p.marketplace} · {p.enabled?t('enabled'):t('disabled')}{p.conflictingPluginIds?.length?` · conflict: ${p.conflictingPluginIds.join(',')}`:''}</li>)}</ul>)}

    <h4>{t('skills')}</h4>
    {section('skills',value=><ul>{value.skills.map(s=><li key={s.id} data-skill-id={s.id}><strong>{s.name}</strong> · {s.scope}{s.pluginName?` · ${s.pluginName}`:''}{s.enabled?'':` · ${t('disabled')}`}</li>)}</ul>)}

    {admission.writes?.allowed&&<>
      <h4>{t('addMarketplace')}</h4>
      <label>{t('source')}<input value={source} onChange={e=>setSource(e.target.value)}/></label>
      <button type="button" disabled={busy||!source.trim()} onClick={()=>void operate('marketplaceAdd',{source:source.trim(),dryRun:true})}>{t('dryRun')}</button>
      <button type="button" disabled={busy||!source.trim()} onClick={()=>void run(async()=>{await sources.operate('marketplaceAdd',{source:source.trim()},newOpId())})}>{t('addMarketplace')}</button>
      <h4>{t('install')}</h4>
      <label>{t('pluginName')}<input value={pluginName} onChange={e=>setPluginName(e.target.value)}/></label>
      <label>{t('marketplace')}<input value={marketplace} onChange={e=>setMarketplace(e.target.value)}/></label>
      <button type="button" disabled={busy||!pluginName.trim()||!marketplace.trim()} onClick={()=>void run(async()=>{await sources.validate({pluginName:pluginName.trim(),marketplace:marketplace.trim()});await sources.operate('install',{pluginName:pluginName.trim(),marketplace:marketplace.trim(),scope:'workspace'},newOpId())})}>{t('verifyAndInstall')}</button>
      <h4>{t('configure')}</h4>
      <label>{t('options')}<textarea value={options} onChange={e=>setOptions(e.target.value)}/></label>
      <button type="button" disabled={busy||!pluginName.trim()||!marketplace.trim()} onClick={()=>void run(async()=>{const parsed=JSON.parse(options);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Object.assign(new Error('options-must-be-object'),{code:'catalog-params-invalid'});await sources.operate('configure',{pluginId:`${pluginName.trim()}@${marketplace.trim()}`,options:parsed,scope:'workspace'},newOpId())})}>{t('configure')}</button>
      <button type="button" disabled={busy||!pluginName.trim()||!marketplace.trim()} onClick={()=>void run(()=>sources.validate({pluginName:pluginName.trim(),marketplace:marketplace.trim()}))}>{t('validate')}</button>
      <button type="button" disabled={busy||!pluginName.trim()||!marketplace.trim()} onClick={()=>void run(async()=>{await sources.describe({pluginName:pluginName.trim(),marketplace:marketplace.trim()})})}>{t('describe')}</button>
    </>}

    {state.validate&&<p role="status">{t('validate')}: {state.validate.error?rowText(state.validate.error.code,state.validate.error.message):`${state.validate.result.ok?t('ok'):t('invalid')}${state.validate.result.diagnostics.length?` · ${state.validate.result.diagnostics.map(d=>rowText(d.code,d.message)).join('; ')}`:''}`}</p>}
    {state.describe&&state.describe.result&&<p role="status">{t('describe')}: {state.describe.result.components?.map(c=>`${c.kind}: ${c.items.map(i=>i.name).join(', ')}`).join(' | ')||'—'}</p>}

    <h4>{t('completed')}</h4>
    {state.operations.length===0&&state.hostOperations.length===0?<p>{t('noOperations')}</p>:<ul>{[...state.operations,...state.hostOperations.filter(h=>!state.operations.some(o=>o.operationId===h.operationId))].map((record,index)=>{const outcome=record.result?operationOutcome(record.result):null;const stateText=record.state==='pending'?t('pending'):record.state==='cancelled'?t('cancelled'):outcome&&!outcome.ok?`${t('failed')}: ${outcome.errors.map(d=>rowText(d.code,d.message)).join('; ')}`:`${t('completed')}: ${record.state}`;return <li key={`${record.operationId??record.action}-${index}`} data-operation={record.operationId??record.action}>{record.action}{record.operationId?` (${record.operationId})`:''} — {stateText}{record.error&&` · ${rowText(record.error.code,record.error.protocolCode)}`}{admission.writes?.allowed&&record.state==='pending'&&record.operationId&&<button type="button" onClick={()=>void run(()=>sources.cancel(record.operationId))}>{t('cancel')}</button>}</li>})}</ul>}
  </section>;
}
