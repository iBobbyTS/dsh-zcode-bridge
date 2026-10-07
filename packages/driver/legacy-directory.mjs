import {ConversationEventTranslator,mergeEventWindows} from './events.mjs';
import {collectHistoryPages,historySnapshots,historyAttachmentReader} from './history-backfill.mjs';

const fault=(code,message)=>Object.assign(new Error(message??code),{code});
const readEvents=session=>session.snapshotEvents?.()??Array.from({length:session.seq},(_,seq)=>session.eventAt(seq));

/** Rewrite replayed events' `time` from the ZCode rows' own timestamps. The official
 * `Completed in …` turn header is computed from turn/start and turn/end times; without this the
 * replay would stamp everything with the sync moment and every turn would read "1s".
 * Mapping: user/tool events by row key, assistant messages by their canonical rows. Turn
 * boundaries follow ZCode's own task-duration semantics:
 * - turn/start ← the turn's `turnHeader` row createdAt (a fork/steer lineage can carry rows whose
 *   createdAt predates the turn by hours, so a min-over-rows anchor would inflate the duration);
 *   fallback: the turn's first user-message row, then the earliest row.
 * - turn/end ← the max row time of the turn, and for the session's FINAL turn the catalog's task
 *   `sessionUpdatedAt` when it is later (ZCode's own task duration counts the post-message task
 *   finalization that no row carries; the rows API exposes only createdAt). Unmappable events
 *   keep their stamped time. */
export function retimeHistoryEvents(events,rows,epoch,{sessionUpdatedAt}={}){
  const rowTime=new Map(),turnTime=new Map(),turnHeader=new Map();
  for(const row of rows){
    const at=typeof row.createdAt==='number'?row.createdAt:Date.parse(row.createdAt);
    if(!Number.isFinite(at))continue;
    const updatedRaw=row.updatedAt===undefined?at:typeof row.updatedAt==='number'?row.updatedAt:Date.parse(row.updatedAt);
    const updated=Number.isFinite(updatedRaw)?updatedRaw:at;
    rowTime.set(JSON.stringify([epoch,row.rowId]),at);
    const turnKey=JSON.stringify([epoch,row.turnId]);
    const turn=turnTime.get(turnKey)??{min:at,max:at};
    turnTime.set(turnKey,{min:Math.min(turn.min,at),max:Math.max(turn.max,updated)});
    if(row.kind==='turnHeader'){
      const header=turnHeader.get(turnKey);
      if(header===undefined||at<header)turnHeader.set(turnKey,at);
    }
  }
  const responseTime=new Map(),turnKeyOf=new Map(),responseKeyOf=new Map(),userStart=new Map();
  let currentTurn;
  for(const event of events){
    const meta=event.data?.zcode;
    if(event.type==='assistant/message'){
      const list=meta?.rows??[];
      const times=list.map(row=>typeof row.createdAt==='number'?row.createdAt:Date.parse(row.createdAt)).filter(Number.isFinite);
      if(times.length)responseTime.set(meta.responseKey,{min:Math.min(...times),max:Math.max(...times)});
    }else if(event.type==='turn/start'){
      turnKeyOf.set(event.data.turn,meta?.turnKey);
      currentTurn=meta?.turnKey;
    }else if(event.type==='turn/end'){
      if(currentTurn&&currentTurn===(meta?.turnKey??currentTurn))currentTurn=undefined;
    }else if(event.type==='user/message'&&currentTurn&&!userStart.has(currentTurn)){
      const submitted=meta?.rowKey?rowTime.get(meta.rowKey):undefined;
      if(submitted!==undefined)userStart.set(currentTurn,submitted);
    }else if(event.type==='step/start')responseKeyOf.set(event.data.turn+':'+event.data.step,meta?.responseKey);
  }
  const turnStart=turnKey=>turnHeader.get(turnKey)??userStart.get(turnKey)??turnTime.get(turnKey)?.min;
  const lastTurnEndIndex=events.findLastIndex(event=>event.type==='turn/end');
  return events.map((event,index)=>{
    const meta=event.data?.zcode;let time;
    if(meta?.rowKey)time=rowTime.get(meta.rowKey);
    else if(meta?.responseKey)time=responseTime.get(meta.responseKey)?.max;
    else if(meta?.turnKey)time=event.type==='turn/end'
      ?Math.max(turnTime.get(meta.turnKey)?.max??-Infinity,index===lastTurnEndIndex&&typeof sessionUpdatedAt==='number'?sessionUpdatedAt:-Infinity)
      :turnStart(meta.turnKey);
    else if(event.type==='turn/end')time=Math.max(turnTime.get(turnKeyOf.get(event.data.turn))?.max??-Infinity,index===lastTurnEndIndex&&typeof sessionUpdatedAt==='number'?sessionUpdatedAt:-Infinity);
    else if(event.type==='turn/start')time=turnStart(turnKeyOf.get(event.data.turn));
    else if(event.type==='step/end')time=responseTime.get(responseKeyOf.get(event.data.turn+':'+event.data.step))?.max;
    else if(event.type==='step/start')time=responseTime.get(meta?.responseKey)?.min;
    return !Number.isFinite(time)&&time!==undefined?event:time===undefined?event:{...event,time};
  });
}

/** Directory owner for pre-existing ZCode Sessions with no DSH record. Startup ONLY imports the
 * session list (one catalog read → title-only placeholders announced with their catalog title and
 * workspace grouping; a session's content is never read until it is opened). `ensureReadable` is
 * the resume write gate: the first open fetches and persists the complete translated history;
 * every later open re-probes ZCode's tail and appends only what changed (the replay is idempotent
 * against already-persisted events). */
export class LegacyDirectory {
  rows=new Map();inflight=new Map();announced=new Map();announcing=new Map();opened=new Set();attached=new Set();headers=new Map();disposed=false;
  constructor({store,persistence,listCatalog,listPersistedHeaders,request,attachments=()=>undefined,sessions,workspaceRegistry,intervalMs=5000,onError=()=>{}}){
    Object.assign(this,{store,persistence,listCatalog,listPersistedHeaders,request,attachments,sessions,workspaceRegistry,intervalMs,onError});
  }
  status(sessionId){return this.store.value.legacy[sessionId]??null}
  /** List import only: ensure a persisted placeholder per catalog row. No history IO here. */
  async sync({signal}={}){
    if(this.disposed)throw fault('legacy-directory-disposed');
    const rows=await this.listCatalog({signal});
    const persisted=await this.listPersistedHeaders({signal});
    for(const header of persisted)this.headers.set(header.id,header);
    const persistedIds=new Set(persisted.map(header=>header.id));
    const result={listed:0,failed:[]};
    for(const row of rows){
      if(row?.archived===true)continue;
      // A moved task can appear under two workspaces in one catalog read; pick deterministically
      // (newest activity wins, first row on a tie) so re-lists never flip the chosen workspace.
      const previous=this.rows.get(row.sessionId);
      if(!previous||typeof row.updatedAt==='number'&&(typeof previous.updatedAt!=='number'||row.updatedAt>previous.updatedAt))this.rows.set(row.sessionId,row);
      if(this.rows.get(row.sessionId)!==row)continue;
      try{
        const before=this.store.value.legacy[row.sessionId]?.state;
        await this.#ensurePlaceholder(row,persistedIds,{signal});
        await this.#announce(row);
        if(before!=='listed'&&before!=='readable')result.listed++;
      }catch(error){result.failed.push({sessionId:row.sessionId,code:error?.code??'list-failed'});this.onError(error,row)}
    }
    return result;
  }
  /** Await (or start) the content sync for one legacy session, then keep it fresh on every open.
   * Returns undefined only when the id has never been a legacy row, so normal driver sessions
   * pass through untouched.
   *
   * A persisted non-readable legacy state must never be released just because the in-memory catalog
   * rows are empty (restart, catalog not yet synced or peer unavailable): announcing the title-only
   * placeholder and appending live turns would make the replayed history sort permanently after the
   * live turn, and the exclusivity of the write handle would then loop the retry. Without a row the
   * caller gets an explicit failure; once a sync has populated the row, the re-entrant backfill
   * completes and the next call resolves readable. */
  ensureReadable(sessionId,{signal}={}){
    // The resume write gate runs before the factory prepares the session id; our announced
    // placeholder entry holds that id in the session store, so release it here or the factory's
    // prepare would collide with "session already exists". A poll announce in flight for the same
    // id must land first: releasing mid-announce would let the announce's enter collide with the
    // factory's prepare (or vice versa) and fail the open.
    const announcing=this.announcing.get(sessionId);
    const gate=(async()=>{
      if(announcing)await announcing.catch(()=>{});
      this.#release(sessionId);
      const state=this.store.value.legacy[sessionId];
      let task;
      if(state?.state==='readable')task=this.#probeFresh(sessionId,{signal});
      else{
        const inflight=this.inflight.get(sessionId);
        if(inflight)return inflight;
        const row=this.rows.get(sessionId);
        if(!row){
          if(state)return Promise.reject(fault('legacy-backfill-unavailable',`the ZCode history for "${sessionId}" is not readable yet and its catalog row is unavailable`));
          return Promise.resolve(undefined);
        }
        task=this.#ensure(row,{signal});
      }
    // A failed gate must not leave the row invisible: the release above already withdrew the
    // announced placeholder, and the factory only re-enters the id when the gate resolves. On
    // rejection the announcement is restored so list surfaces keep showing the session and the
    // next open retries the sync.
      if(task&&typeof task.then==='function')return await task.catch(error=>{this.#restore(sessionId);throw error});
      return task;
    })();
    return gate;
  }
  #restore(sessionId){
    this.opened.delete(sessionId);
    const row=this.rows.get(sessionId);
    if(row&&!this.disposed)void this.#announce(row).catch(()=>{});
  }
  /** One tail-page read decides whether the persisted history is already current. Fresh → cheap
   * return; newer rows → idempotent resync appends just the delta. A changed log epoch means the
   * ZCode history was rewritten (rewind/edit): resyncing would duplicate the old epoch's events,
   * so the gate keeps the persisted copy and the live subscription layer carries the new epoch. */
  async #probeFresh(sessionId,{signal}={}){
    const state=this.store.value.legacy[sessionId];
    const existing=this.inflight.get(sessionId);
    if(existing)return existing;
    const row=this.rows.get(sessionId);
    if(!state?.cursor){
      // A readable state without a cursor predates the freshness gate: resync it when the
      // catalog row is present, otherwise fail explicitly instead of guessing the workspace.
      if(!row)return this.#resolveProbe(sessionId,Promise.reject(fault('legacy-backfill-unavailable',`the ZCode history for "${sessionId}" is readable but its catalog row is unavailable for a freshness probe`)));
      return this.#resolveProbe(sessionId,this.#ensure(row,{signal}));
    }
    const workspace=row?.workspacePath??state.workspace;
    const probe=(async()=>{
      const page=await this.request('v4/conversation/rowsRange',{sessionId,limit:1,...(workspace?{workspace:{workspacePath:workspace,workspaceKey:workspace}}:{})},{signal});
      if(!page||!Array.isArray(page.rows)||typeof page.atLogEpoch!=='string')throw fault('rows-range-result-invalid');
      const {cursor}=state;
      const newest=page.rows[0]?.rowId??0;
      if(page.atLogEpoch!==cursor.logEpoch){
        this.onError(fault('legacy-epoch-divergence',`ZCode history epoch changed for ${sessionId}; the persisted transcript is kept as-is`),row);
        return state;
      }
      if(newest<=cursor.maxRowId&&page.atRevision===cursor.revision)return state;
      if(!row)throw fault('legacy-backfill-unavailable',`the ZCode history for "${sessionId}" has new rows but its catalog row is unavailable`);
      // The probe already holds this id's inflight slot, so resync through the slot-free body.
      return this.#sync(row,{signal});
    })().catch(async error=>{
      this.store.value.legacy[sessionId]={...state,error:error?.code??String(error),at:Date.now()};
      await this.store.save();
      throw error;
    }).finally(()=>this.inflight.delete(sessionId));
    this.inflight.set(sessionId,probe);
    return probe;
  }
  #resolveProbe(sessionId,task){
    this.inflight.set(sessionId,task.finally(()=>this.inflight.delete(sessionId)));
    return task;
  }
  async #ensurePlaceholder(row,persistedIds,{signal}={}){
    const id=row.sessionId;
    if(this.store.value.legacy[id]?.state!=='readable'){
      if(!persistedIds.has(id))await this.#createPlaceholder(row,{signal});
      if(this.store.value.legacy[id]?.state!=='readable')this.store.value.legacy[id]={state:'listed'};
      await this.store.save();
    }
  }
  /** Publish the placeholder as a live Session so list surfaces see its title projection and
   * workspace grouping while the transcript itself stays unread. prepare/enter/announce follow the
   * official create() shape; the detach handle is held so the write gate can hand the id over to
   * the factory on the first open. A prepare rejection means someone else (the factory or a live
   * agent) already owns the id: mark it opened and never announce it again this process.
   *
   * The announced header must be observation-compatible with the persisted placeholder header
   * (0.2.1 session-query rejects a logical source whose live and persisted headers disagree), so
   * the createdAt/cwd come from the persisted header when one exists. */
  #announce(row){
    const id=row.sessionId;
    if(this.disposed)return Promise.resolve();
    const existing=this.announcing.get(id);
    if(existing)return existing;
    const flight=(async()=>{
    const persisted=this.headers.get(id);
    const cwd=persisted?.cwd??row.cwd??row.workspacePath;
    const root=typeof cwd==='string'&&cwd.startsWith('/')?cwd:undefined;
    // Grouping is independent of session publication: the official boot restores persisted
    // sessions into the store itself (and the factory owns any opened id), so a rejected prepare
    // must never skip the workspace attachment. Resolve-or-create follows the host mirror's
    // normalizeRecord precedent; a workspace whose directory no longer exists cannot be created
    // (official registry stat check) and the row stays in the Ungrouped bucket.
    const attach=async()=>{
      if(!root||this.attached.has(id))return;
      try{
        let workspace=await this.workspaceRegistry?.resolveByPath?.(root);
        workspace??=await this.workspaceRegistry?.create?.(root);
        await workspace?.attachSession?.(id);
        if(workspace)this.attached.add(id);
      }catch{}
    };
    if(this.announced.has(id)){await attach();return}
    if(this.opened.has(id)){await attach();return}
    const createdAt=persisted?.createdAt??(typeof row.updatedAt==='number'?row.updatedAt:typeof row.createdAt==='number'?row.createdAt:Date.now());
    const activityAt=typeof row.updatedAt==='number'?row.updatedAt:createdAt;
    // The directory never opens a placeholder write handle here: the resume write gate (and the
    // factory's persistence.open(id,'write')) must not race a concurrent poll for the same id —
    // a lease collision would abort the resume and drop the row from every list surface. The
    // placeholder's persisted timestamps are already written correctly at creation.
    const seed=[];
    if(typeof row.title==='string'&&row.title.trim())seed.push({type:'session/title',data:{title:row.title,messageSeqs:[],source:{kind:'user'}},seq:0,time:activityAt});
    // Live-only visibility marker: 0.2.1 hides blank sessions ("no turn/start") from every list
    // surface, and only a turn event unblanks one. The announced in-memory seed therefore carries
    // an empty, immediately-closed marker turn; the PERSISTED placeholder stays title-only, so the
    // factory's cold read at the write gate sees a clean log and the synced transcript never shows
    // the marker. Times equal the task's real activity; turn 0 sits below the replay's turns.
    seed.push({type:'turn/start',data:{turn:0},seq:seed.length,time:activityAt,ignorable:true});
    seed.push({type:'turn/end',data:{turn:0,reason:{kind:'aborted',reason:{kind:'disposed'}}},seq:seed.length,time:activityAt,ignorable:true});
    try{
      const session=this.sessions.prepare(id,{meta:{createdAt,...(root?{cwd:root}:{})},seed});
      const detach=this.sessions.enter(session);
      this.sessions.announce?.(session);
      this.announced.set(id,{detach});
    }catch{
      // The factory, a live agent, or the official boot's own restore already owns this id:
      // never announce it again in this process, but still heal its grouping.
      this.opened.add(id);
    }
    await attach();
    })();
    this.announcing.set(id,flight.finally(()=>this.announcing.delete(id)));
    return flight;
  }
  #release(id){
    const entry=this.announced.get(id);
    if(!entry)return;
    this.announced.delete(id);
    this.opened.add(id);
    try{entry.detach?.()}catch{}
  }
  #ensure(row,{signal}={}){
    const id=row.sessionId;
    // No readable short-circuit: #probeFresh owns the dispatch for already-readable states, so
    // reaching this method always means the content must be (re)synced.
    const existing=this.inflight.get(id);
    if(existing)return existing;
    const task=this.#sync(row,{signal});
    this.inflight.set(id,task);
    return task;
  }
  /** The sync body without the inflight slot: a tail probe already holds the slot while it
   * decides to resync, so it must call this directly instead of #ensure (self-join deadlock). */
  #sync(row,{signal}={}){
    const id=row.sessionId;
    return (async()=>{
      for(const header of await this.listPersistedHeaders({signal}))this.headers.set(header.id,header);
      if(!this.headers.has(id))await this.#createPlaceholder(row,{signal});
      this.store.value.legacy[id]={state:'backfilling'};
      await this.store.save();
      const outcome=await this.#backfill(row,{signal});
      // `ensureReadable` always resolves to the stored state entry, so callers see a stable
      // shape ({state, appended, cursor}) for both the first sync and later freshness probes.
      const entry={state:'readable',appended:outcome.appended,cursor:outcome.cursor,workspace:row.workspacePath,at:Date.now()};
      this.store.value.legacy[id]=entry;
      await this.store.save();
      return entry;
    })().catch(async error=>{
      this.store.value.legacy[id]={state:'error',error:error?.code??String(error),at:Date.now()};
      await this.store.save();
      throw error;
    }).finally(()=>this.inflight.delete(id));
  }
  /** Header-only placeholder carrying the catalog title: list surfaces can show it while the
   * full transcript is still being fetched. No transcript event is written here. */
  /** Header-only placeholder carrying the catalog title: list surfaces can show it while the
   * full transcript is still being fetched. No transcript event is written here. The header
   * createdAt is set to the task's LAST ACTIVITY, not its creation: the official list rank is
   * `max(header.createdAt, lastPromptAt)` and a placeholder has no prompt events, so the header
   * time is both the ordering key and the row's displayed relative time — ZCode orders its own
   * list by last activity, and the sidebar must match. */
  async #createPlaceholder(row,{signal}={}){
    const activityAt=typeof row.updatedAt==='number'?row.updatedAt:typeof row.createdAt==='number'?row.createdAt:Date.now();
    const header={version:4,id:row.sessionId,createdAt:activityAt,isSeeded:false,delegationDepth:0,...(row.cwd??row.workspacePath?{cwd:row.cwd??row.workspacePath}:{})};
    const handle=await this.persistence.create(header,{signal});
    this.headers.set(header.id,header);
    try{
      if(typeof row.title==='string'&&row.title.trim())await handle.append([{type:'session/title',data:{title:row.title,messageSeqs:[],source:{kind:'user'}},seq:0,time:activityAt}]);
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
        attachments:this.attachments,input:()=>undefined,claim:()=>{},syncInbox:()=>{},history:true,
      });
      try{await translator.replay(windows)}finally{await translator.close()}
      const appended=readEvents(session).slice(existing.length);
      // Detached prepare adds a `session/end-seed` terminator at the seed boundary. Persist it at
      // most once (matching the create path), and never count it as backfill progress.
      const boundary=appended.findIndex(event=>event.type==='session/end-seed');
      const body=boundary<0?appended:[...appended.slice(0,boundary),...appended.slice(boundary+1)];
      const toAppend=boundary>=0&&!existing.some(event=>event.type==='session/end-seed')?[appended[boundary],...body]:body;
      // Retime against the FULL merged window: a multi-page history puts only the oldest page in
      // `windows.at(-1)`, and rows outside the retime set would keep the sync-moment timestamp.
      const merged=mergeEventWindows(windows);
      const retimed=retimeHistoryEvents(toAppend,merged.rows.window,merged.logEpoch,{sessionUpdatedAt:typeof row.updatedAt==='number'?row.updatedAt:undefined});
      if(retimed.length)await handle.append(retimed);
      const tail=pages[0];
      return {appended:body.length,cursor:{logEpoch:tail.atLogEpoch,revision:tail.atRevision,seq:tail.atSeq,maxRowId:Math.max(0,...tail.rows.map(item=>item.rowId))}};
    }finally{await handle.close()}
  }
  dispose(){
    this.disposed=true;
    clearInterval(this.timer);
    this.timer=null;
    this.inflight.clear();
    for(const id of [...this.announced.keys()])this.#release(id);
  }
}

/** Start the driver-owned catalog poll. Only the cheap list import runs here; content sync is
 * exclusively the resume write gate (`ensureReadable`), so an unopened session is never read. */
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
