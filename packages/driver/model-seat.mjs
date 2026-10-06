import {DriverAgent} from './agent.mjs';
import {commandFault} from './commands.mjs';
import {ZCODE_PROVIDER} from '../host/zcode-llm.mjs';
import {officialSelection,selectionConfirmed,selectionFailure,resolveMirrorSelection} from '../host/model-selection.mjs';

const ownedBy=(agent,factory)=>agent instanceof DriverAgent&&agent.transport===factory.transport;

/** Take over the official `SessionCommandController.selectModel` entry for ZCode driver sessions.
 * The ZCode app-server switch is dispatched first and its ACK classified; the official command
 * (durable `model/selection` append, deployment-default save, success value) runs only for a
 * confirmed/unchanged outcome. A refused or outcome-unknown result rejects explicitly and no
 * durable selection is written. Native/official sessions delegate to the original untouched.
 * The official projection `pending` is never read here: it means "not consumed by a request",
 * not "awaiting remote confirmation". */
export function installModelSeat(ctx,factory){
  const controller=ctx.get('sessionController');
  const commands=controller?.commands;
  if(!commands||typeof commands.selectModel!=='function'||typeof controller.resolveAgent!=='function')throw commandFault('driver-model-seat-contract-unavailable');
  const original=commands.selectModel;
  const wrappedSelectModel=async function(request){
    const found=await controller.resolveAgent(request.sessionId);
    if(found.error)throw found.error;
    const agent=found.agent;
    if(!ownedBy(agent,factory))return original.call(this,request);
    if(!factory.accepting)throw commandFault('driver-not-active');
    const llm=typeof ctx.get==='function'?ctx.get('llm'):undefined;
    const resolved=await resolveMirrorSelection(llm,request);
    let outcome;
    try{outcome=await agent.selectModel(officialSelection(resolved.official))}
    catch(error){if(error?.isDSHRemoteError)throw error;throw selectionFailure({outcome:error?.state==='outcome-unknown'?'outcome-unknown':'failed',ack:{reasonCode:error?.code??'selection-failed'}})}
    if(!selectionConfirmed(outcome))throw selectionFailure(outcome);
    return original.call(this,request);
  };
  return ctx.effect(()=>{
    const descriptor=Object.getOwnPropertyDescriptor(commands,'selectModel');
    commands.selectModel=wrappedSelectModel;
    return ()=>{
      if(commands.selectModel!==wrappedSelectModel)return;
      if(descriptor)Object.defineProperty(commands,'selectModel',descriptor);else delete commands.selectModel;
    };
  },'zcode-driver: official model selection seam');
}

/** The official deployment default must resolve inside the ZCode catalog before the official UI
 * opens, otherwise the model seat reports `session/model-unavailable`. Read the live official
 * registry (the picker's own catalog source) and save the first `zcode` model only when the stored
 * default is not already a routable `zcode` selection. Best-effort by contract: a missing registry,
 * an unregistered route, or a failed discovery leaves the stored default untouched. */
export async function coverDefaultModel(ctx,{provider=ZCODE_PROVIDER}={}){
  const read=name=>typeof ctx.get==='function'?ctx.get(name):undefined;
  const llm=read('llm'),defaults=read('agentDefaultModel');
  if(!llm||typeof llm.listModels!=='function'||!defaults||typeof defaults.saveSelection!=='function')return undefined;
  const providers=typeof llm.listProviders==='function'?llm.listProviders():[];
  if(!providers.some(item=>item?.id===provider))return undefined;
  let models;
  try{models=await llm.listModels(provider)}catch{return undefined}
  const first=(models??[])[0];
  if(!first?.id)return undefined;
  const current=typeof defaults.currentSelection==='function'?defaults.currentSelection():undefined;
  if(current?.provider===provider&&(models??[]).some(model=>model.id===current.model))return current;
  let reasoningEffort;
  try{reasoningEffort=(typeof llm.resolveModelInfo==='function'?await llm.resolveModelInfo(provider,first.id):undefined)?.reasoning?.defaultEffort}catch{reasoningEffort=undefined}
  const selection={provider,model:first.id,...(reasoningEffort?{reasoningEffort}:{})};
  try{await defaults.saveSelection(selection)}catch{return undefined}
  return selection;
}

/** Run the default cover once when the driver owns the factory, and lazily again on every event that
 * can move the deployment default:
 * - `llm/adapters-updated` — the route registered after the driver (host plugin ordering).
 * - `app-boot/config-reload` — any successful profile reconciliation, which is what the official
 *   client's `initializeDefaultModel` produces when it rewrites the default to the deepseek first
 *   model on a credential-stored account frame. That write does not touch the llm registry, so
 *   without this re-trigger a late official write would strand the picker default outside the ZCode
 *   catalog. Re-running is idempotent: a default already routable in the ZCode catalog is not rewritten. */
export function installDefaultModelCover(ctx,{provider=ZCODE_PROVIDER}={}){
  const attempt=()=>coverDefaultModel(ctx,{provider}).catch(()=>undefined);
  return ctx.effect(()=>{
    const offs=typeof ctx.on==='function'?['llm/adapters-updated','app-boot/config-reload'].map(name=>ctx.on(name,()=>{void attempt()})):[];
    void attempt();
    return ()=>{for(const off of offs)off?.()};
  },'zcode-driver: default model cover');
}
