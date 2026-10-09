import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,realpath,rm,stat,symlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {AppServerPool} from '../packages/host/app-server-pool.mjs';
import {BridgeHost} from '../packages/host/runtime.mjs';
import {runtimeEnv} from '../packages/host/installation.mjs';

const fixture=fileURLToPath(new URL('./fixtures/app-server-fixture.mjs',import.meta.url));
const installation={launcher:process.execPath,cjs:fixture,providerConfig:'fixture-provider-config',verified:true};
const options={timeout:10000};
async function setup(t,{maxEntries=8,envForSpawn=()=>({}),inspect}={}){
  const root=await realpath(await mkdtemp(join(tmpdir(),'app-server-pool-')));
  const children=[],diagnostics=[],inspected=[];
  const spawnProcess=(launcher,args,spawnOptions)=>{
    const predecessorsClosedBeforeSpawn=children.filter(record=>record.options.cwd===spawnOptions.cwd).every(record=>record.closed);
    const child=spawn(process.execPath,[fixture],{...spawnOptions,env:{...spawnOptions.env,...envForSpawn(children.length)}});
    const record={child,launcher,args,options:spawnOptions,closed:false,signals:[],predecessorsClosedBeforeSpawn};
    record.close=new Promise(resolve=>child.once('close',(code,signal)=>{record.closed=true;resolve({code,signal})}));
    const kill=child.kill.bind(child);child.kill=signal=>{record.signals.push(signal);return kill(signal)};
    children.push(record);return child;
  };
  const inspectProcess=async appPath=>{inspected.push(appPath);return inspect?inspect(appPath):installation};
  const pool=new AppServerPool({appPath:'fixture.app',inspect:inspectProcess,spawnProcess,maxEntries,logger:event=>diagnostics.push(event)});
  t.after(async()=>{await pool.dispose();await Promise.all(children.map(record=>record.close));await rm(root,{recursive:true,force:true})});
  return {root,pool,children,diagnostics,inspected,spawnProcess,inspect:inspectProcess};
}
function notification(peer,method){
  return new Promise(resolve=>{const off=peer.onNotification(message=>{if(message.method===method){off();resolve(message)}})});
}

test('AC1: concurrent first requests share one spawn and canonical stable facade',options,async t=>{
  const f=await setup(t),workspace=join(f.root,'workspace');await mkdir(workspace);
  const alias=join(f.root,'alias');await symlink(workspace,alias,'dir');
  const [left,right]=await Promise.all([f.pool.forWorkspace(workspace),f.pool.forWorkspace(alias)]);
  assert.equal(left,right);left.hold();
  const results=await Promise.all(Array.from({length:8},(_,n)=>left.request('fixture/echo',{n})));
  assert.equal(f.children.length,1);assert.equal(f.inspected.length,1);assert.equal(f.inspected[0],'fixture.app');
  assert.equal(new Set(results.map(result=>result.pid)).size,1);assert.equal(results[0].cwd,workspace);
  const child=f.children[0];assert.equal(child.launcher,installation.launcher);assert.deepEqual(child.args,[fixture,'app-server','--stdio']);
  assert.deepEqual(child.options,{cwd:workspace,env:runtimeEnv(installation.providerConfig),stdio:['pipe','pipe','pipe']});
  const requests=await left.request('fixture/requests',{});
  assert.deepEqual(requests.slice(0,2).map(request=>request.method),['runtime/capabilities','session/list']);
  assert.deepEqual(requests[1].params,{workspace:{workspacePath:workspace,workspaceKey:workspace},limit:1});
});

test('AC2: child exits reject sent requests, notify loss, and lazily recover original observers',options,async t=>{
  const f=await setup(t,{envForSpawn:()=>({FIXTURE_SUICIDE:'1'})});
  const peer=await f.pool.acquire(f.root),connectionId=peer.connectionId,states=[],closures=[],events=[];
  peer.launcher.subscribe(state=>states.push({...state}));peer.onClosed(reason=>closures.push(reason));
  let installed=false;peer.onNotification(message=>{if(message.method==='fixture/event'){assert.equal(installed,true);events.push(message)}});
  await peer.request('fixture/notify',{generation:1},{onResult:result=>{installed=true;return result}});
  const blocked=notification(peer,'fixture/blocked');
  const inFlight=peer.request('fixture/block',{}),rejected=assert.rejects(inFlight,{code:'execution-disconnected',sent:true});await blocked;
  const suicide=assert.rejects(peer.request('fixture/suicide',{}),{code:'execution-disconnected',sent:true});
  await Promise.all([rejected,suicide,f.children[0].close]);
  assert.deepEqual(closures,['execution-disconnected']);assert.equal(peer.closed,false);
  assert.equal(states.at(-1).phase,'starting');assert.equal(f.children.length,1,'exit must not eagerly respawn');
  installed=false;
  const result=await peer.request('fixture/notify',{generation:2},{onResult:result=>{installed=true;return {...result,handled:true}}});
  assert.equal(result.handled,true);assert.equal(f.children.length,2);assert.notEqual(result.pid,events[0].params.pid);
  assert.equal(events.length,2);assert.equal(peer.connectionId,connectionId);assert.equal(await f.pool.forWorkspace(f.root),peer);
  assert.deepEqual(states.map(state=>state.phase),['ready','starting','starting','ready']);
  assert.ok(states.every((state,index)=>index===0||state.revision>states[index-1].revision));
  await assert.rejects(peer.request('fixture/suicide',{}),{code:'execution-disconnected',sent:true});await f.children[1].close;
  assert.equal(closures.length,2,'onClosed persists across every child generation');
  await peer.request('fixture/echo',{});assert.equal(f.children.length,3);
});

test('AC3: all held entries may exceed capacity; released least-recent entry is retired',options,async t=>{
  const f=await setup(t,{maxEntries:2}),peers=[];
  for(const name of ['one','two','three'])peers.push(await f.pool.acquire(join(f.root,name)));
  assert.equal(f.pool.size,3);assert.equal(f.children.length,3);assert.ok(f.children.every(record=>!record.closed));
  assert.ok(f.diagnostics.some(event=>event.event==='pool-over-capacity'));
  peers[0].releaseHold();assert.equal(f.pool.size,2);await f.children[0].close;
  assert.equal(peers[0].closed,true);assert.ok(f.children.slice(1).every(record=>!record.closed));
  assert.ok(f.diagnostics.some(event=>event.event==='pool-evicted'&&event.workspacePath===peers[0].workspacePath));
  assert.deepEqual(f.children[0].signals,[],'eligible retirement starts with stdin EOF');
});

test('AC4: dispose is idempotent, fires closure, and waits for all owned children',options,async t=>{
  const f=await setup(t),peers=await Promise.all(['one','two','three'].map(name=>f.pool.acquire(join(f.root,name))));
  const closed=[];peers.forEach(peer=>peer.onClosed(reason=>closed.push(reason)));
  const first=f.pool.dispose(),second=f.pool.dispose();assert.equal(first,second);await first;
  assert.ok(f.children.every(record=>record.closed));assert.ok(peers.every(peer=>peer.closed));assert.equal(f.pool.size,0);
  assert.deepEqual(closed,['execution-disposed','execution-disposed','execution-disposed']);
  await assert.rejects(peers[0].request('fixture/echo',{}),{code:'execution-disposed',sent:false});
  await assert.rejects(f.pool.forWorkspace(f.root),{code:'execution-disposed',sent:false});
});

test('AC5: aborting one spawn waiter does not stop the shared handshake flight',options,async t=>{
  const f=await setup(t,{envForSpawn:()=>({FIXTURE_HANDSHAKE_DELAY_MS:'80'})});
  const peer=await f.pool.forWorkspace(f.root),controller=new AbortController();peer.hold();
  const handshake=notification(peer,'fixture/handshake');
  const cancelled=peer.request('fixture/echo',{waiter:1},{signal:controller.signal}),rejected=assert.rejects(cancelled,{code:'cancelled',sent:false});
  const surviving=peer.request('fixture/echo',{waiter:2});await handshake;controller.abort();await rejected;
  assert.equal(f.children.length,1);assert.equal(f.children[0].child.stdin.writableEnded,false);
  assert.equal((await surviving).params.waiter,2);assert.equal(f.children.length,1);assert.equal(f.children[0].closed,false);assert.deepEqual(f.children[0].signals,[]);
});

test('AC6: invalid capabilities stop the failed child before the next lazy retry',options,async t=>{
  const f=await setup(t,{envForSpawn:index=>({FIXTURE_BAD_CAPABILITIES:index===0?'1':'0'})});
  const peer=await f.pool.forWorkspace(f.root);peer.hold();const failures=[];peer.onClosed(reason=>failures.push(reason));
  await assert.rejects(peer.request('fixture/echo',{}),{code:'capabilities-invalid',sent:false});
  assert.equal(f.children[0].closed,true);assert.equal(peer.closed,false);assert.equal(peer.launcher.state.phase,'starting');
  const result=await peer.request('fixture/echo',{});assert.equal(f.children.length,2);assert.equal(result.pid,f.children[1].child.pid);assert.equal(failures.length,1);
});

test('AC7: missing workspace is recursively created; unusable paths have a coded failure',options,async t=>{
  const f=await setup(t),path=join(f.root,'missing','nested','workspace'),peer=await f.pool.acquire(path);
  assert.equal((await stat(path)).isDirectory(),true);assert.equal((await peer.request('fixture/echo',{})).cwd,await realpath(path));
  const file=join(f.root,'file');await writeFile(file,'not a directory');
  await assert.rejects(f.pool.forWorkspace(join(file,'child')),{code:'workspace-unavailable',sent:false});
  await assert.rejects(f.pool.forWorkspace(file),{code:'workspace-unavailable',sent:false});
  assert.equal(f.children.length,1);
});

test('AC8: BridgeHost self-managed probes default workspace once and publishes the live pool',options,async t=>{
  const f=await setup(t),statuses=[];
  const host=new BridgeHost({authorityMode:'self-managed',appPath:'fixture.app',defaultWorkspace:join(f.root,'default'),inspect:f.inspect,spawnProcess:f.spawnProcess,onStatus:status=>statuses.push(status)});
  t.after(()=>host.dispose());
  const first=host.connect(),second=host.connect();assert.equal(first,second);
  const [left,right]=await Promise.all([first,second]);assert.equal(f.children.length,1);assert.equal(left.sessionAuthority,right.sessionAuthority);
  assert.equal(left.state,'available');assert.equal(left.connected,true);assert.equal(left.auth,'unavailable');assert.match(left.reason,/direct-storage/);assert.match(left.sessionAuthority,/^self-managed:/);
  assert.equal(left.workspacePath,await realpath(join(f.root,'default')));assert.equal(left.pool,host.pool);assert.equal(host.status.pool,host.pool);assert.equal(statuses.at(-1).pool,host.pool);
  assert.equal(host.launcher,undefined);assert.equal((await host.connect()).sessionAuthority,left.sessionAuthority);assert.equal(f.children.length,1);
  await host.dispose();assert.equal(f.children[0].closed,true);assert.equal(host.status.reason,'disposed');assert.equal(host.status.connected,false);
});

test('close releases one hold idempotently while the idle child remains alive',options,async t=>{
  const f=await setup(t),peer=await f.pool.acquire(f.root),connectionId=peer.connectionId;
  peer.close();peer.close();assert.equal(peer.closed,true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.children[0].closed,false);assert.equal(f.children[0].child.stdin.writableEnded,false);
  await assert.rejects(peer.request('fixture/echo',{}),{code:'execution-disposed',sent:false});
  const replacement=await f.pool.acquire(f.root);assert.notEqual(replacement,peer);assert.equal(replacement.connectionId,connectionId);
  await replacement.request('fixture/echo',{});assert.equal(f.children.length,1);
  peer.releaseHold();
  assert.equal(replacement.entry.holds,1,'a closed facade cannot release the replacement holder');
});

test('LRU never evicts an unheld entry while a request remains in flight',options,async t=>{
  const f=await setup(t,{maxEntries:1}),peer=await f.pool.forWorkspace(join(f.root,'busy'));
  const blocked=notification(peer,'fixture/blocked'),request=peer.request('fixture/delay',{delayMs:80});await blocked;
  await f.pool.acquire(join(f.root,'held'));assert.equal(f.pool.size,2);assert.equal(f.children[0].closed,false);
  await request;assert.equal(f.pool.size,1);await f.children[0].close;assert.equal(peer.closed,true);
});

test('invalid session handshake is stopped and retries without replacing the facade',options,async t=>{
  const f=await setup(t,{envForSpawn:index=>({FIXTURE_BAD_SESSIONS:index===0?'1':'0'})}),peer=await f.pool.forWorkspace(f.root);peer.hold();
  await assert.rejects(peer.request('fixture/echo',{}),{code:'sessions-invalid',sent:false});assert.equal(f.children[0].closed,true);
  await peer.request('fixture/echo',{});assert.equal(f.children.length,2);
});

test('request cancellation, timeout and wire rejection preserve observable sent metadata',options,async t=>{
  const f=await setup(t),peer=await f.pool.acquire(f.root),controller=new AbortController();
  const blocked=notification(peer,'fixture/blocked'),request=peer.request('fixture/block',{}, {signal:controller.signal});
  const rejected=assert.rejects(request,{code:'cancelled',sent:true});await blocked;controller.abort();await rejected;
  await assert.rejects(peer.request('fixture/block',{}, {timeoutMs:20}),{code:'request-timeout',sent:true});
  await assert.rejects(peer.request('fixture/reject',{}),{code:'runtime-rejected',protocolCode:-32602,sent:true});
  await assert.rejects(peer.request('fixture/echo',{}, {timeoutMs:0}),{code:'invalid-timeout',sent:false});
  assert.equal((await peer.request('fixture/echo',{})).pid,f.children[0].child.pid);
});

test('BridgeHost without default workspace creates no child and never touches launcher',options,async t=>{
  const launcher=new Proxy({}, {get(){throw new Error('self-managed touched launcher')}});
  let spawns=0,inspections=0;
  const host=new BridgeHost({authorityMode:'self-managed',launcher,inspect:()=>{inspections++;return installation},spawnProcess:()=>{spawns++}});t.after(()=>host.dispose());
  const status=await host.connect();assert.equal(status.connected,true);assert.equal(status.auth,'unavailable');assert.equal(status.reason,'direct-storage');
  assert.equal(spawns,0);assert.equal(inspections,0);await host.dispose();assert.equal(host.pool.disposed,true);
});

test('dispose during shared inspection prevents a late child launch',options,async t=>{
  let releaseInspect,enteredInspect;
  const inspection=new Promise(resolve=>{releaseInspect=resolve}),entered=new Promise(resolve=>{enteredInspect=resolve});
  const f=await setup(t,{inspect:()=>{enteredInspect();return inspection}}),peer=await f.pool.forWorkspace(f.root);
  const request=peer.request('fixture/echo',{}),rejected=assert.rejects(request,{code:'execution-disposed',sent:false});await entered;
  const disposing=f.pool.dispose();releaseInspect(installation);await Promise.all([disposing,rejected]);assert.equal(f.children.length,0);
});

test('stderr is counted without exposing raw content in pool diagnostics',options,async t=>{
  const secret='fixture-private-stderr';const f=await setup(t,{maxEntries:1,envForSpawn:()=>({FIXTURE_STDERR:secret})});
  const first=await f.pool.acquire(join(f.root,'one'));await f.pool.acquire(join(f.root,'two'));
  assert.equal(first.entry.stderrBytes,Buffer.byteLength(secret));first.releaseHold();
  assert.equal(JSON.stringify(f.diagnostics).includes(secret),false);
});

test('child death during shared handshake reports caller requests as not sent',options,async t=>{
  const f=await setup(t,{envForSpawn:index=>({FIXTURE_SUICIDE_HANDSHAKE:index===0?'1':'0'})});
  const peer=await f.pool.forWorkspace(f.root);peer.hold();
  await Promise.all([1,2].map(n=>assert.rejects(peer.request('fixture/echo',{n}),{code:'execution-disconnected',sent:false})));
  assert.equal(f.children.length,1);assert.equal(f.children[0].closed,true);
  await peer.request('fixture/echo',{});assert.equal(f.children.length,2);
});

test('repair 1: reacquiring an evicted workspace waits for its retiring child to close',options,async t=>{
  const f=await setup(t,{maxEntries:1,envForSpawn:index=>({FIXTURE_IGNORE_EOF:index===0?'1':'0'})});
  const workspaceA=join(f.root,'A'),first=await f.pool.acquire(workspaceA);
  await f.pool.acquire(join(f.root,'B'));
  first.releaseHold();assert.equal(f.children[0].closed,false);
  const replacement=await f.pool.acquire(workspaceA);
  assert.equal(f.children.length,3);assert.equal(f.children[2].predecessorsClosedBeforeSpawn,true,'the old A child must fully close before spawning A again');
  assert.equal(f.children[0].closed,true);assert.deepEqual(f.children[0].signals,['SIGTERM']);
  assert.notEqual((await replacement.request('fixture/echo',{})).pid,f.children[0].child.pid);
});

test('repair 1: stdout EOF reaps the hung generation and lazily restores the same facade',options,async t=>{
  const f=await setup(t,{envForSpawn:index=>({FIXTURE_EOF_HANG:index===0?'1':'0'})});
  const peer=await f.pool.acquire(f.root),connectionId=peer.connectionId,closures=[],states=[];
  peer.onClosed(reason=>closures.push(reason));peer.launcher.subscribe(state=>states.push(state.phase));
  await assert.rejects(peer.request('fixture/eof',{}),{code:'execution-disconnected',sent:true});
  assert.deepEqual(closures,['execution-disconnected']);assert.equal(states.at(-1),'starting');
  assert.equal(peer.closed,false);assert.equal(f.children[0].closed,false);assert.equal(f.children.length,1);
  const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),4000);
  let result;
  try{result=await peer.request('fixture/echo',{}, {signal:controller.signal,timeoutMs:1000})}finally{clearTimeout(deadline)}
  assert.equal(f.children.length,2);assert.equal(f.children[0].closed,true);assert.deepEqual(f.children[0].signals,['SIGTERM']);
  assert.equal(f.children[1].predecessorsClosedBeforeSpawn,true);assert.equal(result.pid,f.children[1].child.pid);
  assert.equal(peer.connectionId,connectionId);assert.equal(await f.pool.forWorkspace(f.root),peer);
  assert.equal(states.at(-1),'ready');assert.deepEqual(closures,['execution-disconnected'],'protocol EOF and child exit must notify only once');
});
