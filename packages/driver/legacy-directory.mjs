import {ConversationEventTranslator,mergeEventWindows,parseWaitingMarkerText,buildWaitingNoteEvent} from './events.mjs';
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
    // The synthetic trigger message carries a synthetic rowKey with no row; its turnKey still
    // anchors it to the turn's own start instead of the import moment.
    if(time===undefined&&meta?.turnKey&&event.type!=='turn/end')time=turnStart(meta.turnKey);
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
/** Insert the turn-end waiting notes into a translated backfill batch: every ⟳ marker turn
 *  proves the turn before it ended resting on that work, and the note becomes that turn's FINAL
 *  assistant message, inserted right before its turn/end. Derived only from official rows (the
 *  marker's own synthesized text carries {kind,title}; the turn's Bash calls rejoin the raw
 *  command by description), so every re-import regenerates an identical event. Pure so the
 *  splice stays testable without the poller. */
export function spliceWaitingNotes(events){
  const out=[];let turn=0;
  const turnEndIndex=new Map(),turnEndTime=new Map(),lastStep=new Map(),markers=[],bashByDescription=new Map();
  for(const event of Array.isArray(events)?events:[]){
    if(event?.type==='turn/start'){const next=event.data?.turn;turn=Number.isSafeInteger(next)?next:turn+1;out.push(event);continue}
    const t=Number.isSafeInteger(event?.data?.turn)?event.data.turn:turn;
    if(event?.type==='step/start'&&Number.isSafeInteger(event.data?.step))lastStep.set(t,event.data.step);
    // user/message events carry id/role/source/content flat on data (assistant nests under .message).
    if(event?.type==='user/message'&&String(event.data?.id??'').includes('trigger:')){
      const text=(Array.isArray(event.data?.content)?event.data.content:[]).filter(block=>block?.type==='text').map(block=>block.text).join(' ');
      const parsed=parseWaitingMarkerText(text);
      if(parsed)markers.push({turn:t,work:parsed,epoch:epochOf(event.data.id)});
    }
    if(event?.type==='turn/end'){
      if(!turnEndIndex.has(t))turnEndIndex.set(t,out.length);
      if(!turnEndTime.has(t)&&typeof event.time==='number')turnEndTime.set(t,event.time);
    }
    if(event?.type==='tool/call'&&event.data?.name==='Bash'&&typeof event.data?.arguments==='string'){
      try{
        const input=JSON.parse(event.data.arguments);
        if(input&&typeof input.description==='string'&&typeof input.command==='string')bashByDescription.set(input.description,input.command.slice(0,200));
      }catch{/* non-JSON argument snapshot: no command to rejoin */}
    }
    out.push(event);
  }
  const byTurn=new Map();
  for(const marker of markers){
    const waiting=marker.turn-1;
    if(waiting<1||!turnEndIndex.has(waiting))continue;
    const works=byTurn.get(waiting)??[];
    if(!works.some(work=>work.title===marker.work.title))works.push({...marker.work,command:marker.work.kind==='bash'?bashByDescription.get(marker.work.title):undefined,epoch:marker.epoch});
    byTurn.set(waiting,works);
  }
  // The note is the waiting turn's own closing step (assistant messages must attach to an open
  // step, and every real step of a closed turn is closed), so three events are spliced: an
  // exclusive step start, the note, and the step end — all stamped with the turn end time.
  const inserts=[];
  for(const [t,works] of byTurn){
    const step=(lastStep.get(t)??0)+1,time=turnEndTime.get(t);
    const events=[
      {type:'step/start',time,data:{turn:t,step}},
      buildWaitingNoteEvent({turn:t,step,works,epoch:works[0]?.epoch,time}),
      {type:'step/end',time,data:{turn:t,step}},
    ];
    inserts.push([turnEndIndex.get(t),events]);
  }
  for(const [index,events] of inserts.sort((a,b)=>b[0]-a[0]))out.splice(index,0,...events);
  return out;
}
const epochOf=id=>{try{const parsed=JSON.parse(String(id));return Array.isArray(parsed)&&typeof parsed[0]==='string'?parsed[0]:'history'}catch{return 'history'}};

export class LegacyDirectory {
  rows=new Map();inflight=new Map();announced=new Map();announcing=new Map();opened=new Set();attached=new Set();headers=new Map();disposed=false;
  constructor({store,persistence,listCatalog,listPersistedHeaders,request,attachments=()=>undefined,sessions,workspaceRegistry,bindings,intervalMs=5000,onError=()=>{}}={}){
    Object.assign(this,{store,persistence,listCatalog,listPersistedHeaders,request,attachments,sessions,workspaceRegistry,bindings,intervalMs,onError});
  }
  status(sessionId){return this.store.value.legacy[sessionId]??null}
  /** True when the follow's opening observation must be routed through the resume gate.
   * Either the content is not synced yet, or a synced row's placeholder is still the announced
   * live source: observing it would anchor the client's cursor on the 3-event placeholder and
   * the factory's later announce would replay the whole transcript past that cursor as live
   * appends. Once the id is handed over (or a live agent owns it) the observation passes
   * through untouched. */
  requiresHandover(sessionId){
    return this.rows.has(sessionId)&&(this.store.value.legacy[sessionId]?.state!=='readable'||this.announced.has(sessionId));
  }
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
      // A row whose conversation a DSH-created session already owns is that session's official
      // side, not a legacy import: a zcode-id-keyed placeholder here is what rendered one ZCode
      // conversation as two sidebar rows. The owner must still exist (persisted or live) — once
      // its DSH record is deleted the conversation becomes importable again.
      const owner=this.bindings?.ownerOf(row.sessionId);
      if(owner&&(persistedIds.has(owner)||this.sessions?.get(owner)))continue;
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
    // The resume write gate runs before the factory prepares the session id, so the gate must
    // hand the id over — but ONLY once the content sync is done. The announced placeholder's
    // live-only marker turn is the sole non-blank observation while the persisted copy is still
    // title-only, and 0.2.1 blank-hides such sessions from every list surface: releasing before
    // the sync would drop the sidebar row for the whole (multi-second) backfill. A poll announce
    // in flight for the same id must land before the dispatch AND before the release: a late
    // enter would collide with the factory's prepare (or vice versa) and fail the open.
    const gate=(async()=>{
      const announcing=this.announcing.get(sessionId);
      if(announcing)await announcing.catch(()=>{});
      const state=this.store.value.legacy[sessionId];
      let task;
      if(state?.state==='readable')task=this.#probeFresh(sessionId,{signal});
      else{
        const inflight=this.inflight.get(sessionId);
        if(inflight)task=inflight;
        else{
          const row=this.rows.get(sessionId);
          if(!row){
            if(state)return Promise.reject(fault('legacy-backfill-unavailable',`the ZCode history for "${sessionId}" is not readable yet and its catalog row is unavailable`));
            return undefined;
          }
          task=this.#ensure(row,{signal});
        }
      }
      const result=await task;
      // The transcript is current and its persisted copy is non-blank, so withdrawing the live
      // placeholder can no longer blank-hide the row before the factory's announce lands. A
      // failed gate keeps the announcement untouched — the row stays listed and the next open
      // retries the sync.
      const late=this.announcing.get(sessionId);
      if(late)await late.catch(()=>{});
      this.#release(sessionId);
      return result;
    })();
    return gate;
  }
  /** One tail-page read decides whether the persisted history is already current. Fresh → cheap
   * return; newer rows → idempotent resync appends just the delta. A changed log epoch is either
   * a plain process restart (row ids stay stable; the fold's epoch re-key dedupes the overlap, so
   * a resync appends exactly the rows the restart-windowed live layer never delivered) or a real
   * rewrite (rewind/edit removed the persisted cursor's row): only the rewrite keeps the
   * persisted copy as-is and lets the live subscription layer carry the new epoch. */
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
        // The anchored read below decides restart vs rewrite: a fresh epoch alone proves
        // nothing because every ZCode process lifetime mints one while row ids stay stable.
        const anchored=await this.request('v4/conversation/rowsRange',{sessionId,limit:1,beforeRowId:cursor.maxRowId+1,...(workspace?{workspace:{workspacePath:workspace,workspaceKey:workspace}}:{})},{signal});
        if(!anchored||!Array.isArray(anchored.rows)||typeof anchored.atLogEpoch!=='string')throw fault('rows-range-result-invalid');
        if((anchored.rows[0]?.rowId??0)!==cursor.maxRowId){
          this.onError(fault('legacy-epoch-divergence',`ZCode history epoch changed for ${sessionId} and the persisted cursor row is gone; the persisted transcript is kept as-is`),row);
          return state;
        }
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
      const entry={state:'readable',appended:outcome.appended,cursor:outcome.cursor,workspace:row.workspacePath,at:Date.now(),...(outcome.active?{active:true}:{})};
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
      // Fold engine only: the translator needs a prepared Session to replay rows through the
      // projections, but the announced placeholder still holds the real id until the gate's
      // final release hands it to the factory — preparing with that id would collide with
      // "session already exists". A store-minted scratch id folds identically and is never
      // entered, announced or persisted; events carry no session identity of their own.
      const session=this.sessions.prepare(undefined,{meta:{cwd:row.cwd??row.workspacePath},seed:existing});
      const translator=new ConversationEventTranslator({
        session,dispatch:{emit(){}},conversation:historyAttachmentReader(this.request,id),
        attachments:this.attachments,input:()=>undefined,claim:()=>{},syncInbox:()=>{},history:true,
      });
      let active=false;
      try{
        await translator.replay(windows);
        // A conversation that was still running when its window was read keeps its final turn
        // OPEN here and in the persisted copy: the live layer closes it from the snapshot's
        // terminal state. Aborting it would show a live turn as "stopped" with trailing content.
        active=[...translator.turns.values()].some(turn=>!turn.closed);
        await translator.close({keepOpenTurns:active});
      }catch(error){await translator.close().catch(()=>{});throw error}
      const appended=readEvents(session).slice(existing.length);
      // Detached prepare adds a `session/end-seed` terminator at the seed boundary. Persist it at
      // most once (matching the create path), and never count it as backfill progress.
      const boundary=appended.findIndex(event=>event.type==='session/end-seed');
      const body=spliceWaitingNotes(boundary<0?appended:[...appended.slice(0,boundary),...appended.slice(boundary+1)]);
      const toAppend=boundary>=0&&!existing.some(event=>event.type==='session/end-seed')?[appended[boundary],...body]:body;
      // An excluded end-seed still consumed a seq inside the detached fold, so the body would
      // start one past the store's next slot; the official persistence validates contiguous
      // seq on append. Re-seq the batch from the store's true tail.
      const sequenced=toAppend.map((event,index)=>({...event,seq:existing.length+index}));
      // Retime against the FULL merged window: a multi-page history puts only the oldest page in
      // `windows.at(-1)`, and rows outside the retime set would keep the sync-moment timestamp.
      const merged=mergeEventWindows(windows);
      const retimed=retimeHistoryEvents(sequenced,merged.rows.window,merged.logEpoch,{sessionUpdatedAt:typeof row.updatedAt==='number'?row.updatedAt:undefined});
      if(retimed.length)await handle.append(retimed);
      const tail=pages[0];
      return {appended:body.length,active,cursor:{logEpoch:tail.atLogEpoch,revision:tail.atRevision,seq:tail.atSeq,maxRowId:Math.max(0,...tail.rows.map(item=>item.rowId))}};
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
