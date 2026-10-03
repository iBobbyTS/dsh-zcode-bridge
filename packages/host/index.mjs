import { BridgeHost } from './runtime.mjs';
export const inject=['connection'];
export const CHANNEL='/zcode-bridge';
const sourceEndpoint='sessions';
/** Uses DSH's authenticated carrier and plugin lifecycle; no DSH loop is registered. */
export function apply(ctx,config={}) {
  const host=new BridgeHost({appPath:config.appPath,workspacePath:config.workspacePath});
  ctx.effect(()=>()=>host.dispose(),'zcode-bridge: owned runtime');
  ctx.effect(()=>ctx.connection.rpc.handle(CHANNEL,async(endpoint,payload,signal)=>{
    if(endpoint===sourceEndpoint){
      if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(key=>key!=='address'))return {ok:false,error:{code:'invalid-payload',message:'Only a Session address may be queried',details:{}}};
      try{return {ok:true,value:await host.listSessions({address:payload.address,signal})}}
      catch(error){return {ok:false,error:{code:error.code??'source-unavailable',message:'Official Session source rejected the query',details:error.protocolCode===undefined?{}:{protocolCode:error.protocolCode}}}}
    }
    if(endpoint!=='status'&&endpoint!=='connect')return {ok:false,error:{code:'not-found',message:`Endpoint ${endpoint} not found`,details:{}}};
    if(payload!==null&&payload!==undefined&&!(typeof payload==='object'&&!Array.isArray(payload)&&Object.keys(payload).length===0))return {ok:false,error:{code:'invalid-payload',message:'This endpoint accepts no runtime commands',details:{}}};
    if(signal.aborted)return {ok:false,error:{code:'cancelled',message:'Cancelled',details:{}}};
    return {ok:true,value:endpoint==='connect'?await host.connect():host.status};
  }),'zcode-bridge: status RPC');
}
