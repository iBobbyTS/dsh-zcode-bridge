import {readFileSync} from 'node:fs';
const captured=JSON.parse(readFileSync(new URL('../fixtures/s03a/success.json',import.meta.url)));
export const tick=()=>new Promise(resolve=>setImmediate(resolve));
export function baseSnapshot(id='official-session'){const snapshot=structuredClone(captured.initial.frame.payload.snapshot);snapshot.sessionId=id;return snapshot}
export class MockPeer {
  closed=false;connectionId='mock-connection';notifications=new Set();closers=new Set();calls=[];acks=new Map();ordinal=0;subscriptions=new Map();snapshot=baseSnapshot();loseAck=false;
  onNotification(listener){this.notifications.add(listener);return ()=>this.notifications.delete(listener)}
  onClosed(listener){this.closers.add(listener);return ()=>this.closers.delete(listener)}
  async request(method,params,{onResult}={}){
    this.calls.push({method,params:structuredClone(params)});let result;
    if(method==='hello')result={kind:'hello',protocolVersion:3,connectionId:this.connectionId,clientMode:'desktop-continuous',deliveryProfile:'continuous',serverTime:0,capabilities:{nativeDialogs:true,localTerminal:true,binaryFrames:false,compression:'none'},auth:{}};
    else if(method==='initialize')result=undefined;
    else if(method==='v4/command'){
      result={commandId:params.commandId,status:'accepted',revisionAtDecision:this.snapshot.revision,...(params.type==='createSession'?{result:{type:'createSession',sessionId:this.snapshot.sessionId}}:{})};this.acks.set(params.commandId,result);
      if(this.loseAck){this.loseAck=false;throw Object.assign(new Error('lost'),{code:'execution-outcome-unknown'})}
    }else if(method==='v4/commands/query')result={results:params.commands.map(key=>({key,result:this.acks.get(key.commandId)??'unknown'}))};
    else if(method==='v4/conversation/subscribe'){
      const id='mock-sub-'+this.subscriptions.size;this.subscriptions.set(params.topic,id);result={ack:{subscriptionId:id,mode:'snapshot',logEpoch:this.snapshot.logEpoch}};setImmediate(()=>this.publish());
    }else if(method==='v4/conversation/resync')result={ack:{subscriptionId:params.subscriptionId,mode:'snapshot',logEpoch:this.snapshot.logEpoch}};
    return onResult?onResult(result):result;
  }
  publish(snapshot=this.snapshot){this.snapshot=structuredClone(snapshot);for(const [topic,subscriptionId] of this.subscriptions){const wire=structuredClone(captured.initial);Object.assign(wire,{topic,subscriptionId,logicalFrameId:'mock-'+(++this.ordinal),logicalFrameOrdinal:this.ordinal,deliveryKind:this.ordinal===1?'initial':'online'});Object.assign(wire.frame,{topic,subscriptionId,fromSeq:0,toSeq:snapshot.seq,payload:{kind:'snapshot',snapshot}});for(const listener of this.notifications)listener({method:'v4/conversation/frame',params:wire})}}
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
