import React, { useEffect, useRef, useState } from 'react';

/** Observation surface in the live session area. Registration never grants execution;
 * reverse replies are owned by Host, not by a browser-side 'success' button. */
export function ZCodeHostToolsPanel({state,controller}){
  const [registration,setRegistration]=useState(null),[error,setError]=useState(null),[busy,setBusy]=useState(false);
  const generation=useRef(0),flight=useRef(null);
  const host=state?.hostTools;
  const canRead=host?.observation.allowed===true&&state?.workAdmission?.allowed===true;
  useEffect(()=>{
    flight.current=null;setBusy(false);setRegistration(null);setError(null);
    return ()=>{generation.current++;flight.current?.abort()};
  },[controller,canRead]);
  const refresh=async()=>{
    if(!canRead||flight.current)return;
    const current=generation.current,abort=new AbortController();flight.current=abort;setBusy(true);setError(null);setRegistration(null);
    try{const result=await controller.hostRegistration({signal:abort.signal});if(current===generation.current&&!abort.signal.aborted)setRegistration(result)}
    catch(e){if(current===generation.current&&!abort.signal.aborted)setError(e.code??e.message)}
    finally{if(current===generation.current){flight.current=null;setBusy(false)}}
  };
  return <details data-testid="zcode-host-tools" style={{padding:'8px 16px',borderBottom:'1px solid var(--dsw-alias-border-primary, #d1d5db)'}}>
    <summary>Browser / Computer Use · host observation</summary>
    <p data-testid="zcode-browser-host-state">Browser Use: gated · {host?.browser.reason??'host-unconfirmed'}</p>
    <p data-testid="zcode-computer-host-state">Computer Use: gated · {host?.computer.reason??'host-unconfirmed'} · permissions: unknown</p>
    <p>Plugin registration does not confirm an executable browser backend or Computer Use helper.</p>
    <button data-testid="zcode-host-registration-refresh" type="button" disabled={!canRead||busy} onClick={()=>void refresh()}>{busy?'Reading official registration…':'Read official host registration'}</button>
    {error&&<p role="alert" data-testid="zcode-host-registration-error">{error}</p>}
    {registration&&<div data-testid="zcode-host-registration">
      {registration.plugins.map(plugin=><p key={plugin.id}>{plugin.id} · enabled: {String(plugin.enabled)} · host tools: {plugin.hostMcpServerNames.join(', ')||'none'} · registered MCP: {plugin.mcpServerNames.join(', ')||'none'}</p>)}
      <p>MCP status: {Object.keys(registration.mcpStatuses).length===0?'empty':JSON.stringify(registration.mcpStatuses)}</p>
    </div>}
    {(!host?.records?.length)&&<p data-testid="zcode-host-tools-empty">No observed host request or Computer Use event in this session.</p>}
    {(host?.records??[]).map(record=><div key={record.id} data-testid="zcode-host-record" data-kind={record.kind} style={{overflowWrap:'anywhere',marginTop:8}}>
      {record.kind==='browser'?<>
        <p>{record.method} · request {record.requestId} · backend {record.browserId??'unassigned'} / generation {record.browserGeneration??'unassigned'}</p>
        <p data-testid="zcode-host-response">{record.status} · {record.reason??'no error'}{record.message?` · ${record.message}`:''}{record.protocolCode!==null&&record.protocolCode!==undefined?` (${record.protocolCode})`:''}{record.sideEffect?` · side effects: ${record.sideEffect}`:''}</p>
        {record.status==='outcome-unknown'&&<p role="alert">The host outcome is unknown. This request will not be retried automatically.</p>}
        {record.result?.browsers&&<p>Discovered backends: {record.result.browsers.length===0?'none':record.result.browsers.map(b=>`${b.name} (${b.id}/${b.generation})`).join(', ')}</p>}
        {record.result?.meta&&<p data-testid="zcode-host-target">{record.result.meta.browserId}/{record.result.meta.browserGeneration} · {record.result.meta.tabId??'no tab'} · {record.result.meta.currentUrl??''} · {record.result.meta.lifecycle??''}</p>}
        {record.result?.state&&<p>{record.result.state.title} · {record.result.state.url}</p>}
        {record.result?.image&&<img data-testid="zcode-host-image" src={`data:image/png;base64,${record.result.image.base64}`} alt="Official browser host screenshot" style={{maxWidth:'100%',maxHeight:280}}/>}
        {record.result?.imageOmitted&&<p>{record.result.imageOmitted}</p>}
      </>:record.kind==='computer-permission'?<p data-testid="zcode-host-permissions">Official permission observation · owner {record.event.permissionStatus.grantOwner} · accessibility {record.event.permissionStatus.accessibility} · screen recording {record.event.permissionStatus.screenRecording} · tool {record.event.toolCallId}</p>:<p data-testid="zcode-host-computer-event">Official operation envelope · {record.event.kind} · {record.event.toolName??'turn'} · {record.event.toolCallId??record.event.turnId??''} · {record.event.computerUse===true?'Computer Use marked':'not classified as a Computer Use action'}</p>}
    </div>)}
  </details>;
}

/** Screenshot/app/error metadata comes from official v4 tool projections, not inferred code. */
export function ZCodeHostToolResult({row}){
  const display=row?.display?.kind==='node_repl_images'?row.display:row?.output?.display;
  if(!display||!['node_repl_images','cua'].includes(display.kind))return null;
  const images=display.kind==='node_repl_images'?display.images??[]:display.media??[];
  const permission=display.permissionStatus;
  return <div data-testid="zcode-host-tool-result" style={{overflowWrap:'anywhere'}}>
    <p>{display.kind==='cua'?`Official Computer Use result · ${display.toolName} · ${display.status}`:display.source==='browser_turn_end'?'Official browser turn-end screenshot':'Official node_repl visual output'}{display.app?` · app ${display.app.displayName??display.app.appKey}`:''}{display.targetApp?.displayName?` · target ${display.targetApp.displayName}`:''}</p>
    {display.errorCode&&<p role="alert">{display.errorCode} · {display.suggestedAction??display.text??''}</p>}
    {permission&&<p>Permission owner {permission.grantOwner} · accessibility {permission.accessibility} · screen recording {permission.screenRecording}</p>}
    {images.map((media,i)=>{
      const data=media.base64??media.data;
      return data&&/^image\/(png|jpeg|webp)$/.test(media.mimeType)
        ?<img key={i} data-testid="zcode-host-tool-image" src={`data:${media.mimeType};base64,${data}`} alt="Official tool screenshot" style={{maxWidth:'100%',maxHeight:280}}/>
        :<p key={i}>Screenshot preview gated · {media.artifactUri?'artifact carrier unverified':`unsupported image type ${media.mimeType}`}</p>;
    })}
    {display.truncated&&<p>Official visual output truncated.</p>}
  </div>;
}
