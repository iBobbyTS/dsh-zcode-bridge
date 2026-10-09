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
import {installObservationGate} from '../packages/driver/observation-gate.mjs';
import {runNativeArchive} from '../packages/driver/legacy-archive.mjs';
import {DriverStateStore,ConversationBindingIndex} from '../packages/driver/driver-state.mjs';
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
      async append(events){if(closed)throw new Error('closed');for(const event of events){if(event.seq!==record.events.length)throw new Error(`append seq mismatch: expected ${record.events.length}, got ${event.seq}`);record.events.push(structuredClone(event))}},
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
  // The official persisted-log load validates the turn/step state machine ("step/start does
  // not match the open turn and next step"); appends through a detached fold do NOT. Enforce
  // the same shape here so a corrupt event order fails the test, not a later production load.
  const replayState=events=>{
    let openTurn=null,openStep=null;const nextStep=new Map();
    for(const event of events){const data=event.data??{};
      if(event.type==='turn/start'){openTurn=data.turn;openStep=null;nextStep.set(data.turn,1)}
      else if(event.type==='step/start')nextStep.set(data.turn,Math.max(nextStep.get(data.turn)??1,data.step+1));
      else if(event.type==='turn/end'&&openTurn===data.turn)openTurn=null;
    }
    return {openTurn,nextStep};
  };
  return {prepare(id,{meta={},seed=[]}={}){
    // The official SessionStore re-prepares the same id on every resume; a re-sync does too.
    const events=structuredClone(seed);
    let {openTurn,nextStep}=replayState(events);
    let openStep=null;
    const session={id,header:{version:4,id,createdAt:1,isSeeded:false,delegationDepth:0,...(meta.cwd?{cwd:meta.cwd}:{})},inheritedEventCount:0,
      get seq(){return events.length},eventAt:seq=>events[seq],snapshotEvents:()=>events,
      append(type,data){
        if(type==='turn/start'){if(openTurn!==null)throw new Error('turn/start with an open turn');openTurn=data.turn;openStep=null;nextStep.set(data.turn,1)}
        else if(type==='turn/end'){if(openTurn!==data.turn)throw new Error('turn/end does not close the open turn');openTurn=null;openStep=null}
        else if(type==='step/start'){
          if(openTurn!==data.turn)throw new Error(`step/start outside the open turn (${data.turn} vs ${openTurn})`);
          const expected=nextStep.get(data.turn)??1;
          if(data.step!==expected)throw new Error(`step/start does not match the open turn and next step (expected ${expected}, got ${data.step})`);
          nextStep.set(data.turn,data.step+1);openStep=data.step;
        }
        else if(type==='step/end'){if(openTurn!==data.turn||openStep!==data.step)throw new Error(`step/end does not close the open step (${data.turn}/${data.step} vs ${openTurn}/${openStep})`);openStep=null}
        else if(type==='assistant/message'||type==='tool/call'||type==='tool/result'){
          if(openTurn!==data.turn||openStep!==data.step)throw new Error(`${type} does not match the open turn and step (${data.turn}/${data.step} vs ${openTurn}/${openStep})`);
        }
        const event=Object.freeze({type,data:structuredClone(data),seq:events.length,time:1});events.push(event);return event}};
    live.set(id,session);return session;
  },
  // The official SessionStore exposes a live lookup; the binding skip consults it for owners
  // whose record has not reached persistence yet.
  get(id){return live.get(id)},
  };
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

test('conversation binding index: buffers before the store attaches, persists through it, and never records identity',async()=>{
  const index=new ConversationBindingIndex();
  // Pre-attach writes answer from memory — the factory is callable before the legacy wiring loads the state file.
  index.bind('zcode-conv-A','session-own-A');
  assert.equal(index.ownerOf('zcode-conv-A'),'session-own-A');
  // Identity is the imported-session case: the record itself keys the zcode id, no owner to index.
  index.bind('zcode-identity','zcode-identity');
  assert.equal(index.ownerOf('zcode-identity'),undefined);
  const root=await mkdtemp(join(tmpdir(),'binding-index-'));
  try{
    const store=new DriverStateStore(root);
    await store.load();
    index.attach(store);
    await store.writing;
    const onDisk=JSON.parse(await readFile(store.file,'utf8'));
    assert.deepEqual(onDisk.bindings,{'zcode-conv-A':'session-own-A'},'buffered entries flush on attach; identity never lands');
    // A later instance resolves owners from the persisted state alone, and rebinding is deduped.
    const fresh=new ConversationBindingIndex();
    fresh.attach(store);
    assert.equal(fresh.ownerOf('zcode-conv-A'),'session-own-A');
    const store2=new DriverStateStore(root);
    await store2.load();
    assert.equal(Object.keys(store2.value.bindings).length,1,'a deduped bind writes nothing new');
    await store.writing;
  }finally{await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:20})}
});

test('legacy directory: catalog rows a DSH session already owns never import; a deleted owner becomes importable again',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const index=new ConversationBindingIndex();
  await persistence.create({version:4,id:'session-persisted-owner',createdAt:2,isSeeded:false,delegationDepth:0,cwd:'/w'});
  index.bind('zcode-owned-persisted','session-persisted-owner');
  const liveOwner=sessions.prepare('session-live-owner',{meta:{cwd:'/w'}});
  index.bind('zcode-owned-live','session-live-owner');
  const request=rowsRangeRequest(historyRows(1));
  const directory=new LegacyDirectory({store,persistence,sessions,request,bindings:index,
    listCatalog:async()=>[
      {sessionId:'zcode-owned-persisted',workspacePath:'/ws',title:'Owned persisted'},
      {sessionId:'zcode-owned-live',workspacePath:'/ws',title:'Owned live'},
      {sessionId:'zcode-free',workspacePath:'/ws',title:'Free'},
    ],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  const listed=await directory.sync({});
  // Only the unowned row imports: a zcode-id-keyed placeholder for an owned conversation is
  // what rendered one official conversation as two sidebar rows.
  assert.equal(listed.listed,1);
  assert.equal(persistence.calls.create,2,'the test\'s own owner pre-create plus the one unowned row');
  assert.ok(!persistence.records.has('zcode-owned-persisted'),'a persisted owner blocks the import');
  assert.ok(!persistence.records.has('zcode-owned-live'),'a live owner blocks the import');
  assert.equal(directory.status('zcode-owned-persisted'),null);
  assert.deepEqual(Object.keys(store.value.legacy),['zcode-free']);
  // Deleting the DSH owner releases its conversation back to the catalog import.
  persistence.records.delete('session-persisted-owner');
  await directory.sync({});
  assert.ok(persistence.records.has('zcode-owned-persisted'),'a deleted owner re-imports');
  assert.equal(directory.status('zcode-owned-persisted').state,'listed');
});

test('driver create: the DSH agent preset never persists into the session header and the conversation binding is recorded',async()=>{
  const f=driverFixture();
  const index=new ConversationBindingIndex();
  const driver=installDriver(f.ctx,{...f.deps,bindings:index});
  try{
    const {agent}=await f.factory.createAgent(f.owner,{sessionId:'preset-strip-1',meta:{cwd:'/w',agentPreset:'standard'}});
    // The preset composes DSH-native agents; a driver session's composition is owned by the
    // official ZCode conversation, so the badge projection must never see a preset id.
    assert.equal(agent.session.header.agentPreset,undefined);
    assert.equal(f.stored.get('preset-strip-1').header.agentPreset,undefined);
    assert.equal(index.ownerOf('zcode-conv-Y'),'preset-strip-1','the created conversation is bound before it can surface in the catalog');
    assert.equal(index.workspaceOf('zcode-conv-Y'),'/w');
  }finally{await driver.dispose()}
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

test('the write gate keeps the placeholder announced for the whole content sync and through a failed sync',async()=>{
  const store=memoryStore(),persistence=fakePersistence();
  const sessions=announcingSessions();
  const entered=Promise.withResolvers(),release=Promise.withResolvers();
  const request=rowsRangeRequest(historyRows(2),{gate:{onEnter:entered.resolve,release}});
  const directory=new LegacyDirectory({store,persistence,sessions,workspaceRegistry:trackingWorkspaceRegistry(),request,
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/ws/one',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  try{
    await directory.sync({});
    const syncing=directory.ensureReadable('zcode-old');
    await entered.promise;
    // 0.2.1 blank-hides a session whose only non-blank observation is the live placeholder
    // (persisted copy still title-only): withdrawing it before the transcript is current would
    // drop the sidebar row for the whole multi-second backfill.
    assert.ok(sessions.state.announced.has('zcode-old'),'the row stays visible while the backfill runs');
    assert.equal(sessions.state.detached.size,0,'nothing is handed over mid-sync');
    release.resolve();
    await syncing;
    assert.deepEqual([...sessions.state.detached],['zcode-old'],'the id is released to the factory only after the sync resolves');

    const failingPersistence=fakePersistence(),failingSessions=announcingSessions();
    const failing=new LegacyDirectory({store:memoryStore(),persistence:failingPersistence,sessions:failingSessions,
      workspaceRegistry:trackingWorkspaceRegistry(),
      request:async()=>{throw Object.assign(new Error('offline'),{code:'execution-unavailable'})},
      listCatalog:async()=>[{sessionId:'zcode-bad',workspacePath:'/ws/one',title:'bad'}],
      listPersistedHeaders:async()=>[...failingPersistence.records.values()].map(r=>r.header),
    });
    try{
      await failing.sync({});
      await assert.rejects(failing.ensureReadable('zcode-bad'),error=>error.code==='execution-unavailable');
      assert.ok(failingSessions.state.announced.has('zcode-bad'),'a failed gate keeps the announcement — the row stays listed');
      assert.equal(failingSessions.state.detached.size,0,'no handover happened, so no restore round-trip is needed');
    }finally{await failing.dispose()}
  }finally{await directory.dispose()}
});

test('the follow observation gate holds the chat snapshot until the content sync resolves',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const entered=Promise.withResolvers(),release=Promise.withResolvers();
  const request=rowsRangeRequest(historyRows(1),{gate:{onEnter:entered.resolve,release}});
  const directory=new LegacyDirectory({store,persistence,sessions,request,
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  await directory.sync({});
  assert.equal(directory.requiresHandover('zcode-old'),true,'a listed row is pending');
  const order=[];
  const service={async observeSession(id,options){order.push('observe');return {observed:id,options}}};
  const restore=installObservationGate({sessionQuery:service,directory});
  try{
    const follow=service.observeSession('zcode-old',{projectionMode:'all'});
    await entered.promise;
    await Promise.resolve();
    assert.deepEqual(order,[],'the snapshot waits for the backfill — the client never anchors its cursor on the 3-event placeholder');
    release.resolve();
    const settled=await follow;
    assert.deepEqual(order,['observe'],'exactly one underlying observation, after the sync');
    assert.equal(settled.observed,'zcode-old');
    assert.equal(directory.requiresHandover('zcode-old'),false,'a handed-over row passes straight through');
    // Non-follow shapes and foreign ids never wait.
    await service.observeSession('zcode-old',{projectionMode:'none'});
    await service.observeSession('driver-session',{projectionMode:'all'});
    assert.deepEqual(order,['observe','observe','observe']);
  }finally{
    restore();
    await directory.dispose();
  }
});

test('a failing content sync fails the follow observation; the patch restores the service cleanly',async()=>{
  const failingPersistence=fakePersistence();
  const failing=new LegacyDirectory({store:memoryStore(),persistence:failingPersistence,sessions:fakeSessions(),
    request:async()=>{throw Object.assign(new Error('offline'),{code:'execution-unavailable'})},
    listCatalog:async()=>[{sessionId:'zcode-bad',workspacePath:'/workspace',title:'bad'}],
    listPersistedHeaders:async()=>[...failingPersistence.records.values()].map(r=>r.header),
  });
  await failing.sync({});
  const original=async()=>({ok:true});
  const service={observeSession:original};
  const restore=installObservationGate({sessionQuery:service,directory:failing});
  const second=installObservationGate({sessionQuery:service,directory:failing});
  try{
    await assert.rejects(service.observeSession('zcode-bad',{projectionMode:'all'}),error=>error.code==='execution-unavailable');
    assert.deepEqual(await service.observeSession('zcode-bad',{projectionMode:'none'}),{ok:true},'non-follow shapes never wait');
  }finally{
    restore();second();
    await failing.dispose();
  }
  assert.equal(service.observeSession,original,'unload restores the raw service method');
});

test('a readable row whose placeholder was re-announced after a restart is handed over before the snapshot',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=announcingSessions();
  const request=rowsRangeRequest(historyRows(1));
  const directory=new LegacyDirectory({store,persistence,sessions,workspaceRegistry:trackingWorkspaceRegistry(),request,
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/ws/one',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  try{
    await directory.sync({});
    await directory.ensureReadable('zcode-old');
    assert.equal(directory.requiresHandover('zcode-old'),false);
    // A process restart rebuilds the in-memory catalog and re-announces every placeholder
    // while the transcript stays readable: observing that 3-event live source would
    // re-anchor the client and replay the whole history as appends, so the follow must
    // still go through the gate.
    directory.opened.clear();directory.rows.clear();
    await directory.sync({});
    assert.equal(directory.requiresHandover('zcode-old'),true,'an announced placeholder needs the handover even when readable');
    const before=request.calls.length;
    const service={async observeSession(id){return {observed:id}}};
    const restore=installObservationGate({sessionQuery:service,directory});
    const observation=await service.observeSession('zcode-old',{projectionMode:'all'});
    assert.deepEqual(observation,{observed:'zcode-old'});
    assert.equal(directory.requiresHandover('zcode-old'),false,'the gate handed the id over');
    const probes=request.calls.slice(before).filter(call=>call.params.limit===1);
    assert.ok(probes.length>=1,'readable rows hand over through the cheap tail probe, not a resync');
    restore();
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

test('a rewritten ZCode log epoch (persisted cursor row gone) keeps the transcript instead of duplicating it',async()=>{
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
  const cursor=store.value.legacy['zcode-old'].cursor;
  // ZCode rewrites its history (rewind/edit): a new epoch AND the persisted cursor's row is gone.
  holder.fn=rowsRangeRequest(historyRows(1),{logEpoch:'epoch-2'});
  const kept=await directory.ensureReadable('zcode-old');
  assert.equal(kept.state,'readable');
  assert.equal(persistence.records.get('zcode-old').events.length,before,'a rewritten epoch never appends a duplicate transcript');
  assert.ok(errors.includes('legacy-epoch-divergence'),'the divergence is reported');
  const anchored=holder.fn.calls.find(call=>call.params.beforeRowId===cursor.maxRowId+1&&call.params.limit===1);
  assert.ok(anchored,'the continuity read anchors at the persisted cursor before giving up');
});

test('a restart-minted log epoch with intact rows resyncs and appends only the delta',async()=>{
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
  const userEvents=()=>persistence.records.get('zcode-old').events.filter(event=>event.type==='user/message');
  assert.equal(userEvents().length,2);
  const cursor=store.value.legacy['zcode-old'].cursor;
  // A ZCode restart mints a fresh epoch while row ids stay stable, and new turns accrue while
  // the session stays closed. The follow layer's restart-windowed anchor cannot cover the gap
  // between the persisted cursor and the newest rows, so the probe must resync; the fold's
  // epoch re-key then dedupes the already-persisted overlap and appends exactly the delta.
  const next=rows.at(-1).rowId+1;
  rows.push(row('turnHeader',next,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId:'turn-3',sourceCommandId:'cmd-3'}));
  rows.push(row('userInput',next+1,{origin:'realUser',text:'question-3',turnId:'turn-3',sourceCommandId:'cmd-3'}));
  rows.push(row('assistantText',next+2,{text:'answer-3',state:'complete',model:'model_a',turnId:'turn-3',assistantResponseId:'resp-3'}));
  holder.fn=rowsRangeRequest(rows,{logEpoch:'epoch-2'});
  const updated=await directory.ensureReadable('zcode-old');
  assert.equal(updated.state,'readable');
  const anchored=holder.fn.calls.find(call=>call.params.beforeRowId===cursor.maxRowId+1&&call.params.limit===1);
  assert.ok(anchored,'the continuity read anchors at the persisted cursor before resyncing');
  assert.equal(userEvents().length,3,'only the new turn is appended under the new epoch');
  assert.ok(userEvents().some(event=>event.data.content[0].text==='question-3'));
  assert.deepEqual(updated.cursor,{logEpoch:'epoch-2',revision:1,seq:rows.length,maxRowId:next+2},'the cursor adopts the new epoch');
  assert.ok(!errors.includes('legacy-epoch-divergence'),'an intact restart is not a divergence');
});

test('a mere restart with intact rows and no new content stays a cheap probe',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const rows=historyRows(2);
  const holder={fn:rowsRangeRequest(rows)};
  const directory=new LegacyDirectory({store,persistence,sessions,request:(...args)=>holder.fn(...args),
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  await directory.sync({});
  await directory.ensureReadable('zcode-old');
  const before=persistence.records.get('zcode-old').events.length;
  holder.fn=rowsRangeRequest(rows,{logEpoch:'epoch-2'});
  const kept=await directory.ensureReadable('zcode-old');
  assert.equal(kept.state,'readable');
  assert.equal(persistence.records.get('zcode-old').events.length,before,'nothing is appended');
  assert.ok(holder.fn.calls.every(call=>call.params.limit===1),'only limit-1 probe and continuity reads run');
  assert.equal(persistence.calls.open,1,'no store re-open: the resync never ran');
});

test('a settled mid-stream partial whose durable text was replaced resyncs instead of failing',async()=>{  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  // A turn whose header is terminal while its text row still reads 'streaming': the settle
  // freezes the partial ("answer-…") into the transcript — the shape the old build produced
  // for every still-running conversation.
  const rows=[
    row('turnHeader',1,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId:'turn-1',sourceCommandId:'cmd-1'}),
    row('userInput',2,{origin:'realUser',text:'q-1',turnId:'turn-1',sourceCommandId:'cmd-1'}),
    row('assistantText',3,{text:'partial answer',state:'streaming',model:'model_a',turnId:'turn-1',assistantResponseId:'resp-1'}),
  ];
  const holder={fn:rowsRangeRequest(rows)};
  const directory=new LegacyDirectory({store,persistence,sessions,request:(...args)=>holder.fn(...args),
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  await directory.sync({});
  await directory.ensureReadable('zcode-old');
  const partial=persistence.records.get('zcode-old').events.find(event=>event.type==='assistant/message');
  assert.equal(partial.data.message.content[0].text,'partial answer','the mid-stream partial was settled');
  // Later the durable text REPLACES the partial (not a prefix extension) and new turns accrue
  // under a restart-minted epoch: the resync must complete and import the delta around it.
  rows[2].text='replacement answer';rows[2].state='complete';
  rows.push(row('turnHeader',4,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId:'turn-2',sourceCommandId:'cmd-2'}));
  rows.push(row('userInput',5,{origin:'realUser',text:'q-2',turnId:'turn-2',sourceCommandId:'cmd-2'}));
  rows.push(row('assistantText',6,{text:'a-2',state:'complete',model:'model_a',turnId:'turn-2',assistantResponseId:'resp-2'}));
  holder.fn=rowsRangeRequest(rows,{logEpoch:'epoch-2'});
  const updated=await directory.ensureReadable('zcode-old');
  assert.equal(updated.state,'readable','a replaced partial never fails the resync');
  const userEvents=()=>persistence.records.get('zcode-old').events.filter(event=>event.type==='user/message');
  assert.equal(userEvents().length,2,'the new turn is appended');
  assert.deepEqual(updated.cursor,{logEpoch:'epoch-2',revision:1,seq:rows.length,maxRowId:6});
  // The re-baselined divergence does not repeat on the next probe.
  const settled=persistence.records.get('zcode-old').events.length;
  const again=await directory.ensureReadable('zcode-old');
  assert.equal(again.state,'readable');
  assert.equal(persistence.records.get('zcode-old').events.length,settled,'a clean re-probe appends nothing');
});

test('late rows for a turn the persisted log already closed re-open under a fresh turn number',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const rows=[
    row('turnHeader',1,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId:'turn-1',sourceCommandId:'cmd-1'}),
    row('userInput',2,{origin:'realUser',text:'q-1',turnId:'turn-1',sourceCommandId:'cmd-1'}),
    row('assistantText',3,{text:'partial answer',state:'streaming',model:'model_a',turnId:'turn-1',assistantResponseId:'resp-1'}),
  ];
  const holder={fn:rowsRangeRequest(rows)};
  const directory=new LegacyDirectory({store,persistence,sessions,request:(...args)=>holder.fn(...args),
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  await directory.sync({});
  await directory.ensureReadable('zcode-old');
  // The turn closed on a settled mid-stream partial (the old-build damage shape); later reads
  // EXTEND that partial. Appending the suffix to the closed turn corrupts the official
  // session format, so the fold re-opens the turn and lands the late rows under a new number.
  rows[2].text='partial answer continued';rows[2].state='complete';
  rows.push(row('turnHeader',4,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId:'turn-2',sourceCommandId:'cmd-2'}));
  rows.push(row('userInput',5,{origin:'realUser',text:'q-2',turnId:'turn-2',sourceCommandId:'cmd-2'}));
  rows.push(row('assistantText',6,{text:'a-2',state:'complete',model:'model_a',turnId:'turn-2',assistantResponseId:'resp-2'}));
  holder.fn=rowsRangeRequest(rows,{logEpoch:'epoch-2'});
  const updated=await directory.ensureReadable('zcode-old');
  assert.equal(updated.state,'readable','the format-validating fold never corrupts the log');
  const events=persistence.records.get('zcode-old').events;
  const text=event=>((event.data.message?.content??[]).map(block=>block.text??'').join('')).trim();
  assert.ok(events.some(event=>event.type==='assistant/message'&&text(event)==='continued'),'the extended suffix lands');
  assert.ok(events.filter(event=>event.type==='user/message').some(event=>event.data.content[0].text==='q-2'),'the new turn lands');
  const starts=events.filter(event=>event.type==='turn/start');
  assert.equal(starts.length,3,'the late rows arrive under their own re-opened turn number');
});

test('non-text row drift on a closed turn never re-opens it',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const rows=historyRows(1);
  const holder={fn:rowsRangeRequest(rows)};
  const directory=new LegacyDirectory({store,persistence,sessions,request:(...args)=>holder.fn(...args),
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  await directory.sync({});
  await directory.ensureReadable('zcode-old');
  // Between reads ZCode touched a non-text field on an already-delivered row (visibility,
  // display metadata, timings). Nothing new can be delivered, so the closed turn must stay
  // exactly as persisted — only the genuinely new turn opens.
  rows[2].visibility='hidden';
  const next=rows.at(-1).rowId+1;
  rows.push(row('turnHeader',next,{origin:'userInput',state:'completedSuccess',startedAt:0,turnId:'turn-2',sourceCommandId:'cmd-2'}));
  rows.push(row('userInput',next+1,{origin:'realUser',text:'q-2',turnId:'turn-2',sourceCommandId:'cmd-2'}));
  rows.push(row('assistantText',next+2,{text:'a-2',state:'complete',model:'model_a',turnId:'turn-2',assistantResponseId:'resp-2'}));
  holder.fn=rowsRangeRequest(rows,{logEpoch:'epoch-2'});
  const updated=await directory.ensureReadable('zcode-old');
  assert.equal(updated.state,'readable');
  const events=persistence.records.get('zcode-old').events;
  assert.equal(events.filter(event=>event.type==='turn/start').length,2,'only the new turn opens');
  assert.equal(events.filter(event=>event.type==='turn/end').length,2);
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

test('a conversation still running at backfill time keeps its final turn open and marks the entry active',async()=>{
  const store=memoryStore(),persistence=fakePersistence(),sessions=fakeSessions();
  const rows=historyRows(2);
  rows.findLast(row=>row.kind==='turnHeader').state='running';
  rows.findLast(row=>row.kind==='assistantText').state='streaming';
  const directory=new LegacyDirectory({store,persistence,sessions,request:rowsRangeRequest(rows),
    listCatalog:async()=>[{sessionId:'zcode-old',workspacePath:'/workspace',title:'t'}],
    listPersistedHeaders:async()=>[...persistence.records.values()].map(r=>r.header),
  });
  try{
    await directory.sync({});
    const entry=await directory.ensureReadable('zcode-old');
    assert.equal(entry.active,true,'the gate reports the live conversation');
    const events=persistence.records.get('zcode-old').events;
    const ends=events.filter(event=>event.type==='turn/end');
    assert.equal(ends.length,1,'only the settled first turn closes');
    assert.equal(ends[0].data.reason.kind,'completed');
    assert.notEqual(events.at(-1).type,'turn/end','the running final turn stays open for the live layer to close from its terminal state');
    // The settled control: a fully completed history never reports active.
    const donePersistence=fakePersistence(),doneRows=historyRows(2);
    const done=new LegacyDirectory({store:memoryStore(),persistence:donePersistence,sessions:fakeSessions(),request:rowsRangeRequest(doneRows),
      listCatalog:async()=>[{sessionId:'zcode-done',workspacePath:'/workspace',title:'d'}],
      listPersistedHeaders:async()=>[...donePersistence.records.values()].map(r=>r.header),
    });
    await done.sync({});
    const doneEntry=await done.ensureReadable('zcode-done');
    assert.equal(doneEntry.active,undefined);
    await done.dispose();
  }finally{await directory.dispose()}
});

test('an active legacy conversation skips the interrupted-turn closers on resume',async()=>{
  const f=driverFixture(),driver=installDriver(f.ctx,f.deps);
  try{
    const created=await f.persistence.create({version:4,id:'legacy-live',createdAt:1,isSeeded:false,delegationDepth:0});
    await created.append([
      {type:'session/title',data:{title:'live',messageSeqs:[],source:{kind:'user'}},seq:0,time:1},
      {type:'turn/start',data:{turn:1},seq:1,time:2},
      {type:'user/message',data:{id:'u1',role:'user',source:{kind:'user'},content:[{type:'text',text:'hi'}]},seq:2,time:2},
    ]);
    await created.close();
    // Without the active flag an open final turn demands the official closers contract.
    f.factory.setWriteGate(async()=>({}));
    await assert.rejects(f.factory.resume(f.owner,{resumeSessionId:'legacy-live'}),/interruptedTurnClosers/);
    // An active conversation keeps its open turn: the live layer closes it from the snapshot.
    f.factory.setWriteGate(async()=>({active:true}));
    const handle=await f.factory.resume(f.owner,{resumeSessionId:'legacy-live'});
    try{
      const session=handle.agent.session;
      const events=Array.from({length:session.seq},(_,seq)=>session.eventAt(seq));
      assert.equal(events.some(event=>event.type==='turn/end'),false,'no aborted closer is appended for a live turn');
    }finally{await handle.dispose()}
  }finally{await driver.dispose()}
});

test('S02 AC5: mixed binding shapes load tolerantly, retain workspaces and round-trip union writes',async()=>{
  const {mkdir,writeFile}=await import('node:fs/promises');
  const root=await mkdtemp(join(tmpdir(),'binding-union-'));
  try{
    const store=new DriverStateStore(root);await mkdir(join(root,'zcode-bridge'));
    await writeFile(store.file,JSON.stringify({version:1,executionWorkspace:'/stable',bindings:{old:'dsh-old',new:{sessionId:'dsh-new',workspace:'/new'},missing:{sessionId:'dsh-missing'},bad:10,badObject:{sessionId:8},null:null,array:['dsh']}}));
    await store.load();const index=new ConversationBindingIndex();index.attach(store);
    assert.equal(index.ownerOf('old'),'dsh-old');assert.equal(index.workspaceOf('old'),undefined);
    assert.equal(index.ownerOf('new'),'dsh-new');assert.equal(index.workspaceOf('new'),'/new');assert.equal(index.ownerOf('missing'),'dsh-missing');
    for(const id of ['bad','badObject','null','array']){assert.equal(index.ownerOf(id),undefined);assert.equal(id in store.value.bindings,false)}
    index.bind('fresh','dsh-fresh','/fresh');index.bind('plain','dsh-plain');index.bind('old','dsh-old','/old');await store.writing;
    const fresh=new DriverStateStore(root);await fresh.load();assert.equal(fresh.value.executionWorkspace,'/stable');
    assert.deepEqual(fresh.value.bindings.fresh,{sessionId:'dsh-fresh',workspace:'/fresh'});assert.equal(fresh.value.bindings.plain,'dsh-plain');assert.deepEqual(fresh.value.bindings.old,{sessionId:'dsh-old',workspace:'/old'});
  }finally{await rm(root,{recursive:true,force:true})}
});

function selfPool(){
  const peers=new Map(),lookups=[];let disposed=0;
  return {peers,lookups,get disposed(){return disposed},dispose(){disposed++},async forWorkspace(workspace){
    lookups.push(workspace);let peer=peers.get(workspace);
    if(!peer||peer.closed){peer={workspacePath:workspace,connectionId:`connection:${workspace}`,closed:false,holds:0,releases:0,readies:0,calls:[],notifications:new Set(),closures:new Set(),
      hold(){this.holds++},releaseHold(){this.holds--;this.releases++},async ready({signal}={}){signal?.throwIfAborted();this.readies++},
      onNotification(fn){this.notifications.add(fn);return ()=>this.notifications.delete(fn)},onClosed(fn){this.closures.add(fn);return ()=>this.closures.delete(fn)},
      close(reason){this.closeReason=reason;this.closed=true},async request(method,params,options){this.calls.push({method,params,options});if(method==='v4/command')return {commandId:params.commandId,status:'accepted',revisionAtDecision:0,result:{type:'createSession',sessionId:'created'}};return {rows:[]}}};peers.set(workspace,peer)}return peer;
  }};
}

test('S02 AC6: self-managed create, resume, conversation holds and legacy history route by workspace',async()=>{
  const {DriverTransport,legacyHistoryRequest}=await import('../packages/driver/index.mjs');
  const root=await mkdtemp(join(tmpdir(),'self-transport-')),store=new DriverStateStore(root);
  try{
    const pool=selfPool();store.value.executionWorkspace=join(root,'default');await store.save();
    const bindings=new ConversationBindingIndex();const host={pool,driverStateStore:store,driverBindings:bindings,status:{sessionAuthority:'self'},connect(){throw new Error('no launcher gating')}};
    const transport=new DriverTransport(host),signal=new AbortController().signal;
    assert.equal(await transport.ready(undefined,signal),join(root,'default'));bindings.attach(store);
    assert.equal(await transport.create({signal,firstInput:{text:'hello'},modelSelection:{providerId:'p',modelId:'m'},mode:'build'}),'created');
    const peer=pool.peers.get(join(root,'default')),envelope=peer.calls[0].params;
    assert.equal(envelope.clientId,'dsh-zcode-driver');assert.equal(envelope.type,'createSession');assert.equal(envelope.sessionId,null);
    assert.deepEqual(envelope.workspace,{workspacePath:join(root,'default'),workspaceKey:join(root,'default')});
    assert.deepEqual(envelope.payload,{workspaceId:join(root,'default'),firstInput:{text:'hello',modelSelection:{providerId:'p',modelId:'m'},mode:'build'}});
    await assert.rejects(transport.create({cwd:'/wrong',signal}),{code:'driver-workspace-mismatch'});
    const workspace=join(root,'project');bindings.bind('other','dsh-other',workspace);
    assert.equal(await transport.resume({zcodeConversationId:'other',signal}),'other');
    const other=pool.peers.get(workspace);assert.equal(other.readies,0,'resume resolves the facade without a project handshake');assert.equal(other.holds,1,'resume protects its prepared facade');
    const one=transport.conversation({zcodeConversationId:'other',cwd:workspace}),two=transport.conversation({zcodeConversationId:'other',cwd:workspace});
    assert.equal(one.peer,other);assert.equal(one.connectionId,other.connectionId);assert.equal(one.clientMode,'desktop-continuous');assert.equal(one.runnable,true);assert.equal(one.managementAllowed,true);assert.equal(other.holds,2);
    await one.cancel();await one.cancel();assert.equal(other.holds,1);assert.equal(other.releases,1);
    // A recoverable connection loss is not a terminal conversation close.
    for(const notify of other.closures)notify('execution-disconnected');assert.equal(other.holds,1);
    const history=legacyHistoryRequest(transport),params={workspace:{workspacePath:workspace,workspaceKey:workspace},sessionId:'other'};
    await history('v4/conversation/rowsRange',params,{signal});assert.deepEqual(other.calls.at(-1),{method:'v4/conversation/rowsRange',params,options:{signal}});
    await history('v4/conversation/rowsRange',{topic:'conversation/other'});assert.equal(other.calls.at(-1).params.topic,'conversation/other');
    const before=peer.calls.length;await history('v4/conversation/rowsRange',{sessionId:'unbound'});assert.equal(peer.calls.length,before+1);
    await transport.requestFor('fixture/read',{workspace:{workspacePath:workspace,workspaceKey:workspace}});assert.equal(other.calls.at(-1).method,'fixture/read');
    transport.dispose();assert.equal(other.holds,0);assert.equal(other.releases,2);assert.equal(other.closeReason,'transport-disposed');assert.equal(peer.closeReason,'transport-disposed');assert.equal(pool.disposed,0);assert.equal(transport.facades.size,0);
    await two.cancel();assert.equal(other.releases,2,'late close never releases twice');
  }finally{await store.writing;await rm(root,{recursive:true,force:true})}
});

test('S02 default execution workspace is lazily created once and persisted before legacy loading',async()=>{
  const {DriverTransport}=await import('../packages/driver/transport.mjs');const {stat}=await import('node:fs/promises');
  const root=await mkdtemp(join(tmpdir(),'self-default-')),previous=process.env.DSH_HOME;process.env.DSH_HOME=root;
  try{
    const store=new DriverStateStore(root),pool=selfPool(),transport=new DriverTransport({pool,driverStateStore:store});
    const expected=join(root,'zcode-execution');assert.deepEqual(await Promise.all([transport.ready(),transport.ready()]),[expected,expected]);
    assert.equal((await stat(expected)).isDirectory(),true);assert.equal((await store.ensureLoaded()).executionWorkspace,expected);
    const saved=new DriverStateStore(root);await saved.load();assert.equal(saved.value.executionWorkspace,expected);
    process.env.DSH_HOME=join(root,'different');const next=new DriverTransport({pool:selfPool(),driverStateStore:saved});assert.equal(await next.ready(),expected);
    transport.dispose();next.dispose();
    const failing={value:{executionWorkspace:expected},async load(){},async save(){throw new Error('read-only state')}};
    delete failing.value.executionWorkspace;process.env.DSH_HOME=root;
    const degraded=new DriverTransport({pool:selfPool(),driverStateStore:failing});assert.equal(await degraded.ready(),expected);degraded.dispose();
  }finally{if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;await rm(root,{recursive:true,force:true})}
});

test('S02 AC7: BridgeHost self catalog is late-bound, host-shaped, address-filtered and honestly unbound',async()=>{
  const {BridgeHost}=await import('../packages/host/runtime.mjs');const {ZCodeRuntime}=await import('../packages/host/zcode-runtime.mjs');
  const host=new BridgeHost({authorityMode:'self-managed'});await host.connect();
  try{
    const unbound=await host.listSessions();assert.deepEqual(unbound.sessions,[]);assert.equal(unbound.catalog.complete,false);assert.equal(unbound.catalog.diagnostic,'self-catalog-unbound');
    const authority=host.status.sessionAuthority,rows=[{sessionId:'one',workspacePath:'/a',workspaceIdentity:'/a',authority,title:'A',createdAt:1,updatedAt:3,archived:true},{sessionId:'one',workspacePath:'/b',workspaceIdentity:'/b',authority,title:'B',updatedAt:4}];
    host.selfCatalogProvider=async()=>rows;const catalog=await host.listSessions();
    assert.equal(catalog.catalog.complete,true);assert.equal(catalog.catalog.multiWorkspace,true);assert.equal(catalog.catalog.readOnly,true);assert.equal(catalog.management.rename,false);assert.equal(catalog.management.delete,false);assert.deepEqual(catalog.scope,{authority,workspace:'official-task-catalog'});
    assert.deepEqual(catalog.sessions[0],{address:{runtime:'zcode',authority,workspace:'/a',sessionId:'one'},title:'A',cwd:'/a',running:undefined,sharedTask:{createdAt:1,lastActivityAt:3,archived:true}});
    assert.deepEqual(await ZCodeRuntime.prototype.catalogSnapshot.call({host}),rows);
    const result=await host.listSessions({address:{runtime:'zcode',authority,workspace:'/b',sessionId:'one'}});assert.equal(result.sessions.length,1);assert.equal(result.sessions[0].title,'B');
    assert.equal((await host.listSessions({address:{runtime:'zcode',authority,workspace:'/b',sessionId:'missing'}})).sessions.length,0);
    await assert.rejects(host.listSessions({address:{runtime:'zcode',authority:'wrong',workspace:'/a',sessionId:'one'}}),{code:'source-address-mismatch'});
  }finally{await host.dispose()}
});

test('S02 AC8: self-managed runtime start exposes catalog without registering, recovering or refreshing mirrors',async()=>{
  const {ZCodeRuntime,installZCodeRuntime}=await import('../packages/host/zcode-runtime.mjs');
  let loaded=0,listed=0;const store={records:new Map([['old',{id:'old',officialId:'old',workspace:'/a'}]]),async load(){loaded++},writing:Promise.resolve()};
  const host={authorityMode:'self-managed',pool:selfPool(),async connect(){},status:{sessionAuthority:'self'},async listSessions(){listed++;return {sessions:[]}}};
  const runtime=new ZCodeRuntime({},host,{store,discoverModels:async()=>[]});
  runtime.register=runtime.recoverAll=runtime.refreshDirectory=()=>{throw new Error('mirror path invoked')};
  await runtime.start();assert.equal(loaded,1);assert.equal(listed,0);assert.equal(runtime.directoryTimer,undefined);assert.equal(runtime.offRecovery,undefined);
  assert.equal((await runtime.bridgeSettings({catalogSync:true})).connection,'self-managed');assert.equal(runtime.directoryTimer,undefined);
  await assert.rejects(runtime.ensurePeer(),{code:'execution-unavailable'});await runtime.dispose();
  const installed=await installZCodeRuntime({},host,{store,createScope:()=>{},agentEvents:{},discoverModels:async()=>[]});
  assert.equal(typeof host.zcodeCatalog,'function');assert.deepEqual(await host.zcodeCatalog(),[]);assert.equal(listed,1);assert.equal(installed.agents.size,0);assert.equal(installed.directoryTimer,undefined);await installed.dispose();
});


test('S02 factory resume records the persisted session workspace in the union binding',async()=>{
  const f=driverFixture(),bindings=new ConversationBindingIndex(),driver=installDriver(f.ctx,{...f.deps,bindings});
  try{
    const handle=await f.persistence.create({version:4,id:'dsh-resumed',cwd:'/session-project',createdAt:1,isSeeded:false,delegationDepth:0});
    await handle.append([{type:BINDING_EVENT,seq:0,time:1,ignorable:true,data:{sessionId:'dsh-resumed',zcodeConversationId:'official-resumed'}}]);await handle.close();
    const resumed=await f.factory.resume(f.owner,{resumeSessionId:'dsh-resumed'});
    assert.equal(bindings.ownerOf('official-resumed'),'dsh-resumed');assert.equal(bindings.workspaceOf('official-resumed'),'/session-project');await resumed.dispose();
  }finally{await driver.dispose()}
});

test('S02 repair: default workspace mkdir failure is a semantic unsent fault and can be retried',async()=>{
  const {DriverTransport}=await import('../packages/driver/transport.mjs');const {writeFile}=await import('node:fs/promises');
  const root=await mkdtemp(join(tmpdir(),'self-workspace-fault-'));
  try{
    const file=join(root,'file');await writeFile(file,'not a directory');
    const store={value:{executionWorkspace:join(file,'child')},async load(){},async save(){}},pool=selfPool();
    const transport=new DriverTransport({pool,driverStateStore:store});
    await assert.rejects(transport.ready(),{code:'workspace-unavailable',sent:false});assert.deepEqual(pool.lookups,[]);
    store.value.executionWorkspace=join(root,'valid');assert.equal(await transport.ready(),join(root,'valid'));transport.dispose();
  }finally{await rm(root,{recursive:true,force:true})}
});

test('S02 wave3: resume retries replace one outstanding unit and dispose releases unused units exactly once',async()=>{
  const {DriverTransport}=await import('../packages/driver/transport.mjs');
  const root=await mkdtemp(join(tmpdir(),'self-resume-holds-'));
  try{
    const pool=selfPool(),workspace=join(root,'project'),store={value:{executionWorkspace:join(root,'default')},async load(){},async save(){}};
    const transport=new DriverTransport({pool,driverStateStore:store,status:{sessionAuthority:'self'}});
    await Promise.all([transport.resume({zcodeConversationId:'same',cwd:workspace}),transport.resume({zcodeConversationId:'same',cwd:workspace})]);
    const peer=pool.peers.get(workspace);assert.equal(peer.holds,1);assert.equal(peer.readies,0);assert.equal(pool.peers.get(join(root,'default')).holds,0);
    const one=transport.conversation({zcodeConversationId:'same',cwd:workspace});assert.equal(peer.holds,1);
    await transport.resume({zcodeConversationId:'same',cwd:workspace});await transport.resume({zcodeConversationId:'same',cwd:workspace});
    assert.equal(peer.holds,2,'one active conversation and one unconsumed retry unit');
    const two=transport.conversation({zcodeConversationId:'same',cwd:workspace});assert.equal(peer.holds,2);await one.cancel();assert.equal(peer.holds,1);
    await transport.resume({zcodeConversationId:'unused',cwd:workspace});await transport.resume({zcodeConversationId:'unused',cwd:workspace});assert.equal(peer.holds,2);
    const releases=peer.releases;transport.dispose();transport.dispose();assert.equal(peer.holds,0);assert.equal(peer.releases,releases+2);assert.equal(pool.disposed,0);
    await two.cancel();assert.equal(peer.releases,releases+2,'a late close never releases a transferred unit twice');
  }finally{await rm(root,{recursive:true,force:true})}
});

test('S02 repair: driver apply binds the shared catalog provider before a self-managed pool exists',async()=>{
  const {apply}=await import('../packages/driver/index.mjs');const {BridgeHost}=await import('../packages/host/runtime.mjs');
  const root=await mkdtemp(join(tmpdir(),'self-driver-boot-')),previous=process.env.DSH_HOME;process.env.DSH_HOME=root;
  const f=driverFixture(),host=new BridgeHost({authorityMode:'self-managed'});f.ctx.zcodeBridgeHost=host;
  // Isolate the apply wiring from optional service assembly while retaining the real factory seam.
  f.registry.setFactory({});
  try{
    await apply(f.ctx);assert.equal(host.pool,undefined);assert.equal(host.status.connected,false);
    assert.equal(typeof host.selfCatalogProvider,'function');assert.ok(host.driverStateStore instanceof DriverStateStore);assert.ok(host.driverBindings instanceof ConversationBindingIndex);
    assert.equal(host.driverStateStore.file,join(root,'zcode-bridge','driver-state.json'));
  }finally{await f.ctx.unload();await host.dispose();if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;await rm(root,{recursive:true,force:true})}
});

test('S02 wave2: bare attachment sessionId routes by binding or prior explicit history workspace with frozen precedence',async()=>{
  const {DriverTransport,legacyHistoryRequest}=await import('../packages/driver/index.mjs');
  const root=await mkdtemp(join(tmpdir(),'self-attachment-route-'));
  try{
    const pool=selfPool(),bindings=new ConversationBindingIndex(),workspace=join(root,'project'),other=join(root,'other'),store={value:{executionWorkspace:join(root,'default')},async load(){},async save(){}};
    bindings.bind('bound','dsh-bound',workspace);bindings.bind('topic','dsh-topic',other);
    const transport=new DriverTransport({pool,driverBindings:bindings,driverStateStore:store,status:{sessionAuthority:'self'}}),history=legacyHistoryRequest(transport);
    await history('v4/conversation/attachmentRead',{sessionId:'bound',offset:0});
    assert.equal(pool.peers.get(workspace)?.calls.at(-1).method,'v4/conversation/attachmentRead');assert.equal(pool.peers.get(join(root,'default')).calls.length,0);
    const params={sessionId:'unbound',workspace:{workspacePath:other,workspaceKey:other}};
    await history('v4/conversation/rowsRange',params);
    await history('v4/conversation/attachmentRead',{sessionId:'unbound'});assert.equal(pool.peers.get(other).calls.at(-1).method,'v4/conversation/attachmentRead');
    await history('v4/conversation/rowsRange',{topic:'conversation/topic-only',workspace:{workspacePath:workspace,workspaceKey:workspace}});
    await history('v4/conversation/attachmentRead',{sessionId:'topic-only'});assert.equal(pool.peers.get(workspace).calls.at(-1).params.sessionId,'topic-only');
    // Bindings outrank cached workspace, and topic binding outranks bare-session binding.
    bindings.bind('unbound','dsh-unbound',workspace);
    await history('v4/conversation/attachmentRead',{sessionId:'unbound'});assert.equal(pool.peers.get(workspace).calls.at(-1).params.sessionId,'unbound');
    await history('v4/conversation/attachmentRead',{topic:'conversation/topic',sessionId:'bound'});assert.equal(pool.peers.get(other).calls.at(-1).params.sessionId,'bound');
    await history('v4/conversation/attachmentRead',{topic:'conversation/topic',sessionId:'bound',workspace:{workspacePath:workspace,workspaceKey:workspace}});assert.equal(pool.peers.get(workspace).calls.at(-1).params.topic,'conversation/topic');
    await history('v4/conversation/attachmentRead',{topic:'conversation/missing-topic',sessionId:'bound'});assert.equal(pool.peers.get(workspace).calls.at(-1).params.sessionId,'bound');
    await transport.resume({zcodeConversationId:'resumed-unbound',cwd:other});
    await history('v4/conversation/attachmentRead',{sessionId:'resumed-unbound'});assert.equal(pool.peers.get(other).calls.at(-1).params.sessionId,'resumed-unbound');
    await history('v4/conversation/attachmentRead',{sessionId:'unknown'});assert.equal(pool.peers.get(join(root,'default')).calls.at(-1).params.sessionId,'unknown');
    transport.dispose();for(const peer of pool.peers.values())assert.equal(peer.holds,0);
  }finally{await rm(root,{recursive:true,force:true})}
});


test('S02 wave3: failed creates release their own preparation unit for every ACK failure path',async t=>{
  const {DriverTransport}=await import('../packages/driver/transport.mjs');
  const root=await mkdtemp(join(tmpdir(),'self-create-failures-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const failures=[
    ['rejected',p=>({commandId:p.commandId,status:'rejected',revisionAtDecision:0,reasonCode:'fixture-denied'})],
    ['exception',()=>{throw Object.assign(new Error('fixture-not-sent'),{code:'fixture-not-sent',sent:false})}],
    ['malformed',()=>({invalid:true})],
    ['receipt mismatch',()=>({commandId:'other',status:'accepted',revisionAtDecision:0,result:{type:'createSession',sessionId:'id'}})],
    ['missing create result',p=>({commandId:p.commandId,status:'accepted',revisionAtDecision:0})],
  ];
  for(const [name,response] of failures)await t.test(name,async()=>{
    const pool=selfPool(),workspace=join(root,name),store={value:{executionWorkspace:workspace},async load(){},async save(){}};
    const transport=new DriverTransport({pool,driverStateStore:store,status:{sessionAuthority:'self'}});
    try{
      await transport.ready();const peer=pool.peers.get(workspace),request=peer.request.bind(peer);
      peer.request=(method,params,options)=>method==='v4/command'?response(params):request(method,params,options);
      await assert.rejects(transport.create({}));assert.equal(peer.holds,0);assert.equal(peer.releases,1);assert.equal(transport.prepared.size,0);assert.equal(transport.holders.size,0);
    }finally{transport.dispose()}
  });
});

test('S02 wave3: ready and routed reads acquire no units while a direct conversation owns a fresh hold',async()=>{
  const {DriverTransport}=await import('../packages/driver/transport.mjs');const root=await mkdtemp(join(tmpdir(),'self-no-handoff-'));
  try{
    const pool=selfPool(),workspace=join(root,'default'),store={value:{executionWorkspace:workspace},async load(){},async save(){}};
    const transport=new DriverTransport({pool,driverStateStore:store,status:{sessionAuthority:'self'}});
    await transport.ready();await transport.ready();await transport.requestFor('fixture/read',{sessionId:'direct'});
    const peer=pool.peers.get(workspace);assert.equal(peer.holds,0);assert.equal(transport.prepared.size,0);
    const conversation=transport.conversation({zcodeConversationId:'direct'});assert.equal(peer.holds,1);assert.equal(transport.prepared.size,0);
    await conversation.cancel();await conversation.cancel();assert.equal(peer.holds,0);assert.equal(peer.releases,1);transport.dispose();assert.equal(pool.disposed,0);
  }finally{await rm(root,{recursive:true,force:true})}
});

test('S02 wave4: create/resume units follow operation abort, detach at handoff, and release once on disposal',async t=>{
  const {DriverTransport}=await import('../packages/driver/transport.mjs');const {getEventListeners}=await import('node:events');
  const root=await mkdtemp(join(tmpdir(),'self-operation-holds-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const method of ['create','resume'])await t.test(method,async()=>{
    const pool=selfPool(),workspace=join(root,method),store={value:{executionWorkspace:workspace},async load(){},async save(){}};
    const transport=new DriverTransport({pool,driverStateStore:store,status:{sessionAuthority:'self'}});
    const run=signal=>method==='create'?transport.create({signal}):transport.resume({zcodeConversationId:'resumed',cwd:workspace,signal});
    try{
      const abandoned=new AbortController();await run(abandoned.signal);const peer=pool.peers.get(workspace);
      assert.equal(peer.holds,1);assert.equal(getEventListeners(abandoned.signal,'abort').length,1);
      abandoned.abort(new Error('operation rolled back after ACK'));
      assert.equal(peer.holds,0);assert.equal(peer.releases,1);assert.equal(transport.prepared.size,0);assert.equal(transport.holders.size,0);assert.equal(getEventListeners(abandoned.signal,'abort').length,0);
      const handedOff=new AbortController(),id=await run(handedOff.signal),listener=getEventListeners(handedOff.signal,'abort')[0];
      assert.equal(peer.holds,1);assert.equal(typeof listener,'function');
      const conversation=transport.conversation({zcodeConversationId:id,cwd:workspace});assert.equal(transport.prepared.size,0);assert.equal(getEventListeners(handedOff.signal,'abort').length,0);
      handedOff.abort(new Error('caller abort after handoff'));listener();
      assert.equal(peer.holds,1,'a detached or already-captured abort callback cannot release a conversation owner');assert.equal(peer.releases,1);
      await conversation.cancel();await conversation.cancel();assert.equal(peer.holds,0);assert.equal(peer.releases,2);assert.equal(getEventListeners(handedOff.signal,'abort').length,0);
      const unused=new AbortController();await run(unused.signal);assert.equal(peer.holds,1);
      let remaining=unused;
      if(method==='resume'){
        remaining=new AbortController();await run(remaining.signal);assert.equal(peer.holds,1);assert.equal(getEventListeners(unused.signal,'abort').length,0);
        const releases=peer.releases;unused.abort();assert.equal(peer.holds,1);assert.equal(peer.releases,releases,'replaced operation cannot release the retry unit');
      }
      const releases=peer.releases;transport.dispose();transport.dispose();assert.equal(peer.holds,0);assert.equal(peer.releases,releases+1);assert.equal(getEventListeners(remaining.signal,'abort').length,0);
      remaining.abort();assert.equal(peer.releases,releases+1);assert.equal(transport.prepared.size,0);assert.equal(pool.disposed,0);
    }finally{transport.dispose()}
  });
});
