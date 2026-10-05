const fault=(code,message)=>Object.assign(new Error(message??code),{code});
export const ZCODE_PROVIDER='zcode';
export const ZCODE_STREAM_FAIL_CLOSED='zcode-adapter-fail-closed';
/** Display labels for the runtime's effort ids; unknown ids stay verbatim. */
const EFFORT_NAMES={low:'Low',medium:'Medium',high:'High',xhigh:'Extra high',max:'Max'};

/** Map discovered official provider/model groups into the one `zcode` route's catalog.
 * Entry ids are `<providerId>/<modelId>` so a discovered account model keeps its origin. */
export function zcodeModels(providers=[]){
  const models=[];
  for(const provider of providers??[]){
    if(!provider?.id)continue;
    for(const model of provider.models??[]){
      if(!model?.id)continue;
      const efforts=(model.reasoningLevels??[]).map(id=>({id,name:EFFORT_NAMES[id]??id}));
      models.push({
        provider:ZCODE_PROVIDER,
        id:`${provider.id}/${model.id}`,
        name:`${provider.id}/${model.id}`,
        ...(efforts.length?{reasoning:{efforts,...(model.defaultReasoningLevel?{defaultEffort:model.defaultReasoningLevel}:{})}}:{}),
      });
    }
  }
  return models;
}

/** One adapter-owned catalog backed by a discovery callback. `stream` never executes:
 * native-loop dispatch of a mirrored model is a programming error, not a silent no-op. */
export function createZCodeAdapter({discover=async()=>[]}={}){
  const adapter={
    providerInfo:provider=>({id:provider,name:'Zcode'}),
    providerRetryPolicy(){return undefined},
    imageRequestPricing(){return undefined},
    async listModels(provider){return provider===ZCODE_PROVIDER?zcodeModels(await discover()):[]},
    async resolveModel(provider,model){
      const entry=provider===ZCODE_PROVIDER?zcodeModels(await discover()).find(candidate=>candidate.id===model):undefined;
      return entry??{provider,id:model,name:model};
    },
    async prepareCall(provider,model,signal){
      return {model:await adapter.resolveModel(provider,model,signal),stream:options=>adapter.stream(options)};
    },
    stream(){throw fault(ZCODE_STREAM_FAIL_CLOSED,'The Zcode provider is a mirror route: model calls execute through the official ZCode app-server, never in-process.')},
  };
  return adapter;
}

/** Register the `zcode` route on the official LLM registry. The registration lives with the
 * caller scope; pass `ctx.llm` directly or let `ctx.inject` resolve it. */
export function installZCodeLlm(ctx,{discover}={}){
  const adapter=createZCodeAdapter({discover});
  const register=scope=>{
    const dispose=scope.llm.registerAdapter([ZCODE_PROVIDER],adapter);
    if(typeof scope.effect==='function')scope.effect(()=>()=>dispose(),'zcode-bridge: zcode llm route');
    return {adapter,dispose};
  };
  // ctx.get is the inject-free accessor: register synchronously at install time so the
  // provider set is complete before the first client catalog read.
  const llm=typeof ctx?.get==='function'?ctx.get('llm'):undefined;
  if(llm)return register({llm,effect:typeof ctx.effect==='function'?(...args)=>ctx.effect(...args):undefined});
  if(typeof ctx?.inject==='function')return ctx.inject(['llm'],register);
  if(ctx?.llm)return register(ctx);
  throw fault('llm-unavailable','The official LLM registry is not available to register the Zcode provider route.');
}
