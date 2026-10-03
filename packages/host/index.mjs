import { BridgeHost } from './runtime.mjs';
export const inject=['connection'];
export const CHANNEL='/zcode-bridge';
const sourceEndpoint='sessions';
/** Uses DSH's authenticated carrier and plugin lifecycle; no DSH loop is registered. */
export function apply(ctx,config={}) {
  const host=new BridgeHost({appPath:config.appPath,workspacePath:config.workspacePath,catalogLimit:config.catalogLimit});
  ctx.effect(()=>()=>host.dispose(),'zcode-bridge: owned runtime');
  ctx.inject(['webServer'],webCtx=>{
    // Connection binds routes to the Context reading the service. The injected
    // child owns webServer access and releases the route when it disappears.
    webCtx.effect(()=>webCtx.connection.rpc.handle(CHANNEL,async(endpoint,payload,signal)=>{
      if(endpoint===sourceEndpoint){
        if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(key=>key!=='address'))return {ok:false,error:{code:'invalid-payload',message:'Only a Session address may be queried',details:{}}};
        try{return {ok:true,value:await host.listSessions({address:payload.address,signal})}}
        catch(error){return {ok:false,error:{code:error.code??'source-unavailable',message:'Official Session source rejected the query',details:error.protocolCode===undefined?{}:{protocolCode:error.protocolCode}}}}
      }
      if(endpoint==='conversation'){
        try{
          if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Object.assign(new Error(),{code:'invalid-payload'});
          const operationKeys={
            open:['operation','address'],
            workspaceConfig:['operation','handle','kind','preferences'],
            attachmentStart:['operation','handle','attachment'],
            attachmentChunk:['operation','handle','uploadId','chunkIndex','dataBase64'],
            attachmentCommit:['operation','handle','uploadId'],
            attachmentAbort:['operation','handle','uploadId'],
            attachmentRead:['operation','handle','ref','target','attachmentIndex','offset','limit'],
            conversationAttachmentStat:['operation','handle','ref','target','attachmentIndex'],
            conversationAttachmentRead:['operation','handle','ref','target','attachmentIndex','offset','limit'],
          };
          const allowed=operationKeys[payload.operation]??['operation','handle','command','commandId'];
          if(Object.keys(payload).some(key=>!allowed.includes(key)))throw Object.assign(new Error(),{code:'invalid-payload'});
          signal.throwIfAborted();
          return {ok:true,value:payload.operation==='open'?await host.openConversation(payload.address,{signal}):await host.conversationOperation(payload,signal)};
        }catch(error){return {ok:false,error:{code:error.code??'conversation-unavailable',message:'Official conversation operation rejected',details:error.protocolCode===undefined?{}:{protocolCode:error.protocolCode}}}}
      }
      if(endpoint!=='status'&&endpoint!=='connect')return {ok:false,error:{code:'not-found',message:`Endpoint ${endpoint} not found`,details:{}}};
      if(payload!==null&&payload!==undefined&&!(typeof payload==='object'&&!Array.isArray(payload)&&Object.keys(payload).length===0))return {ok:false,error:{code:'invalid-payload',message:'This endpoint accepts no runtime commands',details:{}}};
      if(signal.aborted)return {ok:false,error:{code:'cancelled',message:'Cancelled',details:{}}};
      return {ok:true,value:endpoint==='connect'?await host.connect():host.status};
    }),'zcode-bridge: status RPC');
  });
}
