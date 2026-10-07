import React,{useEffect,useRef,useState} from 'react';

const fault=code=>Object.assign(new Error(code),{code});
function accepted(result){if(!['accepted','duplicate'].includes(result?.ack?.status))throw fault(result?.ack?.reasonCode??result?.state??'send-now-unconfirmed');return result}

/** Retained dock control: the only UI entry that can send a paused/idle queued input now.
 * The official queue projection and `availability.sendQueuedNow` decide eligibility, and the
 * command carries the same frozen CAS baseline as the rest of the dock family. */
export function QueueSendNowControl({controller,pollMs=1500}){
  const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(null),[notice,setNotice]=useState(null);
  const owner=useRef(null),flight=useRef(null);
  async function refresh(token=owner.current){
    if(!token||token!==owner.current||flight.current)return;
    const abort=new AbortController();flight.current=abort;
    try{const value=await controller.call('snapshot','read',undefined,{}, {signal:abort.signal});if(token===owner.current){setState(value);return value}}
    catch(err){if(token===owner.current&&!abort.signal.aborted)setError(err.code??err.message)}
    finally{if(flight.current===abort)flight.current=null}
  }
  useEffect(()=>{
    const reset=()=>{flight.current?.abort();flight.current=null;owner.current={};setState(null);setBusy(false);setError(null);setNotice(null);void refresh(owner.current)};
    reset();const off=controller.subscribe(reset),timer=pollMs>0?setInterval(()=>void refresh(),pollMs):null;
    return ()=>{off();clearInterval(timer);owner.current=null;flight.current?.abort();flight.current=null};
  },[controller,pollMs]);
  const snapshot=state?.snapshot,items=snapshot?.queue?.items?.filter(item=>item.dispatch?.state==='queued')??[];
  const allowed=state?.status==='live'&&snapshot?.availability?.sendQueuedNow?.allowed===true&&!busy;
  const reason=snapshot?.availability?.sendQueuedNow?.reasonCode??'projection-unconfirmed';
  async function send(queueItemId){
    if(!allowed)return;
    const token=owner.current,base=snapshot;setBusy(true);setError(null);setNotice(null);
    try{accepted(await controller.command('sendQueuedNow',{queueItemId},{revision:base.revision,logEpoch:base.logEpoch}));if(token===owner.current)setNotice('ZCode accepted send now; waiting for the official queue projection.')}
    catch(err){if(token===owner.current)setError(err.code??err.message)}
    finally{if(token===owner.current){setBusy(false);await refresh(token)}}
  }
  if(!items.length)return null;
  return <section data-zcode-send-now-dock="" style={{padding:'4px 0'}}>
    {items.map(item=><button type="button" key={item.queueItemId} data-zcode-send-now={item.queueItemId} disabled={!allowed} onClick={()=>void send(item.queueItemId)}>
      Send now · {item.text?.slice(0,40)||item.queueItemId}
    </button>)}
    {!allowed&&<span data-zcode-send-now-unavailable="">Send now unavailable: {reason}</span>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" data-zcode-send-now-error="">{error}</p>}
  </section>;
}

/** Interlock notice: shown when the official agent loop still owns the factory so the driver could
 * not activate. The official runtime keeps working; the user must disable the official row. */
export function ZCodeInterlockBanner({status}){
  const state=status?.driverState?.state;
  if(state!=='blocked-official-loop-active')return null;
  return <div role="alert" data-zcode-interlock="" style={{border:'1px solid var(--dsw-alias-border-warning, #b58900)',padding:8,marginBottom:8}}>
    <strong>ZCode driver is not active.</strong>
    <p>{status.driverState.reason??'Disable the official agent-loop plugin, then reload.'}</p>
  </div>;
}
