import { officialSelection, resolveMirrorSelection, selectionFailure } from './model-selection.mjs';
const unavailable=method=>Object.assign(new Error(`Official ZCode route unavailable for ${method}`),{code:'session/official-route-unavailable',details:{operation:method}});
function isMirrorRequest(runtime,request){
  if(runtime?.store?.records?.has(request?.sessionId)||runtime?.absent?.has(request?.sessionId))return true;
  const workspaceId=request?.workspaceId;
  if(!workspaceId)return false;
  const sessionIds=runtime?.ctx?.workspaceRegistry?.get(workspaceId)?.sessionIds??[];
  return sessionIds.some(id=>runtime.store.records.has(id));
}
/** Keep native Remote methods intact for native Agents. A registered foreign Agent must never
 * fall through to seeded native forks or local-only title/model/inbox/workspace mutations.
 * `overrides` lets one guarded method translate into its official ZCode route instead of
 * failing closed; the override receives the original method as its first argument. */
export function guardController(controller,runtime,methods,overrides={}){
  const originals=new Map();
  for(const method of methods){if(typeof controller[method]!=='function')continue;const original=controller[method];
    const wrapped=function(request,...args){if(isMirrorRequest(runtime,request)){const override=overrides[method];if(override)return override.call(this,original,request,...args);throw unavailable(method)}return original.call(this,request,...args)};
    originals.set(method,{original,wrapped});controller[method]=wrapped;
  }
  return ()=>{for(const [method,{original,wrapped}] of originals)if(controller[method]===wrapped)controller[method]=original};
}
export function installMirrorGuards(ctx,runtime){
  ctx.inject(['sessionController'],scope=>{
    // Official selectModel on a ZCode Session is the one selection owner. It resolves the display
    // route against the official catalog, translates to the real provider/model identity, dispatches
    // switchModelConfig, and only commits the durable projection after a confirmed/unchanged outcome.
    // The native SessionCommandController path is deliberately not used: it would append the
    // projection before the runtime settles and enqueue a native deployment-default save.
    const selectModel=async function(_original,request,_args){
      const agent=runtime.agents?.get(request.sessionId);
      if(!agent)throw unavailable('selectModel');
      const llm=typeof scope.get==='function'?scope.get('llm'):undefined;
      const resolved=await resolveMirrorSelection(llm,request);
      let outcome;
      try{outcome=await agent.select(officialSelection(resolved.official))}
      catch(error){if(error?.isDSHRemoteError)throw error;throw selectionFailure({outcome:'failed',ack:{reasonCode:error?.code??'selection-failed'}})}
      if(outcome.outcome!=='confirmed'&&outcome.outcome!=='unchanged')throw selectionFailure(outcome);
      agent.confirmSelection(resolved);
      return {selected:{...resolved.display}};
    };
    const controller=scope.sessionController;
    const list=controller.list,search=controller.search;
    const visible=item=>!runtime.absent?.has(item.sessionId);
    const project=item=>runtime.store.records.get(item.sessionId)?.officialId?{...item,blank:false}:item;
    if(list)controller.list=async function(...args){const value=await list.apply(this,args);return {...value,items:value.items.filter(visible).map(project)}};
    if(search)controller.search=async function(...args){const value=await search.apply(this,args);return {...value,items:value.items.filter(visible).map(project)}};
    runtime.publishDirectory=async()=>{if(!list)return;const value=await controller.list({},new AbortController().signal);for(const item of value.items)if(runtime.store.records.has(item.sessionId)&&!runtime.absent?.has(item.sessionId))ctx.emit?.('api-session/added',item)};
    scope.effect(()=>()=>{if(list)controller.list=list;if(search)controller.search=search;delete runtime.publishDirectory},'zcode-bridge: native catalog projection');
    void runtime.publishDirectory?.().catch(()=>{});
    const restore=guardController(scope.sessionController,runtime,['create','rename','fork','selectModel','attachment','updateQueue'],{create:function(original,request,...args){if(runtime.absent?.has(request.sessionId))throw unavailable('create');return original.call(this,request,...args)},selectModel,rename:(_original,request)=>runtime.rename(request.sessionId,request.title)});
    scope.effect(()=>restore,'zcode-bridge: official session write guards');
  });
  ctx.inject(['workspaceController'],scope=>{const restore=guardController(scope.workspaceController,runtime,['archiveSession','unarchiveSession','pinSession','unpinSession','rename','delete','insertBefore','insertSessionBefore']);scope.effect(()=>restore,'zcode-bridge: official workspace write guards')});
}
