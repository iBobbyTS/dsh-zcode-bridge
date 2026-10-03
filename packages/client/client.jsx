import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { statusText } from './status.mjs';
import { StatusController } from './controller.mjs';
export const inject=['slots','locale','connection'];
const zh={title:'ZCode',description:'官方安装与连接状态'},en={title:'ZCode',description:'Official installation and connection status'};
/** A bundle-owned configuration page in the existing Plugins slot. */
export function apply(ctx){
  ctx.effect(()=>ctx.locale.register('zcodeBridge',{zh,en}),'zcode-bridge: locale');
  ctx.effect(()=>ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',id:'zcode-bridge-status',key:'@dsh-zcode/bridge',locale:'zcodeBridge',inject:()=>({rpc:ctx.connection.rpc,connectionState:ctx.connection.state})},StatusCard)),'zcode-bridge: page');
}
export function StatusCard({rpc,connectionState,view}){
  const controller=useMemo(()=>new StatusController(rpc,connectionState),[rpc,connectionState]);
  const {status:state,busy}=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  useEffect(()=>{controller.start();return ()=>controller.dispose()},[controller]);
  if(view==='summary')return 'Official ZCode runtime connection';
  const install=state.installation;
  return <section aria-label="ZCode connection" style={{padding:16,color:'var(--dsw-alias-text-primary)',fontSize:14}}>
    <h3>ZCode</h3><p role="status">{statusText(state)}</p>
    <p>Account: {state.auth==='unavailable'?'Official authentication source unavailable':'Unconfirmed'}</p>
    {install&&<dl style={{overflowWrap:'anywhere'}}>
      <dt>Official installation</dt><dd>{install.appPath}</dd>
      <dt>Version / build</dt><dd>{install.version} / {install.build}</dd>
      <dt>Runtime launcher</dt><dd>{install.runtime.execPath}</dd>
      <dt>Runtime identity</dt><dd>Electron {install.runtime.electron} · Node {install.runtime.node} · {install.runtime.arch} · PID {state.pid??'—'}</dd>
      <dt>Runtime SHA-256</dt><dd>{install.sha256}</dd>
    </dl>}
    {state.roundTrip&&<p>Official {state.roundTrip.method} response validated · {state.sessionCount} sessions in test workspace · {state.roundTrip.at}</p>}
    <p>Shared official GUI sessions: unverified (CLI default storage).</p>
    <p>Model execution is unavailable until a supported official authentication path is verified.</p>
    <button type="button" disabled={busy||state.connected} onClick={()=>void controller.connect()}>{busy?'Connecting…':state.connected?'Protocol connected':'Connect official runtime'}</button>
  </section>;
}
