import React,{useEffect,useSyncExternalStore} from 'react';

export const automationLocales={en:{
  panel:'ZCode automations and off-peak',restricted:'Official runtime is restricted',unavailable:'unavailable',available:'available',
  management:'Automation management',managementNote:'The official app-server exposes no create/list/bind/update/delete request carrier. automation/* is a Host-consumed reverse carrier: only the official Host owns the scheduled-task store, so this bridge cannot create, list, bind, cancel or set an automation.',carrier:'Carrier',direction:'Direction',requestable:'Requestable',
  offPeak:'Off-peak tasks',offPeakNote:'offPeak/* is likewise a Host-consumed reverse carrier. The selected coding-plan entitlement is a Host-service fact that is not exposed over this channel, so the state is UNKNOWN here.',entitlement:'Entitlement',
  feedback:'Run feedback',feedbackNote:'No official app-server projection carries automation/off-peak task status, progress or recent run results; the bridge does not invent them.',execution:'Run execution',
  account:'Account',accountNote:'No official app-server carrier exposes login/account/subscription state; it stays UNKNOWN.',
  reverse:'Host callback observations',reverseNote:'Reverse automation requests this bridge received and refused without fabricating a task or run. Empty in normal operation.',noRecords:'No official automation callback has been received.',identity:'Identity',outcome:'Outcome',reason:'Reason',pending:'Awaiting official result',unknownEntry:'Unrecognized official entry'
},zh:{
  panel:'ZCode 定时任务与闲时任务',restricted:'官方 runtime 受限',unavailable:'不可用',available:'可用',
  management:'Automation 管理',managementNote:'官方 app-server 没有暴露创建/列出/绑定/更新/删除的请求载体。automation/* 是 Host 消费的反向载体：只有官方 Host 拥有定时任务存储，本 bridge 无法创建、列出、绑定、取消或设置 automation。',carrier:'载体',direction:'方向',requestable:'可请求',
  offPeak:'闲时任务',offPeakNote:'offPeak/* 同样是 Host 消费的反向载体。所选 Coding Plan 的资格是 Host 服务事实，不经该通道暴露，故此处为 UNKNOWN。',entitlement:'资格',
  feedback:'运行反馈',feedbackNote:'没有官方 app-server 投影携带 automation/off-peak 任务状态、进度或最近运行结果；bridge 不伪造。',execution:'运行执行',
  account:'账号',accountNote:'官方 app-server 没有暴露登录/账号/订阅状态的载体，保持 UNKNOWN。',
  reverse:'宿主回调观察',reverseNote:'本 bridge 收到并拒绝的反向 automation 请求，未伪造任务或运行。正常运行时为空。',noRecords:'未收到官方 automation 回调。',identity:'身份',outcome:'结果',reason:'原因',pending:'等待官方结果',unknownEntry:'未识别的官方条目'
}};
const fallback=key=>automationLocales.en[key];
const rowText=error=>error?(error.message?`${error.code}: ${error.message}`:error.code):'unknown';
const stateLabel=(entry,t)=>entry?.available===true?t('available'):`${t('unavailable')} (${entry?.reason??'unknown'})`;

/** Honest automation/off-peak surface. Management is unavailable because the official carriers are
 *  Host-consumed reverse methods; run feedback has no official projection. Nothing is fabricated and
 *  no task/run is created by this view. */
export function ZCodeAutomationPanel({sources,onBack,t=fallback}){
  const state=useSyncExternalStore(sources.subscribe,sources.getSnapshot,sources.getSnapshot);
  useEffect(()=>{void sources.refresh().catch(()=>{})},[sources]);
  const management=state.management,offPeak=state.offPeak,feedback=state.runFeedback,account=state.account,reverse=state.reverse;
  return <section aria-label={t('panel')} style={{padding:12,overflowWrap:'anywhere',fontSize:14}}>
    <h3>{t('panel')}</h3>
    {onBack&&<button type="button" onClick={()=>onBack()}>Back</button>}
    <p role="status">{state.admission?.allowed?t('available'):`${t('restricted')} (${state.admission?.reason??'unknown'})`}</p>
    {state.error&&<p role="alert">{rowText(state.error)}</p>}

    <h4>{t('management')}</h4>
    <p role="note">{t('managementNote')}</p>
    <p data-automation-management-available={String(management?.available===true)} data-automation-management-reason={management?.reason??'not-loaded'}>{stateLabel(management,t)}</p>
    <ul>{(management?.carriers??[]).map(carrier=><li key={carrier.method} data-automation-carrier={carrier.method}>{t('carrier')}: {carrier.method} · {t('direction')}: {carrier.direction} · {t('requestable')}: {String(carrier.requestable===true)}</li>)}</ul>

    <h4>{t('offPeak')}</h4>
    <p role="note">{t('offPeakNote')}</p>
    <p data-offpeak-available={String(offPeak?.available===true)} data-offpeak-reason={offPeak?.reason??'not-loaded'}>{stateLabel(offPeak,t)}</p>
    <p data-offpeak-entitlement={offPeak?.entitlement?.state??'unknown'}>{t('entitlement')}: {(offPeak?.entitlement?.state??'unknown')==='unknown'?'UNKNOWN':offPeak.entitlement.state} · {offPeak?.entitlement?.reason??'not-loaded'}</p>
    <ul>{(offPeak?.carriers??[]).map(carrier=><li key={carrier.method} data-automation-carrier={carrier.method}>{t('carrier')}: {carrier.method} · {t('direction')}: {carrier.direction} · {t('requestable')}: {String(carrier.requestable===true)}</li>)}</ul>

    <h4>{t('feedback')}</h4>
    <p role="note">{t('feedbackNote')}</p>
    <p data-runfeedback-available={String(feedback?.available===true)} data-runfeedback-reason={feedback?.reason??'not-loaded'}>{stateLabel(feedback,t)}</p>
    <p data-runfeedback-execution={feedback?.execution?.state??'unknown'}>{t('execution')}: {feedback?.execution?.state??'unknown'} · {feedback?.execution?.reason??'not-loaded'}</p>

    <h4>{t('account')}</h4>
    <p role="note">{t('accountNote')}</p>
    <p data-automation-account-state={account?.state??'unknown'}>{account?.state??'unknown'} · {account?.reason??'not-loaded'}</p>

    <h4>{t('reverse')}</h4>
    <p role="note">{t('reverseNote')}</p>
    <p data-reverse-allowed={String(reverse?.allowed===true)} data-reverse-empty={String((reverse?.records?.length??0)===0)}>{(reverse?.records?.length??0)===0?t('noRecords'):''}</p>
    {(reverse?.records?.length??0)>0&&<ul>{reverse.records.map(record=><li key={record.id} data-reverse-record={record.method} data-reverse-status={record.outcome??record.status??'pending'}>{record.method} · {t('identity')}: {record.identity?`${record.identity.key}=${record.identity.value}`:'—'} · {t('outcome')}: {record.outcome??record.status??'pending'} · {t('reason')}: {record.reason??'unknown'}</li>)}</ul>}
  </section>;
}
