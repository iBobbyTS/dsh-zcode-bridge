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
export const DRIVER_LIFECYCLE_STEPS=Object.freeze(['create','prompt','stop','follow']);
const TRANSLATED_EVENT_TYPES=Object.freeze(new Set(['turn/start','turn/end','step/start','step/end','request/header','user/message','assistant/message','tool/call','tool/result','agent/inbox/spliced']));
export function lifecycleEventTypes(value){
  const list=value?.events??value?.records??[];
  return (Array.isArray(list)?list:[]).map(entry=>entry?.type??entry?.event?.type).filter(type=>typeof type==='string');
}
function acceptedReceipt(value){return ['accepted','duplicate','completed','accepted-awaiting-terminal','interrupted','running'].includes(value?.ack?.status??value?.state)}
/** Evaluate one create→prompt→stop→follow run. `follow` must read a transcript that contains the
 * driver's translated session events, not just an empty shell. */
export function evaluateDriverLifecycle({created,prompted,stopped,follow}={}){
  const events=lifecycleEventTypes(follow);
  const checks={
    created:typeof created?.sessionId==='string'&&created.sessionId.length>0,
    prompted:acceptedReceipt(prompted),
    stopped:acceptedReceipt(stopped),
    followed:Array.isArray(follow)===false&&events.length>0,
    translated:events.some(type=>TRANSLATED_EVENT_TYPES.has(type)),
  };
  return {ok:Object.values(checks).every(Boolean),checks,events};
}
export async function runDriverLifecycleProbe(call,{signal}={}){
  const created=await call('runtime',{operation:'create'},{signal});
  const sessionId=created?.sessionId;
  if(typeof sessionId!=='string'||!sessionId)return {ok:false,checks:{created:false,prompted:false,stopped:false,followed:false,translated:false},events:[],failure:'create-returned-no-session'};
  const prompted=await call('conversation',{operation:'command',address:{sessionId},command:{type:'sendText',payload:{text:'Reply with exactly: ok'}}},{signal});
  const stopped=await call('conversation',{operation:'command',address:{sessionId},command:{type:'stop',payload:{}}},{signal});
  const follow=await call('conversation',{operation:'historyQuery',address:{sessionId},kind:'sessionEvents',params:{}},{signal});
  return {sessionId,...evaluateDriverLifecycle({created,prompted,stopped,follow})};
}
