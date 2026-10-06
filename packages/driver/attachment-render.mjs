import {decodeBase64} from '../host/attachment.mjs';
import {commandFault} from './commands.mjs';

/** Authoritative row-scoped reads, with bounded progress and no Host filesystem paths. */
export async function* attachmentBytes(conversation,row,attachment,index,signal){
  let offset=0,total,mime;
  do{
    signal?.throwIfAborted();
    const result=await conversation.conversationAttachmentRead({ref:attachment.ref,target:{rowId:row.rowId,entityId:row.entityId},attachmentIndex:index,offset,signal});
    const bytes=decodeBase64(result.dataBase64);
    if(total!==undefined&&(total!==result.totalBytes||mime!==result.mediaType))throw commandFault('attachment-render-source-changed');
    total=result.totalBytes;mime=result.mediaType;
    if(total!==attachment.bytes||mime!==attachment.mime||offset+bytes.length>total||
       result.nextOffset!==null&&result.nextOffset!==offset+bytes.length||result.nextOffset!==null&&!bytes.length||
       result.nextOffset===null&&offset+bytes.length!==total)throw commandFault('attachment-render-progress-invalid');
    yield bytes;
    offset=result.nextOffset;
  }while(offset!==null);
}
export async function renderAttachments(conversation,store,row,{signal}={}){
  if(!row.attachments?.length)return [];
  if(!store)throw commandFault('official-attachment-store-unavailable');
  const blocks=[];
  for(const [index,attachment] of row.attachments.entries()){
    const chunks=attachmentBytes(conversation,row,attachment,index,signal);
    if(['image/png','image/jpeg','image/webp','image/gif'].includes(attachment.mime)){
      const parts=[];let size=0;for await(const bytes of chunks){parts.push(bytes);size+=bytes.length}
      const data=new Uint8Array(size);let offset=0;for(const bytes of parts){data.set(bytes,offset);offset+=bytes.length}
      const [ref]=await store.saveImages([{data,mediaType:attachment.mime,name:attachment.fileName}]);
      signal?.throwIfAborted();blocks.push({type:'image',attachment:ref});
    }else{
      const ref=await store.saveFileStream({data:chunks,name:attachment.fileName,signal});
      signal?.throwIfAborted();blocks.push({type:'file',attachment:ref});
    }
  }
  return blocks;
}
