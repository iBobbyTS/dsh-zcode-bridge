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

test('S02 live enumeration excludes unstarted and dead peers and never lazily respawns',options,async t=>{
  const f=await setup(t,{envForSpawn:()=>({FIXTURE_SUICIDE:'1'})});
  await f.pool.forWorkspace(join(f.root,'idle'));assert.deepEqual(f.pool.live(),[]);assert.equal(f.children.length,0);
  const peer=await f.pool.acquire(join(f.root,'live')),snapshot=f.pool.live();assert.equal(snapshot.length,1);assert.equal(snapshot[0].workspacePath,peer.workspacePath);
  assert.equal((await snapshot[0].facade.requestIfLive('fixture/echo',{})).cwd,peer.workspacePath);assert.equal(f.children.length,1);
  await assert.rejects(peer.request('fixture/suicide',{}),{code:'execution-disconnected'});await f.children[0].close;
  assert.deepEqual(f.pool.live(),[]);assert.equal(snapshot[0].facade.requestIfLive('session/list',{}),null);assert.equal(f.children.length,1);
});

test('S02 repair: resume holds its lazy facade through capacity pressure and transfers ownership to conversation',options,async t=>{
  const {DriverTransport}=await import('../packages/driver/transport.mjs');
  const f=await setup(t,{maxEntries:1}),workspace=join(f.root,'resume-project');
  const store={value:{executionWorkspace:join(f.root,'default')},async load(){},async save(){}};
  const transport=new DriverTransport({pool:f.pool,driverStateStore:store,status:{sessionAuthority:'self'}});t.after(()=>transport.dispose());
  await transport.resume({zcodeConversationId:'resumed',cwd:workspace});
  const facade=transport.facades.get(workspace);assert.equal(facade.entry.holds,1);assert.equal(facade.entry.child,null,'resume never starts the target project');
  await f.pool.forWorkspace(join(f.root,'pressure'));
  assert.equal(facade.closed,false,'a prepared resume must survive LRU pressure before conversation construction');
  const conversation=transport.conversation({zcodeConversationId:'resumed',cwd:workspace});
  assert.equal(conversation.peer,facade);assert.equal(facade.entry.holds,1,'conversation consumes the existing hold');
  await conversation.cancel();await conversation.cancel();assert.equal(facade.entry.holds,0);
  assert.equal(f.children.length,1,'only the default readiness handshake spawned');
});

test('S02 wave3: create handoff survives capacity pressure while ready adds no preparation',options,async t=>{
  const {DriverTransport}=await import('../packages/driver/transport.mjs');
  const f=await setup(t,{maxEntries:1}),workspace=join(f.root,'default');
  const store={value:{executionWorkspace:workspace},async load(){},async save(){}};
  const transport=new DriverTransport({pool:f.pool,driverStateStore:store,status:{sessionAuthority:'self'}});t.after(()=>transport.dispose());
  await transport.ready();const facade=transport.facades.get(workspace),request=facade.request.bind(facade);assert.equal(facade.entry.holds,0,'ready is connectivity only');
  facade.request=(method,params,options)=>method==='v4/command'?Promise.resolve({commandId:params.commandId,status:'accepted',revisionAtDecision:0,result:{type:'createSession',sessionId:'created'}}):request(method,params,options);
  assert.equal(await transport.create({}),'created');await Promise.all([transport.ready(),transport.ready()]);
  await f.pool.forWorkspace(join(f.root,'pressure'));
  assert.equal(facade.closed,false,'successful create must retain the default facade until handoff');assert.equal(facade.entry.holds,1,'ready does not add units to a create preparation');
  const conversation=transport.conversation({zcodeConversationId:'created'});assert.equal(conversation.peer,facade);assert.equal(facade.entry.holds,1);
  await transport.ready();await transport.ready();assert.equal(facade.entry.holds,1,'ready leaves only the active conversation owner');
  await conversation.cancel();await conversation.cancel();assert.equal(facade.entry.holds,0,'the active owner is released exactly once');
  transport.dispose();transport.dispose();assert.equal(facade.entry.holds,0);assert.equal(f.pool.disposed,false);
});

test('S02 wave2: requestIfLive accounts pending, prevents mid-flight eviction, and never spawns dead generations',options,async t=>{
  const f=await setup(t,{maxEntries:1,envForSpawn:()=>({FIXTURE_SUICIDE:'1'})});
  const facade=await f.pool.forWorkspace(join(f.root,'live'));await facade.ready();
  const snapshot=f.pool.live()[0];assert.equal(snapshot.facade,facade);
  const blocked=notification(facade,'fixture/blocked'),request=facade.requestIfLive('fixture/delay',{delayMs:60});
  assert.notEqual(request,null);await blocked;assert.equal(facade.entry.pending,1);
  const pressure=await f.pool.forWorkspace(join(f.root,'pressure'));
  assert.equal(facade.closed,false);assert.equal(facade.entry.pending,1);assert.equal(f.children.length,1);
  await request;assert.equal(facade.entry.pending,0);assert.equal(facade.closed,true,'idle completion permits deferred trim');
  await f.children[0].close;assert.equal(facade.requestIfLive('session/list',{}),null);assert.equal(pressure.requestIfLive('session/list',{}),null);assert.equal(f.children.length,1);
  const current=await f.pool.forWorkspace(join(f.root,'current'));await current.ready();
  await assert.rejects(current.requestIfLive('fixture/suicide',{}),{code:'execution-disconnected'});await f.children[1].close;
  assert.equal(current.closed,false);assert.equal(current.requestIfLive('session/list',{}),null);assert.equal(current.entry.pending,0);assert.equal(f.children.length,2);
});


test('S02 wave3: overlapping creates retain separate handoffs after the first conversation closes at capacity one',options,async t=>{
  const {DriverTransport}=await import('../packages/driver/transport.mjs');
  const f=await setup(t,{maxEntries:1}),workspace=join(f.root,'default');
  const pressure=await f.pool.acquire(join(f.root,'held-other'));t.after(()=>pressure.releaseHold());
  let dispatched=0,enteredBoth,releaseSecond;
  const both=new Promise(resolve=>{enteredBoth=resolve}),secondAck=new Promise(resolve=>{releaseSecond=resolve});
  t.after(()=>releaseSecond());
  const lookup=f.pool.forWorkspace.bind(f.pool),facades=new WeakSet(),peers=new WeakSet();
  f.pool.forWorkspace=async path=>{
    const facade=await lookup(path);
    if(path===workspace&&!facades.has(facade)){
      facades.add(facade);const request=facade.request.bind(facade);
      facade.request=async(method,params,options)=>{
        if(method==='v4/command'){
          await facade.ready(options);const peer=facade.entry.peer;
          if(!peers.has(peer)){
            peers.add(peer);const raw=peer.request.bind(peer);
            peer.request=(method,params,options)=>{
              if(method!=='v4/command')return raw(method,params,options);
              const n=++dispatched;if(n===2)enteredBoth();
              const label=params.payload.firstInput.text;
              const ack={commandId:params.commandId,status:'accepted',revisionAtDecision:0,result:{type:'createSession',sessionId:`created-${label}`}};
              return label==='second'?secondAck.then(()=>ack):Promise.resolve(ack);
            };
          }
        }
        return request(method,params,options);
      };
    }
    return facade;
  };
  const store={value:{executionWorkspace:workspace},async load(){},async save(){}};
  const transport=new DriverTransport({pool:f.pool,driverStateStore:store,status:{sessionAuthority:'self'}});t.after(()=>transport.dispose());
  const first=transport.create({firstInput:{text:'first'}}),second=transport.create({firstInput:{text:'second'}});await both;
  const firstId=await first,facade=transport.facades.get(workspace);
  const one=transport.conversation({zcodeConversationId:firstId});await one.cancel();
  const pendingAfterClose=facade.entry.pending;assert.equal(pendingAfterClose,1,'second create is still in flight');
  releaseSecond();const secondId=await second;
  assert.equal(facade.closed,false,'second accepted create keeps its own handoff unit after RPC pending clears');
  assert.equal(facade.entry.holds,1);assert.equal(facade.entry.pending,0);
  const two=transport.conversation({zcodeConversationId:secondId});assert.equal(two.peer,facade);assert.equal(facade.entry.holds,1);
  await two.cancel();await two.cancel();assert.equal(facade.entry.holds,0);assert.equal(facade.closed,true,'the held other workspace can evict only after the second owner closes');
});

test('S02 wave4: real factory rollback after accepted create releases abandoned preparations before capacity pressure',options,async t=>{
  const {DriverTransport}=await import('../packages/driver/transport.mjs');
  const {installDriver}=await import('../packages/driver/factory.mjs');
  const {driverFixture}=await import('./helpers/zcode-driver-fixture.mjs');
  const f=await setup(t,{maxEntries:1}),workspace=join(f.root,'default');
  const operationSignals=[],unitCounts=[],lookup=f.pool.forWorkspace.bind(f.pool),facades=new WeakSet(),peers=new WeakSet();let accepted=0;
  f.pool.forWorkspace=async path=>{
    const facade=await lookup(path);
    if(path===workspace&&!facades.has(facade)){
      facades.add(facade);const request=facade.request.bind(facade);
      facade.request=async(method,params,options)=>{
        if(method==='v4/command'){
          operationSignals.push(options.signal);await facade.ready(options);const peer=facade.entry.peer;
          if(!peers.has(peer)){
            peers.add(peer);const raw=peer.request.bind(peer);
            peer.request=(method,params,options)=>method==='v4/command'?Promise.resolve({commandId:params.commandId,status:'accepted',revisionAtDecision:0,result:{type:'createSession',sessionId:`official-${++accepted}`}}):raw(method,params,options);
          }
        }
        return request(method,params,options);
      };
    }
    return facade;
  };
  const store={value:{executionWorkspace:workspace},async load(){},async save(){}};
  const transport=new DriverTransport({pool:f.pool,driverStateStore:store,status:{sessionAuthority:'self'}}),harness=driverFixture();
  harness.persistence.create=async(header,{signal})=>{
    assert.equal(signal,operationSignals.at(-1));assert.equal(signal.aborted,false);
    unitCounts.push([...transport.prepared.values()].reduce((sum,slots)=>sum+[...slots.values()].reduce((n,queue)=>n+queue.length,0),0));
    throw Object.assign(new Error('fixture-persistence-failed'),{code:'fixture-persistence-failed'});
  };
  const driver=installDriver(harness.ctx,{...harness.deps,transport});t.after(()=>driver.dispose());
  for(let n=0;n<3;n++){
    await assert.rejects(driver.factory.createAgent(harness.owner,{sessionId:'retry-local',meta:{cwd:workspace}}),{code:'fixture-persistence-failed'});
    assert.equal(operationSignals[n].aborted,true,'factory rollback aborts the actual create operation signal after ACK');
    assert.equal(driver.factory.transactions.size,0);assert.equal(harness.agents.size,0);assert.equal(harness.sessions.size,0);
  }
  assert.equal(accepted,3);
  const abandoned=transport.facades.get(workspace),unitsAfterRollback=transport.prepared.size,holdsAfterRollback=abandoned.entry.holds;
  const next=await f.pool.forWorkspace(join(f.root,'new-workspace'));f.pool.trim();
  assert.equal(next.closed,false,'new workspace must survive pressure instead of being evicted by abandoned create units');
  assert.equal(abandoned.closed,true);assert.equal(unitsAfterRollback,0);assert.equal(holdsAfterRollback,0);assert.equal(transport.holders.size,0);
  assert.deepEqual(unitCounts,[1,1,1],'each retry takes one fresh unit after the previous rollback released it');assert.equal(f.pool.size,1);
});
