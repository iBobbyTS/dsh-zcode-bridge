import { BridgeHost } from './runtime.mjs';
export const inject=['connection'];
export const CHANNEL='/zcode-bridge';
const CATALOG_KEYS={read:['operation','kind','params'],operate:['operation','action','params','operationId'],state:['operation']};
/** Bounded catalog endpoint. Caller payload cannot carry runtime, workspace, or secret material. */
export async function handleCatalog(host,payload,signal){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return {ok:false,error:{code:'invalid-payload',message:'Catalog payload must be an object',details:{}}};
  const allowed=CATALOG_KEYS[payload.operation];
  if(!allowed||Object.keys(payload).some(key=>!allowed.includes(key)))return {ok:false,error:{code:'invalid-payload',message:'Catalog operation is not allowed',details:{}}};
  try{
    if(signal?.aborted)throw Object.assign(new Error(),{code:'cancelled'});
    if(payload.operation==='state')return {ok:true,value:host.catalogState()};
    const params=payload.params??{};
    if(!params||typeof params!=='object'||Array.isArray(params))throw Object.assign(new Error(),{code:'invalid-payload'});
    if(payload.operation==='read')return {ok:true,value:await host.catalogRead(payload.kind,params,{signal})};
    return {ok:true,value:await host.catalogOperate(payload.action,params,{signal,operationId:payload.operationId})};
  }catch(error){return {ok:false,error:{code:error.code??'catalog-unavailable',message:'Official catalog operation rejected',details:error.protocolCode===undefined?{}:{protocolCode:error.protocolCode}}}}
}
const INSIGHTS_KEYS={read:['operation','kind','params'],state:['operation']};
/** Bounded account/usage/diagnostics endpoint. Caller payload cannot carry workspace or secret material. */
export async function handleInsights(host,payload,signal){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return {ok:false,error:{code:'invalid-payload',message:'Insights payload must be an object',details:{}}};
  const allowed=INSIGHTS_KEYS[payload.operation];
  if(!allowed||Object.keys(payload).some(key=>!allowed.includes(key)))return {ok:false,error:{code:'invalid-payload',message:'Insights operation is not allowed',details:{}}};
  try{
    if(signal?.aborted)throw Object.assign(new Error(),{code:'cancelled'});
    if(payload.operation==='state')return {ok:true,value:host.insightsState()};
    if(typeof payload.kind!=='string'||!payload.kind)throw Object.assign(new Error(),{code:'invalid-payload'});
    const params=payload.params??{};
    if(!params||typeof params!=='object'||Array.isArray(params))throw Object.assign(new Error(),{code:'invalid-payload'});
    return {ok:true,value:await host.insightsRead(payload.kind,params,{signal})};
  }catch(error){return {ok:false,error:{code:error.code??'insights-unavailable',message:'Official insights operation rejected',details:error.protocolCode===undefined?{}:{protocolCode:error.protocolCode}}}}
}
const AUTOMATION_KEYS={state:['operation']};
/** Bounded automation/off-peak honesty endpoint. There is no management/read request surface: the
 *  official carriers are Host-consumed reverse methods, so only the honest state is exposed. */
export async function handleAutomation(host,payload,signal){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return {ok:false,error:{code:'invalid-payload',message:'Automation payload must be an object',details:{}}};
  const allowed=AUTOMATION_KEYS[payload.operation];
  if(!allowed||Object.keys(payload).some(key=>!allowed.includes(key)))return {ok:false,error:{code:'invalid-payload',message:'Automation operation is not allowed',details:{}}};
  try{
    if(signal?.aborted)throw Object.assign(new Error(),{code:'cancelled'});
    return {ok:true,value:host.automationState()};
  }catch(error){return {ok:false,error:{code:error.code??'automation-unavailable',message:'Official automation projection rejected',details:{}}}}
}
const sourceEndpoint='sessions';
/** Read-only S15 projection; remote identity, target and credentials are never accepted. */
export async function handleRemote(host,payload,signal){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.operation!=='state'||Object.keys(payload).some(key=>key!=='operation'))return {ok:false,error:{code:'invalid-payload',message:'Only remote state may be read',details:{}}};
  if(signal?.aborted)return {ok:false,error:{code:'cancelled',message:'Cancelled',details:{}}};
  try{return {ok:true,value:host.remoteState()}}
  catch(error){return {ok:false,error:{code:error.code??'remote-unavailable',message:'Remote projection unavailable',details:{}}}}
}
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
            historyQuery:['operation','handle','kind','target','baseRevision','baseLogEpoch'],
            workflowManage:['operation','handle','kind','params'],
            workflowRead:['operation','handle','kind','params'],
            sessionUsage:['operation','handle'],
            hostRegistration:['operation','handle'],
            subagents:['operation','handle','endedCursor','endedLimit'],
            backgroundOutput:['operation','handle','workId'],
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
      if(endpoint==='catalog')return handleCatalog(host,payload,signal);
      if(endpoint==='insights')return handleInsights(host,payload,signal);
      if(endpoint==='automation')return handleAutomation(host,payload,signal);
      if(endpoint==='remote')return handleRemote(host,payload,signal);
      if(endpoint!=='status'&&endpoint!=='connect')return {ok:false,error:{code:'not-found',message:`Endpoint ${endpoint} not found`,details:{}}};
      if(payload!==null&&payload!==undefined&&!(typeof payload==='object'&&!Array.isArray(payload)&&Object.keys(payload).length===0))return {ok:false,error:{code:'invalid-payload',message:'This endpoint accepts no runtime commands',details:{}}};
      if(signal.aborted)return {ok:false,error:{code:'cancelled',message:'Cancelled',details:{}}};
      return {ok:true,value:endpoint==='connect'?await host.connect():host.status};
    }),'zcode-bridge: status RPC');
  });
}
