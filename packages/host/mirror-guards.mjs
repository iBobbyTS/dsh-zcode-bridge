const unavailable=method=>Object.assign(new Error(`Official ZCode route unavailable for ${method}`),{code:'session/official-route-unavailable',details:{operation:method}});
function isMirrorRequest(runtime,request){
  if(runtime?.store?.records?.has(request?.sessionId))return true;
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
    // Official selectModel on a ZCode Session is the Q1 selection entry. The official command
    // commits the durable model/selection projection first, then the mirrored Agent forwards
    // the same choice through the official switchModelConfig route. Native sessions are untouched.
    const defaults=typeof scope.get==='function'?scope.get('agentDefaultModel'):undefined;
    const selectModel=async function(original,request,...args){
      let previous;
      try{previous=defaults?.currentSelection?.()}catch{}
      const result=await original.call(this,request,...args);
      const agent=runtime.agents?.get(request.sessionId);
      if(!agent)throw unavailable('selectModel');
      await agent.select({providerId:request.provider,modelId:request.model,...(request.reasoningEffort===undefined?{}:{options:{reasoningLevel:request.reasoningEffort}})});
      // A mirrored route must never replace the native deployment default.
      if(defaults&&previous&&(previous.provider!==request.provider||previous.model!==request.model)){try{await defaults.saveSelection(previous)}catch{}}
      return result;
    };
    const restore=guardController(scope.sessionController,runtime,['rename','fork','selectModel','attachment','updateQueue'],{selectModel});
    scope.effect(()=>restore,'zcode-bridge: official session write guards');
  });
  ctx.inject(['workspaceController'],scope=>{const restore=guardController(scope.workspaceController,runtime,['archiveSession','unarchiveSession','pinSession','unpinSession','rename','delete','insertBefore','insertSessionBefore']);scope.effect(()=>restore,'zcode-bridge: official workspace write guards')});
}
