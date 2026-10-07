import {commandFault} from './commands.mjs';
import {requireAcceptedCommand} from './queue-steer.mjs';

/** ACK means admitted (possibly queued). Only the existing V4 ledger reconciles
 * the command's own turnHeader to a terminal projection. No local summary/fake end. */
export async function compactAgent(agent,{commandId,signal,timeoutMs=30000}={}){
  const receipt=requireAcceptedCommand(await agent.submitControl({type:'compact',payload:{},...(commandId?{commandId}:{}),signal}));
  const terminal=new Set(['completed','failed','interrupted','rejected','stale','noop','not-sent','outcome-unknown']);
  const result=await new Promise((resolve,reject)=>{
    let off=()=>{},timer;
    const finish=(error,value)=>{off();clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value)};
    const abort=()=>finish(commandFault('compact-cancelled'));
    const inspect=state=>{
      const record=state.commands.find(item=>item.commandId===receipt.commandId);
      if(record&&terminal.has(record.state))return finish(null,record);
      if(state.status==='closed'||state.error)return finish(commandFault(state.error??'agent-disposed'));
    };
    off=agent.conversation.subscribe(inspect);
    timer=setTimeout(()=>finish(Object.assign(commandFault('compact-outcome-unknown'),{commandId:receipt.commandId})),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();else inspect(agent.conversation.state);
  });
  if(result.state!=='completed')throw Object.assign(commandFault(result.ack?.reasonCode??result.error??`compact-${result.state}`),{commandId:result.commandId,state:result.state});
  await agent.translator.tail;agent.assertAvailable();
  const events=agent.session.snapshotEvents?.()??Array.from({length:agent.session.seq},(_,seq)=>agent.session.eventAt(seq));
  const turn=events.find(event=>event.type==='turn/start'&&event.data.zcode?.turnKey===JSON.stringify([result.resultLogEpoch,result.turnId]));
  const end=turn&&events.findLast(event=>event.type==='turn/end'&&event.data.turn===turn.data.turn);
  if(end?.data.reason?.kind!=='completed')throw Object.assign(commandFault('compact-projection-unconfirmed'),{commandId:result.commandId});
  return {kind:'success',text:'ZCode compaction completed.',sourceEventSeq:end.seq};
}
/** The injected agent context makes this an agent-scoped shadow, preserving the
 * global compact implementation for native agents (commands/src/index.ts:259). */
export function installCompactCommand(agent){
  if(typeof agent.ctx.inject!=='function')return;
  agent.ctx.inject(['commands'],ctx=>{
    if(agent.disposed)return;
    ctx.commands.register({definitionId:'@dsh-zcode/driver/compact',name:'compact',description:'Compact ZCode conversation history',handler:invocation=>{
      if(invocation.agent!==agent)throw commandFault('compact-owner-mismatch');
      if(invocation.rawInput.trim())return {kind:'error',text:'Usage: /compact (no arguments)'};
      return agent.track(compactAgent(agent,{commandId:invocation.commandId,signal:invocation.signal}));
    }});
  });
}

export async function compactOperation(agent,payload,signal){
  agent.assertAvailable();await agent.ready();signal?.throwIfAborted();
  const snapshot=agent.conversation.state.snapshot;
  if(payload.baseRevision!==snapshot.revision||payload.baseLogEpoch!==snapshot.logEpoch)throw commandFault('parity-projection-stale');
  if(Object.keys(payload.params??{}).length)throw commandFault('compact-arguments-unavailable');
  return agent.submitControl({type:'compact',payload:{},baseRevision:payload.baseRevision,baseLogEpoch:payload.baseLogEpoch,signal});
}
