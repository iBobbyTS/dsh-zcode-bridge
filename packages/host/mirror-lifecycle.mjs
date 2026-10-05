/** Official queue/ACK evidence only. Native RPC acceptance means bridge admission, not execution. */
export function receiptClass(operation,queue=[]){
  // Execution/projection evidence supersedes the earlier queue admission, including a queue
  // item that has not yet disappeared from a transient promotion snapshot.
  if(['projected','running','waiting','completed','interrupted'].includes(operation.state))return 'accepted';
  if(queue.some(item=>item.sourceCommandId===operation.commandId))return 'queued';
  const status=operation.ack?.status??operation.state;
  if(['rejected','stale','failed','noop','not-sent'].includes(status))return 'rejected';
  if(['accepted','duplicate'].includes(operation.ack?.status)){
    const result=operation.ack.result;
    const delivery=['inputAccepted','inputDisposition'].includes(result?.type)?result.delivery:
      ['createSession','createSelectionSideSession','forkAssistant'].includes(result?.type)?result.input?.delivery:null;
    return delivery==='queue'?'queued':'accepted';
  }
  if(['outcome-unknown','sent-unconfirmed'].includes(operation.state))return 'outcome-unknown';
  if(['accepted','duplicate','accepted-awaiting-terminal'].includes(status))return 'accepted';
  return 'pending';
}
export function mirrorLifecycle(agent,record){
  const state=agent?.conversation?.state,snapshot=state?.snapshot??record.snapshot;
  const confirmed=state?.admission.allowed===true;
  const queue=snapshot?.queue??{items:[],autoDrain:false};
  const operations=new Map(Object.entries(record.operations??{}));
  // Retain original native request/message identity while updating official command evidence.
  for(const command of state?.commands??[]){const held=operations.get(command.commandId);operations.set(command.commandId,{...held,...command,...(held?.state==='projected'?{state:'projected'}:{})})}
  return {
    status:state?.status??(record.officialId?'idle':'draft'),confirmed,
    reason:state?.error??(state?.status==='live'?null:record.error??null),queue,
    control:snapshot?.control??{canStop:false,activeWorks:[],stopState:'idle'},
    inputRouting:snapshot?.inputRouting??null,availability:snapshot?.availability??null,
    receipts:[...operations.values()].map(operation=>({commandId:operation.commandId,requestId:operation.requestId,type:operation.type,state:operation.state,receiptClass:receiptClass(operation,queue.items),reason:operation.ack?.reasonCode??operation.error??null})),
  };
}
