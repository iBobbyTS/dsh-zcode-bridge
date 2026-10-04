// Local notifier keeps this module loadable by the bridge's plain Node tests; the store has no
// dependency on DSH internals beyond the rpc call contract.
const notifySubscribers=(listeners,reason)=>{for(const listener of Array.from(listeners)){try{listener(reason)}catch{/* observer teardown cannot block the carrier */}}};
const err=code=>Object.assign(new Error(code),{code});
const errorOf=error=>({code:error?.code??'automation-unavailable',message:error?.message??String(error)});

function initial(){return Object.freeze({loaded:false,busy:false,error:null,admission:{allowed:false,reason:'not-connected'},management:null,offPeak:null,runFeedback:null,account:null,reverse:null})}

/**
 * Display-only mirror of the official automation/off-peak honesty projection. Never authoritative and
 * never a task store: the endpoint exposes no management/read carrier, so this store cannot create,
 * list, bind, cancel or fabricate an automation or run feedback.
 */
export class AutomationStore {
  #rpc;#listeners=new Set();#snapshot=initial();#closed=false;#generation=0;#refreshPromise;
  constructor(rpc,{connectionGeneration}={}){
    if(!rpc||typeof rpc.call!=='function')throw err('automation-rpc-required');
    this.#rpc=rpc;
    if(connectionGeneration)connectionGeneration.subscribe(()=>this.#reset());
  }
  getSnapshot=()=>this.#snapshot;
  subscribe=listener=>{if(this.#closed)return ()=>{};this.#listeners.add(listener);return ()=>this.#listeners.delete(listener)};
  #publish(next){this.#snapshot=Object.freeze({...this.#snapshot,...next});notifySubscribers(this.#listeners,'[zcode-bridge] automation')}
  #reset(){this.#generation++;this.#refreshPromise=undefined;this.#publish({...initial(),admission:{allowed:false,reason:'host-unreachable'}})}
  async #call(payload){
    if(this.#closed)throw err('disposed');
    const response=await this.#rpc.call('/zcode-bridge','automation',payload);
    if(!response||response.ok!==true)throw Object.assign(new Error(response?.error?.message??'automation-unavailable'),{code:response?.error?.code??'automation-unavailable'});
    return response.value;
  }
  async refresh(){
    if(this.#closed)return Promise.reject(err('disposed'));
    if(this.#refreshPromise)return this.#refreshPromise;
    const generation=this.#generation;
    const operation=(async()=>{
      this.#publish({busy:true,error:null});
      try{
        const value=await this.#call({operation:'state'});
        if(this.#closed||generation!==this.#generation)return;
        this.#publish({busy:false,loaded:true,error:null,admission:value.admission??{allowed:false,reason:'automation-unavailable'},management:value.management??null,offPeak:value.offPeak??null,runFeedback:value.runFeedback??null,account:value.account??null,reverse:value.reverse??null});
      }catch(error){
        if(this.#closed||generation!==this.#generation)return;
        this.#publish({busy:false,loaded:true,error:errorOf(error)});
      }
    })();
    this.#refreshPromise=operation;
    void operation.finally(()=>{if(this.#refreshPromise===operation)this.#refreshPromise=undefined}).catch(()=>{});
    return operation;
  }
  dispose(){if(this.#closed)return;this.#closed=true;this.#listeners.clear();this.#publish(initial())}
}
