import {ConversationEventTranslator} from './events.mjs';
import {collectHistoryPages,historySnapshots,historyAttachmentReader} from './history-backfill.mjs';

const fault=(code,message)=>Object.assign(new Error(message??code),{code});
const readEvents=session=>session.snapshotEvents?.()??Array.from({length:session.seq},(_,seq)=>session.eventAt(seq));

/** Directory owner for pre-existing ZCode Sessions with no DSH record. `sync` ensures a DSH
 * Session per catalog row (SessionId = ZCode conversation id, so the same id can never be
 * ensured twice) and eagerly backfills the complete row history before marking it readable.
 * `ensureReadable` is the write gate: an open/prompt on a placeholder completes the backfill
 * first, so no consumer ever reads a partial or empty transcript as if it were complete.
 * States: absent → placeholder (header + catalog title) → backfilling → readable | error. */
export class LegacyDirectory {
  rows=new Map();inflight=new Map();disposed=false;
  constructor({store,persistence,listCatalog,listPersistedIds,request,attachments=()=>undefined,sessions,intervalMs=5000,onError=()=>{}}){
    Object.assign(this,{store,persistence,listCatalog,listPersistedIds,request,attachments,sessions,intervalMs,onError});
  }
  status(sessionId){return this.store.value.legacy[sessionId]??null}
  /** Ensure + eagerly backfill every catalog row. One row per ZCode conversation id. */
  async sync({signal}={}){
    if(this.disposed)throw fault('legacy-directory-disposed');
    const rows=await this.listCatalog({signal});
    const result={ensured:0,readable:0,failed:[]};
    for(const row of rows){
      if(row?.archived===true)continue;
      this.rows.set(row.sessionId,row);
      const before=this.store.value.legacy[row.sessionId]?.state;
      try{await this.#ensure(row,{signal})}
      catch(error){result.failed.push({sessionId:row.sessionId,code:error?.code??'backfill-failed'});this.onError(error,row);continue}
      if(before!=='readable')result.ensured++;
      if(this.store.value.legacy[row.sessionId]?.state==='readable')result.readable++;
    }
    return result;
  }
  /** Await (or start) the backfill for one legacy session. Returns undefined only when the id has
   * never been a legacy row, so normal driver sessions pass through untouched.
   *
   * A persisted non-readable legacy state must never be released just because the in-memory catalog
   * rows are empty (restart, catalog not yet synced or peer unavailable): announcing the title-only
   * placeholder and appending live turns would make the replayed history sort permanently after the
   * live turn, and the exclusivity of the write handle would then loop the retry. Without a row the
   * caller gets an explicit failure; once a sync has populated the row, the re-entrant backfill
   * completes and the next call resolves readable. */
  ensureReadable(sessionId,{signal}={}){
    const state=this.store.value.legacy[sessionId];
    if(state?.state==='readable')return Promise.resolve(state);
    const inflight=this.inflight.get(sessionId);
    if(inflight)return inflight;
    const row=this.rows.get(sessionId);
    if(!row){
      if(state)return Promise.reject(fault('legacy-backfill-unavailable',`the ZCode history for "${sessionId}" is not readable yet and its catalog row is unavailable`));
      return Promise.resolve(undefined);
    }
    return this.#ensure(row,{signal});
  }
  #ensure(row,{signal}={}){
    const id=row.sessionId;
    const readable=this.store.value.legacy[id];
    if(readable?.state==='readable')return Promise.resolve(readable);
    const existing=this.inflight.get(id);
    if(existing)return existing;
    const task=(async()=>{
      const persisted=await this.listPersistedIds({signal});
      if(!persisted.has(id))await this.#createPlaceholder(row,{signal});
      this.store.value.legacy[id]={state:'backfilling'};
      await this.store.save();
      const outcome=await this.#backfill(row,{signal});
      this.store.value.legacy[id]={state:'readable',appended:outcome.appended,at:Date.now()};
      await this.store.save();
      return outcome;
    })().catch(async error=>{
      this.store.value.legacy[id]={state:'error',error:error?.code??String(error),at:Date.now()};
      await this.store.save();
      throw error;
    }).finally(()=>this.inflight.delete(id));
    this.inflight.set(id,task);
    return task;
  }
  /** Header-only placeholder carrying the catalog title: list surfaces can show it while the
   * full transcript is still being fetched. No transcript event is written here. */
  async #createPlaceholder(row,{signal}={}){
    const header={version:4,id:row.sessionId,createdAt:Date.now(),isSeeded:false,delegationDepth:0,...(row.cwd??row.workspacePath?{cwd:row.cwd??row.workspacePath}:{})};
    const handle=await this.persistence.create(header,{signal});
    try{
      if(typeof row.title==='string'&&row.title.trim())await handle.append([{type:'session/title',data:{title:row.title,messageSeqs:[],source:{kind:'user'}},seq:0,time:Date.now()}]);
    }finally{await handle.close()}
  }
  async #backfill(row,{signal}={}){
    const id=row.sessionId;
    const pages=await collectHistoryPages(this.request,{sessionId:id,workspace:row.workspacePath,signal});
    const windows=historySnapshots(id,pages);
    const handle=await this.persistence.open(id,'write',{signal});
    try{
      const existing=(await handle.read(0,undefined,{signal})).events;
      const session=this.sessions.prepare(id,{meta:{cwd:row.cwd??row.workspacePath},seed:existing});
      const translator=new ConversationEventTranslator({
        session,dispatch:{emit(){}},conversation:historyAttachmentReader(this.request,id),
        attachments:this.attachments,input:()=>undefined,claim:()=>{},syncInbox:()=>{},
      });
      try{await translator.replay(windows)}finally{await translator.close()}
      const appended=readEvents(session).slice(existing.length);
      // Detached prepare adds a `session/end-seed` terminator at the seed boundary. Persist it at
      // most once (matching the create path), and never count it as backfill progress.
      const boundary=appended.findIndex(event=>event.type==='session/end-seed');
      const body=boundary<0?appended:[...appended.slice(0,boundary),...appended.slice(boundary+1)];
      const toAppend=boundary>=0&&!existing.some(event=>event.type==='session/end-seed')?[appended[boundary],...body]:body;
      if(toAppend.length)await handle.append(toAppend);
      this.rows.delete(id);
      return {appended:body.length};
    }finally{await handle.close()}
  }
  dispose(){
    this.disposed=true;
    clearInterval(this.timer);
    this.timer=null;
    this.inflight.clear();
  }
}

/** Start the driver-owned catalog poll. The host mirror publication chain is untouched; this only
 * consumes the catalog read side and owns the DSH import/backfill state. */
export function installLegacyDirectory(ctx,deps){
  const directory=new LegacyDirectory(deps);
  const run=()=>directory.sync({}).catch(error=>deps.onError?.(error));
  ctx.effect(()=>{
    // The constructor-resolved period (default 5000ms) is authoritative; an unset deps.intervalMs
    // must not collapse the poll into a ~1ms overlapping loop.
    directory.timer=setInterval(run,directory.intervalMs);
    directory.timer.unref?.();
    void run();
    return ()=>directory.dispose();
  },'zcode-driver: legacy session directory');
  return directory;
}
