import React, { useEffect, useSyncExternalStore } from 'react';
export const remoteLocales = { en: {
  panel: 'ZCode remote workspaces and sessions', back: 'Back', refresh: 'Refresh status', unavailable: 'Remote management unavailable',
  note: 'The current connection is a local app-server. Remote connections require the official Desktop Host or a separate server; neither is attached here.',
  connection: 'Remote connection', workspaces: 'Remote workspaces', sessions: 'Remote sessions', unknown: 'UNKNOWN — the official remote inventory cannot be read through this connection.',
  local: 'Current local scope', localNote: 'The session directory reads this local process only. It does not list remote or shared official GUI sessions.',
  targets: 'Connection types', ssh: 'SSH', wsl: 'WSL', docker: 'Docker', wslNote: 'Local WSL discovery and launch require a Windows Host. This macOS client does not provide a Windows adapter.',
  carriers: 'Official connection paths', desktop: 'Desktop Main', server: 'Separate server', gated: 'Unavailable on this connection',
}, zh: {
  panel: 'ZCode 远程工作区与会话', back: '返回', refresh: '刷新状态', unavailable: '远程管理不可用',
  note: '当前连接为本地 app-server。远程连接需要官方 Desktop Host 或独立 server；此处未接入这些宿主。',
  connection: '远程连接', workspaces: '远程工作区', sessions: '远程会话', unknown: 'UNKNOWN — 无法通过当前连接读取官方远程目录。',
  local: '当前本地身份', localNote: '现有会话目录仅查询此本地进程，不代表远程或官方 GUI 共享会话目录。',
  targets: '连接类型', ssh: 'SSH', wsl: 'WSL', docker: 'Docker', wslNote: '本机 WSL 发现与启动要求 Windows Host。本 macOS 客户端不提供 Windows 适配器。',
  carriers: '官方连接路径', desktop: 'Desktop Main', server: '独立 server', gated: '当前连接不可用',
} };
const fallback = key => remoteLocales.en[key];
export function ZCodeRemotePanel({ sources, onBack, t = fallback }) {
  const state = useSyncExternalStore(sources.subscribe, sources.getSnapshot, sources.getSnapshot);
  useEffect(() => { void sources.refresh().catch(() => {}); }, [sources]);
  const projection = state.projection;
  return <section aria-label={t('panel')} style={{ padding: 12, overflowWrap: 'anywhere', fontSize: 14 }}>
    <h3>{t('panel')}</h3>
    {onBack && <button type="button" onClick={onBack}>{t('back')}</button>}
    <button type="button" disabled={state.busy} onClick={() => void sources.refresh().catch(() => {})}>{t('refresh')}</button>
    <p role="status" data-remote-available="false">{t('unavailable')} · {state.admission.reason}</p>
    <p>{t('note')}</p>
    {state.error && <p role="alert">{state.error.code}: {state.error.message}</p>}
    <h4>{t('connection')}</h4>
    <p data-remote-connection={projection?.connection.state ?? 'unknown'}>{t('gated')} · {projection?.connection.reason ?? state.admission.reason}</p>
    {['workspaces', 'sessions'].map(kind => <div key={kind}><h4>{t(kind)}</h4><p data-remote-inventory={kind}>{t('unknown')}</p></div>)}
    <h4>{t('local')}</h4><p>{t('localNote')}</p>
    {projection?.scope && <p data-local-scope="true">{projection.scope.authority} · {projection.scope.workspace}</p>}
    <h4>{t('targets')}</h4>
    <ul>{(projection?.targets ?? []).map(target => <li key={target.kind} data-remote-target={target.kind}>{t(target.kind)} · {t('gated')} · {target.reason}</li>)}</ul>
    <p>{t('wslNote')}</p>
    <details><summary>{t('carriers')}</summary><ul>{(projection?.carriers ?? []).map(carrier => <li key={carrier.name}>{carrier.owner === 'desktop-main' ? t('desktop') : t('server')} · {carrier.method} · {t('gated')}</li>)}</ul></details>
  </section>;
}
