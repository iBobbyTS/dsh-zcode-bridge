import { BridgeError } from './installation.mjs';
import { HostCallbackError } from './protocol.mjs';
import {
  zcodeBrowserListParamsSchema, zcodeBrowserListResultSchema,
  zcodeBrowserExecuteParamsSchema, zcodeBrowserExecuteResultSchema,
  zcodeComputerUseOperationEventSchema, cuaPermissionObservationSchema,
} from './vendor/zcode/v4.mjs';
const LIST='interaction/browserList', EXECUTE='interaction/browserExecute';
const MAX_RECORDS=32;
const PLUGIN_IDS=['browser-use@zcode-plugins-official','zcode-cua@zcode-plugins-official','node-repl-host@zcode-plugins-official'];
const selectResult=result=>({
  ...(result.browsers?{browsers:result.browsers}:{}),
  ...(typeof result.ok==='boolean'?{ok:result.ok,elapsedMs:result.elapsedMs}:{}),
  ...(result.error?{error:result.error}:{}),...(result.meta?{meta:result.meta}:{}),
  ...(result.state?{state:result.state}:{}),
  ...(result.image?Buffer.byteLength(result.image.base64)<=256*1024?{image:result.image}:{imageOmitted:'image-preview-limit'}:{}),
});
/** Official reverse host adapter. Production has no verified executor; empty discovery and
 * backend_unavailable match the official Host fallback. Executor injection is an in-process
 * provider seam for fixtures/future admitted hosts, never an RPC/browser-side capability. */
export class HostTools {
  #peer; #catalog; #workspace; #executor; #closed=false; #records=new Map(); #listeners=new Set(); #off=[]; #seenEvents=new Set();
  constructor(peer,{workspace,catalog,browserExecutor}={}){
    if(!workspace||!workspace.workspacePath||workspace.workspaceKey!==workspace.workspacePath)throw new BridgeError('host-context-invalid');
    this.#peer=peer;this.#catalog=catalog;this.#workspace=Object.freeze({...workspace});this.#executor=browserExecutor;
    this.#off.push(peer.registerRequestHandler(LIST,(m,o)=>this.#request(m,o)),peer.registerRequestHandler(EXECUTE,(m,o)=>this.#request(m,o)),peer.onReverseSettled(e=>this.#settled(e)),peer.onNotification(m=>this.#notification(m)),peer.onClosed(()=>this.dispose()));
  }
  subscribe(listener){this.#listeners.add(listener);return ()=>this.#listeners.delete(listener)}
  snapshot(sessionId){return structuredClone({
    observation:{allowed:!this.#closed&&!this.#peer.closed,reason:this.#closed||this.#peer.closed?'host-closed':null},
    browser:{state:'gated',reason:this.#closed?'host-closed':this.#executor?'executor-verification-required':'official-browser-executor-missing',carrier:'stdio-reverse',executionVerified:false},
    computer:{state:'gated',reason:this.#closed?'host-closed':'official-cua-helper-connection-unverified',carrier:'helper-socket',permissions:'unknown',executionVerified:false},
    records:[...this.#records.values()].filter(r=>r.sessionId===sessionId),
  })}
  /** A fresh official directory read; enabled plugin != backend/helper availability. */
  async registration({signal}={}){
    if(this.#closed)throw new BridgeError('host-closed');
    const [plugins,mcp]=await Promise.all([this.#catalog.read('pluginsList',{}, {signal}),this.#catalog.read('mcpList',{mode:'status'},{signal})]);
    if(this.#closed)throw new BridgeError('host-closed');
    return {plugins:plugins.plugins.filter(p=>PLUGIN_IDS.includes(p.id)).map(p=>({id:p.id,enabled:p.enabled,hostMcpServerNames:p.hostMcpServerNames??[],mcpServerNames:p.mcpServerNames??[]})),mcpStatuses:mcp.statuses};
  }
  async #request(message,{signal}){
    const schema=message.method===LIST?zcodeBrowserListParamsSchema:zcodeBrowserExecuteParamsSchema;
    const parsed=schema.safeParse(message.params);
    if(!parsed.success)throw new HostCallbackError(-32602,'Invalid official browser callback params');
    const p=parsed.data;
    // This process owns a single local workspace. Remote/workspace identities cannot drift into it.
    if((p.workspacePath!==undefined&&p.workspacePath!==this.#workspace.workspacePath)||(p.workspaceKey!==undefined&&p.workspaceKey!==this.#workspace.workspaceKey)||p.workspaceIdentity!==undefined||p.remoteSessionId!==undefined)throw new HostCallbackError(-32602,'Browser callback workspace mismatch');
    if(this.#closed||signal.aborted)throw new HostCallbackError(-32603,'Host callback unavailable');
    if(this.#records.size>=MAX_RECORDS){const old=[...this.#records].find(([,r])=>r.status!=='pending');if(old)this.#records.delete(old[0]);else throw new HostCallbackError(-32603,'Host observation limit');}
    const record={id:message.id,requestId:p.requestId,sessionId:p.sessionId,turnId:p.turnId,kind:'browser',method:message.method===LIST?'list':p.command.method,browserId:p.browserId??null,browserGeneration:p.browserGeneration??null,status:'pending'};
    this.#records.set(message.id,record);this.#publish();
    // No automatic browser launch, no substitute DSH executor, no fake backend descriptor.
    const result=message.method===LIST
      ?this.#executor?{browsers:await this.#executor.list(p,{signal})}:{browsers:[]}
      :this.#executor?await this.#executor.execute(p,{signal}):{ok:false,error:{code:'backend_unavailable',message:'Official browser host executor is unavailable',sideEffect:'none'},elapsedMs:0};
    if(this.#closed||signal.aborted)throw new HostCallbackError(-32603,'Host callback unavailable');
    const validated=(message.method===LIST?zcodeBrowserListResultSchema:zcodeBrowserExecuteResultSchema).safeParse(result);
    if(!validated.success)throw new HostCallbackError(-32603,'Invalid official browser host result');
    const meta=validated.data.meta;
    if(meta&&((p.browserId!==undefined&&meta.browserId!==p.browserId)||(p.browserGeneration!==undefined&&meta.browserGeneration!==p.browserGeneration)))throw new HostCallbackError(-32603,'Official browser result target mismatch');
    return validated.data;
  }
  #settled({request,response,outcome}){
    let record=this.#records.get(request.id);
    if(!record&&[LIST,EXECUTE].includes(request.method)){
      const p=request.params;
      // A schema rejection with a local routing identity is still visible to its session.
      // Do not copy malformed payloads or attach a foreign workspace failure to a local owner.
      if(!p||typeof p.sessionId!=='string'||!p.sessionId||(p.workspacePath!==undefined&&p.workspacePath!==this.#workspace.workspacePath)||(p.workspaceKey!==undefined&&p.workspaceKey!==this.#workspace.workspaceKey)||p.workspaceIdentity!==undefined||p.remoteSessionId!==undefined)return;
      if(this.#records.size>=MAX_RECORDS){const old=[...this.#records].find(([,r])=>r.status!=='pending');if(!old)return;this.#records.delete(old[0]);}
      record={id:request.id,requestId:typeof p.requestId==='string'?p.requestId:String(request.id),sessionId:p.sessionId,kind:'browser',method:'unrecognized',status:'pending',browserId:null,browserGeneration:null};
      this.#records.set(request.id,record);
    }
    if(!record||record.status!=='pending')return;
    // B05: timeout/disconnect after dispatch is ambiguous. Never retry or call it completed;
    // ProtocolPeer aborts the handler and drops its late resolution by reverse id.
    record.status=outcome==='outcome-unknown'?'outcome-unknown':response?.error?'rejected':response?.result?.ok===false?'failed':'responded';
    record.reason=response?.error?.message??response?.result?.error?.code??null;
    record.protocolCode=response?.error?.code??null;
    record.message=response?.result?.error?.message??null;
    if(response?.result?.error?.sideEffect)record.sideEffect=response.result.error.sideEffect;
    if(outcome==='outcome-unknown')record.sideEffect='uncertain';
    else if(response?.result)record.result=selectResult(response.result);
    this.#publish();
  }
  #notification(message){
    if(this.#closed)return;
    let parsed,kind;
    if(message.method==='computer-use/operation-event'){parsed=zcodeComputerUseOperationEventSchema.safeParse(message.params);kind='computer-event'}
    else if(message.method==='v4/cua/permission-observation'){parsed=cuaPermissionObservationSchema.safeParse(message.params);kind='computer-permission'}
    else return;
    if(!parsed.success)return;
    const p=parsed.data,key=kind+':'+p.sessionId+':'+p.eventId;
    if(this.#seenEvents.has(key))return;
    this.#seenEvents.add(key);if(this.#seenEvents.size>256)this.#seenEvents.delete(this.#seenEvents.values().next().value);
    // Official operation stream also includes non-CUA turn/tool events. Preserve the envelope;
    // never label an unmarked node_repl/tool/turn as a computer action.
    const record={id:key,kind,sessionId:p.sessionId,status:'observed',event:p};
    if(this.#records.size>=MAX_RECORDS){const old=[...this.#records].find(([,r])=>r.status!=='pending');if(!old)return;this.#records.delete(old[0]);}
    this.#records.set(key,record);this.#publish();
  }
  #publish(){for(const listener of this.#listeners){try{listener()}catch{ /* View lifecycle cannot block the owned host. */ }}}
  dispose(){if(this.#closed)return;this.#closed=true;for(const off of this.#off)off();this.#off=[];for(const record of this.#records.values())if(record.status==='pending'){record.status='outcome-unknown';record.sideEffect='uncertain';record.reason='host-closed'};this.#publish();this.#listeners.clear();this.#seenEvents.clear()}
}
