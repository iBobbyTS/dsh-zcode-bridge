// Local notifier keeps this module loadable by the bridge's plain Node tests; the store has no
// dependency on DSH internals beyond the rpc call contract.
const notifySubscribers=(listeners,reason)=>{for(const listener of Array.from(listeners)){try{listener(reason)}catch{/* observer teardown cannot block the carrier */}}};
const emptyAdmission=reason=>({reads:{allowed:false,reason},writes:{allowed:false,reason}});
const err=code=>Object.assign(new Error(code),{code});
const errorOf=error=>({code:error?.code??'catalog-unavailable',message:error?.message??String(error),protocolCode:error?.details?.protocolCode});

function initial(){return Object.freeze({loaded:false,busy:false,error:null,admission:emptyAdmission('not-connected'),auth:'unconfirmed',installationVerified:false,workspace:null,sections:{mcp:null,overview:null,reference:null,skills:null},describe:null,validate:null,operations:[],hostOperations:[]})}

/** Directory read kinds the panel renders. No catalog is persisted; every refresh reads official.
 *  `pluginsList` is not eager-read here because the panel has no render point for it; the host
 *  carrier remains exposed for a future bounded consumer that actually displays source:missing. */
export const CATALOG_READ_KINDS=Object.freeze({mcp:'mcpList',overview:'pluginsOverview',reference:'pluginReference',skills:'skillReference'});

/**
 * Read-only official outcome projection for one management call. Diagnostics with severity "error"
 * mean the official operation reported a failure even though the RPC itself completed; the view must
 * never present that as a new successful version.
 */
export function operationOutcome(result){
  const diagnostics=Array.isArray(result?.diagnostics)?result.diagnostics:[];
  const errors=diagnostics.filter(item=>item?.severity==='error');
  return {ok:errors.length===0,diagnostics,errors};
}

/** Display-only mirror of official directory facts. It is never authoritative on its own. */
export class CatalogStore {
  #rpc;#listeners=new Set();#snapshot=initial();#closed=false;#generation=0;#refreshPromise;#reads=new Set();
  constructor(rpc,{connectionGeneration}={}){
    if(!rpc||typeof rpc.call!=='function')throw err('catalog-rpc-required');
    this.#rpc=rpc;
    if(connectionGeneration)connectionGeneration.subscribe(()=>this.#reset());
  }
  getSnapshot=()=>this.#snapshot;
  subscribe=listener=>{if(this.#closed)return ()=>{};this.#listeners.add(listener);return ()=>this.#listeners.delete(listener)};
  #publish(next){this.#snapshot=Object.freeze({...this.#snapshot,...next});notifySubscribers(this.#listeners,'[zcode-bridge] catalog')}
  #reset(){this.#generation++;this.#refreshPromise=undefined;for(const controller of this.#reads)controller.abort();this.#reads.clear();this.#publish({...initial(),admission:emptyAdmission('host-unreachable')})}
  async #call(payload,signal){
    if(this.#closed)throw err('disposed');
    const response=await this.#rpc.call('/zcode-bridge','catalog',payload,signal);
    if(!response||response.ok!==true)throw Object.assign(new Error(response?.error?.message??'catalog-unavailable'),{code:response?.error?.code??'catalog-unavailable',details:response?.error?.details});
    return response.value;
  }
  async state(){
    const generation=this.#generation;
    const value=await this.#call({operation:'state'});
    // A connection reset/dispose owns the snapshot once it fires; a late state response must not
    // resurrect the previous connection's admission or workspace into the reset store. Same guard
    // as refresh(): the check happens after the await, before any publish.
    if(this.#closed||generation!==this.#generation)return value;
    this.#publish({admission:value.admission??emptyAdmission('catalog-unavailable'),auth:value.auth??'unconfirmed',installationVerified:value.installationVerified===true,workspace:value.workspace??null,hostOperations:Array.isArray(value.operations)?value.operations:[]});
    return value;
  }
  async #read(kind,params={}){
    const controller=new AbortController();this.#reads.add(controller);
    try{return await this.#call({operation:'read',kind,params},controller.signal)}
    finally{this.#reads.delete(controller)}
  }
  async refresh(){
    if(this.#closed)return Promise.reject(err('disposed'));
    if(this.#refreshPromise)return this.#refreshPromise;
    const generation=this.#generation;
    const operation=(async()=>{
      this.#publish({busy:true,error:null});
      const sections={...this.#snapshot.sections};
      const failures=[];
      for(const [section,kind] of Object.entries(CATALOG_READ_KINDS)){
        try{const value=await this.#read(kind);sections[section]=Object.freeze({value,loadedAt:new Date().toISOString(),error:null})}
        catch(error){sections[section]=Object.freeze({value:null,loadedAt:null,error:errorOf(error)});failures.push(errorOf(error))}
        if(this.#closed||generation!==this.#generation)return;
      }
      let state=null;
      try{state=await this.state()}catch(error){failures.push(errorOf(error))}
      // A connection reset owns the snapshot after it fires; a stale refresh must not overwrite it.
      if(this.#closed||generation!==this.#generation)return;
      this.#publish({busy:false,loaded:true,sections,error:failures.length?failures[0]:null,...(state?{admission:state.admission,auth:state.auth,installationVerified:state.installationVerified===true,workspace:state.workspace,hostOperations:state.operations??[]}:{})});
    })();
    this.#refreshPromise=operation;
    void operation.finally(()=>{if(this.#refreshPromise===operation)this.#refreshPromise=undefined}).catch(()=>{});
    return operation;
  }
  async validate(params){
    try{const value=await this.#read('pluginValidate',params);this.#publish({validate:Object.freeze({target:params,result:value,error:null})});return value}
    catch(error){const failure=errorOf(error);this.#publish({validate:Object.freeze({target:params,result:null,error:failure})});throw error}
  }
  async describe(params){
    try{const value=await this.#read('pluginDescribe',params);this.#publish({describe:Object.freeze({target:params,result:value,error:null})});return value}
    catch(error){const failure=errorOf(error);this.#publish({describe:Object.freeze({target:params,result:null,error:failure})});throw error}
  }
  /** Official management call. An in-flight record is shown only while awaiting; the official result replaces it. */
  async operate(action,params={},operationId){
    const record={action,operationId:operationId??null,state:'pending',startedAt:new Date().toISOString(),result:null,error:null};
    if(record.operationId)this.#publish({operations:[...this.#snapshot.operations,record]});
    try{
      const value=await this.#call({operation:'operate',action,params,...(operationId?{operationId}:{})});
      if(record.operationId)this.#settle(operationId,{state:'completed',result:value});
      await this.refresh();
      return value;
    }catch(error){
      const failure=errorOf(error);
      if(record.operationId)this.#settle(operationId,{state:error?.code==='cancelled'?'cancelled':'failed',error:failure});
      throw error;
    }
  }
  async cancel(operationId){
    if(typeof operationId!=='string'||!operationId)throw err('catalog-params-invalid');
    const value=await this.#call({operation:'operate',action:'cancelOperation',params:{operationId}});
    // The official result is authoritative: cancelled:false means the official runtime has no
    // registered controller for this id, so the operation is still running. Keep it pending and
    // keep the cancel affordance instead of pretending it completed.
    if(value.cancelled===true)this.#settle(operationId,{state:'cancelled',error:{code:'cancelled'}});
    return value;
  }
  #settle(operationId,patch){this.#publish({operations:this.#snapshot.operations.map(record=>record.operationId===operationId?Object.freeze({...record,...patch}):record)})}
  dispose(){if(this.#closed)return;this.#closed=true;for(const controller of this.#reads)controller.abort();this.#reads.clear();this.#listeners.clear();this.#publish(initial())}
}
