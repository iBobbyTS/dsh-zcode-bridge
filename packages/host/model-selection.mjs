const fault=(code,message,details)=>{const error=new Error(message??code);error.code=code;if(details!==undefined)error.details=details;return error};
/** A Remote-recognized failure (structural `RemoteError`, no cross-package dependency):
 * `remoteErrorOf` identifies it by the flag, so the client picker receives a real failure. */
const remoteFault=(code,message,details={})=>{const error=fault(code,message,details);error.isDSHRemoteError=true;return error};
export const ZCODE_ROUTE='zcode';
/** Split one qualified catalog id `provider/model` into its official identity. */
export function splitQualified(model){
  const separator=typeof model==='string'?model.indexOf('/'):-1;
  if(separator<=0||separator===model.length-1)throw remoteFault('session/model-unavailable',`mirrored model "${model}" is not a \`provider/model\` identity`,{model});
  return {provider:model.slice(0,separator),model:model.slice(separator+1)};
}
const displayOf=(request,reasoningEffort)=>({provider:request.provider,model:request.model,...(reasoningEffort?{reasoningEffort}:{})});
/** Translate a display selection into its DSH presentation route and its official app-server
 * identity. Non-mirrored providers pass through unchanged; the `zcode` route splits the qualified
 * model id. No registry validation here (see the catalog/discovery resolvers). */
export function resolveIdentity(request){
  if(request?.provider!==ZCODE_ROUTE)return {display:displayOf(request,request?.reasoningEffort),official:{provider:request?.provider,model:request?.model,reasoningEffort:request?.reasoningEffort}};
  const {provider,model}=splitQualified(request.model);
  return {display:displayOf(request,request?.reasoningEffort),official:{provider,model,reasoningEffort:request?.reasoningEffort}};
}
/** Metadata-only effort resolution: `resolveCallConfig` when the registry exposes it (the official
 * validating path the native controller used), otherwise an equivalent check against the model's
 * advertised efforts. An unsupported explicit effort or a failed metadata lookup is a hard error;
 * nothing is dispatched and no projection is written. */
async function resolveEffectiveEffort(llm,request){
  if(typeof llm.resolveCallConfig==='function'){
    const config=await llm.resolveCallConfig({provider:request.provider,model:request.model,...(request.reasoningEffort===undefined?{}:{reasoningEffort:request.reasoningEffort})});
    return config?.reasoningEffort??request.reasoningEffort;
  }
  const info=typeof llm.resolveModelInfo==='function'?await llm.resolveModelInfo(request.provider,request.model):undefined;
  const reasoning=info?.reasoning;
  if(request.reasoningEffort!==undefined){
    if(reasoning===undefined||!reasoning.efforts.some(effort=>effort.id===request.reasoningEffort))throw Object.assign(new Error(`provider "${request.provider}" model "${request.model}" does not support reasoning effort "${request.reasoningEffort}"`),{code:'UNSUPPORTED_REASONING_EFFORT'});
    return request.reasoningEffort;
  }
  return reasoning?.defaultEffort;
}
/** Resolve a mirrored selection against the live official LLM catalog: the display id must exist in
 * the advertised route, and the official identity is the qualified id unwrapped. The effective
 * effort is resolved and validated before any dispatch. Throws a Remote failure on any failure. */
export async function resolveMirrorSelection(llm,request){
  if(!llm||typeof llm.listModels!=='function')throw remoteFault('session/model-unavailable','the official model catalog is unavailable',{});
  let models;
  try{models=await llm.listModels(request.provider)}catch(error){throw remoteFault('session/model-unavailable',error?.message??String(error),{provider:request.provider})}
  if(!(models??[]).some(model=>model.id===request.model))throw remoteFault('session/model-unavailable',`model "${request.model}" is not available for provider "${request.provider}"`,{provider:request.provider,model:request.model});
  let reasoningEffort;
  try{reasoningEffort=await resolveEffectiveEffort(llm,request)}catch(error){throw remoteFault('session/model-unavailable',error?.message??String(error),{provider:request.provider,model:request.model,reason:error?.code})}
  const {display,official}=resolveIdentity({...request,...(reasoningEffort?{reasoningEffort}:{})});
  return {display,official:{...official,reasoningEffort}};
}
/** Resolve against a discovered provider registry (the bridge `runtime/select` legacy entry). */
export function resolveDiscovered(request,providers){
  if(request?.provider!==ZCODE_ROUTE)return resolveIdentity(request);
  const {provider,model}=splitQualified(request.model);
  const entry=(providers??[]).find(item=>item.id===provider)?.models?.find(item=>item.id===model);
  if(!entry)throw remoteFault('session/model-unavailable',`mirrored model "${request.model}" is not in the discovered registry`,{provider,model});
  const levels=entry.reasoningLevels??[];
  if(request.reasoningEffort!==undefined&&!levels.includes(request.reasoningEffort))throw remoteFault('session/model-unavailable',`model "${provider}/${model}" does not support reasoning effort "${request.reasoningEffort}"`,{provider,model,reason:'UNSUPPORTED_REASONING_EFFORT'});
  const reasoningEffort=request.reasoningEffort??entry.defaultReasoningLevel;
  const {display,official}=resolveIdentity({...request,...(reasoningEffort?{reasoningEffort}:{})});
  return {display,official:{...official,reasoningEffort}};
}
/** Classify one switchModelConfig command record into the confirmed/unchanged/failed vocabulary. */
export function selectionOutcome(record){
  const ack=record?.ack;
  if(!ack)return {outcome:record?.state==='outcome-unknown'?'outcome-unknown':'failed',ack};
  if(['accepted','duplicate'].includes(ack.status))return {outcome:'confirmed',ack};
  if(ack.status==='noop')return {outcome:ack.reasonCode==='config.unchanged'?'unchanged':'failed',ack};
  if(ack.status==='stale')return {outcome:'stale',ack};
  return {outcome:'failed',ack};
}
/** Convert a non-confirmed outcome into the failure the picker must see. */
export function selectionFailure(outcome){
  const ack=outcome?.ack;const reasonCode=ack?.reasonCode;
  return remoteFault('session/model-unavailable',reasonCode?`official selection refused: ${reasonCode}`:`official selection ${outcome?.outcome??'failed'}`,{reasonCode,status:ack?.status,outcome:outcome?.outcome});
}
/** Official Agent selection shape ({providerId,modelId,options}) built from an official identity. */
export function officialSelection(official){return {providerId:official.provider,modelId:official.model,...(official.reasoningEffort?{options:{reasoningLevel:official.reasoningEffort}}:{})}}
/** Native `model/selection` projection value (the DSH presentation route). */
export function displayProjection(display){return {provider:display.provider,model:display.model,...(display.reasoningEffort?{reasoningEffort:display.reasoningEffort}:{})}}
export function sameSelection(left,right){return left===right||Boolean(left&&right&&left.provider===right.provider&&left.model===right.model&&(left.reasoningEffort??undefined)===(right.reasoningEffort??undefined))}
export {remoteFault as selectionError};
