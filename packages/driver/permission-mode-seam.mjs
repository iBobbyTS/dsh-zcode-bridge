import {DriverAgent} from './agent.mjs';
import {mapPreset,mapMode,modeBundle} from './permission-map.mjs';

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

function setupReverseSync(ctx,factory){
  const subscriptions=new Map();
  let active=true;
  const detach=agent=>{
    const observation=subscriptions.get(agent);
    subscriptions.delete(agent);
    observation?.off?.();
  };
  const attach=agent=>{
    if(!active||!owned(agent,factory)||agent.disposed||subscriptions.has(agent))return;
    const conversation=agent.conversation;
    if(!conversation?.subscribe)return;
    const observation={mode:undefined,live:false,everLive:false,recovering:false,lastStatus:undefined,off:null};
    const alive=()=>active&&subscriptions.get(agent)===observation&&factory.accepting!==false&&!agent.disposed&&
      owned(agent,factory)&&ctx.agents?.get?.(agent.id)===agent&&agent.conversation===conversation;
    const observe=state=>{
      if(!alive()||state?.status==='closed'){detach(agent);return}
      const mode=state?.snapshot?.config?.mode;
      const status=state?.status;
      if(status==='error')observation.recovering=true;
      const live=status==='live';
      const opening=!observation.everLive||observation.recovering;
      const shouldAlign=live&&(mode!==observation.mode||opening);
      // R7: consume the observation even while suppressed; settling a command
      // never replays it. A live recovery is a fresh opening read, even at M=M.
      if(live){
        observation.mode=mode;
        observation.everLive=true;
        observation.recovering=false;
      }
      observation.live=live;
      observation.lastStatus=status;
      if(!shouldAlign||isInFlight(agent))return;
      const bundle=modeBundle(mode),preset=mapMode(mode);
      if(!bundle)return;
      try{
        const projections=ctx.get?.('sessionProjections');
        const current=projections?.stateOf?.(agent.session,'permissions');
        if(current==null){
          ctx.logger?.warn?.(`zcode-driver: permission alignment skipped for session ${agent.id} to ${preset}: permissions-projection-unavailable`);
          return;
        }
        if(current.preset===preset&&current.sandbox===bundle.sandbox&&current.approval===bundle.approval)return;
        for(const [type,data] of [
          ['permission/preset',{preset}],
          ['sandbox/mode',{mode:bundle.sandbox}],
          ['approval/policy',{policy:bundle.approval}],
        ]){
          // append publishes synchronously: a listener can dispose/replace the
          // owner or start a user switch before the next event is appended.
          if(!alive()||isInFlight(agent)||observation.mode!==mode)return;
          agent.session.append(type,data);
        }
      }catch(error){
        ctx.logger?.warn?.(`zcode-driver: permission alignment failed for session ${agent.id} to ${preset}: ${error?.code??error?.message??error}`);
      }
    };
    subscriptions.set(agent,observation);
    observation.off=conversation.subscribe(observe);
    observe(conversation.state); // subscribe deliberately does not replay state.
  };
  const offCreated=ctx.on('agent/created',({agent})=>attach(agent));
  const offDisposed=ctx.on('agent/disposed',({agent})=>detach(agent));
  for(const agent of ctx.agents?.list?.()??[])attach(agent);
  return ()=>{
    active=false;
    offCreated?.();
    offDisposed?.();
    for(const agent of subscriptions.keys())detach(agent);
  };
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
