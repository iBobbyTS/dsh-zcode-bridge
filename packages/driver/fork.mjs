import {isDeepStrictEqual} from 'node:util';
import {commandFault} from './commands.mjs';
import {requireAcceptedCommand} from './queue-steer.mjs';
import {collectHistoryPages} from './history-backfill.mjs';
import {inboxProjectionDefinition} from './projections.mjs';

export const FORK_PROJECTION_EVENT='zcode-driver/fork-projection-bound';
const eventsOf=session=>session.snapshotEvents?.()??Array.from({length:session.seq},(_,seq)=>session.eventAt(seq));
const key=(epoch,id)=>JSON.stringify([epoch,id]);
const deny=(reasonCode,detail)=>Object.assign(commandFault(reasonCode),{reasonCode,...(detail?{message:`${reasonCode}: ${detail}`}:{})});
function identity(value){
  try{
    const parsed=JSON.parse(value);
    if(!Array.isArray(parsed)||parsed.length!==2||typeof parsed[0]!=='string'||!parsed[0]||!(typeof parsed[1]==='string'&&parsed[1]||Number.isSafeInteger(parsed[1])&&parsed[1]>=0))throw new Error();
    return parsed;
  }catch{throw deny('guard.forkTargetAmbiguous','malformed projection identity')}
}
const order=rows=>[...rows].sort((a,b)=>a.createdAtSeq-b.createdAtSeq||a.rowId-b.rowId);
const kinds=new Set(['turnHeader','userInput','assistantText','reasoning','toolCall']);
// Identity/action/timing fields are projection-local. Conversation content and tool
// associations must agree; an unrelated or empty child cannot pass this proof.
const content=row=>Object.fromEntries(['kind','text','origin','guided','state','model','toolCallId','toolName','inputText','status','output','error','attachments'].filter(field=>row[field]!==undefined).map(field=>[field,row[field]]));
function lineage(events){
  const checkpoints=events.filter(event=>event.type===FORK_PROJECTION_EVENT).map(event=>event.data);
  return (kind,original,rows)=>{
    let current=original;
    for(const checkpoint of checkpoints){const alias=checkpoint[kind]?.find(entry=>entry.from===current);if(alias){current=alias.to;if(alias.rows)rows=alias.rows}}
    return {key:current,rows};
  };
}
/** Exact official seed boundary -> last successful assistant segment, never a
 * nearest-earlier heuristic. canFork is authoritative (product-projection.ts:1288). */
export function forkBoundary(parent,options){
  const source=eventsOf(parent.session),count=options.inheritedEventCount,seed=options.seed;
  if(!options.meta?.isSeeded||options.meta.parentSession!==parent.id||!Number.isSafeInteger(count)||count<=0||!Array.isArray(seed)||!isDeepStrictEqual(seed.slice(0,count),source.slice(0,count))||seed[count]?.type!=='session/end-seed'||seed[count]?.data.inherited!==true)throw deny('guard.forkTargetAmbiguous','seed is not the exact source prefix');
  if(options.firstInput||options.meta.cwd!==parent.session.header.cwd||parent.conversation.address.workspace!==parent.session.header.cwd)throw deny('guard.forkTargetAmbiguous','fork workspace/input mismatch');
  const prefix=seed.slice(0,count),end=prefix.findLast(event=>event.type==='turn/end');
  if(!end)throw deny('guard.forkAssistantOnly');
  if(end.data.reason?.kind!=='completed'||prefix.slice(end.seq+1).some(event=>['turn/start','user/message','assistant/message','tool/call','tool/result','agent/inbox/spliced'].includes(event.type)))throw deny('guard.forkTargetNotStable','cut is not a completed turn boundary');
  let inbox=inboxProjectionDefinition.init();for(const event of prefix)inbox=inboxProjectionDefinition.apply(inbox,event);
  if(inbox['next-turn'].length||inbox['next-step'].length)throw deny('guard.forkTargetAmbiguous','cut includes unconsumed inbox inputs');
  const start=prefix.findLast(event=>event.type==='turn/start'&&event.data.turn===end.data.turn);
  if(!start?.data.zcode?.turnKey)throw deny('guard.forkTargetAmbiguous','turn has no ZCode identity');
  const resolve=lineage(source),turnKey=resolve('turns',start.data.zcode.turnKey).key;
  const [epoch,turnId]=identity(turnKey),snapshot=parent.conversation.state.snapshot;
  if(epoch!==snapshot.logEpoch)throw deny('guard.forkTargetNotStable','source epoch changed');
  const rows=order(snapshot.rows.window.filter(row=>row.turnId===turnId)),assistant=rows.filter(row=>row.kind==='assistantText').at(-1),header=rows.find(row=>row.kind==='turnHeader');
  if(!assistant)throw deny('guard.forkAssistantOnly');
  if(snapshot.control.activeWorks.some(work=>work.kind==='compact')||assistant.state!=='complete'||header?.state!=='completedSuccess'||assistant.actions?.canFork!==true)throw deny('guard.actionUnavailable');
  const last=prefix.findLast(event=>event.type==='assistant/message'&&event.data.turn===end.data.turn),visible=last?.data.zcode&&resolve('responses',last.data.zcode.responseKey,last.data.zcode.rows).rows;
  if(!visible?.some(row=>row.rowId===assistant.rowId&&row.entityId===assistant.entityId&&row.text===assistant.text))throw deny('guard.forkTargetAmbiguous','DSH boundary does not contain the branch segment');
  return {prefix,source,resolve,snapshot,target:{rowId:assistant.rowId,entityId:assistant.entityId}};
}
async function history(conversation,snapshot,signal){
  const pages=await collectHistoryPages((method,params,options)=>conversation.peer.request(method,params,options),{sessionId:conversation.address.sessionId,workspace:conversation.address.workspace,signal});
  if(pages.some(page=>page.atLogEpoch!==snapshot.logEpoch||page.atRevision!==snapshot.revision||page.atSeq!==snapshot.seq))throw deny('guard.forkTargetNotStable','history changed during readback');
  const rows=new Map();for(const page of pages)for(const row of page.rows){if(rows.has(row.rowId)&&!isDeepStrictEqual(rows.get(row.rowId),row))throw deny('guard.forkTargetAmbiguous');rows.set(row.rowId,row)}
  return order([...rows.values()]);
}
/** Persist aliases outside the inherited prefix. They let the existing translator
 * observe a child with new epoch/row/turn ids without duplicating inherited messages. */
export function forkProjection(binding,sourceRows,branchRows,branchSnapshot){
  const starts=binding.prefix.filter(event=>event.type==='turn/start');
  if(starts.some(event=>!event.data.zcode?.turnKey))throw deny('guard.forkTargetAmbiguous','unmapped inherited turn');
  const turnIds=new Set(starts.map(event=>identity(binding.resolve('turns',event.data.zcode.turnKey).key)[1]));
  const expected=sourceRows.filter(row=>turnIds.has(row.turnId));
  if(expected.some(row=>!kinds.has(row.kind))||expected.length!==branchRows.length||!isDeepStrictEqual(expected.map(content),branchRows.map(content)))throw deny('guard.forkTargetAmbiguous','ZCode branch history differs from DSH prefix');
  const turns=new Map(),owners=new Map();
  for(const [index,row] of expected.entries()){
    const childTurn=branchRows[index].turnId;
    if((turns.has(row.turnId)&&turns.get(row.turnId)!==childTurn)||(owners.has(childTurn)&&owners.get(childTurn)!==row.turnId))throw deny('guard.forkTargetAmbiguous','branch turn associations differ');
    turns.set(row.turnId,childTurn);owners.set(childTurn,row.turnId);
  }
  const paired=new Map(expected.map((row,index)=>[row.rowId,branchRows[index]])),checkpoint={turns:[],users:[],responses:[],calls:[],results:[],cumulative:branchSnapshot.usage?.cumulative};
  const add=(kind,raw,resolved,to,extra={})=>{for(const from of new Set([raw,resolved]))checkpoint[kind].push({from,to,...extra})};
  for(const event of binding.prefix){
    const meta=event.data.zcode;
    if(event.type==='turn/start'){
      if(!meta?.turnKey)throw deny('guard.forkTargetAmbiguous','unmapped inherited turn');
      const current=binding.resolve('turns',meta.turnKey).key,turnId=identity(current)[1],header=expected.find(row=>row.kind==='turnHeader'&&row.turnId===turnId),child=header&&paired.get(header.rowId);
      if(!child)throw deny('guard.forkTargetAmbiguous');add('turns',meta.turnKey,current,key(branchSnapshot.logEpoch,child.turnId));
    }
    if(event.type==='user/message'||event.type==='tool/call'||event.type==='tool/result'){
      const kind=event.type==='user/message'?'users':event.type==='tool/call'?'calls':'results';
      if(!meta?.rowKey)throw deny('guard.forkTargetAmbiguous','unmapped inherited message');
      const current=binding.resolve(kind,meta.rowKey).key,rowId=identity(current)[1],child=paired.get(rowId),original=expected.find(row=>row.rowId===rowId);
      if(!child||event.type==='user/message'&&event.data.content.filter(part=>part.type==='text').map(part=>part.text).join('\n')!==original.text)throw deny('guard.forkTargetAmbiguous');
      add(kind,meta.rowKey,current,key(branchSnapshot.logEpoch,child.rowId));
    }
    if(event.type==='assistant/message'){
      if(!meta?.responseKey||!meta.rows?.length)throw deny('guard.forkTargetAmbiguous','unmapped inherited assistant');
      const resolved=binding.resolve('responses',meta.responseKey,meta.rows),rows=resolved.rows.map(row=>paired.get(row.rowId));
      if(rows.some(row=>!row))throw deny('guard.forkTargetAmbiguous');
      const first=rows[0];add('responses',meta.responseKey,resolved.key,key(branchSnapshot.logEpoch,first.assistantResponseId??first.rowId),{rows});
    }
  }
  return checkpoint;
}
export async function createFork(factory,ownerCtx,options,signal){
  const parentId=options.meta?.parentSession;
  let parent=factory.ctx.agents.get(parentId);
  if(!parent&&typeof parentId==='string'){
    try{parent=(await ownerCtx.agents.resume({resumeSessionId:parentId,signal})).agent}
    catch(error){throw Object.assign(deny('guard.forkTargetAmbiguous','source cannot be resumed'),{cause:error})}
  }
  if(!parent||parent.transport!==factory.transport||!parent.conversation)throw deny('guard.forkTargetAmbiguous','source is not owned by this driver');
  return parent.track((async()=>{
    await parent.ready();await parent.translator.tail;signal.throwIfAborted();
    const binding=forkBoundary(parent,options),sourceRows=await history(parent.conversation,binding.snapshot,signal);
    const receipt=requireAcceptedCommand(await parent.submitControl({type:'forkAssistant',payload:{target:binding.target},baseRevision:binding.snapshot.revision,baseLogEpoch:binding.snapshot.logEpoch,signal}));
    if(!receipt.branchAddress||receipt.ack.result?.type!=='forkAssistant')throw Object.assign(commandFault('command-outcome-unknown'),{commandId:receipt.commandId});
    signal.throwIfAborted();
    const conversation=factory.transport.conversation({zcodeConversationId:receipt.branchAddress.sessionId,cwd:options.meta.cwd});
    try{
      await conversation.connect();
      if(conversation.state.status!=='live')await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>finish(deny('guard.forkTargetNotStable','branch projection unavailable')),5000);
        const abort=()=>finish(signal.reason);let off=()=>{};
        const finish=error=>{clearTimeout(timer);off();signal.removeEventListener('abort',abort);error?reject(error):resolve()};
        off=conversation.subscribe(state=>{if(state.status==='live')finish();else if(state.error||state.status==='closed')finish(deny('guard.forkTargetNotStable'))});signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
      });
      signal.throwIfAborted();const snapshot=conversation.state.snapshot;
      if(snapshot.sessionId!==receipt.branchAddress.sessionId||snapshot.control.canStop||snapshot.control.activeWorks.length)throw deny('guard.forkTargetNotStable','branch identity/state mismatch');
      const branchRows=await history(conversation,snapshot,signal),projection=forkProjection(binding,sourceRows,branchRows,snapshot);
      return {zcodeConversationId:receipt.branchAddress.sessionId,conversation,projection,commandId:receipt.commandId};
    }catch(error){await conversation.cancel();throw Object.assign(error,{commandId:receipt.commandId,branchAddress:receipt.branchAddress})}
  })());
}
