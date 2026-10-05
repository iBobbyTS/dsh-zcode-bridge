// Only model identity and reasoning metadata leave the official account resolver.
// Provider configuration, endpoints, headers and credentials never leave Main.
export function projectModels(view){
  if(!Array.isArray(view?.providers))throw Object.assign(new Error('models-unavailable'),{code:'models-unavailable'});
  return view.providers.filter(provider=>provider.executable===true&&provider.enabled!==false).map(provider=>({
    id:provider.providerId,
    models:(provider.models??[]).filter(model=>model.executable===true&&model.selectable!==false&&model.enabled!==false).map(model=>{
      const reasoning=model.effectiveConfig?.optionSpecs?.reasoningLevel;
      const levels=Array.isArray(reasoning?.values)?reasoning.values.filter(value=>typeof value==='string'):[];
      return {id:model.modelId,reasoningLevels:levels,...(levels.length?{defaultReasoningLevel:levels.at(-1)}:{})};
    }),
  })).filter(provider=>typeof provider.id==='string'&&provider.models.length);
}
