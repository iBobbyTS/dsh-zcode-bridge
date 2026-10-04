import { newAttachmentUploadId, uploadAttachmentViaPort } from './attachment.mjs';
function commandId(){  const bytes=crypto.getRandomValues(new Uint8Array(16));let time=Date.now();
  for(let i=5;i>=0;i--){bytes[i]=time%256;time=Math.floor(time/256)}bytes[6]=(bytes[6]&15)|0x70;bytes[8]=(bytes[8]&63)|0x80;
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
/** Web view of a Host-owned V4 owner. Polls projection only; commands are never retried. */
export class RemoteConversation {
  #handle;#opening;#released=false;#timer;#listeners=new Set();#polling=false;#commands=new Map();
  constructor(rpc,address){this.rpc=rpc;this.address=address;this.state={status:'idle',snapshot:null,commands:[],admission:{allowed:false,reason:'runtime-restricted'},managementAdmission:{allowed:false,reason:'projection-unconfirmed'}}}
  subscribe(listener){this.#listeners.add(listener);return ()=>this.#listeners.delete(listener)}
  #publish(state){if(this.#released)return;const commands=new Map(this.#commands);for(const record of state.commands??[])commands.set(record.commandId,record);this.state={...state,commands:[...commands.values()]};for(const listener of this.#listeners){try{listener(this.state)}catch{}}}
  async #call(payload, signal){const result=await this.rpc.call('/zcode-bridge','conversation',payload,signal??new AbortController().signal);if(!result.ok)throw Object.assign(new Error(result.error.code),result.error,{remoteRejected:true});return result.value}
  connect(){
    if(this.#released)return Promise.reject(new Error('reference-released'));
    if(this.#opening)return this.#opening;
    if(this.#handle&&this.state.status==='live')return Promise.resolve(this.state);
    this.#publish({...this.state,status:'connecting',error:null});
    const operation=(async()=>{
      try{
        if(this.#handle)this.#publish(await this.#call({operation:'connect',handle:this.#handle}));
        else{
          const result=await this.#call({operation:'open',address:this.address});this.#handle=result.handle;
          if(this.#released){await this.#call({operation:'release',handle:this.#handle});return}
          this.#publish(result.state);
        }
        this.#schedule();return this.state;
      }catch(error){this.#publish({...this.state,status:'error',error:error.code??error.message,managementAdmission:{allowed:false,reason:'projection-unconfirmed'}});throw error}
    })();
    this.#opening=operation;void operation.finally(()=>{if(this.#opening===operation)this.#opening=undefined}).catch(()=>{});return operation;
  }
  #schedule(){clearTimeout(this.#timer);if(!this.#released&&!['closed','error'].includes(this.state.status))this.#timer=setTimeout(()=>void this.refresh(),300)}
  async refresh(){
    if(this.#released||!this.#handle||this.#polling)return;
    this.#polling=true;
    try{this.#publish(await this.#call({operation:'state',handle:this.#handle}))}
    catch(error){this.#publish({...this.state,status:'error',error:error.code??error.message,managementAdmission:{allowed:false,reason:'projection-unconfirmed'}})}
    finally{this.#polling=false;this.#schedule()}
  }
  async submit(command,{signal}={}){
    if(this.#released||!this.#handle)throw new Error('projection-unconfirmed');
    const id=command.commandId??commandId();if(this.#commands.has(id))throw new Error('command-already-tracked');
    if(this.#commands.size>=128){const terminal=[...this.#commands].find(([,r])=>['failed','stale','noop','rejected','not-sent'].includes(r.state));if(!terminal)throw new Error('command-pending-limit');this.#commands.delete(terminal[0])}
    this.#commands.set(id,{commandId:id,type:command.type,state:'sent-unconfirmed'});this.#publish(this.state);
    let result;
    try{result=await this.#call({operation:'command',handle:this.#handle,command:{...command,commandId:id}},signal)}
    catch(error){result={commandId:id,type:command.type,state:error.remoteRejected?'not-sent':'outcome-unknown',error:error.code??error.message}}
    this.#commands.set(id,result);this.#publish({...this.state,commands:this.state.commands.filter(r=>r.commandId!==id)});await this.refresh();return this.state.commands.find(record=>record.commandId===id)??result;
  }
  async queryCommand(commandId){
    if(this.#released||!this.#handle||!this.#commands.has(commandId))throw new Error('command-untracked');
    const result=await this.#call({operation:'query',handle:this.#handle,commandId});this.#commands.set(commandId,result);await this.refresh();this.#publish(this.state);return result;
  }
  historyQuery(params,{signal}={}){
    if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));
    return this.#call({operation:'historyQuery',handle:this.#handle,...params},signal);
  }
  workspaceConfiguration(kind,preferences){
    if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));
    return this.#call({operation:'workspaceConfig',handle:this.#handle,kind,...(preferences===undefined?{}:{preferences})});
  }
  attachmentStart(attachment,signal){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'attachmentStart',handle:this.#handle,attachment},signal)}
  attachmentChunk(uploadId,chunkIndex,dataBase64,signal){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'attachmentChunk',handle:this.#handle,uploadId,chunkIndex,dataBase64},signal)}
  attachmentCommit(uploadId,signal){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'attachmentCommit',handle:this.#handle,uploadId},signal)}
  attachmentAbort(uploadId,signal){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'attachmentAbort',handle:this.#handle,uploadId},signal)}
  attachmentRead({ref,target,attachmentIndex,offset=0,limit=512*1024},signal){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'attachmentRead',handle:this.#handle,ref,...(target===undefined?{}:{target}),...(attachmentIndex===undefined?{}:{attachmentIndex}),offset,limit},signal)}
  conversationAttachmentStat({ref,target,attachmentIndex},signal){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'conversationAttachmentStat',handle:this.#handle,ref,target,attachmentIndex},signal)}
  conversationAttachmentRead({ref,target,attachmentIndex,offset=0,limit=512*1024},signal){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'conversationAttachmentRead',handle:this.#handle,ref,target,attachmentIndex,offset,limit},signal)}
  workflowManage(kind,params={}, {signal}={}){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'workflowManage',handle:this.#handle,kind,params},signal)}
  workflowRead(kind,params={}, {signal}={}){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'workflowRead',handle:this.#handle,kind,params},signal)}
  hostRegistration({signal}={}){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'hostRegistration',handle:this.#handle},signal)}
  /** Official session token usage, scoped to this conversation's own address (never a caller id). */
  sessionUsage(signal){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'sessionUsage',handle:this.#handle},signal)}
  /** Official subagent directory (cursor-paginated ended list). Observation only, never cached here. */
  listSubagents({endedCursor,endedLimit}={},signal){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'subagents',handle:this.#handle,...(endedCursor===undefined?{}:{endedCursor}),...(endedLimit===undefined?{}:{endedLimit})},signal)}
  /** Official bounded background bash output tail; unknown/expired workIds are the official unavailable result. */
  readBackgroundBashOutput({workId}={},signal){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.#call({operation:'backgroundOutput',handle:this.#handle,workId},signal)}
  /** Cancel a projected work by its official workId; the official ACK/reasonCode is authoritative. */
  cancelBackgroundWork({workId}={}){if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));return this.submit({type:'cancelBackgroundWork',payload:{workId}})}
  /** Web path: chunks over scoped RPC; never a full-data request and never a caller-supplied session. */
  uploadAttachment({fileName,mime,bytes},{signal,onProgress}={}){
    if(this.#released||!this.#handle)return Promise.reject(new Error('projection-unconfirmed'));
    const handle=this.#handle,uploadId=newAttachmentUploadId();
    const port={
      begin:p=>this.#call({operation:'attachmentStart',handle,attachment:p},signal),
      chunk:p=>this.#call({operation:'attachmentChunk',handle,uploadId:p.uploadId,chunkIndex:p.chunkIndex,dataBase64:p.dataBase64},signal),
      commit:p=>this.#call({operation:'attachmentCommit',handle,uploadId:p.uploadId},signal),
      abort:()=>this.#call({operation:'attachmentAbort',handle,uploadId},signal),
    };
    return uploadAttachmentViaPort(port,{sessionId:this.address.sessionId,uploadId,fileName,mime,bytes},{signal,onProgress});
  }
  resync(){return this.connect()}
  async cancel(){if(this.#released)return;this.#released=true;clearTimeout(this.#timer);this.#listeners.clear();if(this.#handle)await this.#call({operation:'release',handle:this.#handle});else await this.#opening?.catch(()=>{})}
}
