import { initialClientStatus } from './status.mjs';
/** Connection-generation fencing prevents a late RPC from restoring stale status. */
export class StatusController {
  #snapshot={status:initialClientStatus(),busy:false};#listeners=new Set();#generation=0;#disposed=false;#requests=new Set();#timer;#unsubscribe;
  constructor(rpc,connectionState){this.rpc=rpc;this.connectionState=connectionState}
  getSnapshot=()=>this.#snapshot;
  subscribe=listener=>{this.#listeners.add(listener);return ()=>this.#listeners.delete(listener)};
  #set(change){if(this.#disposed)return;this.#snapshot={...this.#snapshot,...change};for(const l of this.#listeners)l()}
  start(){
    this.#disposed=false;
    this.#unsubscribe=this.connectionState?.subscribe(()=>{this.#generation++;for(const r of this.#requests)r.abort();this.#requests.clear();this.#set({status:initialClientStatus(),busy:false})});
    void this.read();this.#timer=setInterval(()=>{if(!this.#snapshot.busy)void this.read()},2000);
  }
  read=()=>this.#requests.size?Promise.resolve():this.#call('status');
  connect=()=>this.#call('connect');
  async #call(method){
    if(this.#disposed)return;
    const generation=++this.#generation,abort=new AbortController();this.#requests.add(abort);
    if(method==='connect')this.#set({busy:true});
    try{const r=await this.rpc.call('/api','zcode-bridge/'+method,{},abort.signal);if(!this.#disposed&&generation===this.#generation)this.#set({status:r.ok?r.value:initialClientStatus()})}
    catch{if(!this.#disposed&&generation===this.#generation)this.#set({status:initialClientStatus()})}
    finally{this.#requests.delete(abort);if(generation===this.#generation)this.#set({busy:false})}
  }
  dispose(){if(this.#disposed)return;this.#disposed=true;this.#generation++;clearInterval(this.#timer);this.#unsubscribe?.();for(const r of this.#requests)r.abort();this.#requests.clear();this.#listeners.clear()}
}
