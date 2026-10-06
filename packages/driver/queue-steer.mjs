import {AsyncLocalStorage} from 'node:async_hooks';
import {commandFault} from './commands.mjs';

// Official updateQueue.steer is remove -> steer. Only that request may transfer
// an occurrence; AsyncLocalStorage prevents concurrent remove calls borrowing it.
const transfers=new AsyncLocalStorage();
export function queueSteerTransfer(agent,id){
  const transfer=transfers.getStore();
  return transfer?.active&&transfer.agent===agent&&transfer.id===id?transfer:null;
}
export function requireAcceptedCommand(result){
  if(!['accepted','duplicate'].includes(result?.ack?.status)||['outcome-unknown','failed','rejected','stale','not-sent'].includes(result.state)){
    throw commandFault(result?.ack?.reasonCode??result?.error??(result?.state==='outcome-unknown'?'command-outcome-unknown':'command-rejected'));
  }
  return result;
}
export async function withQueueSteer(agent,id,operation){
  const transfer={agent,id,active:true,removed:null,task:null};
  return transfers.run(transfer,async()=>{
    try{
      const result=await operation();
      if(!transfer.task)throw commandFault('official-queue-steer-unconfirmed');
      requireAcceptedCommand(await transfer.task);
      return result;
    }catch(error){agent.reportError(error);throw error}
    finally{transfer.active=false}
  });
}
