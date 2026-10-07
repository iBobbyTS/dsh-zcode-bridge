// Legacy migration: one-shot native archive, list-only catalog import at startup
// (placeholder→listed, SessionId=ZCode conversation id dedup), on-open content sync through the
// resume write gate (→readable with a tail cursor), tail-probe freshness on later opens, and the
// history replay/attachment legs. The import e2e uses the real rc.2 SessionStore + JSONL
// persistence; the archive/workspace registry surface is exercised through its documented
// archive(id) contract (external workspace registry assembly is a recorded gap).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {installDriver} from '../packages/driver/factory.mjs';
import {ConversationEventTranslator} from '../packages/driver/events.mjs';
import {driverFixture} from './helpers/zcode-driver-fixture.mjs';
import {collectHistoryPages,historySnapshots,historyAttachmentReader,HISTORY_PAGE_LIMIT} from '../packages/driver/history-backfill.mjs';
import {LegacyDirectory,installLegacyDirectory} from '../packages/driver/legacy-directory.mjs';
import {runNativeArchive} from '../packages/driver/legacy-archive.mjs';
import {DriverStateStore} from '../packages/driver/driver-state.mjs';
import {BINDING_EVENT} from '../packages/driver/factory.mjs';
import {row} from './helpers/zcode-runtime-fixture.mjs';

const npmRoot=process.env.DSH_DRIVER_NPM_NODE_MODULES??'/private/tmp/dsh-local-npm-verify/npm/node_modules';
const cohort=['cordis','dsh-session','dsh-session-persistence-jsonl','dsh-session-projection'];
const artifact=name=>join(npmRoot,'@deepseek-ai',name,'lib/index.js');
const available=cohort.every(name=>existsSync(artifact(name)));
const real={skip:available?false:'requires rc.2 npm artifacts; set DSH_DRIVER_NPM_NODE_MODULES'};

const memoryStore=()=>({value:{version:1,nativeArchive:null,legacy:{}},saves:0,async save(){this.saves++}});

function fakePersistence(){
  const records=new Map();
  const handle=record=>{
    let closed=false;
    return {header:record.header,get closed(){return closed},
      async append(events){if(closed)throw new Error('closed');for(const event of events)record.events.push({...structuredClone(event),seq:record.events.length})},
      async read(){return {events:structuredClone(record.events),eventState:'detached'}},
      async close(){closed=true},
    };
  };
  return {records,calls:{create:0,open:0},
    async create(header){this.calls.create++;if(records.has(header.id))throw new Error('exists');const record={header:structuredClone(header),events:[]};records.set(header.id,record);return handle(record)},
    async open(id){this.calls.open++;const record=records.get(id);if(!record)throw new Error('missing');return handle(record)},
  };
}

function fakeSessions(){
  const live=new Map();
  return {prepare(id,{meta={},seed=[]}={}){
    // The official SessionStore re-prepares the same id on every resume; a re-sync does too.
    const events=structuredClone(seed);
    const session={id,header:{version:4,id,createdAt:1,isSeeded:false,delegationDepth:0,...(meta.cwd?{cwd:meta.cwd}:{})},inheritedEventCount:0,
      get seq(){return events.length},eventAt:seq=>events[seq],snapshotEvents:()=>events,
      append(type,data){const event=Object.freeze({type,data:structuredClone(data),seq:events.length,time:1});events.push(event);return event}};
    live.set(id,session);return session;
  }};
}

/** Session-store double that records the placeholder publication lifecycle (enter/announce/detach). */
function announcingSessions({prepareThrows=[]}={}){
  const state={entered:new Map(),announced:new Set(),detached:new Set(),live:new Map()};
  return {state,
    prepare(id,{meta={},seed=[]}={}){
      if(prepareThrows.includes(id))throw new Error(`session "${id}" already exists`);
      const events=structuredClone(seed);
      const session={id,header:{createdAt:meta.createdAt,...(meta.cwd?{cwd:meta.cwd}:{})},get seq(){return events.length},eventAt:seq=>events[seq],snapshotEvents:()=>events,
        append(type,data){const event={type,data:structuredClone(data),seq:events.length,time:1};events.push(event);return event}};
      state.live.set(id,session);return session;
    },
    enter(session){state.entered.set(session.id,session);return ()=>{state.detached.add(session.id);state.entered.delete(session.id);state.announced.delete(session.id)}},
    announce(session){if(!state.entered.has(session.id))throw new Error('announce before enter');state.announced.add(session.id)},
  };
}

/** Workspace-registry double recording placeholder grouping attachments and create-if-missing. */
function trackingWorkspaceRegistry(){
  const state={attached:[],detached:[],created:[]};
  const workspaceFor=path=>({id:'ws-'+path,attachSession:async id=>state.attached.push({path,id}),detachSession:async id=>state.detached.push(id)});
  return {state,
    async resolveByPath(path){return state.created.includes(path)?workspaceFor(path):undefined},
    async create(path){state.created.push(path);return workspaceFor(path)}};
}

/** Serve `v4/conversation/rowsRange` newest-first pages over an ascending row list. */
function rowsRangeRequest(rows,{sessionId='zcode-old',logEpoch='epoch-1',revision=1,gate}={}){
  const calls=[];
  const request=async(method,params,options)=>{
    calls.push({method,params:structuredClone(params)});
    if(method!=='v4/conversation/rowsRange')throw new Error('unexpected '+method);
    if(gate){gate.onEnter?.();await gate.release.promise}
    const limit=params.limit,before=params.beforeRowId;
    const eligible=rows.filter(item=>before===undefined||item.rowId<before);
    const page=eligible.slice(Math.max(0,eligible.length-limit));
    return {rows:structuredClone(page),atSeq:rows.length,atRevision:revision,atLogEpoch:logEpoch,hasMore:eligible.length>page.length};
  };
  request.calls=calls;return request;
}

function historyRows(turns){
  const rows=[];let id=0;
  for(let turn=1;turn<=turns;turn++){
    const turnId='turn-'+turn;
    rows.push(row('turnHeader',id++,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId,sourceCommandId:'cmd-'+turn}));
    rows.push(row('userInput',id++,{origin:'realUser',text:'question-'+turn,turnId,sourceCommandId:'cmd-'+turn}));
    rows.push(row('assistantText',id++,{text:'answer-'+turn,state:'complete',model:'model_a',turnId,assistantResponseId:'resp-'+turn}));
  }
  return rows;
}

test('native archive is a one-shot snapshot: idempotent, interrupted-rerun safe, ZCode sessions excluded',async()=>{
  const store=memoryStore(),archived=[];
  const listSessionIds=async()=>['native-1','native-2','zcode-bound'];
  const readEvents=async id=>id==='zcode-bound'?[{type:BINDING_EVENT,data:{}}]:[{type:'turn/start',data:{turn:1}}];
  const archive=async id=>archived.push(id);
  const first=await runNativeArchive({store,listSessionIds,readEvents,archive});
  assert.deepEqual(first,{outcome:'migrated',archived:2});
  assert.deepEqual(archived,['native-1','native-2'],'the pre-existing ZCode-bound session is never archived');
  const again=await runNativeArchive({store,listSessionIds,readEvents,archive});
  assert.deepEqual(again,{outcome:'already-migrated',archived:2});
  assert.deepEqual(archived,['native-1','native-2'],'a rerun never re-archives');
  // Interrupted rerun: the frozen snapshot owns membership; a session created afterwards is untouched.
  const interrupted=memoryStore();
  interrupted.value.nativeArchive={snapshot:['native-1','native-2'],archived:['native-1'],done:false};
  const late=[];
  await runNativeArchive({store:interrupted,listSessionIds:async()=>['native-1','native-2','native-3'],readEvents:async()=>[],archive:async id=>late.push(id)});
  assert.deepEqual(late,['native-2'],'only the remaining snapshot member is archived');
  assert.equal(interrupted.value.nativeArchive.done,true);
});

test('the driver state store round-trips the archive snapshot and legacy state through a real file',async()=>{
  const root=await mkdtemp(join(tmpdir(),'zcode-driver-state-'));
  try{
    const store=new DriverStateStore(root);
    await store.load();
    await runNativeArchive({store,listSessionIds:async()=>['native-1'],readEvents:async()=>[],archive:async()=>{}});
    store.value.legacy['zcode-old']={state:'readable',appended:3};
    await store.save();
    const restored=new DriverStateStore(root);
    await restored.load();
    assert.deepEqual(restored.value.nativeArchive.snapshot,['native-1']);
    assert.equal(restored.value.nativeArchive.done,true);
    assert.deepEqual(restored.value.legacy['zcode-old'],{state:'readable',appended:3});
    assert.equal(JSON.parse(await readFile(store.file,'utf8')).version,1);
  }finally{await rm(root,{recursive:true,force:true})}
});

test('rowsRange paginates at the declared 200-row limit, merges cross-page rows once, and replays idempotently',async()=>{
  const rows=historyRows(90); // 270 rows -> two pages
  assert.ok(rows.length>HISTORY_PAGE_LIMIT);
  const request=rowsRangeRequest(rows);
  const pages=await collectHistoryPages(request,{sessionId:'zcode-old'});
  assert.equal(pages.length,2);
  assert.equal(pages[0].rows.length,HISTORY_PAGE_LIMIT);
  assert.equal(pages[0].hasMore,true);
  assert.equal(pages[1].hasMore,false);
  assert.equal(request.calls[0].params.beforeRowId,undefined,'the first page starts at the tail');
  assert.equal(typeof request.calls[1].params.beforeRowId,'number');
  const merged=await import('../packages/driver/events.mjs').then(m=>m.mergeEventWindows(historySnapshots('zcode-old',pages)));
  const ids=merged.rows.window.map(item=>item.rowId);
  assert.equal(ids.length,rows.length,'every row is merged exactly once');
  assert.equal(new Set(ids).size,rows.length);
  assert.deepEqual(ids,[...ids].sort((a,b)=>a-b),'merged rows keep ascending rowId order');
  // Replaying the same windows through a translator appends once; a second replay adds nothing.
  const events=[];
  const session={id:'zcode-old',get seq(){return events.length},eventAt:seq=>events[seq],snapshotEvents:()=>events,append(type,data){const event={type,data:structuredClone(data),seq:events.length,time:1};events.push(event);return event}};
  const translator=new ConversationEventTranslator({session,clock:()=>1,dispatch:{emit(){}}});
  await translator.replay(historySnapshots('zcode-old',pages));
  const first=events.length;
  assert.ok(first>0);
  await translator.replay(historySnapshots('zcode-old',pages));
  assert.equal(events.length,first,'an idempotent replay appends zero new events');
  await translator.close();
});

test('collectHistoryPages rejects a stalled cursor, over-limit page and malformed result instead of truncating',async()=>{
  await assert.rejects(collectHistoryPages(async()=>({rows:[row('assistantText',5,{})],hasMore:true,atSeq:1,atRevision:1,atLogEpoch:'e'}),{sessionId:'s'}),/rows-range-cursor/);
  await assert.rejects(collectHistoryPages(async()=>({rows:Array.from({length:HISTORY_PAGE_LIMIT+1},(_,i)=>row('assistantText',i,{})),hasMore:false,atSeq:1,atRevision:1,atLogEpoch:'e'}),{sessionId:'s'}),/rows-range-page-over-limit/);
  await assert.rejects(collectHistoryPages(async()=>({rows:[],hasMore:false,atSeq:1,atRevision:1}),{sessionId:'s'}),/rows-range-result-invalid/);
});

test('legacy directory: startup lists only (no history read); an open syncs content and stays fresh',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const rows=historyRows(3);
  const request=rowsRangeRequest(rows);
  const directory=new LegacyDirectory({store,persistence,sessions,request,
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'Old ZCode task'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  // Startup is a list import only: one placeholder, zero conversation reads.
  const listed=await directory.sync({});
  assert.deepEqual(listed,{listed:1,failed:[]});
  assert.equal(request.calls.length,0,'startup never reads conversation history');
  assert.equal(persistence.calls.create,1,'the placeholder is created once');
  assert.equal(directory.status('zcode-old').state,'listed');
  const record=persistence.records.get('zcode-old');
  assert.equal(record.header.id,'zcode-old','SessionId equals the ZCode conversation id');
  assert.deepEqual(record.events.map(event=>event.type),['session/title'],'a title-only placeholder');
  assert.equal(record.events[0].data.title,'Old ZCode task');
  // A later poll re-lists without re-creating or reading.
  await directory.sync({});
  assert.equal(persistence.calls.create,1);
  assert.equal(request.calls.length,0);
  // The persisted placeholder stays title-only: the visibility marker turn exists only in the
  // announced in-memory seed, so the factory's cold read at the gate sees a clean log.
  assert.deepEqual(record.events.map(event=>event.type),['session/title'],'persistence never gains the marker turn');
  // The first open (resume write gate) syncs the full content.
  const synced=await directory.ensureReadable('zcode-old');
  assert.equal(synced.state,'readable');
  assert.ok(persistence.records.get('zcode-old').events.some(event=>event.type==='user/message'&&event.data.content[0].text==='question-1'));
  assert.deepEqual(synced.cursor,{logEpoch:'epoch-1',revision:1,seq:9,maxRowId:8},'the tail cursor is recorded for later freshness probes');
  // Every later open probes the tail once; unchanged history is not re-read or re-opened.
  request.calls.length=0;
  const fresh=await directory.ensureReadable('zcode-old');
  assert.equal(fresh.state,'readable');
  assert.deepEqual(request.calls.map(call=>call.params.limit),[1],'exactly one tail probe with limit 1');
  assert.equal(persistence.calls.open,1,'a fresh probe never re-opens the store');
  assert.deepEqual(Object.keys(store.value.legacy),['zcode-old']);
});

test('listed placeholders are announced with their catalog title and workspace grouping; the write gate hands the id to the factory',async()=>{
  const store=memoryStore(),persistence=fakePersistence();
  const sessions=announcingSessions(),workspaces=trackingWorkspaceRegistry();
  const request=rowsRangeRequest(historyRows(1),{sessionId:'zcode-old'});
  const directory=new LegacyDirectory({store,persistence,sessions:sessions,workspaceRegistry:workspaces,request,
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/ws/one',title:'Catalog title'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  try{
    await directory.sync({});
    // The placeholder is a live session carrying the catalog title, grouped under its workspace.
    assert.deepEqual([...sessions.state.announced],['zcode-old']);
    assert.equal(sessions.state.live.get('zcode-old').eventAt(0).type,'session/title');
    assert.equal(sessions.state.live.get('zcode-old').eventAt(0).data.title,'Catalog title');
    assert.deepEqual(sessions.state.live.get('zcode-old').snapshotEvents().map(e=>e.type),['session/title','turn/start','turn/end'],
      'the announced seed carries the live-only visibility marker turn (0.2.1 blank-hiding)');
    assert.deepEqual(persistence.records.get('zcode-old').events.map(e=>e.type),['session/title'],
      'the persisted placeholder stays title-only');
    assert.equal(sessions.state.live.get('zcode-old').header.cwd,'/ws/one');
    assert.equal(sessions.state.live.get('zcode-old').header.createdAt,persistence.records.get('zcode-old').header.createdAt,
      'the announced header must be observation-compatible with the persisted placeholder header (0.2.1 session-query source check)');
    assert.deepEqual(workspaces.state.attached,[{path:'/ws/one',id:'zcode-old'}]);
    // The poll never announces twice.
    await directory.sync({});
    assert.deepEqual([...sessions.state.announced],['zcode-old']);
    // The resume write gate releases the announcement exactly once so the factory can
    // prepare the same id; a later poll treats the id as opened and stays silent.
    await directory.ensureReadable('zcode-old');
    assert.deepEqual([...sessions.state.detached],['zcode-old']);
    await directory.sync({});
    assert.deepEqual([...sessions.state.announced],[],'an opened id is never re-announced');
  }finally{await directory.dispose()}
});

test('a placeholder the session store already owns is never announced and never blocks listing',async()=>{
  const store=memoryStore(),persistence=fakePersistence();
  const sessions=announcingSessions({prepareThrows:['zcode-owned']});
  const request=rowsRangeRequest(historyRows(1),{sessionId:'zcode-owned'});
  const directory=new LegacyDirectory({store,persistence,sessions:sessions,workspaceRegistry:trackingWorkspaceRegistry(),request,
    listCatalog:async()=>[{sessionId:'zcode-owned',workspacePath:'/ws/one',title:'Owned elsewhere'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  try{
    const listed=await directory.sync({});
    assert.deepEqual(listed,{listed:1,failed:[]});
    assert.equal(sessions.state.announced.size,0,'a factory-owned id is never announced');
    assert.deepEqual([...directory.opened],['zcode-owned']);
  }finally{await directory.dispose()}
});

test('a re-open detects ZCode-side additions and appends only the delta',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const rows=historyRows(2);
  const request=rowsRangeRequest(rows);
  const directory=new LegacyDirectory({store,persistence,sessions,request,
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  await directory.sync({});
  await directory.ensureReadable('zcode-old');
  const userEvents=()=>persistence.records.get('zcode-old').events.filter(event=>event.type==='user/message');
  assert.equal(userEvents().length,2);
  // The ZCode side gains a third turn while the session is closed in DSH.
  const next=rows.at(-1).rowId+1;
  rows.push(row('turnHeader',next,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId:'turn-3',sourceCommandId:'cmd-3'}));
  rows.push(row('userInput',next+1,{origin:'realUser',text:'question-3',turnId:'turn-3',sourceCommandId:'cmd-3'}));
  rows.push(row('assistantText',next+2,{text:'answer-3',state:'complete',model:'model_a',turnId:'turn-3',assistantResponseId:'resp-3'}));
  request.calls.length=0;
  const updated=await directory.ensureReadable('zcode-old');
  assert.equal(updated.state,'readable');
  assert.deepEqual(request.calls.map(call=>call.params.limit).at(0),1,'the probe runs first');
  assert.ok(request.calls.length>1,'a changed tail triggers a history re-read');
  assert.equal(userEvents().length,3,'only the new turn is appended');
  assert.ok(userEvents().some(event=>event.data.content[0].text==='question-3'));
  assert.deepEqual(updated.cursor.maxRowId,next+2,'the cursor advances');
});

test('a changed ZCode log epoch keeps the persisted transcript instead of duplicating it',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const rows=historyRows(2);
  const holder={fn:rowsRangeRequest(rows)};
  const errors=[];
  const directory=new LegacyDirectory({store,persistence,sessions,request:(...args)=>holder.fn(...args),
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
    onError:error=>errors.push(error.code),
  });
  await directory.sync({});
  await directory.ensureReadable('zcode-old');
  const before=persistence.records.get('zcode-old').events.length;
  // ZCode rewrites its history (rewind/edit): the epoch changes under the same conversation.
  holder.fn=rowsRangeRequest(rows,{logEpoch:'epoch-2'});
  const kept=await directory.ensureReadable('zcode-old');
  assert.equal(kept.state,'readable');
  assert.equal(persistence.records.get('zcode-old').events.length,before,'a rewritten epoch never appends a duplicate transcript');
  assert.ok(errors.includes('legacy-epoch-divergence'),'the divergence is reported');
});

test('replayed events carry the ZCode rows real createdAt, so Completed-in durations survive',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const rows=[
    row('turnHeader',1,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId:'turn-1',sourceCommandId:'cmd-1',createdAt:1_000}),
    row('userInput',2,{origin:'realUser',text:'q-1',turnId:'turn-1',sourceCommandId:'cmd-1',createdAt:1_000}),
    row('assistantText',3,{text:'a-1',state:'complete',model:'m',turnId:'turn-1',assistantResponseId:'resp-1',createdAt:61_000}),
  ];
  const request=rowsRangeRequest(rows);
  const directory=new LegacyDirectory({store,persistence,sessions,request,
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  await directory.sync({});
  await directory.ensureReadable('zcode-old');
  const events=persistence.records.get('zcode-old').events;
  const start=events.find(event=>event.type==='turn/start'),end=events.find(event=>event.type==='turn/end');
  const user=events.find(event=>event.type==='user/message'),message=events.find(event=>event.type==='assistant/message');
  assert.equal(start.time,1_000);
  assert.equal(user.time,1_000);
  assert.equal(message.time,61_000);
  assert.equal(end.time,61_000,'turn/end closes at the terminal row time — the renderer computes 60s, not the sync moment');
});

test('turn duration ignores fork-lineage rows with stale createdAt and closes at the terminal updatedAt (ZCode parity)',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const stale=1_000,hour=3_600_000;
  const submitted=stale+11*hour,finalCreated=submitted+3*60_000+31_000,finalUpdated=submitted+3*60_000+55_000;
  const rows=[
    row('reasoning',10,{text:'carried from the fork lineage',turnId:'turn-1',assistantResponseId:'resp-1',createdAt:stale}),
    row('toolCall',11,{toolCallId:'call-1',toolName:'Bash',inputText:'{}',status:'success',output:{text:'ok'},turnId:'turn-1',createdAt:stale+20}),
    row('turnHeader',1,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId:'turn-1',sourceCommandId:'cmd-1',createdAt:submitted}),
    row('userInput',2,{origin:'realUser',text:'q-1',turnId:'turn-1',sourceCommandId:'cmd-1',createdAt:submitted}),
    // rowsRange rows carry only createdAt; the task-level finalization time arrives as the
    // catalog row's updatedAt.
    row('assistantText',3,{text:'a-1',state:'complete',model:'m',turnId:'turn-1',assistantResponseId:'resp-1',createdAt:finalCreated}),
  ];
  const request=rowsRangeRequest(rows);
  const directory=new LegacyDirectory({store,persistence,sessions,request,
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t',updatedAt:finalUpdated}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  await directory.sync({});
  await directory.ensureReadable('zcode-old');
  const events=persistence.records.get('zcode-old').events;
  const start=events.find(event=>event.type==='turn/start'),end=events.find(event=>event.type==='turn/end');
  const user=events.find(event=>event.type==='user/message');
  assert.equal(start.time,submitted,'turn/start anchors at the turnHeader row, never at a stale lineage row');
  assert.equal(user.time,submitted);
  assert.equal(end.time,finalUpdated,'the final turn closes at the catalog task updatedAt — the ZCode task-duration semantics');
  assert.equal(end.time-start.time,3*60_000+55_000,'the renderer computes 3m 55s');
});

test('ensureReadable awaits an in-flight content sync and reports failure explicitly',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const rows=historyRows(2);
  const entered=Promise.withResolvers(),release=Promise.withResolvers();
  const request=rowsRangeRequest(rows,{gate:{onEnter:entered.resolve,release}});
  const directory=new LegacyDirectory({store,persistence,sessions,request,
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  await directory.sync({});
  const syncing=directory.ensureReadable('zcode-old');
  await entered.promise;
  assert.equal(directory.status('zcode-old').state,'backfilling');
  const waiting=directory.ensureReadable('zcode-old');
  assert.equal(typeof waiting.then,'function');
  release.resolve();
  await syncing;
  await waiting;
  assert.equal(directory.status('zcode-old').state,'readable');
  assert.equal(await directory.ensureReadable('unknown-driver-session'),undefined,'ordinary driver sessions pass through');

  const failingPersistence=fakePersistence();
  const failing=new LegacyDirectory({store:memoryStore(),persistence:failingPersistence,sessions:fakeSessions(),
    request:async()=>{throw Object.assign(new Error('offline'),{code:'execution-unavailable'})},
    listCatalog:async()=>[{sessionId:'zcode-bad',workspacePath:'/workspace',title:'bad'}],
    listPersistedHeaders:async()=>[...failingPersistence.records.values()].map(r=>r.header),
  });
  await failing.sync({});
  await assert.rejects(failing.ensureReadable('zcode-bad'),error=>error.code==='execution-unavailable');
  assert.equal(failing.status('zcode-bad').state,'error','a content-sync failure is explicit, never a silent empty history');
  await assert.rejects(failing.ensureReadable('zcode-bad'),error=>error.code==='execution-unavailable');
});

test('a persisted non-readable legacy state is never released without a catalog row; a recovered sync unblocks it',async()=>{
  for(const state of ['backfilling','error']){
    const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
    store.value.legacy['zcode-old']={state};
    const directory=new LegacyDirectory({store,persistence,sessions,request:rowsRangeRequest(historyRows(1)),
      listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
      listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
    });
    // Restart window: the catalog row is not available yet (peer unavailable / sync not run).
    await assert.rejects(directory.ensureReadable('zcode-old'),error=>error.code==='legacy-backfill-unavailable',`${state} must not pass the gate`);
    assert.equal(persistence.calls.create,0,'no session is announced or created while blocked');
    // Catalog recovers: the list poll registers the row, then the write gate syncs the content.
    const listed=await directory.sync({});
    assert.deepEqual(listed.failed,[]);
    assert.equal(directory.status('zcode-old').state,'listed');
    const released=await directory.ensureReadable('zcode-old');
    assert.equal(released.state,'readable');
    assert.equal(typeof released.appended,'number');
    assert.ok(released.appended>0,'the history was actually synced after the catalog recovered');
  }
  // A never-seen id still passes through untouched.
  const store=memoryStore();
  const directory=new LegacyDirectory({store,persistence:fakePersistence(),sessions:fakeSessions(),request:rowsRangeRequest([]),listCatalog:async()=>[],listPersistedHeaders:async()=>[]});
  assert.equal(await directory.ensureReadable('ordinary-driver-session'),undefined);
});

test('a blocked legacy gate rejects the resume before any session is entered or announced',async()=>{
  const f=driverFixture(),driver=installDriver(f.ctx,f.deps);
  try{
    const created=await f.persistence.create({version:4,id:'legacy-blocked',createdAt:1,isSeeded:false,delegationDepth:0});await created.close();
    f.factory.setWriteGate(async id=>{throw Object.assign(new Error(`history for ${id} is not readable`),{code:'legacy-backfill-unavailable'})});
    await assert.rejects(f.factory.resume(f.owner,{resumeSessionId:'legacy-blocked'}),error=>error.code==='legacy-backfill-unavailable');
    assert.equal(f.sessions.size,0,'a blocked legacy session is never entered');
    assert.equal(f.agents.size,0,'a blocked legacy session is never announced');
    // Once the backfill completed (gate releases), the same resume succeeds.
    f.factory.setWriteGate(async()=>undefined);
    const handle=await f.factory.resume(f.owner,{resumeSessionId:'legacy-blocked'});
    assert.equal(handle.agent.id,'legacy-blocked');
  }finally{await driver.dispose()}
});

test('the installation barrier holds a resume until the legacy write gate is bound, and keeps rejecting after a failed init',async()=>{
  const f=driverFixture(),driver=installDriver(f.ctx,f.deps);
  try{
    const created=await f.persistence.create({version:4,id:'gate-1',createdAt:1,isSeeded:false,delegationDepth:0});await created.close();
    f.factory.claimWriteGate();
    assert.equal(f.factory.writeGateState(),'initializing');
    let settled=false;
    const pending=f.factory.resume(f.owner,{resumeSessionId:'gate-1'}).then(value=>{settled=true;return value},error=>{settled=true;throw error});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(settled,false,'a resume during the installation window waits instead of reading the store');
    assert.equal(f.sessions.size,0);
    assert.equal(f.agents.size,0);
    f.factory.setWriteGate(async()=>{throw Object.assign(new Error('not readable'),{code:'legacy-backfill-unavailable'})});
    await assert.rejects(pending,error=>error.code==='legacy-backfill-unavailable');
    assert.equal(f.sessions.size,0,'the delayed gate never let a placeholder publish');
    assert.equal(f.agents.size,0);
  }finally{await driver.dispose()}
  const failed=driverFixture(),failedDriver=installDriver(failed.ctx,failed.deps);
  try{
    const created=await failed.persistence.create({version:4,id:'gate-2',createdAt:1,isSeeded:false,delegationDepth:0});await created.close();
    failed.factory.claimWriteGate();
    failed.factory.failWriteGate(Object.assign(new Error('state load failed'),{code:'legacy-write-gate-unavailable'}));
    await assert.rejects(failed.factory.resume(failed.owner,{resumeSessionId:'gate-2'}),error=>error.code==='legacy-write-gate-unavailable');
    assert.equal(failed.sessions.size,0);
  }finally{await failedDriver.dispose()}
});

test('the installed catalog poll uses the resolved default period instead of an undefined sub-millisecond loop',async()=>{
  const realSetInterval=globalThis.setInterval,realClearInterval=globalThis.clearInterval;
  const captured=[];
  globalThis.setInterval=(fn,ms)=>{captured.push(ms);return {unref(){}}};
  globalThis.clearInterval=()=>{};
  try{
    const ctx={effect:fn=>{fn();return ()=>{}}};
    const deps={store:memoryStore(),persistence:fakePersistence(),sessions:fakeSessions(),request:async()=>{throw new Error('unused')},listCatalog:async()=>[],listPersistedHeaders:async()=>[]};
    const installed=installLegacyDirectory(ctx,deps);
    assert.equal(installed.intervalMs,5000,'the constructor default period is resolved on the directory');
    assert.deepEqual(captured,[5000],'the poll is armed at the resolved period, never at an undefined 1ms');
    installLegacyDirectory(ctx,{...deps,intervalMs:7000});
    assert.deepEqual(captured,[5000,7000]);
  }finally{globalThis.setInterval=realSetInterval;globalThis.clearInterval=realClearInterval}
});

test('catalogSnapshot carries the host-backed sharedTask.archived flag and the import skips archived tasks',async()=>{
  const {ZCodeRuntime}=await import('../packages/host/zcode-runtime.mjs');
  const hostBacked={listSessions:async()=>({sessions:[
    {address:{runtime:'zcode',authority:'host',workspace:'/w',sessionId:'archived-1'},title:'Archived',sharedTask:{archived:true}},
    {address:{runtime:'zcode',authority:'host',workspace:'/w',sessionId:'live-1'},title:'Live',sharedTask:{archived:false}},
  ]})};
  const rows=await ZCodeRuntime.prototype.catalogSnapshot.call({host:hostBacked});
  assert.deepEqual(rows.map(row=>[row.sessionId,row.archived??false]),[['archived-1',true],['live-1',false]],'archived is read from sharedTask.archived');
  const restricted={launcher:{read:async()=>({tasks:[{taskId:'legacy-archived',workspacePath:'/w',title:'A',archived:true},{taskId:'legacy-live',workspacePath:'/w',title:'L'}]})}};
  const restrictedRows=await ZCodeRuntime.prototype.catalogSnapshot.call({host:restricted});
  assert.deepEqual(restrictedRows.map(row=>[row.sessionId,row.archived??false]),[['legacy-archived',true],['legacy-live',false]],'the restricted-cli catalog keeps its top-level flag and a missing flag means not archived');
  // End to end through the real producer: an archived task is not imported/backfilled.
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const directory=new LegacyDirectory({store,persistence,sessions,request:rowsRangeRequest(historyRows(1)),
    listCatalog:()=>ZCodeRuntime.prototype.catalogSnapshot.call({host:hostBacked}),
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  const synced=await directory.sync({});
  assert.deepEqual(synced,{listed:1,failed:[]});
  assert.equal(persistence.records.has('archived-1'),false,'an archived official task is never imported');
  assert.equal(persistence.records.has('live-1'),true);
});

test('backfill history rows: rendered attachment blocks resolve through the DSH attachment store',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const bytes=Buffer.from('hello attachment');
  const attachments=[];
  const dshStore={async saveFileStream({name}){const ref={attachmentId:'att-'+name,name};attachments.push(ref);return ref},async saveImages(){throw new Error('unused')}};
  const rowWithAttachment={...row('userInput',2,{origin:'realUser',text:'with file',turnId:'turn-1',sourceCommandId:'cmd-1'}),attachments:[{ref:'official-ref-1',fileName:'notes.txt',mime:'text/plain',bytes:bytes.length}]};
  const header=row('turnHeader',1,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId:'turn-1',sourceCommandId:'cmd-1'});
  const assistant=row('assistantText',3,{text:'got it',state:'complete',model:'model_a',turnId:'turn-1',assistantResponseId:'resp-1'});
  const request=async(method,params)=>{
    if(method==='v4/conversation/rowsRange')return {rows:structuredClone([header,rowWithAttachment,assistant]),atSeq:3,atRevision:1,atLogEpoch:'epoch-1',hasMore:false};
    if(method==='v4/conversation/attachmentRead')return {dataBase64:bytes.toString('base64'),mediaType:'text/plain',totalBytes:bytes.length,nextOffset:null};
    throw new Error('unexpected '+method);
  };
  const directory=new LegacyDirectory({store,persistence,sessions,request,attachments:()=>dshStore,
    listCatalog:async()=>[{sessionId:'zcode-att',workspacePath:'/workspace',title:'att'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  await directory.sync({});
  await directory.ensureReadable('zcode-att');
  const user=persistence.records.get('zcode-att').events.find(event=>event.type==='user/message');
  assert.deepEqual(user.data.content.map(block=>block.type),['text','file']);
  assert.deepEqual(user.data.content[1].attachment,attachments[0],'the stored DSH attachment ref is resolvable');
  assert.equal(attachments[0].attachmentId,'att-notes.txt');
});

test('rowsRange is allowlisted on the parity/relay read channel and mapped to the official method',async()=>{
  const {requestParity,PARITY_CALLS}=await import('../packages/host/launcher/parity.mjs');
  const {createExecutionRelay,EXECUTION_CALLS}=await import('../packages/host/launcher/execution.mjs');
  assert.ok(PARITY_CALLS.includes('zcode-agent.conversationRowsRangeV4'));
  assert.ok(EXECUTION_CALLS.includes('zcode-agent.conversationRowsRangeV4'));
  const calls=[];
  const result=await requestParity({call:async(service,method,args)=>{calls.push({service,method,args});return {rows:[],hasMore:false,atSeq:0,atRevision:0,atLogEpoch:'e'}}},
    'v4/conversation/rowsRange',{sessionId:'zcode-1',limit:HISTORY_PAGE_LIMIT},{workspacePath:'/workspace',workspaceIdentity:'/workspace'});
  assert.equal(result.hasMore,false);
  assert.deepEqual(calls,[{service:'zcode-agent',method:'conversationRowsRangeV4',args:[{sessionId:'zcode-1',limit:HISTORY_PAGE_LIMIT,workspacePath:'/workspace',workspaceIdentity:'/workspace'}]}]);
  await assert.rejects(requestParity({call:async()=>({})},'v4/conversation/rowsRange',{sessionId:'s',limit:1,__zcodeTrustedV4Connection:{}},{workspacePath:'/w'}),error=>error.code==='parity-identity-denied');
  const relayed=[];
  const relay=createExecutionRelay({workspacePath:'/execution',workspaceIdentity:'/execution',emit(){},channel:{call:async(service,method,args)=>{relayed.push({service,method,args});return {rows:[],hasMore:false,atSeq:0,atRevision:0,atLogEpoch:'e'}},listen:()=>()=>{}}});
  await relay.request('v4/conversation/rowsRange',{sessionId:'zcode-1',limit:200});
  assert.deepEqual(relayed.map(item=>item.method),['conversationRowsRangeV4']);
  relay.dispose();
});

test('a resume is gated on the legacy backfill before any persistence read or session publication',async()=>{
  const f=driverFixture(),driver=installDriver(f.ctx,f.deps);
  try{
    const created=await f.persistence.create({version:4,id:'legacy-1',createdAt:1,isSeeded:false,delegationDepth:0});await created.close();
    f.factory.setWriteGate(async id=>{f.log.push('legacy-gate:'+id)});
    const handle=await f.factory.resume(f.owner,{resumeSessionId:'legacy-1'});
    assert.equal(handle.agent.id,'legacy-1');
    assert.ok(f.log.includes('legacy-gate:legacy-1'));
    assert.ok(f.log.indexOf('legacy-gate:legacy-1')<f.log.indexOf('persist-open'),'the backfill gate runs before the resume reads the store');
    assert.ok(f.log.indexOf('legacy-gate:legacy-1')<f.log.indexOf('session-enter'));
    f.log.length=0;
    const fresh=await f.factory.createAgent(f.owner,{sessionId:'fresh-1'});
    assert.equal(f.log.some(entry=>String(entry).startsWith('legacy-gate')),false,'a new driver session never runs the legacy gate');
    await fresh.dispose();
  }finally{await driver.dispose()}
});

test('real rc.2 JSONL persistence: a >200-row legacy ZCode session is fully backfilled and cold-read without an Agent',real,async()=>{
  const [{Context},{SessionStore},{default:SessionProjections},{default:JsonlPersistence}]=await Promise.all(['cordis','dsh-session','dsh-session-projection','dsh-session-persistence-jsonl'].map(name=>import(pathToFileURL(artifact(name)))));
  const root=await mkdtemp(join(tmpdir(),'zcode-driver-backfill-'));
  try{
    const ctx=new Context();
    new SessionStore(ctx);new SessionProjections(ctx);
    const persistence=new JsonlPersistence(ctx,{root,compression:'none'});
    const store=memoryStore();
    const rows=historyRows(80); // 240 rows > one 200-row tail window
    const request=rowsRangeRequest(rows);
    const directory=new LegacyDirectory({store,persistence,sessions:ctx.sessions,request,
      listCatalog:async()=>[{sessionId:'legacy-zcode-1',workspacePath:root,title:'Legacy',cwd:root}],
      listPersistedHeaders:async()=>(await persistence.list()).map(snapshot=>snapshot.header),
    });
    const listed=await directory.sync({});
    assert.deepEqual(listed,{listed:1,failed:[]});
    // The first open syncs the full 80-turn history through the write gate.
    const outcome=await directory.ensureReadable('legacy-zcode-1');
    assert.equal(outcome.state,'readable');
    assert.ok(outcome.appended>0);
    // Cold read through persistence only (no live Agent was ever announced/entered).
    assert.equal(ctx.sessions.get('legacy-zcode-1'),undefined);
    const handle=await persistence.open('legacy-zcode-1','read');
    const cold=await handle.read(0);
    await handle.close();
    const types=cold.events.map(event=>event.type);
    assert.equal(types[0],'session/title');
    assert.ok(types.filter(type=>type==='user/message').length===80,'all 80 turns were synced, not only the tail window');
    assert.ok(cold.events.some(event=>event.type==='user/message'&&event.data.content[0].text==='question-1'),'the first-window content is present after the sync');
    assert.ok(cold.events.some(event=>event.type==='assistant/message'&&event.data.message.content[0].text==='answer-80'));
    assert.deepEqual(cold.events.map(event=>event.seq),cold.events.map((_,index)=>index),'synced seq is gap-free');
    // A later open probes the tail and appends nothing new to the durable store.
    const before=cold.events.length;
    const fresh=await directory.ensureReadable('legacy-zcode-1');
    assert.equal(fresh.state,'readable');
    const handle2=await persistence.open('legacy-zcode-1','read');
    const cold2=await handle2.read(0);
    await handle2.close();
    assert.equal(cold2.events.length,before,'a fresh re-open appends nothing');
    await ctx.fiber.dispose();
  }finally{await rm(root,{recursive:true,force:true})}
});

test('legacyHistoryRequest establishes the launcher peer instead of failing before any driver session ran',async()=>{
  const calls=[];
  const makeTransport=({readyError}={})=>{
    const transport={peer:null,
      async ready(cwd,signal){
        calls.push(['ready',cwd,signal!==undefined]);
        if(readyError)throw readyError;
        transport.peer={async request(method,params,options){calls.push(['request',method,params,options?.signal!==undefined]);return {rows:[],hasMore:false,atSeq:0,atRevision:0,atLogEpoch:'epoch'}}};
      }};
    return transport;
  };
  const {legacyHistoryRequest}=await import('../packages/driver/index.mjs');
  // Before any driver session: no peer yet. The request must still succeed after ready().
  const request=legacyHistoryRequest(makeTransport());
  const result=await request('v4/conversation/rowsRange',{sessionId:'zcode-1'},{signal:AbortSignal.abort()});
  assert.deepEqual(result,{rows:[],hasMore:false,atSeq:0,atRevision:0,atLogEpoch:'epoch'});
  assert.deepEqual(calls,[['ready',undefined,true],['request','v4/conversation/rowsRange',{sessionId:'zcode-1'},true]],'ready runs first with the caller signal, then the peer request');
  // The directory's sync passes no options at all; ready() and the peer must tolerate that
  // (regression: a mandatory signal in ready() turned every backfill into a TypeError).
  const bare=legacyHistoryRequest(makeTransport());
  await bare('v4/conversation/rowsRange',{sessionId:'zcode-1'});
  // An unavailable launcher surfaces its own fault code for the directory's per-row error state.
  const failing=legacyHistoryRequest(makeTransport({readyError:Object.assign(new Error('execution-unavailable'),{code:'execution-unavailable'})}));
  await assert.rejects(failing('v4/conversation/rowsRange',{}),{code:'execution-unavailable'});
  // An aborted caller signal aborts during readiness, never touching a peer.
  const controller=new AbortController();controller.abort(new Error('stop'));
  const aborting=legacyHistoryRequest({async ready(cwd,signal){signal.throwIfAborted()}});
  await assert.rejects(aborting('v4/conversation/rowsRange',{}, {signal:controller.signal}),/stop/);
});
