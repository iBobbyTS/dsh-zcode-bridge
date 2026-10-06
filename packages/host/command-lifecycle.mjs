import { newCommandId } from './conversation.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
const unresolved=new Set(['prepared','dispatching','sent-unconfirmed','outcome-unknown']);
/** One durable association owns native request dedup, official command receipts, and recovery.
 * Receiving a later command's ACK never changes an earlier command's uncertainty. */
export class CommandLifecycle {
  constructor(record){
    this.record=record;record.operations??={};
    // Migrate the first session-create candidate's single pending carrier without losing its identity.
    if(record.pending?.commandId&&!record.operations[record.pending.commandId])record.operations[record.pending.commandId]={...record.pending,state:'outcome-unknown'};
    delete record.pending;
  }
  findRequest(requestId){return requestId?Object.values(this.record.operations).find(operation=>operation.requestId===requestId):undefined}
  receive(message,target){
    const requestId=message.source?.kind==='user'?message.source.rpcId:undefined;
    const existing=this.findRequest(requestId);if(existing)return {operation:existing,duplicate:true};
    if(Object.keys(this.record.operations).length>=4096)throw Object.assign(new Error('command-ledger-limit'),{code:'command-ledger-limit'});
    const operation={commandId:newCommandId(),type:'sendText',state:'prepared',target,message:clone(message),...(requestId?{requestId}:{})};
    this.record.operations[operation.commandId]=operation;return {operation,duplicate:false};
  }
  prepareControl(type,payload){
    if(Object.keys(this.record.operations).length>=4096)throw Object.assign(new Error('command-ledger-limit'),{code:'command-ledger-limit'});
    const operation={commandId:newCommandId(),type,payload:clone(payload),state:'prepared'};
    this.record.operations[operation.commandId]=operation;return operation;
  }
  mark(commandId,state,extra={}){const operation=this.record.operations[commandId];if(!operation)return;const projected=operation.state==='projected';Object.assign(operation,clone(extra));operation.state=projected?'projected':state;this.record.lastCommand=clone(operation)}
  receipt(commandId,result){if(result.commandId!==undefined&&result.commandId!==commandId||result.ack?.commandId!==undefined&&result.ack.commandId!==commandId)throw Object.assign(new Error('command-receipt-mismatch'),{code:'command-receipt-mismatch'});this.mark(commandId,result.state==='outcome-unknown'?'outcome-unknown':result.ack?.status??result.state,{...result});}
  project(commandId){const operation=this.record.operations[commandId];if(operation){operation.state='projected';this.record.lastCommand=clone(operation)}return operation?.requestId??commandId}
  nativeRequestId(commandId){return this.record.operations[commandId]?.requestId??commandId}
  pending(target){return Object.values(this.record.operations).filter(operation=>operation.message&&operation.target===target&&!['projected','rejected','stale','failed','noop','not-sent'].includes(operation.state)).map(operation=>operation.message)}
  recoverable(){return Object.values(this.record.operations).filter(operation=>unresolved.has(operation.state))}
}
