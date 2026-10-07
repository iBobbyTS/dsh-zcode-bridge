import {randomUUID} from 'node:crypto';
import {commandFault} from './commands.mjs';
import {renderAttachments} from './attachment-render.mjs';
import {inboxProjectionDefinition} from './projections.mjs';
import {FORK_PROJECTION_EVENT} from './fork.mjs';

const clean=value=>JSON.parse(JSON.stringify(value));
export const eventRowKey=(epoch,id)=>JSON.stringify([epoch,id]);
const terminalTools=new Set(['success','error','cancelled']);
const rowsFor=snapshot=>[...snapshot.rows.window].sort((a,b)=>a.createdAtSeq-b.createdAtSeq||a.rowId-b.rowId);
export function turnEndReason(state,error){
  if(state==='completedSuccess')return {kind:'completed'};
  if(state==='completedInterrupted')return {kind:'aborted',reason:{kind:'legacy'}};
  if(state==='failed'||state==='error')return {kind:'error',error:{code:error?.code??'UNKNOWN',message:error?.message??'ZCode turn failed'}};
  return null;
}
function terminalState(rows,snapshot,current){
  const state=rows.find(row=>row.kind==='turnHeader')?.state;
  return state&&state!=='running'?state:current?snapshot.control.phase:state;
}
function responseGroups(rows,epoch){
  const groups=new Map();let legacy,hasText=false;
  for(const row of rows){
    if(!['assistantText','reasoning','toolCall'].includes(row.kind))continue;
    if(!legacy||hasText&&['assistantText','reasoning'].includes(row.kind)){legacy=row.rowId;hasText=false}
    if(row.kind==='assistantText')hasText=true;
    const key=eventRowKey(epoch,row.assistantResponseId??legacy);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  return groups;
}
/** Combine caller-supplied historical windows. No catalog or rowsRange IO lives here. */
export function mergeEventWindows(windows){
  if(!windows.length)throw commandFault('event-window-empty');
  const ordered=[...windows].sort((a,b)=>a.seq-b.seq||a.revision-b.revision);
  const merged=structuredClone(ordered.at(-1)),rows=new Map();
  for(const window of ordered){
    if(window.logEpoch!==merged.logEpoch||window.sessionId!==merged.sessionId)throw commandFault('event-window-owner-mismatch');
    for(const row of window.rows.window)rows.set(row.rowId,structuredClone(row));
  }
  merged.rows.window=[...rows.values()].sort((a,b)=>a.createdAtSeq-b.createdAtSeq||a.rowId-b.rowId);
  return merged;
}

/** Stateful live translator; durable identity metadata rebuilds its indexes on resume.
 * `replay(windows)` feeds the same mapper with arbitrary caller-owned history windows.
 * zcode metadata is JSON on standard events, never a second command ACK ledger.
 */
export class ConversationEventTranslator {
  turns=new Map();responses=new Map();users=new Set();calls=new Map();results=new Map();streams=new Map();revision=0;nextTurn=1;tail=Promise.resolve();lifetime=new AbortController();generation=randomUUID();
  constructor({session,dispatch,conversation,attachments=()=>undefined,input=()=>undefined,claim=()=>{},syncInbox=()=>{},acceptInput=()=>true,history=false,clock=Date.now}){
    Object.assign(this,{session,dispatch,conversation,attachments,input,claim,syncInbox,acceptInput,history,clock});
    const events=session.snapshotEvents?.()??Array.from({length:session.seq},(_,seq)=>session.eventAt(seq));
    for(const event of events){
      const data=event.data,meta=data.zcode;
      if(event.type===FORK_PROJECTION_EVENT){this.bindForkProjection(data);continue}
      if(event.type==='turn/start'){
        this.nextTurn=Math.max(this.nextTurn,data.turn+1);
        if(meta)this.turns.set(meta.turnKey,{turn:data.turn,closed:false,steps:new Map(),openStep:null,nextStep:1});
      }
      const turn=[...this.turns.values()].find(value=>value.turn===data.turn);
      if(event.type==='step/start'&&turn){turn.nextStep=Math.max(turn.nextStep,data.step+1);turn.openStep=data.step;if(meta){turn.steps.set(meta.responseKey,data.step);if(meta.pending)turn.pendingKey=meta.responseKey}}
      if(event.type==='step/end'&&turn)turn.openStep=null;
      if(event.type==='turn/end'&&turn)turn.closed=true;
      if(event.type==='request/header')this.hasHeader=true;
      if(event.type==='user/message'&&meta)this.users.add(meta.rowKey);
      if(event.type==='assistant/message'&&meta){if(turn)turn.steps.set(meta.responseKey,data.step);this.responses.set(meta.responseKey,{seq:event.seq,data,rows:meta.rows,interrupted:data.interrupted===true});if(meta.cumulative)this.cumulative=meta.cumulative}
      if(event.type==='tool/call'&&meta)this.calls.set(meta.rowKey,{turn:data.turn,step:data.step,callId:data.callId,name:data.name,arguments:data.arguments});
      if(event.type==='tool/result'){
        if(meta)this.results.set(meta.rowKey,{seq:event.seq,status:meta.status});
        else for(const [key,call] of this.calls)if(call.callId===data.message.source.callId)this.results.set(key,{seq:event.seq,status:'recovered'});
      }
    }
  }
  bindForkProjection(checkpoint){
    for(const {from,to} of checkpoint.turns){const turn=this.turns.get(from);if(turn)this.turns.set(to,turn)}
    for(const {from,to} of checkpoint.users)if(this.users.has(from))this.users.add(to);
    for(const {from,to,rows} of checkpoint.responses){
      const previous=this.responses.get(from);
      if(previous){this.responses.set(to,{...previous,rows});for(const turn of this.turns.values())if(turn.steps.has(from))turn.steps.set(to,turn.steps.get(from))}
    }
    for(const kind of ['calls','results'])for(const {from,to} of checkpoint[kind]){const previous=this[kind].get(from);if(previous)this[kind].set(to,previous)}
    if(checkpoint.cumulative)this.cumulative=structuredClone(checkpoint.cumulative);
  }
  append(type,data,surfaceOp){return this.session.append(type,clean(data),...(surfaceOp?[{surfaceOp}]:[]))}
  enqueue(snapshot){
    const window=structuredClone(snapshot);
    const task=this.tail.then(()=>this.translate(window));this.tail=task.catch(()=>{});return task;
  }
  replay(windows){return this.enqueue(mergeEventWindows(windows))}
  turn(key,restart=false){
    if(this.turns.get(key)?.closed&&restart)this.turns.delete(key);
    if(!this.turns.has(key)){
      for(const previous of this.turns.values())if(!previous.closed)this.closeTurn(previous,{kind:'aborted',reason:{kind:'legacy'}});
      const turn={turn:this.nextTurn++,closed:false,steps:new Map(),openStep:null,nextStep:1};
      this.append('turn/start',{turn:turn.turn,zcode:{turnKey:key}});this.turns.set(key,turn);
    }
    return this.turns.get(key);
  }
  step(turn,key,snapshot,rows,{pending=false}={}){
    if(!pending&&turn.pendingKey){const step=turn.steps.get(turn.pendingKey);turn.steps.delete(turn.pendingKey);turn.pendingKey=null;turn.steps.set(key,step)}
    if(!turn.steps.has(key)){
      for(const [other,stream] of [...this.streams])if(other!==key)this.settle(other,stream.latest,stream.turn,stream.step,{interrupted:true,canonicalRows:stream.canonicalRows??stream.latest});
      if(turn.openStep!==null)this.append('step/end',{turn:turn.turn,step:turn.openStep});
      const step=turn.nextStep++;
      this.append('step/start',{turn:turn.turn,step,zcode:{responseKey:key,...(pending?{pending:true}:{})}});turn.steps.set(key,step);turn.openStep=step;if(pending)turn.pendingKey=key;
      const rowModel=rows.find(row=>row.model)?.model;
      // Execution metadata, not the mirror display route: the header carries the session's real
      // provider/model/effort so the official modelSelection fold does not read a `zcode` placeholder.
      if(rowModel){
        const selection=snapshot?.config?.modelSelection;
        const provider=selection?.providerId??snapshot?.config?.provider;
        const model=selection?.modelId??rowModel;
        const reasoningEffort=selection?.options?.reasoningLevel??snapshot?.config?.thought;
        this.append('request/header',{header:{config:{provider:provider??'zcode',model,...(reasoningEffort?{reasoningEffort}:{})}},reason:this.headerEmitted?'change':this.hasHeader?'resume':'initial'});
        this.hasHeader=true;this.headerEmitted=true;
      }
    }
    return turn.steps.get(key);
  }
  startStream(key,turn,step){
    if(this.streams.has(key))return this.streams.get(key);
    const stream={attemptId:`${this.session.id}:${this.generation}:${key}:${++this.attempt}`,turn,step,index:0,records:[],rows:new Map(),baseline:this.cumulative?structuredClone(this.cumulative):undefined};
    // attempt is lifecycle-local; revisions continue even after abandoned attempts.
    this.streams.set(key,stream);this.emit(stream,{type:'start',turn,step});return stream;
  }
  attempt=0;
  emit(stream,frame){this.dispatch.emit('agent/assistant-stream',{frame:{attemptId:stream.attemptId,revision:++this.revision,...frame}})}
  chunk(stream,chunk){const time=this.clock();stream.records.push({type:'chunk',time,chunk});this.emit(stream,{type:'chunk',index:stream.index++,time,chunk})}
  abandon(key){const stream=this.streams.get(key);if(!stream)return;this.emit(stream,{type:'end',index:stream.index,outcome:{kind:'abandoned'}});this.streams.delete(key)}
  blocks(rows){return rows.filter(row=>row.kind!=='toolCall'||row.status!=='inputStreaming').map(row=>row.kind==='toolCall'?{type:'tool-call',id:row.toolCallId,name:row.toolName,arguments:row.inputText}:{type:row.kind==='reasoning'?'reasoning':'text',text:row.text})}
  pushRows(stream,rows){
    stream.latest=clean(rows);
    for(const [index,row] of rows.entries()){
      const previous=stream.rows.get(row.rowId),text=row.kind==='toolCall'?row.inputText:row.text;
      if(previous&&!text.startsWith(previous.text))throw commandFault('event-stream-prefix-replaced');
      if(!previous)this.chunk(stream,{type:'block-start',index,blockType:row.kind==='toolCall'?'tool-call':row.kind==='reasoning'?'reasoning':'text'});
      const suffix=text.slice(previous?.text.length??0);
      if(suffix||!previous&&row.kind==='toolCall')this.chunk(stream,row.kind==='toolCall'?{type:'tool-call-delta',index,id:row.toolCallId,name:row.toolName,argumentsDelta:suffix}:{type:row.kind==='reasoning'?'reasoning-delta':'text-delta',index,text:suffix});
      stream.rows.set(row.rowId,{text,index});
    }
  }
  settle(key,rows,turn,step,{interrupted=false,usage,cumulative,canonicalRows=rows}={}){
    const content=this.blocks(rows);if(!content.length){this.abandon(key);return}
    const stream=this.startStream(key,turn,step);
    try{
      this.pushRows(stream,rows);
      for(const [index,block] of content.entries())this.chunk(stream,{type:'block-end',index,block});
      if(usage)this.chunk(stream,{type:'usage',usage});
      const data={turn,step,message:{id:`zcode-response:${key}:${turn}:${step}`,role:'assistant',source:{kind:'model',provider:'zcode',model:rows.find(row=>row.model)?.model??'unreported'},content},stream:stream.records,
        ...(interrupted?{interrupted:true}:{}),...(usage?{usage}:{}),zcode:{responseKey:key,rows:clean(canonicalRows),...(stream.baseline?{baseline:stream.baseline}:{}),...(cumulative?{cumulative}:{})}};
      const event=this.append('assistant/message',data,'append');
      this.responses.set(key,{seq:event.seq,data,rows:clean(canonicalRows),interrupted});
      this.emit(stream,{type:'end',index:stream.index,outcome:{kind:'committed',eventType:'assistant/message',seq:event.seq}});this.streams.delete(key);
    }catch(error){this.abandon(key);throw error}
  }
  continuation(rows,previous){
    return rows.flatMap(row=>{
      const old=previous.rows.find(item=>item.rowId===row.rowId);
      if(!old)return [row];
      if(row.kind==='toolCall')return old.status==='inputStreaming'&&row.status!=='inputStreaming'?[row]:[];
      if(!row.text.startsWith(old.text))throw commandFault('event-stream-prefix-replaced');
      const text=row.text.slice(old.text.length);return text?[{...row,text}]:[];
    });
  }
  tool(row,key,turn,step,interrupted=false){
    if(row.status==='inputStreaming')return;
    if(!this.calls.has(key)){
      this.append('tool/call',{turn,step,callId:row.toolCallId,name:row.toolName,arguments:row.inputText,zcode:{rowKey:key}});this.calls.set(key,{turn,step,callId:row.toolCallId,name:row.toolName,arguments:row.inputText});
    }
    const status=terminalTools.has(row.status)?row.status:interrupted?'cancelled':null;
    if(!status||this.results.get(key)?.status===status)return;
    const call=this.calls.get(key),failed=status!=='success';
    const previous=this.results.get(key);
    const data={turn:call.turn,step:call.step,message:{id:`zcode-result:${key}`,role:'tool',source:{kind:'tool',callId:row.toolCallId},toolCallId:row.toolCallId,content:[{type:'text',text:row.output?.text??row.error?.message??(failed?'ZCode tool outcome is unknown after interruption.':'')}],...(failed?{isError:true}:{})},
      ...(failed?{error:{name:'ZCodeToolError',code:row.error?.code??'TOOL_OUTCOME_UNKNOWN',reason:row.error?.message??'Tool interrupted; verify effects before retrying.'}}:{}),
      meta:{zcode:{status,toolName:row.toolName,...(row.display?{callDisplay:row.display}:{}),...(row.output?.display?{display:row.output.display}:{})}},zcode:{rowKey:key,status}};
    const event=this.append('tool/result',data,'append');this.results.set(key,{seq:event.seq,status});
  }
  async translate(snapshot){
    this.lifetime.signal.throwIfAborted();
    const groups=new Map();for(const row of rowsFor(snapshot)){const key=eventRowKey(snapshot.logEpoch,row.turnId);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}
    const cumulative=snapshot.usage?.cumulative;
    const candidates=[];
    for(const [turnKey,rows] of groups){
      const responses=responseGroups(rows,snapshot.logEpoch),end=turnEndReason(terminalState(rows,snapshot,turnKey===[...groups.keys()].at(-1)),snapshot.control.lastError);
      for(const [key,visible] of responses)if((end||visible.every(row=>row.kind==='toolCall'?row.status!=='inputStreaming':row.state!=='streaming'))&&end?.kind!=='aborted'&&end?.kind!=='error'&&(!this.responses.has(key)||this.responses.get(key).interrupted))candidates.push(key);
    }
    const active=candidates.length===1?this.streams.get(candidates[0]):undefined;
    const prior=candidates.length===1?this.responses.get(candidates[0]):undefined;
    const baseline=active?active.baseline:prior?prior.data.zcode.baseline:this.cumulative;
    const delta=baseline&&cumulative?Object.fromEntries(Object.keys(cumulative).map(key=>[key,cumulative[key]-baseline[key]])):null;
    const credit=candidates.length===1&&delta&&Object.values(delta).every(value=>value>=0)&&Object.values(delta).some(value=>value>0)?candidates[0]:null;
    for(const [turnKey,rows] of groups){
      const header=rows.find(row=>row.kind==='turnHeader'),end=turnEndReason(terminalState(rows,snapshot,turnKey===[...groups.keys()].at(-1)),snapshot.control.lastError);
      if(header&&!this.acceptInput(header))continue;
      const phase=terminalState(rows,snapshot,turnKey===[...groups.keys()].at(-1));
      const turn=this.turn(turnKey,phase==='running'||phase==='prewarming');
      const accepted=rows.filter(row=>this.acceptInput({...row,sourceCommandId:row.sourceCommandId??header?.sourceCommandId}));
      this.syncInbox({...snapshot,rows:{...snapshot.rows,window:accepted}});
      const responses=responseGroups(rows,snapshot.logEpoch);
      for(const row of rows){
        const rowKey=eventRowKey(snapshot.logEpoch,row.rowId);
        if(row.kind==='userInput'&&!this.users.has(rowKey)&&this.acceptInput({...row,sourceCommandId:row.sourceCommandId??header?.sourceCommandId})){
          const input=this.input(row.sourceCommandId??header?.sourceCommandId),first=rows.find(item=>['assistantText','reasoning','toolCall'].includes(item.kind));
          const responseKey=responses.keys().next().value??eventRowKey(snapshot.logEpoch,`${row.turnId}:pending`);
          this.step(turn,responseKey,snapshot,first?rows:[],{pending:!first});
          const attachments=await renderAttachments(this.conversation,this.attachments(),row,{signal:this.lifetime.signal,...(this.history?{lenient:true}:{})});
          this.lifetime.signal.throwIfAborted();
          const message={id:input?.id??`zcode-user:${rowKey}`,role:'user',source:input?.source??(row.origin==='realUser'||row.guided?{kind:'user'}:{kind:'zcode-context',origin:row.origin}),content:[{type:'text',text:row.text},...attachments],zcode:{rowKey}};
          this.claim(message.id);
          if(row.guided){
            let inbox=inboxProjectionDefinition.init();for(let seq=0;seq<this.session.seq;seq++)inbox=inboxProjectionDefinition.apply(inbox,this.session.eventAt(seq));
            for(const target of ['next-turn','next-step']){const index=inbox[target].findIndex(item=>item.id===message.id);if(index>=0)this.append('agent/inbox/spliced',{target,start:index,removedCount:1,inserted:[]})}
            const start=inbox['next-step'].filter(item=>item.id!==message.id).length;
            this.append('agent/inbox/spliced',{target:'next-step',start,inserted:[message]});
            this.append('agent/inbox/spliced',{target:'next-step',start,removedCount:1,inserted:[]});
          }
          this.append('user/message',message,'append');this.users.add(rowKey);
        }
      }
      for(const [key,visible] of responses){
        const previous=this.responses.get(key);
        const signature=JSON.stringify(visible);
        if(previous&&JSON.stringify(previous.rows)===signature)continue;
        let delivered=visible;
        if(previous){
          delivered=this.continuation(visible,previous);
          if(!delivered.length){for(const row of visible)if(row.kind==='toolCall')this.tool(row,eventRowKey(snapshot.logEpoch,row.rowId),turn.turn,previous.data.step,!!end);continue}
          if(!this.streams.has(key)){if(turn.openStep!==null)this.append('step/end',{turn:turn.turn,step:turn.openStep});turn.openStep=null;turn.steps.delete(key)}
        }
        const step=this.step(turn,key,snapshot,visible);
        const ready=!!end||visible.every(row=>row.kind==='toolCall'?row.status!=='inputStreaming':row.state!=='streaming');
        const interrupted=visible.some(row=>['interrupted','failed'].includes(row.state)||!!end&&(row.state==='streaming'||row.status==='inputStreaming'));
        if(previous&&JSON.stringify(this.blocks(previous.rows))===JSON.stringify(this.blocks(visible))&&previous.interrupted===interrupted){for(const row of visible)if(row.kind==='toolCall')this.tool(row,eventRowKey(snapshot.logEpoch,row.rowId),turn.turn,step,!!end);continue}
        const stream=this.startStream(key,turn.turn,step);if(previous)stream.baseline=previous.data.zcode.baseline;stream.canonicalRows=clean(visible);this.pushRows(stream,delivered);
        if(ready){
          const usage=key===credit&&!interrupted?{...delta,totalTokens:delta.inputTokens+delta.outputTokens}:undefined;
          this.settle(key,delivered,turn.turn,step,{interrupted,usage,cumulative,canonicalRows:visible});
          for(const row of visible)if(row.kind==='toolCall')this.tool(row,eventRowKey(snapshot.logEpoch,row.rowId),turn.turn,step,!!end);
        }
      }
      if(end&&!turn.closed){
        for(const [key,stream] of [...this.streams])if(stream.turn===turn.turn)this.settle(key,stream.latest??[],turn.turn,stream.step,{interrupted:true,canonicalRows:stream.canonicalRows??stream.latest});
        this.closeTurn(turn,end);
      }
    }
    // v4 reports cumulative session counters, not per-row usage. Attribute only a
    // nonnegative observed delta to ONE newly completed successful response.
    // assistant/attempt is intentionally omitted; interrupted usage stays absent.
    if(cumulative)this.cumulative=structuredClone(cumulative);
    if(!groups.size)this.syncInbox(snapshot);
  }
  interrupt(){const task=this.tail.then(()=>this.interruptNow());this.tail=task.catch(()=>{});return task}
  interruptNow(){
    for(const [key,stream] of [...this.streams]){
      if(stream.latest){
        this.settle(key,stream.latest,stream.turn,stream.step,{interrupted:true,canonicalRows:stream.canonicalRows??stream.latest});
        for(const row of stream.canonicalRows??stream.latest)if(row.kind==='toolCall'&&row.status!=='inputStreaming')this.tool(row,eventRowKey(JSON.parse(key)[0],row.rowId),stream.turn,stream.step,true);
        const turn=[...this.turns.values()].find(value=>value.turn===stream.turn);
        if(turn?.openStep===stream.step){this.append('step/end',{turn:stream.turn,step:stream.step});turn.openStep=null}
      }else this.abandon(key);
    }
  }
  abort(){this.lifetime.abort(commandFault('event-translator-disposed'))}
  closeTurn(turn,reason){
    this.interruptNow();
    for(const [key,call] of this.calls)if(call.turn===turn.turn&&!this.results.has(key))this.tool({rowId:0,toolCallId:call.callId,toolName:call.name,inputText:call.arguments,status:'cancelled'},key,call.turn,call.step,true);
    if(turn.openStep!==null)this.append('step/end',{turn:turn.turn,step:turn.openStep});
    this.append('turn/end',{turn:turn.turn,reason});turn.closed=true;turn.openStep=null;
  }
  async close(){
    this.abort();await this.tail;this.interruptNow();
    for(const turn of this.turns.values())if(!turn.closed)this.closeTurn(turn,{kind:'aborted',reason:{kind:'disposed'}});
  }
}
