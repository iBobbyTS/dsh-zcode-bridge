import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ZCodeAgent} from '../packages/host/zcode-agent.mjs';
import {LauncherPeer,createExecutionRelay} from '../packages/host/launcher/execution.mjs';
import {installMirrorGuards} from '../packages/host/mirror-guards.mjs';
import {mirrorLifecycle,receiptClass} from '../packages/host/mirror-lifecycle.mjs';
import {agentFixture,baseSnapshot,row,tick,MockPeer} from './helpers/zcode-runtime-fixture.mjs';
import {world,catalogRow,directory} from './helpers/s03-runtime.mjs';
const captured=JSON.parse(readFileSync(new URL('./fixtures/s03a/success.json',import.meta.url)));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const input=rpcId=>({id:'native-'+rpcId,role:'user',source:{kind:'user',rpcId},content:[{type:'text',text:rpcId}]});
function queueItem(commandId='external',id='q-1',text='Official queued text'){
 return {sourceCommandId:commandId,queueItemId:id,clientId:'official-gui',kind:'sendText',text,attachments:[],delivery:{requested:'guide',admitted:'queue',fallbackReasonCode:'busy'},order:{admissionSeq:1,queuePosition:0},steer:{state:'fellBack',reasonCode:'busy'},dispatch:{state:'queued'},admittedAt:0};
}
async function opened(options={}){const f=agentFixture();f.agent=new ZCodeAgent({},f.session,f.record,{...f.dependencies,...options});await f.agent.connect();await tick();return f}
function lifecycle(f){return mirrorLifecycle(f.agent,f.record)}

// Real relay + LauncherPeer + registered runtime. The channel is deterministic official-API mock;
// frames arrive before the ACK, across event-loop turns, rather than simulating an ACK-first peer.
function carrier(){
 const official=new MockPeer(),events=new Set(),states=new Set();let relay;
 const launcher={state:{phase:'ready',auth:'authenticated',executionWorkspace:'/execution'},subscribe:fn=>{states.add(fn);return ()=>states.delete(fn)},onExecutionEvent:fn=>{events.add(fn);return ()=>events.delete(fn)},execution:(method,params)=>relay.request(method,params),read:async()=>official.listProviders()};
 const names={helloConversationV4:'hello',initializeConversationV4:'initialize',subscribeConversationV4:'v4/conversation/subscribe',resyncConversationV4:'v4/conversation/resync',unsubscribeConversationV4:'v4/conversation/unsubscribe',queryConversationCommandsV4:'v4/commands/query',sendConversationCommandV4:'v4/command'};
 const off=official.onNotification(event=>{for(const listener of events)listener(event)});
 const newRelay=()=>createExecutionRelay({workspacePath:'/execution',emit:event=>{for(const listener of events)listener(event)},channel:{listen:()=>()=>{},call:async(_service,name,args)=>{
  const p=args[0],method=names[name];let params=p;
  if(method==='v4/conversation/subscribe')params={topic:'conversation/'+p.sessionId};
  else if(method==='v4/command')params=p.envelope;
  else if(method==='v4/conversation/unsubscribe'||method==='v4/conversation/resync')params={...p,topic:[...official.subscriptions].find(([,id])=>id===p.subscriptionId)?.[0]};
  const result=await official.request(method,params);if(method==='v4/conversation/subscribe'||method==='v4/conversation/resync'){await tick();await tick()}return result;
 }}});
 relay=newRelay();
 const peer=new LauncherPeer(launcher);
 return {official,launcher,peer,relay,change(phase,reason){launcher.state={...launcher.state,phase,reason};if(phase!=='ready'){official.subscriptions.clear();relay.dispose()}else relay=newRelay();for(const listener of states)listener(launcher.state)},close(){peer.close();relay.dispose();off()}};
}

test('S04 subscription capacity: 32 concurrent opens through the bounded production relay, idle reclaim and resubscribe preserve history',async()=>{
 const c=carrier(),rows=Array.from({length:32},(_,i)=>catalogRow('capacity-'+i));
 for(const item of rows)c.official.registerSession(item.address.sessionId);
 const w=await world({catalog:async()=>directory(rows)});w.runtime.peerFactory=()=>c.peer;w.host.launcher=c.launcher;w.runtime.agentOptions={idleSubscriptionMs:10000};
 try{
  await w.runtime.start();await Promise.all([...w.store.records.keys()].map(id=>w.runtime.open(id)));await tick();
  assert.equal(w.agents.size,32);assert.equal(c.official.subscriptions.size,32);
  const agent=[...w.agents.values()][0],session=agent.session,events=structuredClone(agent.record.events);
  for(const agent of w.agents.values()){agent.idleSubscriptionMs=5;agent.scheduleIdleRelease()}await wait(20);assert.equal(c.official.subscriptions.size,0);assert.equal(w.agents.size,32);assert.deepEqual(agent.record.events,events);
  agent.idleSubscriptionMs=10000;await w.runtime.handle({operation:'observe',sessionId:agent.id});await tick();
  assert.equal(agent.session,session);assert.equal(agent.conversation.state.status,'live');assert.equal(c.official.subscriptions.size,1);
  assert.deepEqual(agent.record.events,events);
 }finally{await w.runtime.dispose();c.close()}
});

test('S04 idle reclaim is blocked by official queue, active work, uncertain receipts, and mounted observation lease',async()=>{
 const f=await opened({idleSubscriptionMs:10});try{
  let s=structuredClone(f.peer.snapshot);s.seq++;s.queue.items=[queueItem()];f.peer.publish(s);await wait(25);assert.equal(f.peer.subscriptions.size,1);
  s=structuredClone(s);s.seq++;s.queue.items=[];s.control.activeWorks=[{kind:'primaryTurn',startedAt:0,foregroundExecutionId:'work'}];f.peer.publish(s);await wait(25);assert.equal(f.peer.subscriptions.size,1);assert.equal(f.agent.status,'running');
  s=structuredClone(s);s.seq++;s.control.activeWorks=[];f.peer.publish(s);f.agent.touch();await wait(5);f.agent.touch();await wait(5);assert.equal(f.peer.subscriptions.size,1);
  f.peer.loseAck=true;f.agent.followup(input('uncertain'));await tick();await wait(25);assert.equal(f.peer.subscriptions.size,1);assert.equal(lifecycle(f).receipts[0].receiptClass,'outcome-unknown');
 }finally{await f.agent.dispose()}
});

test('S04 relay rejected subscription releases its reserved capacity and explicit overflow is not-sent',async()=>{
 let fail=true;const relay=createExecutionRelay({workspacePath:'/execution',maxSubscriptions:1,emit(){},channel:{listen:()=>()=>{},call:async()=>{if(fail)throw Error('mock cold-open rejected');return {ack:{subscriptionId:'sub'}}}}});
 try{await assert.rejects(relay.request('v4/conversation/subscribe',{topic:'conversation/one'}));fail=false;await relay.request('v4/conversation/subscribe',{topic:'conversation/two'});await assert.rejects(relay.request('v4/conversation/subscribe',{topic:'conversation/three'}),{code:'execution-subscription-limit',sent:false});await relay.request('v4/conversation/unsubscribe',{subscriptionId:'sub'});await relay.request('v4/conversation/subscribe',{topic:'conversation/three'})}finally{relay.dispose()}
});

test('TRACE S04 lost ACK/reconnect queue column: queued receipt, retained prefix, official refresh wins and no resend',async()=>{
 const f=await opened({reconnectDelayMs:1000});try{
  f.peer.loseAck=true;f.agent.steer(input('once'));await tick();const send=f.peer.calls.find(call=>call.params?.type==='sendText');assert.equal(send.params.payload.requestedDelivery,'guide');
  const s=structuredClone(f.peer.snapshot);s.seq=1;s.queue.items=[queueItem(send.params.commandId)];s.rows.window=[row('assistantText',1,{text:'held prefix',state:'streaming'})];f.peer.publish(s);await tick();
  assert.equal(lifecycle(f).receipts[0].receiptClass,'queued');assert.equal(lifecycle(f).queue.items[0].steer.state,'fellBack');
  f.peer.disconnect();assert.equal(lifecycle(f).confirmed,false);assert.equal(lifecycle(f).reason,'execution-disconnected');assert.equal(lifecycle(f).queue.items.length,1);
  const official=structuredClone(s);official.seq=2;official.queue.items=[];official.queue.autoDrain=false;official.queue.pauseReason='stopped';f.peer.snapshots.set(official.sessionId,official);f.peer.snapshot=official;
  await f.agent.reconnect();await tick();assert.equal(lifecycle(f).confirmed,true);assert.equal(lifecycle(f).queue.items.length,0);assert.equal(lifecycle(f).queue.pauseReason,'stopped');
  assert.equal(f.events.filter(event=>event.data.message?.content[0].text==='held prefix').length,1);
  assert.equal(f.peer.calls.filter(call=>call.params?.type==='sendText').length,1);assert.equal(f.peer.calls.filter(call=>call.method==='v4/commands/query').length,1);assert.equal(f.peer.calls.filter(call=>call.method==='v4/conversation/subscribe').length,2);
 }finally{await f.agent.dispose()}
});

test('TRACE S04 external deletion/stale directory queue column: retired queue cannot be reopened or mutated',async()=>{
 let listing=directory([catalogRow('one')]);const w=await world({catalog:async()=>listing});w.peer.registerSession('one');try{
  await w.runtime.start();const record=[...w.store.records.values()][0];await w.runtime.open(record.id);await tick();const s=w.peer.snapshots.get('one');s.seq++;s.queue.items=[queueItem()];w.peer.publish(s);assert.equal(w.runtime.info(record.id).lifecycle.queue.items.length,1);
  let old;w.host.listSessions=()=>new Promise(resolve=>old=resolve);const stale=w.runtime.refreshDirectory();await tick();w.host.listSessions=async()=>directory([]);await w.runtime.refreshDirectory();old(directory([catalogRow('one')]));await stale;
  assert.equal(w.runtime.absent.has(record.id),true);assert.equal(w.agents.has(record.id),false);assert.equal(w.peer.subscriptions.size,0);await assert.rejects(w.runtime.open(record.id),{code:'session/not-found'});
  await assert.rejects(w.runtime.handle({operation:'queue',sessionId:record.id,queueItemId:'q-1',action:'sendNow'}));assert.equal(w.peer.calls.filter(call=>call.method==='v4/command').length,0);
 }finally{await w.runtime.dispose()}
});

test('TRACE S04 official replacement queue column: newer queue/control replace old snapshot on same resident Session',async()=>{
 const f=await opened();try{
  const old=structuredClone(f.peer.snapshot);old.seq=1;old.queue.items=[queueItem()];old.control.canStop=true;old.control.activeWorks=[{kind:'primaryTurn',startedAt:0,foregroundExecutionId:'old'}];old.rows.window=[row('userInput',1,{text:'old',origin:'realUser'})];f.peer.publish(old);
  const session=f.agent.session,next=baseSnapshot();next.logEpoch='replacement';next.revision=1;next.queue.autoDrain=false;next.queue.pauseReason='manual';next.control.canStop=false;next.rows.window=[row('userInput',1,{text:'new',origin:'realUser'})];f.peer.publish(next);await tick();await tick();
  assert.equal(f.agent.session,session);assert.equal(lifecycle(f).queue.items.length,0);assert.equal(lifecycle(f).queue.pauseReason,'manual');assert.equal(lifecycle(f).control.canStop,false);assert.equal(lifecycle(f).control.activeWorks.length,0);assert.equal(f.agent.status,'idle');await assert.rejects(f.agent.queueAction({queueItemId:'q-1',action:'sendNow'}),{code:'sendQueuedNowRequiresRunning'});await assert.rejects(f.agent.stop(),{code:'stop-target-unconfirmed'});assert.equal(f.peer.calls.filter(call=>call.method==='v4/command').length,0);
 }finally{await f.agent.dispose()}
});

test('TRACE S04 B05 auto reconnect reinitializes carrier, retains content, refreshes queue and guarded native stop works',async()=>{
 const c=carrier(),w=await world({catalog:async()=>directory([catalogRow('one')])});c.official.registerSession('one');w.runtime.peerFactory=()=>c.peer;w.host.launcher=c.launcher;w.runtime.agentOptions={reconnectDelayMs:5};
 try{
  await w.runtime.start();const id=[...w.store.records.keys()][0];await w.runtime.open(id);await tick();const agent=w.agents.get(id),session=agent.session;
  const s=structuredClone(c.official.snapshots.get('one'));s.seq=1;s.rows.window=[row('assistantText',1,{text:'displayed',state:'streaming'})];s.queue.items=[queueItem()];c.official.publish(s);
  c.change('failed','app-server-exited');assert.equal(w.runtime.info(id).lifecycle.reason,'app-server-exited');assert.equal(w.runtime.info(id).lifecycle.confirmed,false);assert.ok(agent.record.events.some(e=>e.data.message?.content[0].text==='displayed'));
  const fresh=structuredClone(s);fresh.seq=2;fresh.queue.items=[];fresh.rows.window[0].text='displayed recovery';fresh.rows.window[0].state='complete';fresh.control.canStop=true;fresh.control.activeWorks=[{kind:'primaryTurn',startedAt:0,foregroundExecutionId:'new-run'}];c.official.snapshots.set('one',fresh);
  c.change('ready');await wait(40);assert.equal(w.runtime.info(id).lifecycle.confirmed,true);assert.equal(w.runtime.info(id).lifecycle.queue.items.length,0);assert.equal(agent.session,session);assert.equal(c.official.calls.filter(call=>call.method==='initialize').length,2);
  assert.deepEqual(agent.record.events.filter(e=>e.type==='assistant/message').flatMap(e=>e.data.message.content).map(p=>p.text),['displayed',' recovery']);
  const controller={cancel:()=>({native:true})},ctx={inject(deps,fn){if(deps.includes('sessionController'))fn({sessionController:controller,effect(){}})}};installMirrorGuards(ctx,w.runtime);
  assert.deepEqual(await controller.cancel({sessionId:id}),{accepted:true});const stop=c.official.calls.filter(call=>call.params?.type==='stop');assert.equal(stop.length,1);assert.equal(stop[0].params.payload.expectedForegroundExecutionId,'new-run');assert.deepEqual(controller.cancel({sessionId:'native'}),{native:true});
  assert.equal(c.official.calls.filter(call=>['createSession','sendText'].includes(call.params?.type)).length,0);
 }finally{await w.runtime.dispose();c.close()}
});

test('S04 official edit/send-now availability and reservation guards; delete remains denied',async()=>{
 const c=carrier(),f=agentFixture();f.peer=c.peer;f.record.workspace='/execution';f.agent=new ZCodeAgent({},f.session,f.record,{...f.dependencies,peer:c.peer});c.official.snapshot=baseSnapshot(f.record.officialId);
 try{await f.agent.connect();await tick();const s=structuredClone(c.official.snapshot);s.seq=1;s.queue.items=[queueItem()];s.availability.queueEdit={allowed:true};s.availability.sendQueuedNow={allowed:true};c.official.publish(s);
  await f.agent.queueAction({action:'edit',queueItemId:'q-1',newText:'Edited'});await f.agent.queueAction({action:'sendNow',queueItemId:'q-1'});
  assert.deepEqual(c.official.calls.filter(call=>call.method==='v4/command').map(call=>[call.params.type,call.params.payload]),[['editQueueItem',{queueItemId:'q-1',newText:'Edited'}],['sendQueuedNow',{queueItemId:'q-1'}]]);
  s.seq++;s.queue.items[0].dispatch.state='reserved';c.official.publish(s);await assert.rejects(f.agent.queueAction({action:'edit',queueItemId:'q-1',newText:'Late'}),{code:'guard.queueItemReserved'});
  await assert.rejects(f.agent.queueAction({action:'remove',queueItemId:'q-1'}),{code:'official-inbox-edit-unavailable'});await assert.rejects(c.relay.request('v4/command',{commandId:'delete',clientId:'x',sessionId:f.record.officialId,issuedAt:0,type:'deleteSession',payload:{}}),{code:'execution-command-denied'});
 }finally{await f.agent.dispose();c.close()}
});

test('S04 D4-a receipt evidence distinguishes accepted, queued, rejected and outcome-unknown without guessing from running',()=>{
 const ack={status:'accepted',commandId:'a'};assert.equal(receiptClass({commandId:'a',state:'accepted',ack}),'accepted');assert.equal(receiptClass({commandId:'a',state:'accepted',ack},[queueItem('a')]),'queued');assert.equal(receiptClass({state:'accepted',ack:{...ack,result:{type:'inputDisposition',delivery:'queue'}}}),'queued');assert.equal(receiptClass({state:'projected',ack:{...ack,result:{type:'inputDisposition',delivery:'queue'}}}),'accepted');assert.equal(receiptClass({state:'failed',ack:{status:'rejected'}}),'rejected');assert.equal(receiptClass({state:'outcome-unknown'}),'outcome-unknown');assert.equal(receiptClass({state:'outcome-unknown',ack}),'accepted');assert.equal(receiptClass({state:'prepared'}),'pending');
});

function barrierPeer(){
 const events=new Set(),states=new Set(),flights=[];
 const launcher={state:{phase:'ready'},onExecutionEvent:fn=>{events.add(fn);return ()=>events.delete(fn)},subscribe:fn=>{states.add(fn);return ()=>states.delete(fn)},execution:(method,params)=>{const gate=Promise.withResolvers();flights.push({method,params,...gate});return gate.promise}};
 const peer=new LauncherPeer(launcher);
 return {peer,flights,emit:(topic,id)=>{for(const fn of events)fn({method:'v4/conversation/frame',params:{topic,subscriptionId:id}})},lost(){launcher.state={phase:'failed',reason:'app-server-exited'};for(const fn of states)fn(launcher.state)},ready(){launcher.state={phase:'ready'};for(const fn of states)fn(launcher.state)}};
}
test('S04 reservation barrier: resync and resubscribe buffer until async ACK observer completes',async()=>{
 const b=barrierPeer(),seen=[];b.peer.onNotification(event=>seen.push(event.params.subscriptionId));
 try{for(const method of ['v4/conversation/subscribe','v4/conversation/resync']){
  const callback=Promise.withResolvers(),entered=Promise.withResolvers(),params={topic:'conversation/one',...(method.endsWith('resync')?{subscriptionId:'new'}:{})};
  const pending=b.peer.request(method,params,{onResult:async raw=>{entered.resolve();await callback.promise;return raw}});
  b.emit(params.topic,'new');await tick();assert.equal(seen.length,0);
  b.flights.at(-1).resolve({ack:{subscriptionId:'new'}});await entered.promise;b.emit(params.topic,'new');assert.equal(seen.length,0);callback.resolve();await pending;
  assert.equal(b.peer.bufferedBytes,0);assert.equal(b.peer.reservations.size,0);seen.length=0;
 }}finally{b.peer.close()}
});

test('S04 reservation reconnect interleave: late old ACK cannot consume the new generation frame or baseline',async()=>{
 const b=barrierPeer(),seen=[],acks=[];b.peer.onNotification(event=>seen.push(event.params.subscriptionId));
 try{
  const old=b.peer.request('v4/conversation/subscribe',{topic:'conversation/one'},{onResult:()=>acks.push('old')});const rejected=assert.rejects(old,{code:'execution-disconnected'});
  b.emit('conversation/one','old');b.lost();assert.equal(b.peer.bufferedBytes,0);b.ready();
  const next=b.peer.request('v4/conversation/subscribe',{topic:'conversation/one'},{onResult:()=>acks.push('new')});b.emit('conversation/one','new');await tick();assert.deepEqual(seen,[]);
  b.flights[0].resolve({ack:{subscriptionId:'old'}});await rejected;assert.deepEqual(acks,[]);assert.deepEqual(seen,[]);
  b.flights[1].resolve({ack:{subscriptionId:'new'}});await next;assert.deepEqual(acks,['new']);assert.deepEqual(seen,['new']);assert.equal(b.peer.bufferedBytes,0);assert.equal(b.peer.reservations.size,0);
 }finally{b.peer.close()}
});

test('S04 reservation observer rejection and peer close release all held frames',async()=>{
 const b=barrierPeer(),seen=[];b.peer.onNotification(event=>seen.push(event));
 const rejected=b.peer.request('v4/conversation/resync',{topic:'conversation/one',subscriptionId:'one'},{onResult:()=>{throw Error('consumer rejected ACK')}});const check=assert.rejects(rejected,/consumer rejected ACK/);b.emit('conversation/one','one');b.flights[0].resolve({ack:{subscriptionId:'one'}});await check;assert.equal(b.peer.bufferedBytes,0);assert.equal(seen.length,0);
 const pending=b.peer.request('v4/conversation/subscribe',{topic:'conversation/one'});const closed=assert.rejects(pending,{code:'execution-disconnected'});b.emit('conversation/one','one');b.peer.close();b.flights[1].resolve({ack:{subscriptionId:'one'}});await closed;assert.equal(b.peer.bufferedBytes,0);assert.equal(b.peer.reservations.size,0);assert.equal(seen.length,0);
});

test('S04 idle cleanup releases per-workspace frame listeners; duplicate topic opens cannot leak subscriptions',async()=>{
 let listeners=0,seq=0;const relay=createExecutionRelay({workspacePath:'/execution',resolveWorkspace:async path=>({workspaceIdentity:path}),emit(){},channel:{listen(){listeners++;return ()=>listeners--},call:async(_service,name)=>({ack:{subscriptionId:name.startsWith('subscribe')?'sub-'+seq++:'unused'}})}});
 try{for(let i=0;i<70;i++){
  const params={topic:'conversation/'+i,workspace:{workspacePath:'/workspace-'+i,workspaceKey:'/workspace-'+i}};
  const result=await relay.request('v4/conversation/subscribe',params);assert.equal(listeners,1);await assert.rejects(relay.request('v4/conversation/subscribe',params),{code:'execution-subscription-active',sent:false});await relay.request('v4/conversation/unsubscribe',{...params,subscriptionId:result.ack.subscriptionId});assert.equal(listeners,0);
 }}finally{relay.dispose()}
});

test('S04 failed initialization retries instead of retaining a rejected handshake; reclaimed idle sessions stay lazy across disconnect',async()=>{
 const w=await world();let reject=true;const request=w.peer.request.bind(w.peer);w.peer.request=(method,...args)=>{if(method==='initialize'&&reject){reject=false;throw Object.assign(Error('mock init failed'),{code:'initialize-failed'})}return request(method,...args)};
 try{await assert.rejects(w.runtime.ensurePeer(),{code:'initialize-failed'});await w.runtime.ensurePeer();assert.equal(w.peer.calls.filter(call=>call.method==='hello').length,2)}finally{await w.runtime.dispose()}
 const f=await opened({idleSubscriptionMs:10000,reconnectDelayMs:5});try{
  await f.agent.conversation.suspend();const count=f.peer.calls.filter(call=>call.method==='v4/conversation/subscribe').length;f.peer.disconnect();await wait(20);assert.equal(f.agent.conversation.state.status,'idle');assert.equal(f.peer.calls.filter(call=>call.method==='v4/conversation/subscribe').length,count);assert.ok(f.agent.record.snapshot);await f.agent.connect();await tick();assert.equal(f.agent.conversation.state.status,'live');
 }finally{await f.agent.dispose()}
});

test('S04 durable control receipt: lost stop ACK is queried by original ID; projected native request never becomes pending again',async()=>{
 const f=await opened({reconnectDelayMs:1000});try{
  const s=structuredClone(f.peer.snapshot);s.seq=1;s.control.canStop=true;s.control.activeWorks=[{kind:'primaryTurn',startedAt:0,foregroundExecutionId:'stop-run'}];f.peer.publish(s);
  f.peer.loseAck=true;const result=await f.agent.stop();const id=result.commandId;assert.equal(f.record.operations[id].state,'outcome-unknown');assert.equal(f.record.operations[id].payload.expectedForegroundExecutionId,'stop-run');
  f.peer.disconnect();await f.agent.reconnect();await tick();assert.equal(f.record.operations[id].ack.status,'accepted');assert.deepEqual(f.peer.calls.find(call=>call.method==='v4/commands/query').params.commands,[{sessionId:f.record.officialId,commandId:id}]);assert.equal(f.peer.calls.filter(call=>call.params?.type==='stop').length,1);
  const {operation}=f.agent.commands.receive(input('native-rpc'),'next-turn');f.agent.commands.project(operation.commandId);f.agent.commands.receipt(operation.commandId,{commandId:operation.commandId,state:'running',ack:{commandId:operation.commandId,status:'accepted'}});assert.equal(operation.state,'projected');assert.deepEqual(f.agent.commands.pending('next-turn'),[]);
 }finally{await f.agent.dispose()}
});

test('S04 sent-unconfirmed disk recovery queries its original native command exactly once without a replay',async()=>{
 const record={id:'disk-mirror',officialId:'official-session',workspace:'/execution',authority:'official-host',events:[],operations:{'disk-command':{commandId:'disk-command',type:'sendText',state:'sent-unconfirmed',requestId:'native-rpc',target:'next-turn',message:input('native-rpc')}}};
 const w=await world({records:[record]});w.peer.acks.set('disk-command',{commandId:'disk-command',status:'accepted',revisionAtDecision:0});
 try{await w.runtime.start();await tick();assert.deepEqual(w.peer.calls.find(call=>call.method==='v4/commands/query').params.commands,[{sessionId:'official-session',commandId:'disk-command'}]);assert.equal(record.operations['disk-command'].state,'accepted');assert.equal(w.peer.calls.filter(call=>call.method==='v4/command').length,0)}finally{await w.runtime.dispose()}
});

test('S04 failed idle unsubscribe retains ownership and explicit reason until confirmed cleanup; never silently consumes more capacity',async()=>{
 const f=await opened({idleSubscriptionMs:10000,reconnectDelayMs:1000});const request=f.peer.request.bind(f.peer);let reject=true;
 f.peer.request=(method,...args)=>method==='v4/conversation/unsubscribe'&&reject?Promise.reject(Object.assign(Error('mock release denied'),{code:'release-denied'})):request(method,...args);
 try{const old=f.agent.conversation.state.subscriptionId;assert.equal(await f.agent.conversation.suspend(),false);assert.equal(f.agent.conversation.state.subscriptionId,old);assert.equal(lifecycle(f).reason,'subscription-release-uncertain');assert.equal(lifecycle(f).confirmed,false);await assert.rejects(f.agent.connect(),{code:'subscription-release-uncertain'});assert.equal(f.peer.calls.filter(call=>call.method==='v4/conversation/subscribe').length,1);reject=false;await f.agent.connect();await tick();assert.equal(f.agent.conversation.state.status,'live');assert.equal(f.peer.subscriptions.size,1)}finally{reject=false;await f.agent.dispose()}
});

test('S04 reclaim interleave: synchronous idle observer cannot resubscribe before unsubscribe settles',async()=>{
 const c=carrier(),f=agentFixture();f.record.workspace='/execution';f.agent=new ZCodeAgent({},f.session,f.record,{...f.dependencies,peer:c.peer,idleSubscriptionMs:10000});c.official.snapshot=baseSnapshot(f.record.officialId);let reopening,attempted=false;
 try{await f.agent.connect();await tick();const off=f.agent.conversation.subscribe(state=>{if(state.status==='idle'&&!attempted){attempted=true;reopening=f.agent.conversation.connect({forceSnapshot:true});void reopening.catch(()=>{})}});
  try{await f.agent.conversation.suspend();await reopening;await tick();assert.equal(f.agent.conversation.state.status,'live');assert.deepEqual(c.official.calls.filter(call=>call.method.startsWith('v4/conversation/')).map(call=>call.method),['v4/conversation/subscribe','v4/conversation/unsubscribe','v4/conversation/subscribe']);assert.equal(c.official.subscriptions.size,1)}finally{off()}
 }finally{await f.agent.dispose();c.close()}
});

test('S04 disposal waits for an admitted control receipt before releasing its Agent scope',async()=>{
 const f=await opened(),gate=Promise.withResolvers(),request=f.peer.request.bind(f.peer);let stopping,disposing;
 try{
  const s=structuredClone(f.peer.snapshot);s.seq++;s.control.canStop=true;s.control.activeWorks=[{kind:'primaryTurn',startedAt:0,foregroundExecutionId:'held-stop'}];f.peer.publish(s);
  f.peer.request=async(method,params,options)=>{const result=await request(method,params,options);if(params?.type==='stop')await gate.promise;return result};
  stopping=f.agent.stop();await tick();disposing=f.agent.dispose();await tick();assert.equal(f.scopeDisposals.length,0);gate.resolve();await stopping;await disposing;assert.equal(f.scopeDisposals.length,1);assert.equal(Object.values(f.record.operations)[0].ack.status,'accepted');
 }finally{gate.resolve();await stopping?.catch(()=>{});await disposing;await f.agent.dispose()}
});
