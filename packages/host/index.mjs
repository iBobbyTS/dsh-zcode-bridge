import { BridgeHost } from './runtime.mjs';
export const inject=['connection'];
/** Uses DSH's authenticated carrier and plugin lifecycle; no DSH loop is registered. */
export function apply(ctx,config={}) {
  const host=new BridgeHost({appPath:config.appPath,workspacePath:config.workspacePath});
  ctx.effect(()=>()=>host.dispose(),'zcode-bridge: owned runtime');
  ctx.effect(()=>ctx.connection.rpc.intercept('/api',endpoint=>['zcode-bridge/status','zcode-bridge/connect'].includes(endpoint),async(endpoint,payload,signal)=>{
    if(payload!==null&&payload!==undefined&&!(typeof payload==='object'&&!Array.isArray(payload)&&Object.keys(payload).length===0))return {ok:false,error:{code:'invalid-payload',message:'This endpoint accepts no runtime commands',details:{}}};
    if(signal.aborted)return {ok:false,error:{code:'cancelled',message:'Cancelled',details:{}}};
    return {ok:true,value:endpoint==='zcode-bridge/connect'?await host.connect():host.status};
  }),'zcode-bridge: status RPC');
}
