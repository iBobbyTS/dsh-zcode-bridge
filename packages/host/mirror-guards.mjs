const unavailable=method=>Object.assign(new Error(`Official ZCode route unavailable for ${method}`),{code:'session/official-route-unavailable',details:{operation:method}});
/** Keep native Remote methods intact for native Agents. A registered foreign Agent must never
 * fall through to seeded native forks or local-only title/model/inbox/workspace mutations. */
export function guardController(controller,runtime,methods){
  const originals=new Map();
  for(const method of methods){if(typeof controller[method]!=='function')continue;const original=controller[method];
    const wrapped=function(request,...args){if(runtime.store.records.has(request?.sessionId)||request?.workspaceId&&runtime.ctx?.workspaceRegistry.get(request.workspaceId)?.sessionIds.some(id=>runtime.store.records.has(id)))throw unavailable(method);return original.call(this,request,...args)};
    originals.set(method,{original,wrapped});controller[method]=wrapped;
  }
  return ()=>{for(const [method,{original,wrapped}] of originals)if(controller[method]===wrapped)controller[method]=original};
}
export function installMirrorGuards(ctx,runtime){
  ctx.inject(['sessionController'],scope=>{const restore=guardController(scope.sessionController,runtime,['rename','fork','selectModel','attachment','updateQueue']);scope.effect(()=>restore,'zcode-bridge: official session write guards')});
  ctx.inject(['workspaceController'],scope=>{const restore=guardController(scope.workspaceController,runtime,['archiveSession','unarchiveSession','pinSession','unpinSession','rename','delete','insertBefore','insertSessionBefore']);scope.effect(()=>restore,'zcode-bridge: official workspace write guards')});
}
