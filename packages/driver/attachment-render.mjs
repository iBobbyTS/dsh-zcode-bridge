import {decodeBase64} from '../host/attachment.mjs';
import {commandFault} from './commands.mjs';

/** Authoritative row-scoped reads, with bounded progress and no Host filesystem paths.
 * `lenient` (history replay): the server's current bytes are the truth — a re-encoded or
 * re-processed attachment may no longer match the historical row's declared size/mime, and the
 * replay must not fail the whole backfill for that. Chunk-arithmetic invariants stay strict. */
export async function* attachmentBytes(conversation,row,attachment,index,signal,{lenient=false}={}){
  let offset=0,total,mime;
  do{
    signal?.throwIfAborted();
    const result=await conversation.conversationAttachmentRead({ref:attachment.ref,target:{rowId:row.rowId,entityId:row.entityId},attachmentIndex:index,offset,signal});
    const bytes=decodeBase64(result.dataBase64);
    if(total!==undefined&&(total!==result.totalBytes||mime!==result.mediaType))throw commandFault('attachment-render-source-changed');
    total=result.totalBytes;mime=result.mediaType;
    if((!lenient&&(total!==attachment.bytes||mime!==attachment.mime))||offset+bytes.length>total||
       result.nextOffset!==null&&result.nextOffset!==offset+bytes.length||result.nextOffset!==null&&!bytes.length||
       result.nextOffset===null&&offset+bytes.length!==total)throw commandFault('attachment-render-progress-invalid');
    yield bytes;
    offset=result.nextOffset;
  }while(offset!==null);
}
/** Minimal image magic sniffing for the lenient history path: the app's current bytes are the
 * truth, and the official store rejects a declared type that disagrees with them. */
export function sniffImageType(data){
  if(data.length>=8&&data[0]===0x89&&data[1]===0x50&&data[2]===0x4E&&data[3]===0x47)return 'image/png';
  if(data.length>=3&&data[0]===0xFF&&data[1]===0xD8&&data[2]===0xFF)return 'image/jpeg';
  if(data.length>=4&&data[0]===0x47&&data[1]===0x49&&data[2]===0x46&&data[3]===0x38)return 'image/gif';
  if(data.length>=12&&data[0]===0x52&&data[1]===0x49&&data[2]===0x46&&data[3]===0x46&&data[8]===0x57&&data[9]===0x45&&data[10]===0x42&&data[11]===0x50)return 'image/webp';
  return undefined;
}
export async function renderAttachments(conversation,store,row,{signal,lenient=false}={}){
  if(!row.attachments?.length)return [];
  if(!store)throw commandFault('official-attachment-store-unavailable');
  const blocks=[];
  for(const [index,attachment] of row.attachments.entries()){
    const chunks=attachmentBytes(conversation,row,attachment,index,signal,{lenient});
    if(['image/png','image/jpeg','image/webp','image/gif'].includes(attachment.mime)){
      const parts=[];let size=0;for await(const bytes of chunks){parts.push(bytes);size+=bytes.length}
      const data=new Uint8Array(size);let offset=0;for(const bytes of parts){data.set(bytes,offset);offset+=bytes.length}
      try{
        const mediaType=lenient?sniffImageType(data)??attachment.mime:attachment.mime;
        const [ref]=await store.saveImages([{data,mediaType,name:attachment.fileName}]);
        signal?.throwIfAborted();blocks.push({type:'image',attachment:ref});
      }catch(error){
        // Lenient history fallback: bytes the store cannot admit as an image (unknown magic,
        // sniff/store disagreement) still render as a file block instead of failing the replay.
        if(!lenient)throw error;
        const ref=await store.saveFileStream({data:[data],name:attachment.fileName,signal});
        signal?.throwIfAborted();blocks.push({type:'file',attachment:ref});
      }
    }else{
      const ref=await store.saveFileStream({data:chunks,name:attachment.fileName,signal});
      signal?.throwIfAborted();blocks.push({type:'file',attachment:ref});
    }
  }
  return blocks;
}
