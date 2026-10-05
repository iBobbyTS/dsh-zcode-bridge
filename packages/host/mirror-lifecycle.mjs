/** Official queue/ACK evidence only. Native RPC acceptance means bridge admission, not execution. */
export function receiptClass(operation,queue=[]){
  if(queue.some(item=>item.sourceCommandId===operation.commandId))return 'queued';
  const status=operation.ack?.status??operation.state;
  if(['rejected','stale','failed','noop','not-sent'].includes(status))return 'rejected';
  if(['accepted','duplicate'].includes(operation.ack?.status))return operation.ack?.result?.type==='inputDisposition'&&operation.ack.result.delivery==='queue'&&!['projected','running','waiting','completed','interrupted'].includes(operation.state)?'queued':'accepted';
  if(['outcome-unknown','sent-unconfirmed'].includes(operation.state))return 'outcome-unknown';
  if(['accepted','duplicate','projected','running','waiting','completed','interrupted','accepted-awaiting-terminal'].includes(status))return operation.ack?.result?.type==='inputDisposition'&&operation.ack.result.delivery==='queue'&&!['projected','running','waiting','completed','interrupted'].includes(operation.state)?'queued':'accepted';
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
