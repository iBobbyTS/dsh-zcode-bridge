import { randomUUID } from 'node:crypto';
import { BridgeError } from './installation.mjs';
const own=(x,k)=>Object.hasOwn(x,k);
const validId=x=>typeof x==='string'||Number.isSafeInteger(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;
/** Bounded duplex legacy NDJSON peer. Request direction, rather than id text, owns correlation. */
export class ProtocolPeer {
  #parts=[]; #bytes=0; #pending=new Map(); #retired=new Set(); #reverse=new Map(); #reverseRetired=new Set(); #closed=false;
  #queue=[]; #queuedBytes=0; #blocked=false; #notifications=new Set(); #closures=new Set();
  constructor(input,output,{onClose=()=>{},onAuthUnavailable=()=>{},onRequest,timeoutMs=5000,maxFrameBytes=1024*1024,maxQueueBytes=1024*1024,maxPending=256}={}) {
    if(![timeoutMs,maxFrameBytes,maxQueueBytes,maxPending].every(positive))throw new RangeError('Peer limits must be positive integers');
    Object.assign(this,{input,output,onClose,onAuthUnavailable,onRequest,timeoutMs,maxFrameBytes,maxQueueBytes,maxPending});
    this.data=chunk=>{try{this.#decode(typeof chunk==='string'?Buffer.from(chunk):chunk)}catch(e){this.close(e instanceof BridgeError?e.code:'protocol-invalid')}};
    this.eof=()=>this.close(this.#bytes?'protocol-truncated':'transport-eof');
    this.error=()=>this.close('transport-error');
    this.drain=()=>{this.#blocked=false;try{this.#flush()}catch{this.close('transport-error')}};
    input.on('data',this.data);input.once('end',this.eof);input.once('close',this.eof);input.on('error',this.error);output.on('error',this.error);output.on('drain',this.drain);output.once('close',this.eof);
  }
  get pendingCount(){return this.#pending.size}
  get reversePendingCount(){return this.#reverse.size}
  get queuedBytes(){return this.#queuedBytes}
  get closed(){return this.#closed}
  onNotification(listener){this.#notifications.add(listener);return ()=>this.#notifications.delete(listener)}
  onClosed(listener){this.#closures.add(listener);return ()=>this.#closures.delete(listener)}
  #decode(chunk){
    let start=0;
    while(start<chunk.length&&!this.#closed){
      const newline=chunk.indexOf(10,start),end=newline<0?chunk.length:newline;
      const bytes=end-start;
      if(this.#bytes+bytes>this.maxFrameBytes)throw new BridgeError('protocol-buffer-limit');
      if(bytes){this.#parts.push(Buffer.from(chunk.subarray(start,end)));this.#bytes+=bytes;if(this.#parts.length>=32)this.#parts=[Buffer.concat(this.#parts,this.#bytes)]}
      if(newline<0)return;
      const line=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(this.#parts,this.#bytes));
      this.#parts=[];this.#bytes=0;
      if(line.trim())this.#receive(JSON.parse(line));
      start=end+1;
    }
  }
  #remember(set,id){set.add(id);if(set.size>256)set.delete(set.values().next().value)}
  #send(frame,entry){
    if(this.#closed)throw new BridgeError('transport-closed');
    const line=JSON.stringify(frame)+'\n',bytes=Buffer.byteLength(line);
    if(bytes>this.maxFrameBytes+1)throw new BridgeError('protocol-buffer-limit');
    if(this.#queuedBytes+bytes>this.maxQueueBytes)throw new BridgeError('transport-backpressure-limit');
    this.#queue.push({line,bytes,entry});this.#queuedBytes+=bytes;this.#flush();
  }
  #flush(){
    while(!this.#blocked&&this.#queue.length&&!this.#closed){
      const item=this.#queue.shift();this.#queuedBytes-=item.bytes;
      if(item.entry&&!this.#pending.has(item.entry.id))continue;
      if(item.entry)item.entry.sent=true;
      this.#blocked=!this.output.write(item.line);
    }
  }
  #receive(m){
    if(!m||typeof m!=='object'||Array.isArray(m))throw Error();
    if(own(m,'method')){
      if(typeof m.method!=='string'||!own(m,'params')||own(m,'result')||own(m,'error'))throw Error();
      if(!own(m,'id')){for(const listener of this.#notifications)listener(m);return}
      if(!validId(m.id)||this.#reverse.has(m.id)||this.#reverseRetired.has(m.id))throw Error();
      // A reverse request may reuse an outbound id. It can never resolve that outbound request.
      if(!this.onRequest){
        if(m.method==='interaction/requestProviderRuntimeHeaders'){
          const p=m.params;
          if(!p||typeof p.requestId!=='string'||typeof p.sessionId!=='string'||typeof p.providerId!=='string'||!p.modelSelection||!p.workspace)this.#send({id:m.id,error:{code:-32602,message:'Invalid provider runtime headers params'}});
          else{this.onAuthUnavailable();this.#send({id:m.id,result:{headersApplied:false,errorMessage:'Provider request auth is unavailable'}})}
        }else this.#send({id:m.id,error:{code:-32601,message:'Host callback unavailable in this bridge slice'}});
        this.#remember(this.#reverseRetired,m.id);return;
      }
      if(this.#reverse.size>=this.maxPending)throw new BridgeError('transport-pending-limit');
      const controller=new AbortController();
      const finish=response=>{
        const entry=this.#reverse.get(m.id);if(!entry)return;
        clearTimeout(entry.timer);this.#reverse.delete(m.id);this.#remember(this.#reverseRetired,m.id);
        try{this.#send({id:m.id,...response})}catch(e){this.close(e.code??'transport-error')}
      };
      const timer=setTimeout(()=>{finish({error:{code:-32000,message:'Host callback timed out'}});controller.abort()},this.timeoutMs);
      this.#reverse.set(m.id,{timer,controller});
      Promise.resolve().then(()=>this.onRequest(m,{signal:controller.signal})).then(result=>finish({result}),()=>finish({error:{code:-32603,message:'Host callback failed'}}));
      return;
    }
    if(!validId(m.id)||own(m,'result')===own(m,'error'))throw Error();
    if(own(m,'error')&&(!m.error||!Number.isInteger(m.error.code)||typeof m.error.message!=='string'))throw Error();
    const entry=this.#pending.get(m.id);
    if(!entry){if(this.#retired.has(m.id))return;throw Error()}
    if(own(m,'error')){
      this.#pending.delete(m.id);entry.cleanup();this.#remember(this.#retired,m.id);
      const e=new BridgeError('runtime-rejected');e.protocolCode=m.error.code;e.sent=entry.sent;entry.reject(e);
    }else{
      // Install ownership synchronously before following notifications in the same stdout chunk.
      const result=entry.onResult?entry.onResult(m.result):m.result;
      this.#pending.delete(m.id);entry.cleanup();this.#remember(this.#retired,m.id);entry.resolve(result);
    }
  }
  request(method,params,{signal,timeoutMs=this.timeoutMs,onResult}={}){
    const rejectBeforeSend=code=>{const e=new BridgeError(code);e.sent=false;return Promise.reject(e)};
    if(method==='session/close')return rejectBeforeSend('session-close-forbidden');
    if(this.#closed)return rejectBeforeSend('transport-closed');
    if(signal?.aborted)return rejectBeforeSend('cancelled');
    if(!positive(timeoutMs))return rejectBeforeSend('invalid-timeout');
    if(this.#pending.size>=this.maxPending)return rejectBeforeSend('transport-pending-limit');
    return new Promise((resolve,reject)=>{
      const id='bridge-'+randomUUID();let timer;
      const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort)};
      const entry={id,resolve,reject,cleanup,onResult,sent:false};
      const fail=code=>{
        if(!this.#pending.delete(id))return;cleanup();this.#remember(this.#retired,id);
        this.#queue=this.#queue.filter(item=>{if(item.entry!==entry)return true;this.#queuedBytes-=item.bytes;return false});
        const e=new BridgeError(code);e.sent=entry.sent;reject(e);
      };
      const abort=()=>fail('cancelled');
      this.#pending.set(id,entry);
      timer=setTimeout(()=>fail('request-timeout'),timeoutMs);signal?.addEventListener('abort',abort,{once:true});
      try{this.#send({id,method,params},entry)}catch(e){const code=e.code??'transport-error';fail(code);this.close(code)}
    });
  }
  close(code='disposed'){
    if(this.#closed)return;this.#closed=true;
    this.input.off('data',this.data);this.input.off('end',this.eof);this.input.off('close',this.eof);this.output.off('drain',this.drain);this.output.off('close',this.eof);
    for(const p of this.#pending.values()){p.cleanup();const e=new BridgeError(code);e.sent=p.sent;p.reject(e)}this.#pending.clear();
    for(const p of this.#reverse.values()){clearTimeout(p.timer);p.controller.abort()}this.#reverse.clear();
    this.#retired.clear();this.#reverseRetired.clear();this.#parts=[];this.#bytes=0;this.#queue=[];this.#queuedBytes=0;
    this.#notifications.clear();for(const listener of this.#closures){try{listener(code)}catch{ /* Consumer teardown cannot block the transport owner. */ }}this.#closures.clear();
    // Keep error absorbers: queued EPIPE must not crash Host; the owner releases streams.
    this.onClose(code);
  }
}
