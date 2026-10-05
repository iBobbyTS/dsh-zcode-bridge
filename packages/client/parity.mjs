import { CatalogStore } from './catalog.mjs';
import { InsightsStore } from './insights.mjs';
import { uploadAttachmentViaPort } from './attachment.mjs';
const fault=code=>Object.assign(new Error(code),{code});
/** One session-bound UI owner. No unknown capabilities are persisted; reconnect and explicit
 * refresh always request current official state. Late replies cannot cross owners/generations. */
export class ParityController {
  generation=0;disposed=false;listeners=new Set();requests=new Set();
  constructor(rpc,{sessionId,connectionGeneration}={}){this.rpc=rpc;this.sessionId=sessionId;this.off=connectionGeneration?.subscribe(()=>{this.generation++;for(const request of this.requests)request.abort();for(const listener of this.listeners)listener()});
    const adapter={call:async(_channel,domain,payload,signal)=>{try{return {ok:true,value:await this.call(domain,payload.operation,payload.kind??payload.action,payload.params??{}, {signal,operationId:payload.operationId})}}catch(error){return {ok:false,error:{code:error.code,message:error.message}}}}};
    this.catalog=new CatalogStore(adapter,{connectionGeneration});this.insights=new InsightsStore(adapter,{connectionGeneration});
  }
  subscribe=listener=>{this.listeners.add(listener);return ()=>this.listeners.delete(listener)};
  async call(domain,operation,kind,params={},options={}){
    if(this.disposed)throw fault('disposed');const generation=this.generation;
    const request=new AbortController(),abort=()=>request.abort();this.requests.add(request);
    if(options.signal?.aborted)abort();else options.signal?.addEventListener('abort',abort,{once:true});
    try{
      if(request.signal.aborted)throw fault('cancelled');
      const response=await this.rpc.call('/zcode-bridge','parity',{domain,operation,...(kind?{kind}:{}),params,...(this.sessionId?{sessionId:this.sessionId}:{}),...(options.operationId?{operationId:options.operationId}:{}),...(options.snapshot?{baseRevision:options.snapshot.revision,baseLogEpoch:options.snapshot.logEpoch}:{}),...(options.heldQueue?{heldQueue:options.heldQueue}:{})},request.signal);
      if(this.disposed||generation!==this.generation)throw fault('parity-owner-replaced');
      if(request.signal.aborted)throw fault('cancelled');
      if(response?.ok!==true)throw fault(response?.error?.code??'parity-unavailable');return response.value;
    }finally{this.requests.delete(request);options.signal?.removeEventListener('abort',abort)}
  }
  workflowManage=(kind,params,options)=>this.call('workflow','manage',kind,params,options);
  workflowRead=(kind,params,options)=>this.call('workflow','read',kind,params,options);
  async submit(command){const snapshot=await this.call('snapshot','read');return this.call('command','submit',command.type,command.payload,{snapshot:snapshot.snapshot})}
  async command(type,params,snapshot,options={}){return this.call('command','submit',type,params,{...options,snapshot})}
  async cancelWork(workId){return this.submit({type:'cancelBackgroundWork',payload:{workId}})}
  async upload(file,{signal,onProgress}={}){
    const bytes=new Uint8Array(await file.arrayBuffer());if(signal?.aborted)throw fault('cancelled');
    const port=Object.fromEntries(['begin','chunk','commit','abort'].map(kind=>[kind,params=>{const {sessionId:_session,...rest}=params;return this.call('attachment',kind==='begin'?'start':kind,undefined,rest,{signal:kind==='abort'?undefined:signal})}]));
    const result=await uploadAttachmentViaPort(port,{sessionId:this.sessionId,uploadId:crypto.randomUUID(),fileName:file.name,mime:file.type||'application/octet-stream',bytes},{signal,onProgress});
    return {ref:result.ref,fileName:file.name,mime:file.type||'application/octet-stream',bytes:bytes.byteLength};
  }
  dispose(){this.disposed=true;this.generation++;for(const request of this.requests)request.abort();this.requests.clear();this.off?.();this.listeners.clear();this.catalog.dispose();this.insights.dispose()}
}
