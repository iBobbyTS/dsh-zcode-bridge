import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { statusText } from './status.mjs';
import { StatusController } from './controller.mjs';
import {ZCodeDirectory,ZCodeSessionPanel,directoryLocales} from './directory-view.jsx';
export {ZCodeDirectory,ZCodeSessionPanel} from './directory-view.jsx';
import {ZCodeCatalogPanel,catalogLocales} from './catalog-view.jsx';
import {CatalogStore} from './catalog.mjs';
export {ZCodeCatalogPanel} from './catalog-view.jsx';
export {CatalogStore} from './catalog.mjs';
import { installRuntimeSessions } from './sources.mjs';
export { ZCodeConversationView, ConversationController } from './conversation-view.jsx';
export const inject=['slots','locale','connection'];
const zh={title:'ZCode',description:'官方安装与连接状态'},en={title:'ZCode',description:'Official installation and connection status'};
/** A bundle-owned configuration page in the existing Plugins slot. */
export function apply(ctx){
  const catalog=new CatalogStore(ctx.connection.rpc,{connectionGeneration:ctx.connection.generation});
  ctx.effect(()=>()=>catalog.dispose(),'zcode-bridge: official catalog');
  ctx.effect(()=>ctx.locale.register('zcodeCatalog',catalogLocales),'zcode-bridge: catalog locale');
  ctx.effect(()=>installRuntimeSessions(ctx),'zcode-bridge: native source injection');
  ctx.inject(['runtimeSessions','layout'],scope=>{
    scope.effect(()=>scope.locale.register('zcodeDirectory',directoryLocales),'zcode-bridge: directory locale');
    scope.slots.inject('sidebar.workspaces.runtimeDirectory',()=>scope.slots.register({name:'sidebar.workspaces.runtimeDirectory',id:'zcode-directory',locale:'zcodeDirectory',inject:()=>({sources:scope.runtimeSessions,onOpen:()=>scope.layout.selectPanel('zcode-session'),onOpenCatalog:()=>scope.layout.selectPanel('zcode-catalog')})},ZCodeDirectory));
    scope.slots.inject('main',()=>scope.slots.register({name:'main',key:'zcode-session',id:'zcode-session',locale:'zcodeDirectory',inject:()=>({sources:scope.runtimeSessions})},ZCodeSessionPanel));
    // The official catalog lives in its own main panel: no second catalog, no status-card duplication.
    scope.slots.inject('main',()=>scope.slots.register({name:'main',key:'zcode-catalog',id:'zcode-catalog',locale:'zcodeCatalog',inject:()=>({sources:catalog,onBack:()=>scope.layout.selectPanel('zcode-session')})},ZCodeCatalogPanel));
    void scope.runtimeSessions.refresh();
  });
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
