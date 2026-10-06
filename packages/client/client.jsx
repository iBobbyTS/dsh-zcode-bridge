export {HookReviewPanel} from './hook-review.jsx';
import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { statusText } from './status.mjs';
import { StatusController } from './controller.mjs';
import { installParityPanels } from './parity-controls.jsx';
export { BridgeParityPage,BridgeSettingsPanel,AutomationPanel,PreferencesPanel,FeedbackPanel,AttachmentPanel,SessionParityPanel,DiagnosticsExtras } from './parity-controls.jsx';
import { installRuntimeControls } from './runtime-controls.mjs';
import { CompatibilityStore } from './compatibility.mjs';
export { CompatibilityStore } from './compatibility.mjs';
export const inject=['slots','locale','connection','sessions','uiWorkspace'];
const zh={title:'ZCode',description:'官方安装与连接状态'},en={title:'ZCode',description:'Official installation and connection status'};
/** A bundle-owned configuration page in the existing Plugins slot. */
export function apply(ctx){
  // Auto-start: the shared controller connects once per transport generation as soon as the
  // plugin opens. There is deliberately no manual Connect gate; failures surface through status.
  const connection=new StatusController(ctx.connection.rpc,ctx.connection.state);
  ctx.effect(()=>{connection.start();return ()=>connection.dispose()},'zcode-bridge: auto connection');
  const controls=installRuntimeControls(ctx);
  installParityPanels(ctx,connection,controls,StatusCard);
  ctx.effect(()=>ctx.locale.register('zcodeBridge',{zh,en}),'zcode-bridge: locale');
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
export function StatusCard({controller,view}){
  const {status:state}=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const compatibilityStore=useMemo(()=>new CompatibilityStore(),[]);
  useEffect(()=>()=>compatibilityStore.dispose(),[compatibilityStore]);
  if(view==='summary')return 'Official ZCode runtime connection';
  const install=state.installation;
  return <section aria-label="ZCode connection" style={{padding:16,color:'var(--dsw-alias-text-primary)',fontSize:14}}>
    <h3>ZCode</h3><p role="status">{statusText(state)}</p>
    {state.launcher?.liveHttp?.allowed===false&&<p role="alert">{state.launcher.liveHttp.reason}</p>}
    <ZCodeVersionBanner compatibility={state.compatibility} store={compatibilityStore}/>
    {state.failSafe?.incompatible&&<p role="alert" data-testid="zcode-failsafe-core">Core protocol incompatibility: new side effects are stopped; reconnect to retry.</p>}
    {state.failSafe?.level==='non-core'&&<p data-testid="zcode-failsafe-isolated">Optional capabilities isolated: {state.failSafe.isolated.map(item=>item.capability).join(', ')}. Other paths keep working.</p>}
    <p>Account: {state.auth==='authenticated'?'Authenticated by official Host':state.auth==='unavailable'?'Official authentication source unavailable':state.auth==='signed-out'?'Signed out':'Unconfirmed'}</p>
    {install&&<dl style={{overflowWrap:'anywhere'}}>
      <dt>Official installation</dt><dd>{install.appPath}</dd>
      <dt>Version / build</dt><dd>{install.version} / {install.build}</dd>
      <dt>Runtime launcher</dt><dd>{install.runtime.execPath}</dd>
      <dt>Runtime identity</dt><dd>Electron {install.runtime.electron} · Node {install.runtime.node} · {install.runtime.arch} · PID {state.pid??'—'}</dd>
      <dt>Runtime SHA-256</dt><dd>{install.sha256}</dd>
    </dl>}
    {state.roundTrip&&<p>Official {state.roundTrip.method} response validated · {state.sessionCount} sessions in test workspace · {state.roundTrip.at}</p>}
    <p>{state.auth==='authenticated'?'Shared official task store · read-only':'Shared official GUI sessions: unverified (CLI default storage).'}</p>
    <p>{state.auth==='authenticated'?'ZCode session execution uses the official Host.':'Model execution is unavailable until a supported official authentication path is verified.'}</p>
    <p role="note">Auto-start: the official runtime connects automatically when this plugin opens; one attempt per reconnect.</p>
  </section>;
}
