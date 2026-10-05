import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {USAGE_RANGES} from './insights.mjs';

export const insightsLocales={en:{
  panel:'ZCode account, usage and diagnostics',account:'Account',accountUnknown:'Account state: UNKNOWN',accountUnknownNote:'No official app-server carrier exposes login/account/subscription state, so this client cannot report a signed-in or signed-out state.',auth:'Official request authentication',login:'Sign in',available:'available',unavailable:'unavailable',restricted:'Official runtime is restricted',readsAllowed:'Official reads admitted',
  usage:'Usage',usageEmpty:'No usage recorded in this range.',tokens:'tokens',in:'in',out:'out',reasoning:'reasoning',cacheRead:'cache read',sessions:'sessions',turns:'turns',toolCalls:'tool calls',modelErrors:'model error rate',range:'Range',
  diagnostics:'Diagnostics',childProcesses:'MCP child processes',noProcesses:'No official MCP child process is running.',resourceSample:'Latest process sample',rss:'RSS',cpu:'CPU',uptime:'uptime (min)',noSample:'No official process sample received yet.',
  generation:'Auxiliary generation',generationGatedNote:'Official generation, cancel and connectivity carriers require model execution; they are gated here and never invoked by this bridge.',sessionUsage:'Session usage',requests:'requests',errors:'errors',pending:'Awaiting official result',unknownKind:'Unrecognized official entry'
},zh:{
  panel:'ZCode 账号、用量与诊断',account:'账号',accountUnknown:'账号状态：UNKNOWN',accountUnknownNote:'官方 app-server 没有暴露登录/账号/订阅状态的载体，本客户端无法报告已登录或已登出。',auth:'官方请求鉴权',login:'登录',available:'可用',unavailable:'不可用',restricted:'官方 runtime 受限',readsAllowed:'官方读取已准入',
  usage:'用量',usageEmpty:'该区间内没有用量记录。',tokens:'tokens',in:'输入',out:'输出',reasoning:'推理',cacheRead:'缓存读取',sessions:'会话',turns:'轮次',toolCalls:'工具调用',modelErrors:'模型错误率',range:'区间',
  diagnostics:'诊断',childProcesses:'MCP 子进程',noProcesses:'当前没有运行中的官方 MCP 子进程。',resourceSample:'最新进程样本',rss:'RSS',cpu:'CPU',uptime:'运行（分钟）',noSample:'尚未收到官方进程样本。',
  generation:'辅助生成',generationGatedNote:'官方生成、取消与连通性载体都会触发模型执行；此处 gated 呈现，bridge 从不调用。',sessionUsage:'会话用量',requests:'请求数',errors:'错误数',pending:'等待官方结果',unknownKind:'未识别的官方条目'
}};
const fallback=key=>insightsLocales.en[key];
const rowText=error=>error?(error.message?`${error.code}: ${error.message}`:error.code):'unknown';
const fmt=value=>Number.isFinite(value)?value.toLocaleString('en-US'):'—';
// Official modelErrorRate is a 0..1 ratio, so present it as a percentage instead of a raw count-like number.
const percent=value=>Number.isFinite(value)?`${(value*100).toLocaleString('en-US',{maximumFractionDigits:2})}%`:'—';

/** Account honesty, official usage, process diagnostics and the gated model surfaces. Nothing here is
 *  a second store; account state is UNKNOWN when no official carrier can answer. */
export function ZCodeInsightsPanel({sources,onBack,t=fallback}){
  const state=useSyncExternalStore(sources.subscribe,sources.getSnapshot,sources.getSnapshot);
  useEffect(()=>{void sources.refresh().catch(()=>{})},[sources]);
  const account=state.account,gated=state.gated??{},usage=state.usage,diagnostics=state.diagnostics,errors=state.sectionErrors??{};
  return <section aria-label={t('panel')} style={{padding:12,overflowWrap:'anywhere',fontSize:14}}>
    <h3>{t('panel')}</h3>
    {onBack&&<button type="button" onClick={()=>onBack()}>Back</button>}
    <p role="status">{state.admission?.allowed?t('readsAllowed'):`${t('restricted')} (${state.admission?.reason??'unknown'})`}</p>
    {state.error&&!errors.usage&&!errors.diagnostics&&<p role="alert">{rowText(state.error)}</p>}

    <h4>{t('account')}</h4>
    <p role="status" data-account-state={account?.state??'unknown'}>{account?.state==='unknown'||!account?t('accountUnknown'):`${account.state}`} · {account?.reason??'not-connected'}</p>
    <p role="note">{t('accountUnknownNote')}</p>
    {account?.auth&&<p data-account-auth={account.auth}>{t('auth')}: {account.auth}</p>}
    <p data-login-available={String(account?.login?.available===true)}>{t('login')}: {account?.login?.available===true?t('available'):`${t('unavailable')} (${account?.login?.reason??'unknown'})`}</p>

    <h4>{t('usage')}</h4>
    <div>{USAGE_RANGES.map(range=><button type="button" key={range} disabled={state.busy||range===state.usageRange} onClick={()=>void sources.setRange(range)}>{range}</button>)}</div>
    {errors.usage?<p role="alert">{t('unavailable')}: {rowText(errors.usage)}</p>
      :usage?usage.summary.totalTokens===0?<p data-usage-empty="true">{t('usageEmpty')}</p>:<dl data-usage="loaded">
        <dt>{t('tokens')}</dt><dd>{fmt(usage.summary.totalTokens)}</dd>
        <dt>{t('in')} / {t('out')}</dt><dd>{fmt(usage.summary.inputTokens)} / {fmt(usage.summary.outputTokens)}</dd>
        <dt>{t('reasoning')}</dt><dd>{fmt(usage.summary.reasoningTokens)}</dd>
        <dt>{t('cacheRead')}</dt><dd>{fmt(usage.summary.cacheReadTokens)}</dd>
        <dt>{t('sessions')} / {t('turns')}</dt><dd>{fmt(usage.summary.totalSessions)} / {fmt(usage.summary.totalTurns)}</dd>
        <dt>{t('toolCalls')}</dt><dd>{fmt(usage.summary.toolCallCount)}</dd>
        <dt>{t('modelErrors')}</dt><dd>{percent(usage.summary.modelErrorRate)}</dd>
      </dl>
      :<p role="status">{t('pending')}</p>}

    <h4>{t('diagnostics')}</h4>
    {errors.diagnostics?<p role="alert">{t('unavailable')}: {rowText(errors.diagnostics)}</p>
      :diagnostics?<>
        <h5>{t('childProcesses')}</h5>
        {diagnostics.processes.length===0?<p data-processes-empty="true">{t('noProcesses')}</p>:<ul>{diagnostics.processes.map(process=><li key={process.pid} data-process-pid={process.pid}>{process.serverName} · {process.mcpSource}{process.pluginName?` · ${process.pluginName}`:''}</li>)}</ul>}
        <p data-resource-sample={state.resourceSample?'present':'absent'}>{t('resourceSample')}: {state.resourceSample?`${t('rss')} ${fmt(state.resourceSample.rssKb)}KB · ${t('cpu')} ${fmt(state.resourceSample.cpuPercent)}% · ${t('uptime')} ${fmt(state.resourceSample.uptimeMinutes)}`:(state.admission?.allowed?t('noSample'):t('unavailable'))}</p>
      </>:<p role="status">{t('pending')}</p>}

    <h4>{t('generation')}</h4>
    {gated.generateText&&<p role="note">{t('generationGatedNote')}</p>}
    <ul>{Object.keys(gated).map(kind=>{const entry=gated[kind];return <li key={kind} data-gated-kind={kind}>{kind} — {entry?.available===true?t('available'):`${t('unavailable')} (${entry?.reason??(state.admission?.allowed===true?t('unknownKind'):(state.admission?.reason??'not-connected'))})`}</li>})}</ul>
  </section>;
}

/** Scoped official session token usage for one opened conversation. The session identity is the
 *  conversation's own bound address; no caller-supplied id is accepted. Read on demand so opening a
 *  session never issues an extra official query. */
export function SessionUsage({conversation,t=fallback}){
  const [state,setState]=useState({status:'idle',result:null,error:null});
  const owner=useRef(conversation),request=useRef(0);
  useEffect(()=>{owner.current=conversation;request.current++;setState({status:'idle',result:null,error:null})},[conversation]);
  const load=()=>{
    const requestedOwner=conversation,requestId=++request.current;
    setState({status:'pending',result:null,error:null});
    // A late reply from a previous owner (reopened address) or a superseded retry is discarded: only the
    // owner/request captured at load time may settle state, so an old owner never overwrites the view.
    const settle=next=>{if(owner.current!==requestedOwner||request.current!==requestId)return;setState(next)};
    conversation.sessionUsage().then(
      result=>settle({status:'loaded',result,error:null}),
      error=>settle({status:'error',result:null,error:{code:error?.code??'session-usage-unavailable',message:error?.message}}),
    );
  };
  if(state.status==='idle')return <button type="button" data-session-usage="idle" onClick={load}>{t('sessionUsage')}</button>;
  if(state.status==='error')return <p role="alert" data-session-usage="error">{t('sessionUsage')}: {rowText(state.error)} <button type="button" onClick={load}>{t('sessionUsage')}</button></p>;
  if(!state.result)return <p data-session-usage="pending">{t('sessionUsage')}: {t('pending')}</p>;
  const r=state.result;
  return <p data-session-usage="loaded">{t('sessionUsage')}: {fmt(r.totalTokens)} {t('tokens')} · {t('in')} {fmt(r.inputTokens)} · {t('out')} {fmt(r.outputTokens)} · {t('requests')} {r.modelRequestCount} · {t('errors')} {r.modelErrorCount}</p>;
}
