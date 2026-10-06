import React,{useEffect,useRef,useState} from 'react';

// Extracted from conversation-view.jsx:832-947, 970-983, 1731-1929. This
// published dock uses the session-bound parity port, never the old mirror view.
const targetKeys=['sessionId','taskId','runId','remoteSessionId','workspaceIdentity','bundleDigest','reviewFlowId','generation','interactionId'];
const target=payload=>Object.fromEntries(targetKeys.filter(key=>payload[key]!==undefined).map(key=>[key,payload[key]]));
const trustable=item=>['pending_trust','revoked','stale_digest'].includes(item.trustState);
const fault=code=>Object.assign(new Error(code),{code});
function accepted(result){
  if(!['accepted','duplicate'].includes(result?.ack?.status))throw fault(result?.ack?.reasonCode??result?.state??'hook-review-unconfirmed');
  return result;
}
/** Snapshot owns trust and lifecycle. ACK only reports acceptance; it never changes a
 * checkbox, trustState, or pending interaction locally. Reads may refresh; writes never retry. */
export function HookReviewPanel({controller,pollMs=1500}){
  const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(null),[receipt,setReceipt]=useState(null);
  const owner=useRef(null),flight=useRef(null),acting=useRef(false);
  async function refresh(token=owner.current){
    if(!token||token!==owner.current||flight.current)return;
    const abort=new AbortController();flight.current=abort;
    try{const value=await controller.call('snapshot','read',undefined,{}, {signal:abort.signal});if(token===owner.current){setState(value);return value}}
    catch(err){if(token===owner.current&&!abort.signal.aborted){setState(null);setError(err.code??err.message)}}
    finally{if(flight.current===abort)flight.current=null}
  }
  useEffect(()=>{
    const reset=()=>{flight.current?.abort();flight.current=null;owner.current={};acting.current=false;setState(null);setBusy(false);setError(null);setReceipt(null);void refresh(owner.current)};
    reset();const off=controller.subscribe(reset),timer=pollMs>0?setInterval(()=>void refresh(),pollMs):null;
    return ()=>{off();clearInterval(timer);owner.current=null;flight.current?.abort();flight.current=null};
  },[controller,pollMs]);
  const snapshot=state?.snapshot,ready=state?.admission?.allowed&&state?.managementAdmission?.allowed&&!busy;
  async function act(type,payload,interaction){
    if(!ready||acting.current)return;
    const token=owner.current,base=snapshot;acting.current=true;setBusy(true);setError(null);setReceipt(null);
    try{
      // Current v4 forbids autoResolution on workspaceHookReview. Keep this first
      // operation hook conditional for projections that actually carry a timer;
      // never infer a timer/snoozed state from createdAt/deadlineAt.
      if(interaction?.autoResolution&&interaction.autoResolution.state!=='snoozed'){
        accepted(await controller.command('snoozeInteractionAutoResolution',{interactionId:interaction.interactionId},base));
        const current=await controller.call('snapshot','read');
        if(token!==owner.current)return;
        const item=current.snapshot?.pendingInteractions.find(value=>value.interactionId===interaction.interactionId);
        if(!item||JSON.stringify(target(item.payload))!==JSON.stringify(target(interaction.payload)))throw fault('hook-review-stale');
        accepted(await controller.command(type,payload,current.snapshot));
      }else accepted(await controller.command(type,payload,base));
      if(token===owner.current)setReceipt('Official command accepted; waiting for the current review state.');
    }catch(err){if(token===owner.current)setError(err.code??err.message)}
    finally{if(token===owner.current){acting.current=false;setBusy(false);void refresh(token)}}
  }
  const admission=snapshot?.workspaceHookAdmission;
  const interactions=snapshot?.pendingInteractions??[];
  return <section data-zcode-hook-review="" style={{padding:12,overflowWrap:'anywhere'}}>
    {admission?.pendingCount>0&&<div role="alert" data-zcode-hook-trust-banner=""><p>Workspace hooks require security review ({admission.pendingCount} pending).</p>
      <button disabled={!ready||!admission.workspaceIdentity} onClick={()=>void act('requestWorkspaceHookReview',{sessionId:snapshot.sessionId,workspaceIdentity:admission.workspaceIdentity,bundleDigest:admission.bundleDigest})}>Request Review</button></div>}
    {interactions.filter(item=>item.kind==='workspaceHookReview').map(interaction=>{
      const review=interaction.payload,pending=review.items.filter(trustable),send=(type,params)=>void act(type,{...target(review),...params},interaction);
      return <article key={interaction.interactionId} data-zcode-hook-card={interaction.interactionId}>
        <h4>Workspace hook security review</h4><p role="note">Workspace hooks execute shell commands. Review each command before granting persistent trust.</p>
        <p>{review.workspaceLabel} · {review.summary.eventCount} events · {review.summary.hookCount} hooks · {review.summary.pendingCount} pending</p>
        <ul>{review.sourceFiles.map(file=><li key={file.path}>{file.displayPath} · {file.editable?'editable':'read only'}</li>)}</ul>
        {review.items.map(item=><div key={item.reviewItemId} data-zcode-hook-item={item.reviewItemId}>
          <h5>{item.displayName}</h5><label><input type="checkbox" aria-label={`Enable ${item.displayName}`} checked={item.configuredEnabled} disabled={!ready||!item.editable} onChange={event=>send('toggleWorkspaceHookReviewItem',{reviewItemId:item.reviewItemId,enabled:event.target.checked})}/>Enabled</label>
          <p>{item.event} · {item.executionMode} · {item.trustState} · {item.resolvedTimeoutMs} ms · {item.resolvedMaxOutputBytes} bytes</p><pre style={{whiteSpace:'pre-wrap'}}>{item.displayCommand}</pre><p>{item.sourcePath}</p>
          {trustable(item)&&<button disabled={!ready} onClick={()=>send('respondWorkspaceHookReview',{decision:{action:'trust_selected',reviewItemIds:[item.reviewItemId]}})}>Trust Hook</button>}
          {item.trustState==='trusted_persistent'&&<button disabled={!ready} onClick={()=>send('revokeWorkspaceHookTrust',{reviewItemIds:[item.reviewItemId]})}>Revoke Trust</button>}
        </div>)}
        <button disabled={!ready||!pending.length} onClick={()=>send('respondWorkspaceHookReview',{decision:{action:'trust_selected',reviewItemIds:pending.map(item=>item.reviewItemId)}})}>Trust All Pending</button>
      </article>;
    })}
    {interactions.filter(item=>!['workspaceHookReview','permission'].includes(item.kind)).map(item=><p role="alert" key={item.interactionId}>Interaction unavailable: {item.kind}. The official interaction remains pending.</p>)}
    {busy&&<p role="status">Awaiting official result</p>}{receipt&&<p role="status">{receipt}</p>}{error&&<p role="alert">{error}</p>}
    {(admission?.pendingCount>0||interactions.length>0||error)&&<button disabled={busy} onClick={()=>void refresh()}>Refresh hook review</button>}
  </section>;
}
