// Local notifier keeps this module loadable by the bridge's plain Node tests; the store has no
// dependency on DSH internals beyond the rpc call contract.
const notifySubscribers=(listeners,reason)=>{for(const listener of Array.from(listeners)){try{listener(reason)}catch{/* observer teardown cannot block the carrier */}}};
const err=code=>Object.assign(new Error(code),{code});
const errorOf=error=>({code:error?.code??'insights-unavailable',message:error?.message??String(error)});

/** Official app usage ranges (APP_USAGE_RANGES). No local default window is invented. */
export const USAGE_RANGES=Object.freeze(['all','7d','30d']);
const DEFAULT_RANGE='30d';

function initial(){return Object.freeze({loaded:false,busy:false,error:null,admission:{allowed:false,reason:'not-connected'},account:null,gated:null,resourceSample:null,usage:null,usageRange:DEFAULT_RANGE,diagnostics:null,sectionErrors:{usage:null,diagnostics:null}})}

/** Display-only mirror of official account/usage/diagnostic facts. Never authoritative: every
 *  refresh reads the official app-server. Account state stays UNKNOWN unless an official carrier
 *  returns something authoritative (none does today). */
export class InsightsStore {
  #rpc;#listeners=new Set();#snapshot=initial();#closed=false;#generation=0;#refreshPromise;#reads=new Set();
  constructor(rpc,{connectionGeneration}={}){
    if(!rpc||typeof rpc.call!=='function')throw err('insights-rpc-required');
    this.#rpc=rpc;
    if(connectionGeneration)this.offGeneration=connectionGeneration.subscribe(()=>this.#reset());
  }
  getSnapshot=()=>this.#snapshot;
  subscribe=listener=>{if(this.#closed)return ()=>{};this.#listeners.add(listener);return ()=>this.#listeners.delete(listener)};
  #publish(next){this.#snapshot=Object.freeze({...this.#snapshot,...next});notifySubscribers(this.#listeners,'[zcode-bridge] insights')}
  #reset(){this.#generation++;this.#refreshPromise=undefined;for(const controller of this.#reads)controller.abort();this.#reads.clear();this.#publish({...initial(),admission:{allowed:false,reason:'host-unreachable'}})}
  async #call(payload,signal){
    if(this.#closed)throw err('disposed');
    const response=await this.#rpc.call('/zcode-bridge','insights',payload,signal);
    if(!response||response.ok!==true)throw Object.assign(new Error(response?.error?.message??'insights-unavailable'),{code:response?.error?.code??'insights-unavailable',details:response?.error?.details});
    return response.value;
  }
  async #read(kind,params={}){
    const controller=new AbortController();this.#reads.add(controller);
    try{return await this.#call({operation:'read',kind,params},controller.signal)}
    finally{this.#reads.delete(controller)}
  }
  async state(){
    const generation=this.#generation;
    const value=await this.#call({operation:'state'});
    if(this.#closed||generation!==this.#generation)return value;
    this.#publish({admission:value.admission??{allowed:false,reason:'insights-unavailable'},account:value.account??null,gated:value.gated??null,resourceSample:value.resourceSample??null});
    return value;
  }
  /** Official range selection. The chosen range is read from the official store; nothing is cached. */
  async setRange(range){
    if(!USAGE_RANGES.includes(range))throw err('usage-range-invalid');
    this.#publish({usageRange:range});
    return this.refresh();
  }
  async refresh(){
    if(this.#closed)return Promise.reject(err('disposed'));
    if(this.#refreshPromise)return this.#refreshPromise;
    const generation=this.#generation,range=this.#snapshot.usageRange;
    const operation=(async()=>{
      this.#publish({busy:true,error:null});
      const sectionErrors={usage:null,diagnostics:null};const failures=[];
      let usage=null,diagnostics=null,state=null;
      try{usage=await this.#read('usageStats',{range})}
      catch(error){sectionErrors.usage=errorOf(error);failures.push(errorOf(error))}
      if(this.#closed||generation!==this.#generation)return;
      try{diagnostics=await this.#read('childProcesses')}
      catch(error){sectionErrors.diagnostics=errorOf(error);failures.push(errorOf(error))}
      if(this.#closed||generation!==this.#generation)return;
      try{state=await this.state()}catch(error){failures.push(errorOf(error))}
      if(this.#closed||generation!==this.#generation)return;
      this.#publish({busy:false,loaded:true,usage,diagnostics,sectionErrors,error:failures.length?failures[0]:null,...(state?{admission:state.admission,account:state.account,gated:state.gated,resourceSample:state.resourceSample}:{})});
    })();
    this.#refreshPromise=operation;
    void operation.finally(()=>{if(this.#refreshPromise===operation)this.#refreshPromise=undefined}).catch(()=>{});
    return operation;
  }
  /** Scoped per-session usage is read through the session's own conversation owner, not this store. */
  dispose(){if(this.#closed)return;this.#closed=true;this.offGeneration?.();for(const controller of this.#reads)controller.abort();this.#reads.clear();this.#listeners.clear();this.#publish(initial())}
}
