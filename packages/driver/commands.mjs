import {INPUT_COMMANDS} from '../host/conversation.mjs';
import {createHash} from 'node:crypto';

export const commandFault=code=>Object.assign(new Error(code),{code});
// Stable identity survives native inbox replay; it is never a command state ledger.
export function inputCommandId(sessionId,messageId){
  const bytes=createHash('sha256').update(JSON.stringify(['zcode-driver-input',sessionId,messageId])).digest().subarray(0,16);
  bytes[6]=(bytes[6]&15)|0x80;bytes[8]=(bytes[8]&63)|0x80;
  const hex=bytes.toString('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export const COMMAND_REJECTIONS=Object.freeze({
  remove:'official-queue-remove-unavailable',
  deleteQueueItem:'official-queue-remove-unavailable',
  clearQueue:'official-queue-clear-unavailable',
  inject:'official-inject-unavailable',
  userInput:'interaction-mapping-unavailable',
  fork:'official-history-unavailable',
  retry:'official-history-unavailable',
  editHistory:'official-history-unavailable',
  splice:'official-inbox-splice-unavailable',
  prepend:'official-inbox-prepend-unavailable',
});
export const ROUTED_COMMANDS=new Set([...INPUT_COMMANDS].filter(type=>type!=='deleteQueueItem').concat('renameSession','resolveInteraction','snoozeInteractionAutoResolution','respondWorkspaceHookReview','toggleWorkspaceHookReviewItem','revokeWorkspaceHookTrust','requestWorkspaceHookReview','forkAssistant','compact','editUserQuery','retryTurn','applyFileRewind','discardSharedContext','createSelectionSideSession'));
export function rejectOperation(operation){throw commandFault(COMMAND_REJECTIONS[operation]??'official-operation-unavailable')}

// startNow is a preemption request when busy. Ordinary followups must queue then.
export function requestedDelivery(target,snapshot){
  if(!['next-turn','next-step'].includes(target))throw commandFault('official-inbox-target-invalid');
  if(target==='next-step')return 'guide';
  return snapshot.control.canStop||snapshot.control.activeWorks.length||snapshot.queue.items.length?'queue':'startNow';
}
export function validateMessage(message){
  if(!message||typeof message.id!=='string'||!message.id||!Array.isArray(message.content)||!message.content.length)throw commandFault('official-message-invalid');
  for(const part of message.content){
    if(part.type==='text'&&typeof part.text==='string')continue;
    if(['image','file'].includes(part.type)&&part.attachment?.attachmentId)continue;
    throw commandFault('official-content-unavailable');
  }
}
export async function promptPayload(message,conversation,store,{signal,modelSelection,mode}={}){
  validateMessage(message);
  const attachments=[];
  for(const part of message.content){
    if(part.type==='text')continue;
    if(!store)throw commandFault('official-attachment-store-unavailable');
    let bytes;
    if(part.type==='image')bytes=(await store.readImage(part.attachment,signal)).data;
    else {
      const chunks=[];let size=0;
      for await(const chunk of store.readFileStream(part.attachment,signal)){chunks.push(chunk);size+=chunk.byteLength}
      bytes=new Uint8Array(size);let offset=0;
      for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
    }
    signal?.throwIfAborted();
    const fileName=part.attachment.name??part.attachment.attachmentId;
    const mime=part.type==='image'?part.attachment.mediaType:'application/octet-stream';
    const {ref}=await conversation.uploadAttachment({fileName,mime,bytes},{signal});
    attachments.push({ref,fileName,mime,bytes:bytes.byteLength});
  }
  return {text:message.content.filter(part=>part.type==='text').map(part=>part.text).join('\n'),
    ...(attachments.length?{attachments}:{}),...(modelSelection?{modelSelection}:{}),...(mode?{mode}:{})};
}
