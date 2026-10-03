import { StringDecoder } from 'node:string_decoder';
import { randomUUID } from 'node:crypto';
import { BridgeError } from './installation.mjs';
const own=(x,k)=>Object.hasOwn(x,k);
const validId=x=>typeof x==='string'||(Number.isSafeInteger(x)&&typeof x==='number');
/** Bounded legacy NDJSON peer; stdout alone carries frames. No JSON-RPC adornment. */
export class ProtocolPeer {
  #buffer=''; #decoder=new StringDecoder('utf8'); #pending=new Map(); #retired=new Set(); #closed=false;
  constructor(input,output,{onClose=()=>{},onAuthUnavailable=()=>{},timeoutMs=5000}={}) {
    this.input=input;this.output=output;this.onClose=onClose;this.onAuthUnavailable=onAuthUnavailable;this.timeoutMs=timeoutMs;
    this.data=b=>{try{this.#buffer+=typeof b==='string'?b:this.#decoder.write(b);if(Buffer.byteLength(this.#buffer)>1024*1024)throw Error();let n;while((n=this.#buffer.indexOf('\n'))>=0){const line=this.#buffer.slice(0,n);this.#buffer=this.#buffer.slice(n+1);if(line.trim())this.#receive(JSON.parse(line));}}catch{this.close('protocol-invalid')}};
    this.eof=()=>this.close('transport-eof');this.error=()=>this.close('transport-error');
    input.on('data',this.data);input.once('end',this.eof);input.once('close',this.eof);input.on('error',this.error);output.on('error',this.error);
  }
  get pendingCount(){return this.#pending.size}
  get closed(){return this.#closed}
  #send(frame){if(this.#closed)throw new BridgeError('transport-closed');this.output.write(JSON.stringify(frame)+'\n')}
  #receive(m){
    if(!m||typeof m!=='object'||Array.isArray(m))throw Error();
    if(own(m,'method')){
      if(typeof m.method!=='string'||!own(m,'params')||own(m,'result')||own(m,'error'))throw Error();
      if(!own(m,'id'))return; // Notifications do not settle unary requests.
      if(!validId(m.id))throw Error();
      if(m.method==='interaction/requestProviderRuntimeHeaders'){
        const p=m.params;
        if(!p||typeof p.requestId!=='string'||typeof p.sessionId!=='string'||typeof p.providerId!=='string'||!p.modelSelection||!p.workspace){this.#send({id:m.id,error:{code:-32602,message:'Invalid provider runtime headers params'}});return}
        this.onAuthUnavailable();
        this.#send({id:m.id,result:{headersApplied:false,errorMessage:'Provider request auth is unavailable'}});
      }else this.#send({id:m.id,error:{code:-32601,message:'Host callback unavailable in this bridge slice'}});
      return;
    }
    if(!validId(m.id)||own(m,'result')===own(m,'error'))throw Error();
    if(own(m,'error')&&(!m.error||!Number.isInteger(m.error.code)||typeof m.error.message!=='string'))throw Error();
    const entry=this.#pending.get(m.id);
    if(!entry){if(this.#retired.has(m.id))return;throw Error()}
    this.#pending.delete(m.id);entry.cleanup();
    if(own(m,'error')){const e=new BridgeError('runtime-rejected');e.protocolCode=m.error.code;entry.reject(e)}else entry.resolve(m.result);
  }
  request(method,params,{signal,timeoutMs=this.timeoutMs}={}){
    if(method==='session/close')return Promise.reject(new BridgeError('session-close-forbidden'));
    if(this.#closed)return Promise.reject(new BridgeError('transport-closed'));
    if(signal?.aborted)return Promise.reject(new BridgeError('cancelled'));
    return new Promise((resolve,reject)=>{
      const id='bridge-'+randomUUID();let timer;
      const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort)};
      const fail=code=>{if(!this.#pending.delete(id))return;cleanup();this.#retired.add(id);if(this.#retired.size>256)this.#retired.delete(this.#retired.values().next().value);reject(new BridgeError(code))};
      const abort=()=>fail('cancelled');
      this.#pending.set(id,{resolve,reject,cleanup});
      timer=setTimeout(()=>fail('request-timeout'),timeoutMs);signal?.addEventListener('abort',abort,{once:true});
      try{this.#send({id,method,params})}catch{fail('transport-error');this.close('transport-error')}
    });
  }
  close(code='disposed'){
    if(this.#closed)return;this.#closed=true;
    this.input.off('data',this.data);this.input.off('end',this.eof);this.input.off('close',this.eof);
    for(const p of this.#pending.values()){p.cleanup();p.reject(new BridgeError(code))}this.#pending.clear();this.#retired.clear();this.#buffer='';
    // Keep error absorbers until the streams finish: queued EPIPE must not crash Host.
    this.onClose(code);
  }
}
