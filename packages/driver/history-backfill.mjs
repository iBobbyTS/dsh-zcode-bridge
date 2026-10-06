import {PROTOCOL_V4_LIMITS,v4ConversationAttachmentReadResultSchema} from '../host/vendor/zcode/v4.mjs';

const fault=code=>Object.assign(new Error(code),{code});
/** ZCode's declared per-page maximum (vendor/zcode/v4.mjs rowsRangeMaxLimit). */
export const HISTORY_PAGE_LIMIT=PROTOCOL_V4_LIMITS.rowsRangeMaxLimit;

/** Read the complete ZCode row history for one Session through `v4/conversation/rowsRange`.
 * Paginates from the current tail backwards with `beforeRowId`, one page per call, and stops on
 * the server's own `hasMore`. A stalled cursor, an over-limit page, or a malformed result is an
 * explicit error — a partial history is never silently accepted as complete. */
export async function collectHistoryPages(request,{sessionId,workspace,signal,limit=HISTORY_PAGE_LIMIT,maxPages=10000}={}){
  if(typeof request!=='function'||typeof sessionId!=='string'||!sessionId)throw fault('rows-range-request-invalid');
  const pages=[];
  let beforeRowId;
  for(let index=0;index<maxPages;index++){
    signal?.throwIfAborted();
    const params={sessionId,limit,...(beforeRowId!==undefined?{beforeRowId}:{}),...(workspace?{workspace:{workspacePath:workspace,workspaceKey:workspace}}:{})};
    const result=await request('v4/conversation/rowsRange',params,{signal});
    if(!result||!Array.isArray(result.rows)||typeof result.hasMore!=='boolean'||typeof result.atSeq!=='number'||typeof result.atRevision!=='number'||typeof result.atLogEpoch!=='string')throw fault('rows-range-result-invalid');
    if(result.rows.length>limit)throw fault('rows-range-page-over-limit');
    pages.push(result);
    if(!result.hasMore)return pages;
    if(!result.rows.length)throw fault('rows-range-cursor-invalid');
    const oldest=Math.min(...result.rows.map(row=>row.rowId));
    if(!Number.isSafeInteger(oldest))throw fault('rows-range-cursor-invalid');
    if(beforeRowId!==undefined&&oldest>=beforeRowId)throw fault('rows-range-cursor-stalled');
    beforeRowId=oldest;
  }
  throw fault('rows-range-page-limit');
}

/** Wrap each page as a caller-owned history window for `mergeEventWindows`/`replay`. The phase is
 * terminal because only committed history is read; per-turn state still comes from the rows. */
export function historySnapshots(sessionId,pages){
  return pages.map(page=>({
    protocolVersion:3,sessionId,logEpoch:page.atLogEpoch,seq:page.atSeq,revision:page.atRevision,
    control:{phase:'completedSuccess',canStop:false,activeWorks:[],lastError:null},
    availability:{},inputRouting:{mode:'startNow'},queue:{items:[],autoDrain:true},pendingInteractions:[],
    rows:{window:page.rows},
  }));
}

/** Attachment leg for historical rows: the live V4Conversation read gate requires a subscription
 * and only authorizes refs it uploaded itself, so history reads the same authoritative row-scoped
 * carrier directly. `renderAttachments` then writes the bytes into the DSH attachment store. */
export function historyAttachmentReader(request,sessionId){
  return {
    async conversationAttachmentRead({ref,target,attachmentIndex,offset=0,limit,signal}={}){
      const result=await request('v4/conversation/attachmentRead',{sessionId,ref,target,attachmentIndex,offset,...(limit===undefined?{}:{limit})},{signal});
      return v4ConversationAttachmentReadResultSchema.parse(result);
    },
  };
}
