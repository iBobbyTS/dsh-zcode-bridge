import {DriverAgent} from './agent.mjs';
import {mapPreset} from './permission-map.mjs';

export const owned=(agent,factory)=>Boolean(agent instanceof DriverAgent&&agent.transport===factory.transport);

const agentBaselines=new WeakMap();
const inFlightMap=new WeakMap();

export function isInitializing(agent){
  return Boolean(agent?.initializing);
}

export function getAgentBaseline(agent){
  return agentBaselines.get(agent);
}

export function isInFlight(agent){
  return Boolean(inFlightMap.get(agent)?.size);
}

/** Reverse sync placeholder for S01; will be implemented in S02 */
function setupReverseSync(ctx,factory){
  return ()=>{};
}

export function installPermissionModeSeam(ctx,factory){
  return ctx.effect(()=>{
    const offForward=ctx.on('session/event',(session,event)=>{
      try{
        if(event?.type!=='permission/preset')return;
        const preset=event.data?.preset??event.preset;
        const mode=mapPreset(preset);
        if(!mode)return;
        const agent=ctx.agents?.get?.(session.id);
        if(!owned(agent,factory))return;
        if(isInitializing(agent)){
          agentBaselines.set(agent,preset);
          return;
        }
        const inFlight=isInFlight(agent);
        const currentMode=agent.conversation?.state?.snapshot?.config?.mode;
        if(!inFlight&&currentMode!==undefined&&currentMode===mode)return;
        const token=Symbol();
        let ops=inFlightMap.get(agent);
        if(!ops)inFlightMap.set(agent,ops=new Set());
        ops.add(token);
        (async()=>{
          try{
            await agent.submitControl({type:'switchCollaborationMode',payload:{mode}});
          }catch(error){
            ctx.logger?.warn?.(`zcode-driver: permission mode switch failed for session ${session.id} to ${mode}: ${error?.code??error?.message??error}`);
          }finally{
            ops.delete(token);
            if(ops.size===0)inFlightMap.delete(agent);
          }
        })();
      }catch(error){
        ctx.logger?.warn?.(`zcode-driver: session event error for session ${session?.id}: ${error?.code??error?.message??error}`);
      }
    });

    const offReverse=setupReverseSync(ctx,factory);

    return ()=>{
      offForward?.();
      offReverse?.();
    };
  },'zcode-driver: permission mode sync seams');
}

export {installPermissionModeSeam as installPermissionModeSeams};
