import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { statusText } from './status.mjs';
import { StatusController } from './controller.mjs';
import {ZCodeDirectory,ZCodeSessionPanel,directoryLocales} from './directory-view.jsx';
export {ZCodeDirectory,ZCodeSessionPanel} from './directory-view.jsx';
import {ZCodeCatalogPanel,catalogLocales} from './catalog-view.jsx';
import {CatalogStore} from './catalog.mjs';
export {ZCodeCatalogPanel} from './catalog-view.jsx';
export {CatalogStore} from './catalog.mjs';
import {ZCodeInsightsPanel,insightsLocales} from './insights-view.jsx';
import {InsightsStore} from './insights.mjs';
export {ZCodeInsightsPanel,SessionUsage} from './insights-view.jsx';
export {InsightsStore} from './insights.mjs';
import {ZCodeAutomationPanel,automationLocales} from './automation-view.jsx';
import {AutomationStore} from './automation.mjs';
export {ZCodeAutomationPanel} from './automation-view.jsx';
export {AutomationStore} from './automation.mjs';
import { installRuntimeSessions } from './sources.mjs';
import {RemoteStore} from './remote.mjs';
import {ZCodeRemotePanel,remoteLocales} from './remote-view.jsx';
export {RemoteStore} from './remote.mjs';
export {ZCodeRemotePanel} from './remote-view.jsx';
export { ZCodeConversationView, ConversationController } from './conversation-view.jsx';
import { CompatibilityStore } from './compatibility.mjs';
export { CompatibilityStore } from './compatibility.mjs';
export const inject=['slots','locale','connection'];
const zh={title:'ZCode',description:'官方安装与连接状态'},en={title:'ZCode',description:'Official installation and connection status'};
/** A bundle-owned configuration page in the existing Plugins slot. */
export function apply(ctx){
  const remote=new RemoteStore(ctx.connection.rpc,{connectionGeneration:ctx.connection.generation});
  ctx.effect(()=>()=>remote.dispose(),'zcode-bridge: remote projection');
  ctx.effect(()=>ctx.locale.register('zcodeRemote',remoteLocales),'zcode-bridge: remote locale');
  const catalog=new CatalogStore(ctx.connection.rpc,{connectionGeneration:ctx.connection.generation});
  ctx.effect(()=>()=>catalog.dispose(),'zcode-bridge: official catalog');
  ctx.effect(()=>ctx.locale.register('zcodeCatalog',catalogLocales),'zcode-bridge: catalog locale');
  const insights=new InsightsStore(ctx.connection.rpc,{connectionGeneration:ctx.connection.generation});
  ctx.effect(()=>()=>insights.dispose(),'zcode-bridge: official account/usage/diagnostics');
  ctx.effect(()=>ctx.locale.register('zcodeInsights',insightsLocales),'zcode-bridge: insights locale');
  const automation=new AutomationStore(ctx.connection.rpc,{connectionGeneration:ctx.connection.generation});
  ctx.effect(()=>()=>automation.dispose(),'zcode-bridge: official automation/reverse honesty');
  ctx.effect(()=>ctx.locale.register('zcodeAutomation',automationLocales),'zcode-bridge: automation locale');
  ctx.effect(()=>installRuntimeSessions(ctx),'zcode-bridge: native source injection');
  ctx.inject(['runtimeSessions','layout'],scope=>{
    scope.effect(()=>scope.locale.register('zcodeDirectory',directoryLocales),'zcode-bridge: directory locale');
    scope.slots.inject('sidebar.workspaces.runtimeDirectory',()=>scope.slots.register({name:'sidebar.workspaces.runtimeDirectory',id:'zcode-directory',locale:'zcodeDirectory',inject:()=>({sources:scope.runtimeSessions,onOpen:()=>scope.layout.selectPanel('zcode-session'),onOpenCatalog:()=>scope.layout.selectPanel('zcode-catalog'),onOpenInsights:()=>scope.layout.selectPanel('zcode-insights'),onOpenAutomation:()=>scope.layout.selectPanel('zcode-automation'),onOpenRemote:()=>scope.layout.selectPanel('zcode-remote')})},ZCodeDirectory));
    scope.slots.inject('main',()=>scope.slots.register({name:'main',key:'zcode-session',id:'zcode-session',locale:'zcodeDirectory',inject:()=>({sources:scope.runtimeSessions})},ZCodeSessionPanel));
    // Remote status reuses the existing main/sidebar seam and never creates a remote executor.
    scope.slots.inject('main',()=>scope.slots.register({name:'main',key:'zcode-remote',id:'zcode-remote',locale:'zcodeRemote',inject:()=>({sources:remote,onBack:()=>scope.layout.selectPanel('zcode-session')})},ZCodeRemotePanel));
    // The official catalog lives in its own main panel: no second catalog, no status-card duplication.
    scope.slots.inject('main',()=>scope.slots.register({name:'main',key:'zcode-catalog',id:'zcode-catalog',locale:'zcodeCatalog',inject:()=>({sources:catalog,onBack:()=>scope.layout.selectPanel('zcode-session')})},ZCodeCatalogPanel));
    // Account/usage/diagnostics panel; account state is UNKNOWN when no official carrier exists.
    scope.slots.inject('main',()=>scope.slots.register({name:'main',key:'zcode-insights',id:'zcode-insights',locale:'zcodeInsights',inject:()=>({sources:insights,onBack:()=>scope.layout.selectPanel('zcode-session')})},ZCodeInsightsPanel));
    // Automation/off-peak honesty panel; management is a Host-consumed reverse carrier with no request surface.
    scope.slots.inject('main',()=>scope.slots.register({name:'main',key:'zcode-automation',id:'zcode-automation',locale:'zcodeAutomation',inject:()=>({sources:automation,onBack:()=>scope.layout.selectPanel('zcode-session')})},ZCodeAutomationPanel));
    void scope.runtimeSessions.refresh();
  });
  ctx.effect(()=>ctx.locale.register('zcodeBridge',{zh,en}),'zcode-bridge: locale');
  ctx.effect(()=>ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',id:'zcode-bridge-status',key:'@dsh-zcode/bridge',locale:'zcodeBridge',inject:()=>({rpc:ctx.connection.rpc,connectionState:ctx.connection.state})},StatusCard)),'zcode-bridge: page');
}
/** R19 version banner and R20 fail-safe notices. Dismissal is a separate local preference and
 *  never clears the host fail-safe. */
export function ZCodeVersionBanner({compatibility,store}){
  useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  const decision=store.decide(compatibility);
  const identity=compatibility?.state??'unknown',actual=compatibility?.actual??{};
  return <>
    {identity==='newer-unverified'&&decision.visible&&<div role="alert" data-testid="zcode-version-banner" style={{border:'1px solid var(--dsw-alias-border-warning, #b58900)',padding:8,marginBottom:8}}>
      <p>Compatibility is not guaranteed: official ZCode {actual.version} is newer than the highest verified version {compatibility.highestVerified}.</p>
      <button type="button" data-testid="zcode-dismiss-once" onClick={()=>store.dismiss('once',actual.version)}>Dismiss once</button>{' '}
      <button type="button" data-testid="zcode-dismiss-this-version" onClick={()=>store.dismiss('this-version',actual.version)}>Dismiss for this version</button>{' '}
      <button type="button" data-testid="zcode-dismiss-new-next-version" onClick={()=>store.dismiss('new-next-version',actual.version)}>Dismiss for this and the next version</button>
    </div>}
    {identity==='identity-mismatch'&&<p data-testid="zcode-version-identity">Official ZCode {actual.version} has an unverified build or digest; previous support evidence does not apply.</p>}
    {identity==='unknown'&&<p data-testid="zcode-version-neutral">Official ZCode version is undetermined; no compatibility claim is made.</p>}
    {identity==='other-unverified'&&<p data-testid="zcode-version-neutral">Official ZCode {actual.version} is outside the verified set; compatibility is not asserted.</p>}
    {decision.restartRequired&&<p role="alert" data-testid="zcode-restart-required">An installed bridge update is not active; restart the host and client plugins to use the new version.</p>}
  </>;
}
export function StatusCard({rpc,connectionState,view}){
  const controller=useMemo(()=>new StatusController(rpc,connectionState),[rpc,connectionState]);
  const {status:state,busy}=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const compatibilityStore=useMemo(()=>new CompatibilityStore(),[]);
  useEffect(()=>{controller.start();return ()=>controller.dispose()},[controller]);
  useEffect(()=>()=>compatibilityStore.dispose(),[compatibilityStore]);
  if(view==='summary')return 'Official ZCode runtime connection';
  const install=state.installation;
  return <section aria-label="ZCode connection" style={{padding:16,color:'var(--dsw-alias-text-primary)',fontSize:14}}>
    <h3>ZCode</h3><p role="status">{statusText(state)}</p>
    <ZCodeVersionBanner compatibility={state.compatibility} store={compatibilityStore}/>
    {state.failSafe?.incompatible&&<p role="alert" data-testid="zcode-failsafe-core">Core protocol incompatibility: new side effects are stopped; reconnect to retry.</p>}
    {state.failSafe?.level==='non-core'&&<p data-testid="zcode-failsafe-isolated">Optional capabilities isolated: {state.failSafe.isolated.map(item=>item.capability).join(', ')}. Other paths keep working.</p>}
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
