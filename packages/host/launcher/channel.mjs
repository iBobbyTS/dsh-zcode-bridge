import { fault } from './config.mjs';
const MAX=8*1024*1024;
const marker='__zcode_rpc_nested_uint8array_v1';
export class VSBytes {constructor(buffer){this.buffer=buffer}}
function vint(n){const bytes=[];do{bytes.push((n&127)|(n>>>7?128:0));n>>>=7}while(n);return Buffer.from(bytes)}
function encode(v,depth=0){
  if(depth>64)throw fault('channel-depth');
  if(v===undefined)return Buffer.from([0]);
  if(typeof v==='number'&&(v|0)===v)return Buffer.concat([Buffer.from([6]),vint(v)]);
  if(Array.isArray(v))return Buffer.concat([Buffer.from([4]),vint(v.length),...v.map(x=>encode(x,depth+1))]);
  const tag=v instanceof VSBytes?3:v instanceof Uint8Array?2:typeof v==='string'?1:5;
  const b=tag===3?Buffer.from(v.buffer):tag===2?Buffer.from(v):Buffer.from(tag===1?v:JSON.stringify(v,(_k,x)=>x instanceof Uint8Array?{[marker]:true,base64:Buffer.from(x).toString('base64')}:x));
  return Buffer.concat([Buffer.from([tag]),vint(b.length),b]);
}
export function encodeFrame(header,body){const b=Buffer.concat([encode(header),encode(body)]);if(b.length>MAX)throw fault('channel-size');return new Uint8Array(b)}
export function decodeFrame(input){
  if(!(input instanceof Uint8Array)||input.length>MAX)throw fault('channel-size');
  const b=Buffer.from(input);let p=0;
  const take=n=>{if(n<0||p+n>b.length)throw fault('channel-truncated');const out=b.subarray(p,p+n);p+=n;return out};
  const int=()=>{let value=0;for(let shift=0;shift<35;shift+=7){const c=take(1)[0];if(shift===28&&(c&240))throw fault('channel-varint');value|=(c&127)<<shift;if(!(c&128))return value}throw fault('channel-varint')};
  const val=(depth=0)=>{if(depth>64)throw fault('channel-depth');const t=take(1)[0];if(t===0)return undefined;if(t===6)return int();if(t===4){const n=int();if(n<0||n>b.length-p)throw fault('channel-array');return Array.from({length:n},()=>val(depth+1))}if(![1,2,3,5].includes(t))throw fault('channel-tag');const bytes=take(int());if(t===2)return new Uint8Array(bytes);if(t===3)return new VSBytes(new Uint8Array(bytes));if(t===1)return bytes.toString();return JSON.parse(bytes.toString(),(_k,x)=>x&&x[marker]===true&&typeof x.base64==='string'&&Object.keys(x).length===2?new Uint8Array(Buffer.from(x.base64,'base64')):x)};
  const result=[val(),val()];if(p!==b.length||!Array.isArray(result[0]))throw fault('channel-frame');return result;
}
export const STATUS_CALLS=new Set(['oauth.restoreCachedSessionState','oauth.getActiveProvider','oauth.getProviders','provider-settings.getView','setting.get']);
// State event only: subscribing never resumes a task or stream.
export const STATUS_EVENTS=new Set(['provider-settings.onDidChange']);
export class HostChannel {
  #port;#pending=new Map();#events=new Map();#seq=0;#ready=false;#closed=false;#message;#exit;
  constructor(port,{allowCalls=STATUS_CALLS,allowEvents=STATUS_EVENTS,onReady=()=>{},onClose=()=>{}}={}){
    this.#port=port;this.allowCalls=allowCalls;this.allowEvents=allowEvents;this.onClose=onClose;
    this.#message=({data})=>{try{const [h,b]=decodeFrame(data);if(h[0]===200){if(this.#ready)return;this.#ready=true;for(const x of this.#pending.values())x.send();for(const x of this.#events.values())x.send();onReady();return}
      if(![201,202,203,204].includes(h[0])||!Number.isInteger(h[1]))throw fault('channel-response');
      if(h[0]===204){this.#events.get(h[1])?.listener(b);return}
      const entry=this.#pending.get(h[1]);if(!entry)return;entry.cleanup();
      if(h[0]===201)entry.resolve(b);else if(h[0]===203)entry.reject(b);else {const e=Object.assign(new Error(b?.message??'Host error'),{name:b?.name??'Error'});for(const key of ['code','kind','status','retryAfterMs','data','detail','details','taskId','traceId'])if(b?.[key]!==undefined)e[key]=b[key];if(Array.isArray(b?.stack))e.stack=b.stack.join('\n');entry.reject(e)}
    }catch{this.close('channel-invalid')}};
    this.#exit=()=>this.close('channel-closed');port.on('message',this.#message);port.once('close',this.#exit);port.start();
  }
  get available(){return this.#ready&&!this.#closed}
  #send(h,b){if(this.#closed)throw fault('channel-closed');try{this.#port.postMessage(encodeFrame(h,b))}catch{this.close('channel-send-failed');throw fault('channel-send-failed')}}
  call(channel,method,args=[],{signal,timeoutMs=15000}={}){
    if(!this.allowCalls.has(channel+'.'+method))return Promise.reject(fault('status-rpc-denied'));
    if(this.#closed||signal?.aborted)return Promise.reject(fault(this.#closed?'channel-closed':'cancelled'));
    if(this.#pending.size>=128)return Promise.reject(fault('channel-pending-limit'));
    const id=this.#seq++;
    return new Promise((resolve,reject)=>{let sent=false;const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);this.#pending.delete(id)};
      const cancel=()=>{cleanup();if(sent)try{this.#send([101,id])}catch{}reject(fault('cancelled'))};
      const timer=setTimeout(()=>{cleanup();if(sent)try{this.#send([101,id])}catch{}reject(fault('channel-timeout'))},timeoutMs);
      const send=()=>{if(sent||!this.#pending.has(id))return;sent=true;try{this.#send([100,id,channel,method],args)}catch(e){cleanup();reject(e)}};
      this.#pending.set(id,{resolve,reject,cleanup,send});signal?.addEventListener('abort',cancel,{once:true});if(this.#ready)send();
    });
  }
  listen(channel,event,listener,args=[]){
    if(this.#closed||!this.allowEvents.has(channel+'.'+event))throw fault('status-event-denied');
    if(this.#events.size>=64)throw fault('channel-event-limit');
    const id=this.#seq++;let sent=false;
    const entry={listener,send:()=>{if(sent||!this.#events.has(id))return;sent=true;this.#send([102,id,channel,event],args)}};
    this.#events.set(id,entry);if(this.#ready)entry.send();
    return ()=>{if(!this.#events.delete(id))return;if(sent&&!this.#closed)this.#send([103,id])};
  }
  close(reason='channel-closed'){
    if(this.#closed)return;this.#closed=true;
    for(const x of this.#pending.values()){x.cleanup();x.reject(fault(reason))}this.#pending.clear();this.#events.clear();
    this.#port.off('message',this.#message);this.#port.off('close',this.#exit);this.#port.close();this.onClose(reason);
  }
  get diagnostics(){return {pending:this.#pending.size,subscriptions:this.#events.size,available:this.available}}
}
