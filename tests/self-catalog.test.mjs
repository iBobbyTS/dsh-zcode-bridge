import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readSelfManagedCatalog} from '../packages/driver/self-catalog.mjs';
import {ZCodeRuntime} from '../packages/host/zcode-runtime.mjs';
import {LegacyDirectory} from '../packages/driver/legacy-directory.mjs';

async function fixture(t,tasks=[]){
  const root=await mkdtemp(join(tmpdir(),'self-catalog-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const sqlitePath=join(root,'tasks.sqlite'),db=new DatabaseSync(sqlitePath);
  db.exec('CREATE TABLE tasks (workspace_path TEXT,workspace_identity TEXT,task_id TEXT,title TEXT,created_at INTEGER,updated_at INTEGER,archived INTEGER,deleted INTEGER)');
  const insert=db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?)');
  for(const task of tasks)insert.run(...task);db.close();return {root,sqlitePath};
}
function fakePool(peers=[]){
  return {spawns:0,live:()=>peers.map(facade=>({facade,workspacePath:facade.workspacePath})),forWorkspace(){this.spawns++;throw new Error('catalog spawned')},acquire(){this.spawns++;throw new Error('catalog acquired')}};
}

test('S02 AC1/AC2: sqlite and live catalog match snapshot shape, live values win and polling never spawns',async t=>{
  const {sqlitePath}=await fixture(t,[['/a','/a','one','old',10,20,0,0],['/b','/b','two','archived',30,40,1,0],['/a','/a','deleted','hidden',1,2,0,1]]);
  const calls=[],pool=fakePool([{workspacePath:'/a',async requestIfLive(method,params){calls.push({method,params});return {sessions:[{sessionId:'one',title:'fresh',updatedAt:99},{sessionId:'three',title:'live only',createdAt:50,updatedAt:60}]}}}]);
  const rows=await readSelfManagedCatalog({pool,sqlitePath,authority:'self'});
  assert.deepEqual(rows,[
    {sessionId:'one',workspacePath:'/a',workspaceIdentity:'/a',authority:'self',title:'fresh',createdAt:10,updatedAt:99},
    {sessionId:'two',workspacePath:'/b',workspaceIdentity:'/b',authority:'self',title:'archived',createdAt:30,updatedAt:40,archived:true},
    {sessionId:'three',workspacePath:'/a',workspaceIdentity:'/a',authority:'self',title:'live only',createdAt:50,updatedAt:60},
  ]);
  const projected=await ZCodeRuntime.prototype.catalogSnapshot.call({host:{listSessions:async()=>({sessions:rows.map(row=>({address:{workspace:row.workspacePath,sessionId:row.sessionId,authority:row.authority},title:row.title,createdAt:row.createdAt,updatedAt:row.updatedAt,archived:row.archived}))})}});
  assert.deepEqual(rows,projected);
  await readSelfManagedCatalog({pool,sqlitePath,authority:'self'});assert.equal(pool.spawns,0);
  assert.deepEqual(calls[0],{method:'session/list',params:{workspace:{workspacePath:'/a',workspaceKey:'/a'},limit:50}});
  const db=new DatabaseSync(sqlitePath,{readOnly:true});assert.equal(db.prepare('SELECT count(*) AS n FROM tasks').get().n,3);db.close();
});

test('S02 AC3: corrupt sqlite falls back to workspace bindings and creation records, drops unknown workspaces',async t=>{
  const {sqlitePath}=await fixture(t);await writeFile(sqlitePath,'not a sqlite database');
  const events=[],pool=fakePool(),store={value:{executionWorkspace:'/default',bindings:{created:{sessionId:'dsh-created',workspace:'/default'},external:{sessionId:'dsh-external',workspace:'/other'},unknown:'old-owner',invalid:12}}};
  const rows=await readSelfManagedCatalog({pool,store,sqlitePath,authority:'self',logger:event=>events.push(event),titleFor:id=>id==='dsh-created'?'DSH title':undefined});
  assert.deepEqual(rows,[
    {sessionId:'created',workspacePath:'/default',workspaceIdentity:'/default',authority:'self',title:'DSH title'},
    {sessionId:'external',workspacePath:'/other',workspaceIdentity:'/other',authority:'self'},
  ]);
  assert.ok(events.some(event=>event.event==='catalog-sqlite-unavailable'));
  assert.deepEqual(events.find(event=>event.event==='catalog-row-dropped'),{event:'catalog-row-dropped',count:1});assert.equal(pool.spawns,0);
});

test('S02 AC4: numeric timestamps remain usable by legacy newer-wins and archived tasks stay excluded',async t=>{
  const {sqlitePath}=await fixture(t,[['/old','/old','moved','old',1,10,0,0],['/archived','/archived','archived','archive',2,500,1,0]]);
  const pool=fakePool([{workspacePath:'/new',async requestIfLive(){return {sessions:[{sessionId:'moved',title:'new',updatedAt:20}]}}}]);
  const rows=await readSelfManagedCatalog({pool,sqlitePath,authority:'self'});
  assert.equal(rows.find(row=>row.sessionId==='archived').archived,true);
  assert.equal(rows.find(row=>row.workspacePath==='/new').updatedAt,20);
  const records=new Map(),store={value:{legacy:{}},async save(){}};
  const persistence={async create(header){const record={header,events:[]};records.set(header.id,record);return {async append(events){record.events.push(...events)},async close(){}}}};
  const directory=new LegacyDirectory({store,persistence,listCatalog:async()=>rows,listPersistedHeaders:async()=>[],request(){throw new Error('list must not read history')}});
  await directory.sync({});assert.equal(directory.rows.get('moved').workspacePath,'/new');assert.equal(records.has('archived'),false);
});

test('live catalog reads are limited to four concurrent peers and a dead peer degrades without acquisition',async t=>{
  const {sqlitePath}=await fixture(t);let active=0,maximum=0;
  const events=[],pool=fakePool(Array.from({length:9},(_,n)=>({workspacePath:`/w${n}`,async requestIfLive(){active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setImmediate(resolve));active--;if(n===2)throw Object.assign(new Error('gone'),{code:'execution-disconnected'});return {sessions:[{sessionId:`s${n}`,title:'live',updatedAt:n}]}}})));
  const rows=await readSelfManagedCatalog({pool,sqlitePath,logger:event=>events.push(event)});
  assert.equal(maximum,4);assert.equal(rows.length,8);assert.equal(pool.spawns,0);assert.ok(events.some(event=>event.event==='catalog-live-unavailable'&&event.workspacePath==='/w2'));
});

test('healthy sqlite never imports fallback bindings and a missing sqlite file is not created',async t=>{
  const {root,sqlitePath}=await fixture(t);const store={value:{bindings:{fallback:{sessionId:'dsh',workspace:'/w'}}}};
  assert.deepEqual(await readSelfManagedCatalog({sqlitePath,store,pool:fakePool()}),[]);
  const missing=join(root,'missing.sqlite');assert.equal((await readSelfManagedCatalog({sqlitePath:missing,store,pool:fakePool()})).length,1);
  const {access}=await import('node:fs/promises');await assert.rejects(access(missing),{code:'ENOENT'});
});


test('catalog read order is sqlite, then live peers, then fallback titles; live archived=false wins',async t=>{
  const {sqlitePath}=await fixture(t,[['/w','/w','one','old',1,2,1,0]]);
  let read=false;const pool=fakePool([{workspacePath:'/w',async requestIfLive(){read=true;return {sessions:[{sessionId:'one',title:'fresh',updatedAt:3,archived:false}]}}}]);
  assert.equal((await readSelfManagedCatalog({pool,sqlitePath}))[0].archived,undefined);
  await writeFile(sqlitePath,'corrupt');read=false;
  const rows=await readSelfManagedCatalog({pool,sqlitePath,store:{value:{bindings:{one:{sessionId:'dsh',workspace:'/w'}}}},titleFor(){assert.equal(read,true);return 'fallback'}});
  assert.equal(rows[0].title,'fresh');assert.equal(rows[0].updatedAt,3);
});

test('S02 AC8 repair: unconnected self-managed boot exposes sqlite catalog for empty and migrated stores without spawning',async t=>{
  const {BridgeHost}=await import('../packages/host/runtime.mjs');
  const {installZCodeRuntime}=await import('../packages/host/zcode-runtime.mjs');
  const {sqlitePath}=await fixture(t,[['/project','/project','official','Before connect',10,20,0,0]]);
  for(const migrated of [false,true]){
    let inspections=0,spawns=0,connections=0,loaded=0;
    const host=new BridgeHost({authorityMode:'self-managed',inspect(){inspections++;throw new Error('catalog inspected installation')},spawnProcess(){spawns++;throw new Error('catalog spawned')}});
    const connect=host.connect.bind(host);host.connect=()=>{connections++;return connect()};
    t.after(()=>host.dispose());
    const authority=host.status.sessionAuthority;assert.match(authority,/^self-managed:/);
    assert.equal(host.pool,undefined);assert.equal(host.status.connected,false);
    const unbound=await host.listSessions();assert.deepEqual(unbound.sessions,[]);assert.equal(unbound.catalog.complete,false);
    host.selfCatalogProvider=()=>readSelfManagedCatalog({pool:host.pool,sqlitePath,authority:host.status.sessionAuthority});
    const store={records:new Map(migrated?[['old',{id:'old',officialId:'old',workspace:'/old'}]]:[]),async load(){loaded++},writing:Promise.resolve()};
    const runtime=await installZCodeRuntime({},host,{store,createScope:()=>{},agentEvents:{},discoverModels:async()=>[]});
    t.after(()=>runtime.dispose());
    assert.equal(loaded,1);assert.equal(runtime.agents.size,0);assert.equal(runtime.directoryTimer,undefined);assert.equal(runtime.offRecovery,undefined);
    assert.equal(typeof host.zcodeCatalog,'function');assert.equal(typeof host.zcodeModels,'function');
    assert.deepEqual(await host.zcodeCatalog(),[{sessionId:'official',workspacePath:'/project',workspaceIdentity:'/project',authority,title:'Before connect',createdAt:10,updatedAt:20}]);
    assert.deepEqual(await host.zcodeModels(),[]);
    assert.equal((await runtime.bridgeSettings({catalogSync:true})).connection,'self-managed');assert.equal(runtime.directoryTimer,undefined);
    const address={runtime:'zcode',authority,workspace:'/project',sessionId:'official'};
    assert.equal((await host.listSessions({address})).sessions.length,1);
    assert.equal(connections,0);assert.equal(inspections,0);assert.equal(spawns,0);assert.equal(host.pool,undefined);
    await host.connect();assert.equal(host.status.sessionAuthority,authority);assert.equal(host.pool.size,0);
    assert.equal((await host.listSessions({address})).sessions[0].address.authority,authority);
    assert.equal(inspections,0);assert.equal(spawns,0);
    await runtime.dispose();await host.dispose();await assert.rejects(host.listSessions(),{code:'source-unavailable'});
  }
});

test('S02 wave2: a live snapshot whose facade has become idle is skipped without spawning or diagnostics',async t=>{
  const {sqlitePath}=await fixture(t,[['/w','/w','official','sqlite',1,2,0,0]]);
  let calls=0;const events=[],pool={live:()=>[{workspacePath:'/w',facade:{requestIfLive(method,params){calls++;assert.equal(method,'session/list');assert.equal(params.limit,50);return null}}}],forWorkspace(){throw new Error('spawn')},acquire(){throw new Error('spawn')}};
  const rows=await readSelfManagedCatalog({pool,sqlitePath,logger:event=>events.push(event)});
  assert.equal(calls,1);assert.equal(rows.length,1);assert.equal(rows[0].title,'sqlite');assert.deepEqual(events,[]);
});
