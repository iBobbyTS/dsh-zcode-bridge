import {join} from 'node:path';

/** Pure, offline-testable pieces of the isolated acceptance runner: argument parsing, the
 * isolated profile patch (the delivered patch never disables an official row), the plugin install
 * targets, and the driver-mode probe evaluation. No network, process or filesystem side effect. */
export const ACCEPTANCE_OPTIONS=Object.freeze(new Set(['--root','--port','--smoke','--prepare-only','--diagnose-version-seams','--driver-mode']));
export const ACCEPTANCE_DEFAULT_PORT=3208;

export function parseAcceptanceArgs(args,{resolve}= {}){
  let root,port=ACCEPTANCE_DEFAULT_PORT,smoke=false,prepareOnly=false,diagnose=false,driverMode=false;
  for(let i=0;i<args.length;i++){
    const arg=args[i];if(!ACCEPTANCE_OPTIONS.has(arg))throw Error('Unknown option: '+arg);
    if(arg==='--smoke')smoke=true;
    else if(arg==='--prepare-only')prepareOnly=true;
    else if(arg==='--diagnose-version-seams')diagnose=true;
    else if(arg==='--driver-mode')driverMode=true;
    else {const value=args[++i];if(!value||value.startsWith('--'))throw Error('Missing value for '+arg);if(arg==='--root')root=resolve?resolve(value):value;else port=Number(value)}
  }
  return {root,port,smoke,prepareOnly,diagnose,driverMode};
}
export function assertAcceptanceArgs(options){
  if(!Number.isInteger(options.port)||options.port<1024||options.port>65535)throw Error('Invalid port');
  if(options.smoke&&options.prepareOnly)throw Error('Choose --smoke or --prepare-only');
  return options;
}
/** The isolated profile patch. Driver mode disables the official agent-loop row only inside this
 * generated profile; the shipped cordis.patch.yml never carries that row. */
export function profilePatchFor({launcher,driverMode=false}){
  return [
    ...(driverMode?[{id:'agent-loop',disabled:true}]:[]),
    {id:'zcode-bridge-host',config:{authorityMode:'host-backed',launcher}},
    {id:'session-title-llm',disabled:true},
  ];
}
export function pluginInstallTargets({repo,driverMode=false}){
  const targets=['file:'+repo,'file:'+join(repo,'packages/host'),'file:'+join(repo,'packages/client')];
  if(driverMode)targets.push('file:'+join(repo,'packages/driver'));
  return targets;
}
/** Evaluate the lifecycle probe for the selected mode. Driver mode requires the driver to have
 * occupied the official factory and the launcher to be authenticated/ready; both modes require an
 * error-free plugin load. */
export function driverModeProbe({driverMode=false,bridgeStatus,pluginErrors=[],launcherReady}={}){
  const checks={
    bridgeStatusOk:bridgeStatus?.ok===true,
    launcherReady:bridgeStatus?.launcherPhase==='ready'||launcherReady===true,
    pluginErrors:pluginErrors.length===0,
  };
  if(driverMode)checks.driverOccupied=bridgeStatus?.driverState?.state==='occupied';
  return {ok:Object.values(checks).every(Boolean),checks};
}

/** Lifecycle probe for a driver session over the official session API surface. The bridge call is
 * injected so the whole flow is offline-testable; the real runner wires it to the authenticated
 * bridge HTTP endpoints. */
export const DRIVER_LIFECYCLE_STEPS=Object.freeze(['create','prompt','stop','page']);
const TRANSLATED_EVENT_TYPES=Object.freeze(new Set(['turn/start','turn/end','step/start','step/end','request/header','user/message','assistant/message','tool/call','tool/result','agent/inbox/spliced']));
export function lifecycleEventTypes(value){
  const list=value?.records??value?.events??[];
  return (Array.isArray(list)?list:[]).map(entry=>entry?.event?.type??entry?.type).filter(type=>typeof type==='string');
}
/** The official prompt/cancel receipts are `{accepted:true}` (SessionPromptValue / SessionCancelValue)
 * and carry no ack/state. The legacy bridge ack/state vocabulary stays accepted as a compatibility
 * positive so the probe works against both surfaces. */
function acceptedReceipt(value){
  if(value?.accepted===true)return true;
  return ['accepted','duplicate','completed','accepted-awaiting-terminal','interrupted','running'].includes(value?.ack?.status??value?.state);
}
/** Evaluate one create→prompt→stop→page run. `page` is the official `@Remote('page')` cold
 * transcript read; it must contain the driver's translated session events, not an empty shell. */
export function evaluateDriverLifecycle({created,prompted,stopped,page}={}){
  const events=lifecycleEventTypes(page);
  const checks={
    created:typeof created?.sessionId==='string'&&created.sessionId.length>0,
    prompted:acceptedReceipt(prompted),
    stopped:acceptedReceipt(stopped),
    followed:events.filter(type=>type!=='session/end-seed').length>0,
    translated:events.some(type=>TRANSLATED_EVENT_TYPES.has(type)),
  };
  return {ok:Object.values(checks).every(Boolean),checks,events};
}
/** The official session API surface of the isolated web host (never the bridge's own endpoints).
 * `session/page` replaces the stream-mode `session/follow`: the S04 authority confirms page is a
 * single-shot cold read that works without an active Agent. */
export const OFFICIAL_SESSION_METHODS=Object.freeze({create:'session/create',prompt:'session/prompt',cancel:'session/cancel',page:'session/page'});
/** Build the official remote caller. Wire contract: POST `/api/<method>` with the client-request
 * envelope `{type:'client-request',rpcId,method,payload}` and read the matching
 * `{type:'server-response',rpcId,result:{ok,value|error}}` reply. */
export function officialRemoteCall({baseURL,cookie,fetchImpl=globalThis.fetch,timeoutMs=30000,newRpcId}={}){
  const nextRpcId=newRpcId??(()=>globalThis.crypto.randomUUID());
  return async(method,payload,{signal}={})=>{
    const rpcId=nextRpcId();
    const timeout=AbortSignal.timeout(timeoutMs);
    const combined=signal?AbortSignal.any([signal,timeout]):timeout;
    const response=await fetchImpl(`${baseURL}/api/${method}`,{method:'POST',headers:{...(cookie?{cookie}:{}),'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId,method,payload}),signal:combined});
    const body=await response.json();
    if(body?.type!=='server-response'||body.rpcId!==rpcId)throw Object.assign(new Error('official remote reply does not match the request'),{code:'official-remote-envelope-mismatch'});
    if(body.result?.ok!==true)throw Object.assign(new Error(body.result?.error?.code??body.result?.error?.message??'official-remote-failed'),{code:body.result?.error?.code??'official-remote-failed'});
    return body.result.value;
  };
}
export async function runDriverLifecycleProbe(call,{signal}={}){
  const created=await call(OFFICIAL_SESSION_METHODS.create,{},{signal});
  const sessionId=created?.sessionId;
  if(typeof sessionId!=='string'||!sessionId)return {ok:false,checks:{created:false,prompted:false,stopped:false,followed:false,translated:false},events:[],failure:'create-returned-no-session'};
  // SessionAddress is a discriminated union: the ordinary-session variant always carries
  // `kind:'session'`; without it an addressId consumer falls through to the child variant and
  // resolves `childSessionId=undefined`, failing the source lookup.
  const address=created?.address??{kind:'session',sessionId,...(created?.workspace?{workspace:created.workspace}:{}),...(created?.authority?{authority:created.authority}:{})};
  // SessionPromptRequest requires a client-minted request id (persisted on the accepted message)
  // and an explicit admission mode.
  const prompted=await call(OFFICIAL_SESSION_METHODS.prompt,{requestId:globalThis.crypto.randomUUID(),sessionId,mode:'queue',content:[{type:'text',text:'Reply with exactly: ok'}]},{signal});
  const stopped=await call(OFFICIAL_SESSION_METHODS.cancel,{sessionId},{signal});
  const page=await call(OFFICIAL_SESSION_METHODS.page,{address,throughSeq:-1,maxMessages:200},{signal});
  return {sessionId,...evaluateDriverLifecycle({created,prompted,stopped,page})};
}

/** Merge the generic boot outcome with the opt-in lifecycle probe. A failed probe keeps its own
 * outcome so a later generic boot result never masks it; a successful or disabled probe leaves the
 * generic outcome untouched. */
export function mergeAcceptanceOutcome({genericOutcome,driverLifecycleProbe}){
  if(driverLifecycleProbe?.ok===false)return 'driver-lifecycle-probe-unconfirmed';
  return genericOutcome;
}
/** Exit-code policy. In smoke mode a seam difference and an unconfirmed lifecycle probe are both
 * non-zero; outside smoke the child process exit code is reported as before. */
export function acceptanceExitCode({smoke,outcome,webExitCode}){
  if(smoke)return ['seam-differences-found','driver-lifecycle-probe-unconfirmed'].includes(outcome)?2:0;
  return webExitCode??1;
}
