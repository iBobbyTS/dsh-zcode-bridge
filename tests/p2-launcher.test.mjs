import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, rmSync, realpathSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { createLauncherConfig, assertLandings } from '../packages/host/launcher/config.mjs';
import { HostChannel, encodeFrame, decodeFrame, VSBytes } from '../packages/host/launcher/channel.mjs';
import { HostAuthority, ProviderRequestGate } from '../packages/host/launcher/authority.mjs';
import { HostLauncher, handleLauncher } from '../packages/host/launcher/index.mjs';
import { BridgeHost } from '../packages/host/runtime.mjs';
const config=()=>createLauncherConfig({scratchRoot:join(realpathSync(tmpdir()),'s02-config'),runId:'unit',artifactRoot:'/read-only/official-extracted',electronPath:'/read-only/electron',builtinConfig:'/read-only/provider.json'});
test('standalone Host package declares its Channel/bus schema dependency',()=>{const pkg=JSON.parse(readFileSync(new URL('../packages/host/package.json',import.meta.url),'utf8'));assert.equal(pkg.dependencies.zod,'4.6.5')});

test('scratch is explicit; both process environments scrub inherited settings/secret/preload overrides',()=>{
  assert.throws(()=>createLauncherConfig(),/launcher-config-required/);
  const old=process.env.ZCODE_DESKTOP_HOME_DIR;process.env.ZCODE_DESKTOP_HOME_DIR='/real/settings';
  try{const c=config();assert.equal(assertLandings(c).passed,true);assert.equal(c.env.ZCODE_DESKTOP_HOME_DIR,c.paths.home);assert.deepEqual(c.env,c.runtimeProcessEnvPatch);assert.equal(c.env.NODE_OPTIONS,undefined)}finally{if(old===undefined)delete process.env.ZCODE_DESKTOP_HOME_DIR;else process.env.ZCODE_DESKTOP_HOME_DIR=old}
});
for(const name of ['home','dataBase','runtimeHome','sessionDb','userData','sessionData','logs','temp','workspace','appData','crashDumps','desktop','documents','downloads','music','pictures','videos'])test('prelaunch rejects escaped '+name,()=>{const c=config();c.paths[name]='/real/'+name;assert.throws(()=>assertLandings(c),/landing-outside-scratch/)});
for(const key of ['HOME','USERPROFILE','ZCODE_DESKTOP_HOME_DIR','ZCODE_DATA_BASE_DIR','ZCODE_SESSION_DB_PATH','SESSION_DB','ZCODE_HOME','TMPDIR'])test('inner env leak rejected: '+key,()=>{const c=config();c.runtimeProcessEnvPatch[key]='/real';assert.throws(()=>assertLandings(c),/landing-env-mismatch/)});
test('cwd, inherited env and real root reject; symlink ancestors are rejected',()=>{
  const c=config();c.cwd='/real';assert.throws(()=>assertLandings(c),/landing-cwd-mismatch/);c.cwd=c.paths.workspace;c.env.NODE_OPTIONS='preload';assert.throws(()=>assertLandings(c),/inherited-env-denied/);
  assert.throws(()=>createLauncherConfig({...config(),scratchRoot:config().realHome}),/real-data-root-denied/);
  const root=realpathSync(mkdtempSync(join(tmpdir(),'s02-links-')));try{mkdirSync(join(root,'target'));symlinkSync(join(root,'target'),join(root,'link'));assert.throws(()=>createLauncherConfig({...config(),scratchRoot:join(root,'link')}),/landing-symlink/)}finally{rmSync(root,{recursive:true,force:true})}
});

class Port extends EventEmitter {sent=[];postMessage(frame){this.sent.push(decodeFrame(frame))}start(){}close(){this.emit('close')}receive(h,b){this.emit('message',{data:encodeFrame(h,b)})}}
test('official codec round-trips all tags, signed int32, nested bytes and bounded malformed frames',()=>{
  const values=[undefined,'中文',-2147483648,-1,0,128,new Uint8Array([1,255]),new VSBytes(new Uint8Array([2,3])),{flag:true,nested:new Uint8Array([7]),null:null},['a',9],2.5];
  for(const v of values)assert.deepEqual(decodeFrame(encodeFrame([201,4],v)),[[201,4],v]);
  for(const b of [new Uint8Array([4,255]),new Uint8Array([7]),new Uint8Array([6,128,128,128,128,128])])assert.throws(()=>decodeFrame(b));
  const b=encodeFrame([200]);assert.throws(()=>decodeFrame(new Uint8Array([...b,0])),/channel-frame/);
});
test('Initialize queues calls; error fields/object failures and event listen/unlisten use official codes',async()=>{
  const p=new Port(),c=new HostChannel(p);const pending=c.call('setting','get');assert.equal(p.sent.length,0);p.receive([200]);assert.deepEqual(p.sent[0],[[100,0,'setting','get'],[]]);p.receive([201,0],{safe:1});assert.deepEqual(await pending,{safe:1});
  const failed=c.call('setting','get');p.receive([202,1],{message:'no',name:'OfficialError',code:'X',details:{safe:true},stack:['stack']});await assert.rejects(failed,e=>e.code==='X'&&e.name==='OfficialError'&&e.details.safe&&e.stack==='stack');
  const obj=c.call('setting','get');p.receive([203,2],{code:'plain'});await assert.rejects(obj,e=>e.code==='plain');
  let events=0;const dispose=c.listen('provider-settings','onDidChange',()=>events++);p.receive([204,3],{});assert.equal(events,1);dispose();dispose();p.receive([204,3],{});assert.equal(events,1);assert.deepEqual(p.sent.at(-1),[[103,3],undefined]);c.close();assert.deepEqual(c.diagnostics,{pending:0,subscriptions:0,available:false});
});
test('cancellation before init sends nothing; sent cancellation and timeout emit 101; port exit rejects all',async()=>{
  const p=new Port(),c=new HostChannel(p),abort=new AbortController();const before=c.call('setting','get',[],{signal:abort.signal});abort.abort();await assert.rejects(before,/cancelled/);p.receive([200]);assert.equal(p.sent.length,0);
  const abort2=new AbortController(),sent=c.call('setting','get',[],{signal:abort2.signal});abort2.abort();await assert.rejects(sent,/cancelled/);assert.equal(p.sent.at(-1)[0][0],101);
  const timeout=c.call('setting','get',[],{timeoutMs:2});await assert.rejects(timeout,/channel-timeout/);assert.equal(p.sent.at(-1)[0][0],101);
  const outstanding=c.call('setting','get');p.emit('close');await assert.rejects(outstanding,/channel-closed/);assert.equal(p.listenerCount('message'),0);
});
test('status allowlist denies close/commands/login/title/tester/warmup/recovery without sending',async()=>{
  const p=new Port(),c=new HostChannel(p);p.receive([200]);for(const [svc,method] of [['zcode-session','closeSession'],['zcode-session','closeDeferredDraftSession'],['zcode-agent','sendConversationCommandV4'],['oauth','startOAuth'],['provider-settings','testModelConnectivity'],['zcode-agent','initialize'],['zcode-agent','resyncConversation']])await assert.rejects(c.call(svc,method),/status-rpc-denied/);assert.equal(p.sent.length,0);c.close();
});
test('malformed binary or transport failure closes pending requests',async()=>{
  const p=new Port(),c=new HostChannel(p);const pending=c.call('setting','get');p.emit('message',{data:new Uint8Array([255])});await assert.rejects(pending,/channel-invalid/);
  const q=new Port(),d=new HostChannel(q);q.receive([200]);q.postMessage=()=>{throw Error('broken')};await assert.rejects(d.call('setting','get'),/channel-send-failed/);
});

class Child extends EventEmitter {received=[];postMessage(m){this.received.push(m)}send(m){this.emit('message',m)}}
const target={workspacePath:'/scratch/workspace',workspaceKey:'identity-key',workspaceIdentity:'identity-key',taskId:'task',runId:'run',traceId:'run'};
const acquire=(c,id,t=target)=>c.send({type:'task-run-lease-acquire',request:{...t,leaseRequestId:id}});
test('Main official lease contract is single owner/run fenced; stale release cannot release new owner',()=>{
  const bus=new HostAuthority(),a=new Child(),b=new Child();bus.register({hostId:'a',child:a,workspaceKeys:['identity-key']});bus.register({hostId:'b',child:b,workspaceKeys:['identity-key']});
  acquire(a,'1');assert.equal(a.received.at(-1).result.acquired,true);acquire(b,'2');assert.equal(b.received.at(-1).result.acquired,false);acquire(a,'3',{...target,runId:'stale',traceId:'stale'});assert.equal(a.received.at(-1).result.acquired,false);
  a.send({type:'task-run-lease-release',target:{...target,runId:'stale',traceId:'stale'}});assert.equal(bus.diagnostics.leases,1);a.send({type:'task-run-lease-release',target});acquire(b,'4');assert.equal(b.received.at(-1).result.acquired,true);bus.unregister('b');assert.equal(bus.diagnostics.leases,0);bus.dispose();assert.equal(a.listenerCount('message'),0);
});
test('owner command forwards only to owner, ignores forged results, fences stale run, fails on owner exit',()=>{
  const bus=new HostAuthority(),a=new Child(),b=new Child();for(const [id,child] of [['a',a],['b',b]])bus.register({hostId:id,child,workspaceKeys:['identity-key']});acquire(a,'lease');
  const {traceId:_traceId,...commandTarget}=target;const command={...commandTarget,commandRequestId:'cmd',type:'stop_generation'};b.send({type:'task-owner-command-request',command});assert.equal(a.received.at(-1).type,'task-owner-command-deliver');
  b.send({type:'task-owner-command-result',result:{commandRequestId:'cmd',success:true}});assert.equal(bus.diagnostics.pendingOwnerCommands,1);
  a.send({type:'task-owner-command-result',result:{commandRequestId:'cmd',success:true}});assert.equal(b.received.at(-1).result.success,true);
  b.send({type:'task-owner-command-request',command:{...command,commandRequestId:'stale',runId:'stale'}});assert.equal(b.received.at(-1).result.code,'STALE_TASK_OWNER_COMMAND');
  b.send({type:'task-owner-command-request',command:{...command,commandRequestId:'exit'}});bus.unregister('a');assert.equal(b.received.find(m=>m.result?.commandRequestId==='exit').result.success,false);bus.dispose();
});
test('eventId dedup bounds cache, scopes workspace visibility and does not loop through deliver messages',()=>{
  const bus=new HostAuthority(),a=new Child(),b=new Child(),hidden=new Child();for(const [id,child,workspaceKeys] of [['a',a,['identity-key']],['b',b,['identity-key']],['h',hidden,['other']]])bus.register({hostId:id,child,workspaceKeys});
  const {runId:_runId,...eventTarget}=target;const event={...eventTarget,type:'task_snapshot_invalidated',eventId:'same',createdAt:1,reason:'stream_mirror_owner_lost'};a.send({type:'task-realtime-publish',event});a.send({type:'task-realtime-publish',event});assert.equal(a.received.length,1);assert.equal(b.received.length,1);assert.equal(hidden.received.length,0);b.send(b.received[0]);assert.equal(a.received.length,1);
  for(let i=0;i<1005;i++)a.send({type:'task-realtime-publish',event:{...event,eventId:'e'+i}});assert.equal(bus.diagnostics.seenEventIds,1000);bus.dispose();assert.equal(bus.diagnostics.seenEventIds,0);
});
test('stream owner/run gate, monotonic seq/watermark, observer invalidation and full teardown',()=>{
  const bus=new HostAuthority(),a=new Child(),b=new Child();bus.register({hostId:'a',child:a,workspaceKeys:['identity-key']});bus.register({hostId:'b',child:b,workspaceKeys:['identity-key'],deliveryKind:'relay_bridge'});acquire(a,'lease');
  const op={kind:'stream_event',event:{type:'text_chunk',taskId:'task',traceId:'run',text:'synthetic'}};
  b.send({type:'task-stream-op-publish',target,op});a.send({type:'task-stream-op-publish',target:{...target,runId:'stale',traceId:'stale'},op});assert.equal(bus.diagnostics.streamBatches,0);
  // An immediate event flushes a synthetic stream, without touching any packaged runtime.
  a.send({type:'task-stream-op-publish',target,op:{kind:'stream_event',event:{type:'permission_request',taskId:'task',traceId:'run'}}});
  const ev=a.received.find(m=>m.event?.type==='task_stream_mirror_batch')?.event;assert.ok(ev);assert.equal(ev.fromSeq,1);assert.equal(ev.ops[0].seq,1);assert.equal(ev.toSeq,1);assert.equal(ev.batchSeq,1);
  bus.dispose();assert.equal(bus.diagnostics.streamBatches,0);assert.equal(a.listenerCount('message'),0);assert.equal(b.listenerCount('exit'),0);
});
test('database relay strips arbitrary fields; attachments detach exactly once; login is explicitly disabled',()=>{
  const bus=new HostAuthority(),a=new Child();bus.register({hostId:'a',child:a});a.send({type:'database-startup-state',state:{phase:'ready',secret:'never project'}});assert.deepEqual(bus.database('a'),{phase:'ready'});
  bus.attach('a','attachment',{}, {kind:'local'},'desktop-continuous');assert.equal(typeof a.received.at(-1).requestId,'string');bus.detach('a','attachment');bus.detach('a','attachment');assert.equal(a.received.filter(m=>m.type==='detach-service-port').length,1);for(const method of ['login','registerOAuthState','handleOAuthDeepLink','openOAuthBrowser'])assert.throws(()=>bus[method](),/login-disabled-s03/);assert.throws(()=>bus.controlDatabaseStartup(),/database-control-disabled-s02/);bus.dispose();
});
test('official replay buffer truncation invalidates observer with gap/watermark; owner exit invalidates active run',()=>{
  const bus=new HostAuthority(),a=new Child(),b=new Child();bus.register({hostId:'a',child:a,workspaceKeys:['identity-key']});acquire(a,'lease');
  const op={kind:'stream_event',event:{type:'permission_request',taskId:'task',traceId:'run'}};
  for(let i=0;i<61;i++)a.send({type:'task-stream-op-publish',target,op});
  const batches=a.received.filter(m=>m.event?.type==='task_stream_mirror_batch');assert.equal(batches.length,61);assert.equal(batches.at(-1).event.toSeq,61);
  bus.register({hostId:'b',child:b,workspaceKeys:['identity-key'],deliveryKind:'relay_bridge'});
  const gap=b.received.find(m=>m.event?.reason==='stream_mirror_gap')?.event;assert.ok(gap);assert.deepEqual(gap.streamWatermark,{runId:'run',opSeq:61});
  bus.unregister('a');assert.ok(b.received.some(m=>m.event?.reason==='stream_mirror_owner_lost'));bus.dispose();assert.equal(bus.diagnostics.streamBatches,0);
});
test('request gate blocks before dispatch, counts attempts before send, never reuses failed budget; live installation false',()=>{
  let sends=0;const zero=new ProviderRequestGate();assert.throws(()=>zero.dispatchBeforeSend(()=>sends++),/budget-exhausted/);assert.equal(sends,0);
  const one=new ProviderRequestGate({limit:1});assert.throws(()=>one.dispatchBeforeSend(()=>{sends++;throw Error('synthetic transport failure')}),/synthetic/);assert.throws(()=>one.dispatchBeforeSend(()=>sends++),/budget-exhausted/);assert.equal(sends,1);assert.equal(one.state.sent,1);assert.equal(one.state.installed,false);assert.equal(one.state.enforceable,false);
});
test('Host-backed authority consumes lifecycle without CLI spawn or session execution; disposal releases subscription',async()=>{
  const events=new EventEmitter();let disposed=0,spawned=0;const launcher={state:{phase:'idle'},subscribe:l=>{events.on('state',l);return()=>events.off('state',l)},start:async()=>({phase:'ready',channelAvailable:true,services:['setting']}),dispose:async()=>disposed++};
  const host=new BridgeHost({authorityMode:'host-backed',launcher,spawnProcess:()=>spawned++});await host.connect();assert.equal(host.status.state,'restricted');assert.equal(host.status.connected,false);assert.equal(host.status.launcher.channelAvailable,true);assert.equal(spawned,0);await assert.rejects(host.listSessions(),/source-unavailable/);events.emit('state',{phase:'failed',reason:'host-exited'});assert.equal(host.status.reason,'host-exited');await host.dispose();assert.equal(events.listenerCount('state'),0);assert.equal(disposed,1);
});
test('launcher projection state/watch rejects caller commands and cancellation releases listener',async()=>{
  const launcher=new HostLauncher({});const state=await handleLauncher(launcher,{operation:'state'});assert.equal(state.value.phase,'idle');assert.equal((await handleLauncher(launcher,{operation:'state',rpc:'session/close'})).ok,false);
  const abort=new AbortController();const watch=handleLauncher(launcher,{operation:'watch',afterRevision:0},abort.signal);abort.abort();assert.equal((await watch).error.code,'cancelled');const pending=launcher.waitState(0);await launcher.dispose();assert.equal((await pending).phase,'stopped');
});
