import {readFileSync} from 'node:fs';
const captured=JSON.parse(readFileSync(new URL('../fixtures/s03a/success.json',import.meta.url)));
export const tick=()=>new Promise(resolve=>setImmediate(resolve));
/** Sample official account discovery. Real account discovery plugs into the same shape later. */
export function sampleProviders(){return [
  {id:'A',name:'Provider A',models:[
    {id:'model_a',reasoningLevels:['low','medium','high','xhigh','max'],defaultReasoningLevel:'medium'},
    {id:'model_b',reasoningLevels:['low','medium','high','xhigh','max'],defaultReasoningLevel:'high'},
  ]},
  {id:'B',name:'Provider B',models:[
    {id:'model_c',reasoningLevels:['low','medium','high','xhigh','max'],defaultReasoningLevel:'low'},
  ]},
]}
export function baseSnapshot(id='official-session'){const snapshot=structuredClone(captured.initial.frame.payload.snapshot);snapshot.sessionId=id;return snapshot}
export class MockPeer {
  closed=false;connectionId='mock-connection';notifications=new Set();closers=new Set();calls=[];acks=new Map();ordinal=0;subscriptionSeq=0;subscriptions=new Map();delivered=new Map();snapshot=baseSnapshot();loseAck=false;providers=sampleProviders();
  /** Discovery seam consumed by the Zcode LLM adapter; returns detached provider groups. */
  async listProviders(){return structuredClone(this.providers)}
  /** Validate one OFFICIAL provider/model identity against the advertised registry, mirroring the
   * real handler's provider.notInRegistry/model rejection so identity bugs fail loudly in mock. */
  validateIdentity(provider,model){const group=this.providers.find(item=>item.id===provider);return group!==undefined&&group.models.some(item=>item.id===model)}
  onNotification(listener){this.notifications.add(listener);return ()=>this.notifications.delete(listener)}
  onClosed(listener){this.closers.add(listener);return ()=>this.closers.delete(listener)}
  async request(method,params,{onResult}={}){
    this.calls.push({method,params:structuredClone(params)});let result;
    if(method==='hello')result={kind:'hello',protocolVersion:3,connectionId:this.connectionId,clientMode:'desktop-continuous',deliveryProfile:'continuous',serverTime:0,capabilities:{nativeDialogs:true,localTerminal:true,binaryFrames:false,compression:'none'},auth:{}};
    else if(method==='initialize')result=undefined;
    else if(method==='v4/command'){
      if(params.type==='switchModelConfig'&&!this.validateIdentity(params.payload?.provider,params.payload?.model)){
        const reasonCode=this.providers.some(item=>item.id===params.payload?.provider)?'model.notInRegistry':'provider.notInRegistry';
        result={commandId:params.commandId,status:'failed',reasonCode,revisionAtDecision:this.snapshot.revision};
      }else{
        result={commandId:params.commandId,status:'accepted',revisionAtDecision:this.snapshot.revision,...(params.type==='createSession'?{result:{type:'createSession',sessionId:this.snapshot.sessionId}}:{})};
      }
      this.acks.set(params.commandId,result);
      if(this.loseAck){this.loseAck=false;throw Object.assign(new Error('lost'),{code:'execution-outcome-unknown'})}
    }else if(method==='v4/commands/query')result={results:params.commands.map(key=>({key,result:this.acks.get(key.commandId)??'unknown'}))};
    else if(method==='v4/conversation/subscribe'){
      const id='mock-sub-'+this.subscriptionSeq++;this.subscriptions.set(params.topic,id);result={ack:{subscriptionId:id,mode:'snapshot',logEpoch:this.snapshot.logEpoch}};setImmediate(()=>this.publish());
    }else if(method==='v4/conversation/unsubscribe'){for(const [topic,id] of this.subscriptions)if(id===params.subscriptionId||topic===params.topic)this.subscriptions.delete(topic);result={ack:{subscriptionId:params.subscriptionId}}}else if(method==='v4/conversation/resync'){result={ack:{subscriptionId:params.subscriptionId,mode:'snapshot',logEpoch:this.snapshot.logEpoch}};setImmediate(()=>this.publish(this.snapshot,'recovery'))}
    return onResult?onResult(result):result;
  }
  publish(snapshot=this.snapshot,deliveryKind){this.snapshot=structuredClone(snapshot);for(const [topic,subscriptionId] of this.subscriptions){const seen=this.delivered.get(subscriptionId)??0;this.delivered.set(subscriptionId,seen+1);const kind=deliveryKind??(seen===0?'initial':'online');const wire=structuredClone(captured.initial);Object.assign(wire,{topic,subscriptionId,logicalFrameId:'mock-'+(++this.ordinal),logicalFrameOrdinal:this.ordinal,deliveryKind:kind});Object.assign(wire.frame,{topic,subscriptionId,fromSeq:0,toSeq:snapshot.seq,payload:{kind:'snapshot',snapshot}});for(const listener of this.notifications)listener({method:'v4/conversation/frame',params:wire})}}
  disconnect(){for(const listener of this.closers)listener('execution-disconnected')}
  close(){this.closed=true;this.notifications.clear();this.closers.clear()}
}
export function row(kind,id,extra={}){return {kind,rowId:id,entityId:'row-'+id,turnId:'turn-1',createdAt:0,createdAtSeq:id,...extra}}
export function agentFixture(){
  const peer=new MockPeer(),events=[],scopeDisposals=[];const session={id:'dsh-session',seq:0,append(type,data,opts){const event={type,data,...opts,seq:this.seq++,time:Date.now()};events.push(structuredClone(event));return event}};
  const publications=[];const createScope=(ctx,key)=>({ctx:{key,inject(){}},dispose:async()=>scopeDisposals.push(key)});const agentEvents=(ctx,agent)=>({emit:(type,payload)=>publications.push({type,...payload,agent}),waterfall:()=>Promise.resolve('unavailable')});
  const record={id:session.id,officialId:peer.snapshot.sessionId,workspace:'/fixture/workspace',authority:'official-host',events:[],selection:{providerId:'official',modelId:'model',options:{reasoningLevel:'high'}}};
  return {peer,events,session,record,publications,scopeDisposals,dependencies:{peer,createScope,agentEvents,onPersist(){}}};
}
