import { randomUUID } from 'node:crypto';
import { BridgeError } from './installation.mjs';
/** Only explicit wire errors from registered host handlers may select a protocol code. */
export class HostCallbackError extends Error {
  constructor(code,message){super(message);if(!Number.isInteger(code))throw new TypeError('Invalid callback error code');this.protocolCode=code}
}
const own=(x,k)=>Object.hasOwn(x,k);
const validId=x=>typeof x==='string'||Number.isSafeInteger(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;
/** Bounded duplex legacy NDJSON peer. Request direction, rather than id text, owns correlation. */
export class ProtocolPeer {
  #line=Buffer.alloc(0); #bytes=0; #pending=new Map(); #retired=new Set(); #reverse=new Map(); #reverseRetired=new Set(); #closed=false;
  #handlers=new Map(); #reverseObservers=new Set();
  #queue=[]; #queuedBytes=0; #blocked=false; #notifications=new Set(); #closures=new Set();
  constructor(input,output,{onClose=()=>{},onAuthUnavailable=()=>{},onRequest,timeoutMs=5000,maxFrameBytes=1024*1024,maxQueueBytes=1024*1024,maxPending=256}={}) {
    if(![timeoutMs,maxFrameBytes,maxQueueBytes,maxPending].every(positive))throw new RangeError('Peer limits must be positive integers');
    Object.assign(this,{input,output,onClose,onAuthUnavailable,onRequest,timeoutMs,maxFrameBytes,maxQueueBytes,maxPending});
    this.data=chunk=>{try{this.#decode(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk))}catch(e){this.close(e instanceof BridgeError?e.code:'protocol-invalid')}};
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
  registerRequestHandler(method,handler){
    if(this.#closed||typeof method!=='string'||typeof handler!=='function'||this.#handlers.has(method))throw new BridgeError('host-handler-invalid');
    this.#handlers.set(method,handler);return ()=>{if(this.#handlers.get(method)===handler)this.#handlers.delete(method)};
  }
  onReverseSettled(listener){this.#reverseObservers.add(listener);return ()=>this.#reverseObservers.delete(listener)}
  #settled(request,response,outcome){for(const listener of this.#reverseObservers){try{listener({request,response,outcome})}catch{ /* Observation cannot change an official callback response. */ }}}
  #decode(chunk){
    let start=0;
    while(start<chunk.length&&!this.#closed){
      const newline=chunk.indexOf(10,start),end=newline<0?chunk.length:newline;
      const bytes=end-start;
      if(this.#bytes+bytes>this.maxFrameBytes)throw new BridgeError('protocol-buffer-limit');
      if(bytes){
        const required=this.#bytes+bytes;
        if(required>this.#line.length){
          const capacity=Math.min(this.maxFrameBytes,Math.max(required,this.#line.length*2,4096));
          const line=Buffer.allocUnsafe(capacity);this.#line.copy(line,0,0,this.#bytes);this.#line=line;
        }
        chunk.copy(this.#line,this.#bytes,start,end);this.#bytes=required;
      }
      if(newline<0)return;
      const line=new TextDecoder('utf-8',{fatal:true}).decode(this.#line.subarray(0,this.#bytes));
      this.#bytes=0;
      if(line.trim())this.#receive(JSON.parse(line));
      start=end+1;
    }
  }
  #remember(set,id){set.add(id);if(set.size>256)set.delete(set.values().next().value)}
  #send(frame,entry,delivery){
    if(this.#closed)throw new BridgeError('transport-closed');
    const line=JSON.stringify(frame)+'\n',bytes=Buffer.byteLength(line);
    if(bytes>this.maxFrameBytes+1)throw new BridgeError('protocol-buffer-limit');
    if(this.#queuedBytes+bytes>this.maxQueueBytes)throw new BridgeError('transport-backpressure-limit');
    this.#queue.push({line,bytes,entry,delivery});this.#queuedBytes+=bytes;this.#flush();
  }
  #flush(){
    while(!this.#blocked&&this.#queue.length&&!this.#closed){
      const item=this.#queue.shift();this.#queuedBytes-=item.bytes;
      if(item.entry&&!this.#pending.has(item.entry.id))continue;
      if(item.entry)item.entry.sent=true;
      try{this.#blocked=!this.output.write(item.line)}catch(error){item.delivery?.dropped();throw error}
      item.delivery?.written();
    }
  }
  #receive(m){
    if(!m||typeof m!=='object'||Array.isArray(m))throw Error();
    if(own(m,'method')){
      if(typeof m.method!=='string'||!own(m,'params')||own(m,'result')||own(m,'error'))throw Error();
      if(!own(m,'id')){for(const listener of this.#notifications)listener(m);return}
      if(!validId(m.id)||this.#reverse.has(m.id)||this.#reverseRetired.has(m.id))throw Error();
      // A reverse request may reuse an outbound id. It can never resolve that outbound request.
      const handler=this.#handlers.get(m.method)??this.onRequest;
      if(!handler){
        if(m.method==='interaction/requestProviderRuntimeHeaders'){
          const p=m.params;
          if(!p||typeof p.requestId!=='string'||typeof p.sessionId!=='string'||typeof p.providerId!=='string'||!p.modelSelection||!p.workspace)this.#send({id:m.id,error:{code:-32602,message:'Invalid provider runtime headers params'}});
          else{this.onAuthUnavailable();this.#send({id:m.id,result:{headersApplied:false,errorMessage:'Provider request auth is unavailable'}})}
        }else this.#send({id:m.id,error:{code:-32601,message:'Host callback unavailable in this bridge slice'}});
        this.#remember(this.#reverseRetired,m.id);return;
      }
      if(this.#reverse.size>=this.maxPending)throw new BridgeError('transport-pending-limit');
      const controller=new AbortController();
      const finish=(response,outcome)=>{
        const entry=this.#reverse.get(m.id);if(!entry)return;
        clearTimeout(entry.timer);this.#reverse.delete(m.id);this.#remember(this.#reverseRetired,m.id);
        try{this.#send({id:m.id,...response},undefined,{written:()=>this.#settled(m,response,outcome),dropped:()=>this.#settled(m,response,'outcome-unknown')})}catch(e){this.#settled(m,response,'outcome-unknown');this.close(e.code??'transport-error')}
      };
      const timer=setTimeout(()=>{finish({error:{code:-32000,message:'Host callback timed out'}},'outcome-unknown');controller.abort()},this.timeoutMs);
      this.#reverse.set(m.id,{timer,controller,request:m});
      Promise.resolve().then(()=>handler(m,{signal:controller.signal})).then(result=>finish({result},'responded'),error=>finish({error:{code:error instanceof HostCallbackError?error.protocolCode:-32603,message:error instanceof HostCallbackError?error.message:'Host callback failed'}},'rejected'));
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
    for(const p of this.#reverse.values()){clearTimeout(p.timer);this.#settled(p.request,null,'outcome-unknown');p.controller.abort()}this.#reverse.clear();
    for(const item of this.#queue)item.delivery?.dropped();
    this.#handlers.clear();this.#reverseObservers.clear();
    this.#retired.clear();this.#reverseRetired.clear();this.#line=Buffer.alloc(0);this.#bytes=0;this.#queue=[];this.#queuedBytes=0;
    this.#notifications.clear();for(const listener of this.#closures){try{listener(code)}catch{ /* Consumer teardown cannot block the transport owner. */ }}this.#closures.clear();
    // Keep error absorbers: queued EPIPE must not crash Host; the owner releases streams.
    this.onClose(code);
  }
}
