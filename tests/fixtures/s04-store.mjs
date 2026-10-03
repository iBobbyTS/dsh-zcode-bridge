import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
const official=JSON.parse(readFileSync(fileURLToPath(import.meta.url).replace('s04-store.mjs','s03a/success.json')));
/** Controlled store. Snapshot schema comes from official capture; title/revision, ids,
 * pagination and schedules below are explicit injections, never a GUI oracle. */
export function controlledStore({count=1,seed,holdFrames=false,renameFailure=false,dropCommandAck=false}={}){
  const rows=new Map(seed?seed.map(row=>[row.sessionId,{id:row.sessionId,title:row.title,seq:0,revision:0}]):Array.from({length:count},(_,i)=>['s'+i,{id:'s'+i,title:'Title '+i,seq:0,revision:0}]));
  const requests=[],slots=new Map(),acks=new Map(),held=[];let next=0;
  const frame=(slot,kind='online')=>{
    const row=rows.get(slot.sessionId);if(!row)return;
    const wire=structuredClone(official.initial);wire.deliveryKind=kind;wire.logicalFrameOrdinal=++slot.ordinal;wire.logicalFrameId=slot.id+'-'+slot.ordinal;
    wire.topic=wire.frame.topic='conversation/'+row.id;wire.subscriptionId=wire.frame.subscriptionId=slot.id;
    const snapshot=wire.frame.payload.snapshot;snapshot.sessionId=row.id;snapshot.seq=wire.frame.toSeq=row.seq;snapshot.revision=row.revision;snapshot.meta={title:row.title,titleSource:'custom'};
    const send=()=>slot.child.stdout.write(JSON.stringify({method:'v4/conversation/frame',params:wire})+'\n');
    if(holdFrames&&kind==='online')held.push(send);else send();return wire;
  };
  function child(){
    const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=8000+next;
    child.stdin.on('data',data=>{for(const line of data.toString().trim().split('\n')){
      const request=JSON.parse(line);requests.push(request);const p=request.params;let result;
      if(request.method==='runtime/capabilities')result={independentPlanState:true};
      else if(request.method==='session/list')result={sessions:[...rows.values()].filter(r=>!p.sessionIds||p.sessionIds.includes(r.id)).slice(0,p.limit??50).map(r=>({sessionId:r.id,title:r.title,status:'idle',workspace:p.workspace}))};
      else if(request.method==='v4/conversation/subscribe'){
        const sessionId=p.topic.slice('conversation/'.length);if(!rows.has(sessionId)){child.stdout.write(JSON.stringify({id:request.id,error:{code:-32004,message:'Session not found'}})+'\n');continue}
        const slot={id:'s04-sub-'+ ++next,child,sessionId,ordinal:0};slots.set(p.connectionId,slot);result={ack:{...official.ack.ack,subscriptionId:slot.id}};
        child.stdout.write(JSON.stringify({id:request.id,result})+'\n');frame(slot,'initial');continue;
      }else if(request.method==='v4/conversation/unsubscribe'){slots.delete(p.connectionId);result={}}
      else if(request.method==='v4/commands/query'){result={results:p.commands.map(key=>({key,result:acks.get(key.commandId)??'unknown'}))}}
      else if(request.method==='v4/command'){
        const row=rows.get(p.sessionId);result={commandId:p.commandId,status:'accepted',revisionAtDecision:row?.revision??0};
        if(acks.has(p.commandId))result={...acks.get(p.commandId),status:'duplicate'};
        else if(!row)result={...result,status:'failed',reasonCode:'fault.command.executionFailed'};
        else if(p.type==='renameSession'&&renameFailure)result={...result,status:'failed',reasonCode:'fault.command.executionFailed',message:'Session not found: '+row.id};
        else if(p.type==='setFollowupMode'&&p.baseRevision!==row.revision)result={...result,status:'stale',reasonCode:'proto.staleRevision'};
        else if(p.type==='deleteSession')rows.delete(row.id);
        else{row.seq++;row.revision++;if(p.type==='renameSession')row.title=p.payload.title;for(const slot of slots.values())if(slot.sessionId===row.id)frame(slot)}
        acks.set(p.commandId,result);
      }else throw Error('unexpected fixture method '+request.method);
      if(request.method==='v4/command'&&dropCommandAck){dropCommandAck=false;continue}
      child.stdout.write(JSON.stringify({id:request.id,result})+'\n');
    }});
    child.stdin.once('finish',()=>{child.stdout.end();child.stderr.end();child.emit('close',0)});child.kill=()=>{throw Error('fixture must finish by EOF')};return child;
  }
  return {rows,requests,slots,child,flush:()=>{for(const send of held.splice(0))send()},frame};
}
