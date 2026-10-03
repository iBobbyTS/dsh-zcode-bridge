import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation, negotiatedClientHello } from '../packages/host/conversation.mjs';
import { encodeTopicWireFrames, measureTopicNotificationEnvelopeBytes, parseCommandEnvelope } from '../packages/host/vendor/zcode/v4.mjs';
const fixtures={};for(const name of ['success','failure','gap','lateframe'])fixtures[name]=JSON.parse(await readFile(new URL('./fixtures/s03a/'+name+'.json',import.meta.url)));
const clone=structuredClone,tick=()=>new Promise(r=>setImmediate(r));
function fixture({runnable=true,clientMode='web-remote-replayable',peerTimeout=30,...options}={}){
 const input=new PassThrough(),output=new PassThrough(),sent=[];
 output.on('data',b=>sent.push(JSON.parse(b)));const peer=new ProtocolPeer(input,output,{timeoutMs:peerTimeout});
 const conversation=new V4Conversation(peer,{address:{runtime:'zcode',authority:'test-authority',workspace:'/fixture/workspace',sessionId:'fixture-session'},workspace:{workspacePath:'/fixture/workspace',workspaceKey:'/fixture/workspace'},clientId:'fixture-client',connectionId:'fixture-connection',clientMode,runnable,frameTimeoutMs:100,...options});
 const receive=m=>input.write(JSON.stringify(m)+'\n');
 const response=(request,result)=>receive({id:request.id,result});
 const wire=frame=>receive({method:'v4/conversation/frame',params:frame});
 async function open(initial=fixtures.success.initial,ack=fixtures.success.ack){
  const p=conversation.connect();input.write(JSON.stringify({id:sent.at(-1).id,result:ack})+'\n'+JSON.stringify({method:'v4/conversation/frame',params:initial})+'\n');await p;return conversation;
 }
 const dispose=()=>peer.close();
 return {input,output,sent,peer,conversation,receive,response,wire,open,dispose};
}
function turnWire(commandId,state='running',ordinal=2){
 const w=clone(fixtures.success.online);w.logicalFrameId='turn-'+ordinal;w.logicalFrameOrdinal=ordinal;w.frame.fromSeq=ordinal-2;w.frame.toSeq=ordinal-1;
 w.frame.payload.deltas=[{op:'row.appended',row:{kind:'turnHeader',rowId:ordinal,entityId:'turn-entity',turnId:'turn-1',sourceCommandId:commandId,origin:'userInput',state,startedAt:0,createdAt:0,createdAtSeq:ordinal}}];return w;
}
test('real source success/failure fixtures parse, ACK and initial snapshot in same batch establish admission',async()=>{
 for(const {params,result} of fixtures.failure.commands){assert.ok(result.reasonCode);assert.ok(['failed','stale','rejected'].includes(result.status));if(params.type==='sendText')assert.equal(parseCommandEnvelope(params).ok,false)}
 const f=fixture();try{await f.open();assert.equal(f.conversation.state.status,'live');assert.equal(f.conversation.state.snapshot.sessionId,'fixture-session');assert.equal(f.conversation.admission.allowed,true);assert.equal(f.sent[0].params.workflowRunDeltas,undefined);assert.equal(f.sent[0].params.base,undefined)}finally{f.dispose()}
});
test('B03 fixture interval (10,12] then (13,14] detects (12,13], same-sub resync uses actual applied base',async()=>{
 const f=fixture();try{
  await f.open(fixtures.gap.initial);f.wire(fixtures.gap.advance);assert.equal(f.conversation.state.snapshot.seq,12);
  f.wire(fixtures.gap.gap);assert.equal(f.conversation.state.snapshot.seq,12);assert.deepEqual(f.conversation.state.gap,fixtures.gap.expectedGap);assert.equal(f.conversation.admission.allowed,false);
  const req=f.sent.at(-1);assert.equal(req.method,'v4/conversation/resync');assert.deepEqual(req.params.base,{logEpoch:fixtures.gap.ack.ack.logEpoch,seq:12});
  f.wire(fixtures.lateframe.frame);assert.equal(f.conversation.state.snapshot.seq,12);
  const recovered=clone(fixtures.gap.ack);delete recovered.ack.openTiming;
  f.input.write(JSON.stringify({id:req.id,result:recovered})+'\n'+JSON.stringify({method:'v4/conversation/frame',params:fixtures.gap.recovery})+'\n');await tick();assert.equal(f.conversation.state.status,'live');assert.equal(f.conversation.state.snapshot.seq,14);
  const late=clone(fixtures.gap.advance);late.logicalFrameOrdinal=5;late.logicalFrameId='late';f.wire(late);assert.equal(f.conversation.state.snapshot.seq,14);
 }finally{f.dispose()}
});
test('B03 resume requires actual matching epoch state; snapshot ACK cannot authorize deltas',async()=>{
 const f=fixture();try{
  const p=f.conversation.connect();f.response(f.sent[0],fixtures.success.ack);await p;
  f.wire(fixtures.success.online);assert.equal(f.conversation.state.snapshot,null);assert.equal(f.sent.at(-1).params.base,null);assert.equal(f.sent.at(-1).params.forceSnapshot,true);
 }finally{f.dispose()}
 for(const invalid of ['resume','empty-id','empty-epoch']){const g=fixture();try{const p=g.conversation.connect();const ack=clone(fixtures.success.ack);if(invalid==='resume')ack.ack.mode='resume';if(invalid==='empty-id')ack.ack.subscriptionId='';if(invalid==='empty-epoch')ack.ack.logEpoch='';g.response(g.sent[0],ack);await assert.rejects(p);assert.equal(g.peer.closed,true)}finally{g.dispose()}}
});
test('B03 held baseline survives reconnect; old subscription cannot write and epoch replacement is atomic',async()=>{
 const f=fixture();try{
  await f.open(fixtures.gap.initial);const old=f.conversation.state.snapshot;
  const p=f.conversation.connect();assert.deepEqual(f.sent.at(-1).params.base,{logEpoch:old.logEpoch,seq:10});
  const ack=clone(fixtures.success.ack);ack.ack.subscriptionId='next-sub';ack.ack.logEpoch='next-epoch';f.response(f.sent.at(-1),ack);await p;
  f.wire(fixtures.gap.advance);assert.equal(f.conversation.state.snapshot.seq,10);
  const replacement=clone(fixtures.success.initial);replacement.subscriptionId=replacement.frame.subscriptionId='next-sub';replacement.frame.payload.snapshot.logEpoch='next-epoch';f.wire(replacement);
  assert.equal(f.conversation.state.snapshot.logEpoch,'next-epoch');assert.equal(f.conversation.state.snapshot.seq,0);
 }finally{f.dispose()}
});
test('B03 recovery aligned empty interval closes flight without reapplying; malformed core requests one bounded recovery',async()=>{
 const f=fixture();try{
  await f.open();const p=f.conversation.resync();const ack=clone(fixtures.success.ack);ack.ack.mode='resume';delete ack.ack.openTiming;f.response(f.sent.at(-1),ack);
  const empty=clone(fixtures.success.online);empty.deliveryKind='recovery';empty.frame.fromSeq=empty.frame.toSeq=0;f.wire(empty);await p;assert.equal(f.conversation.state.status,'live');
  const broken=turnWire('x','running',3);broken.frame.payload.deltas[0].row.kind='newCoreRow';f.wire(broken);assert.equal(f.sent.at(-1).method,'v4/conversation/resync');
  const req=f.sent.at(-1);f.response(req,fixtures.success.ack);broken.deliveryKind='recovery';broken.logicalFrameOrdinal=4;broken.logicalFrameId='bad-recovery';f.wire(broken);await tick();assert.equal(f.conversation.state.status,'error');assert.equal(f.conversation.admission.allowed,false);
 }finally{f.dispose()}
});
test('B03 physical fragments are atomic, UTF-8 split reassembles, checksum fault recovers, cancellation frees staging',async()=>{
 const f=fixture();try{
  await f.open();const logical=clone(fixtures.success.initial.frame);logical.toSeq=logical.payload.snapshot.seq=1;logical.payload.snapshot.meta.title='你好'.repeat(500);
  const wires=encodeTopicWireFrames(logical,{deliveryKind:'online',topic:logical.topic,subscriptionId:logical.subscriptionId,logicalFrameId:'fragments',logicalFrameOrdinal:2,maxPhysicalFrameBytes:3000,measurePhysicalFrameBytes:w=>measureTopicNotificationEnvelopeBytes(w).maxBytes});assert.ok(wires.length>1);
  for(const w of wires.slice(0,-1).reverse())f.wire(w);assert.equal(f.conversation.state.snapshot.seq,0);assert.ok(f.conversation.assemblyStats.stagedDecodedBytes>0);f.wire(wires.at(-1));assert.equal(f.conversation.state.snapshot.meta.title,'你好'.repeat(500));assert.equal(f.conversation.assemblyStats.assemblies,0);
  const broken=clone(wires[0]);broken.logicalFrameOrdinal=3;broken.logicalFrameId='broken';broken.checksum.value='00000000';f.wire(broken);assert.equal(f.conversation.assemblyStats.assemblies,1);
  const cancelling=f.conversation.cancel();f.response(f.sent.at(-1),{});await cancelling;assert.deepEqual(f.conversation.assemblyStats,{assemblies:0,stagedDecodedBytes:0});
 }finally{f.dispose()}
});
test('B04 accepted command without terminal stays accepted; lost ACK queries same id and never replays command',async()=>{
 const f=fixture();try{
  await f.open();const p=f.conversation.submit({type:'sendText',payload:{text:'fixture only'},commandId:'stable-command'});
  const req=f.sent.at(-1);assert.equal(req.params.commandId,'stable-command');const lost=await p;assert.equal(lost.state,'outcome-unknown');assert.equal(lost.error,'request-timeout');
  const query=f.conversation.queryCommand('stable-command');assert.deepEqual(f.sent.at(-1).params,{commands:[{sessionId:'fixture-session',commandId:'stable-command'}]});
  const ack={...fixtures.success.accepted.result,commandId:'stable-command'};f.response(f.sent.at(-1),{results:[{key:{sessionId:'fixture-session',commandId:'stable-command'},result:ack}]});await query;assert.equal(f.conversation.command('stable-command').state,'accepted-awaiting-terminal');
  f.receive({id:req.id,result:ack});assert.equal(f.peer.closed,false);
  await assert.rejects(f.conversation.submit({type:'sendText',payload:{text:'again'},commandId:'stable-command'}),{code:'command-already-tracked'});
  assert.equal(f.sent.filter(x=>x.method==='v4/command').length,1);
  f.wire(turnWire('different-command'));assert.equal(f.conversation.command('stable-command').state,'accepted-awaiting-terminal');
  const done=turnWire('stable-command','completedSuccess',3);f.wire(done);assert.equal(f.conversation.command('stable-command').state,'completed');
 }finally{f.dispose()}
});
test('B04 terminal before ACK cannot regress; rejected/stale/failed/native reason codes remain distinct',async()=>{
 for(const source of fixtures.failure.commands){
  const f=fixture();try{await f.open();const p=f.conversation.submit({type:'setFollowupMode',payload:{mode:'queue'},commandId:'cmd'});f.response(f.sent.at(-1),{...source.result,commandId:'cmd'});const record=await p;assert.equal(record.state,source.result.status);assert.equal(record.ack.reasonCode,source.result.reasonCode)}finally{f.dispose()}
 }
 const f=fixture();try{await f.open();const p=f.conversation.submit({type:'sendText',payload:{text:'fixture'},commandId:'cmd'});f.wire(turnWire('cmd','failed'));f.response(f.sent.at(-1),{...fixtures.success.accepted.result,commandId:'cmd'});assert.equal((await p).state,'failed')}finally{f.dispose()}
});
test('B04 CAS/epoch/row and stop identities are sourced from actual projection; wrong ACK/query key fails closed',async()=>{
 const f=fixture();try{
  await f.open();await assert.rejects(f.conversation.submit({type:'stop',payload:{}}),{code:'stop-target-unconfirmed'});await assert.rejects(f.conversation.submit({type:'resolveInteraction',payload:{interactionId:'other',answer:{optionId:'yes'}}}),{code:'interaction-unconfirmed'});
  await assert.rejects(f.conversation.submit({type:'retryTurn',payload:{target:{rowId:9,entityId:'foreign'}}}),{code:'row-target-unconfirmed'});
  const p=f.conversation.submit({type:'setFollowupMode',payload:{mode:'queue'},commandId:'cas'});assert.equal(f.sent.at(-1).params.baseRevision,0);f.response(f.sent.at(-1),{...fixtures.success.accepted.result,commandId:'wrong'});await p;assert.equal(f.peer.closed,true);assert.equal(f.conversation.state.status,'closed');
 }finally{f.dispose()}
});
test('B04 query unknown and cancellation/EOF are uncertain outcomes; cancel is idempotent and has no runtime stop',async()=>{
 const f=fixture();try{
  await f.open();const p=f.conversation.submit({type:'sendText',payload:{text:'fixture'},commandId:'cancelled-command'});assert.equal(f.conversation.cancelCommand('cancelled-command'),true);assert.equal(f.conversation.cancelCommand('cancelled-command'),false);assert.equal((await p).state,'outcome-unknown');
  const q=f.conversation.queryCommand('cancelled-command');f.response(f.sent.at(-1),{results:[{key:{sessionId:'fixture-session',commandId:'cancelled-command'},result:'unknown'}]});assert.equal((await q).state,'outcome-unknown');
  const cancelling=f.conversation.cancel(),again=f.conversation.cancel();assert.equal(cancelling,again);f.response(f.sent.at(-1),{});await cancelling;assert.equal(f.sent.filter(x=>x.method==='v4/conversation/unsubscribe').length,1);assert.equal(f.sent.some(x=>x.params?.type==='stop'||x.method==='session/close'),false);
 }finally{f.dispose()}
});
test('B08 strict handshake feature bits require explicit Host support; profile baselines are separate and restricted stays safe',async()=>{
 const hello={kind:'hello',protocolVersion:3,connectionId:'c',clientMode:'web-remote-replayable',deliveryProfile:'replayable',serverTime:0,capabilities:{nativeDialogs:false,localTerminal:false,binaryFrames:false,compression:'none'},auth:{}};
 assert.equal(negotiatedClientHello(hello,{clientId:'a',appVersion:'1'}).capabilities,undefined);hello.capabilities.workflowRunDeltas=true;assert.deepEqual(negotiatedClientHello(hello,{clientId:'a',appVersion:'1'}).capabilities,{workflowRunDeltas:true});assert.throws(()=>negotiatedClientHello({...hello,newTrustedField:true},{clientId:'a',appVersion:'1'}));
 for(const clientMode of ['desktop-continuous','web-remote-replayable']){
  const f=fixture({clientMode,runnable:false});try{await f.open();assert.equal(f.sent[0].params.clientMode,clientMode);assert.equal(f.conversation.state.profile,clientMode==='desktop-continuous'?'continuous':'replayable');assert.equal(f.conversation.admission.allowed,false);await assert.rejects(f.conversation.submit({type:'sendText',payload:{text:'no'}}),{code:'runtime-restricted'});assert.throws(()=>{f.conversation.clientMode='desktop-continuous'})}finally{f.dispose()}
 }
});
test('cancel during subscribe cleans its late owned ACK; assembly deadline and recovery deadline do not hang',async()=>{
 const f=fixture();const p=f.conversation.connect(),cancel=f.conversation.cancel();f.response(f.sent[0],fixtures.success.ack);await p;await tick();assert.equal(f.sent.at(-1).method,'v4/conversation/unsubscribe');f.response(f.sent.at(-1),{});await cancel;assert.equal(f.conversation.state.status,'closed');f.dispose();
 const g=fixture({frameTimeoutMs:10,peerTimeout:100});try{const p=g.conversation.connect();g.response(g.sent[0],fixtures.success.ack);await p;await new Promise(r=>setTimeout(r,20));assert.equal(g.sent.at(-1).method,'v4/conversation/resync');g.response(g.sent.at(-1),fixtures.success.ack);await new Promise(r=>setTimeout(r,20));assert.equal(g.conversation.state.error,'recovery-frame-timeout')}finally{g.dispose()}
});
test('B03 checksum/assembly timeout/size bound faults release all bytes and request authoritative recovery',async()=>{
 for(const fault of ['checksum','timeout','size']){
  const f=fixture({assemblyOptions:{timeoutMs:10,maxAssemblyBytes:5000}});try{
   await f.open();const logical=clone(fixtures.success.initial.frame);logical.toSeq=logical.payload.snapshot.seq=1;logical.payload.snapshot.meta.title='好'.repeat(fault==='size'?2000:600);
   const wires=encodeTopicWireFrames(logical,{deliveryKind:'online',topic:logical.topic,subscriptionId:logical.subscriptionId,logicalFrameId:'fault-'+fault,logicalFrameOrdinal:2,maxPhysicalFrameBytes:3000,measurePhysicalFrameBytes:w=>measureTopicNotificationEnvelopeBytes(w).maxBytes});
   if(fault==='checksum'){for(const w of wires){w.checksum.value='00000000';f.wire(w)}}
   else if(fault==='timeout'){f.wire(wires[0]);await new Promise(r=>setTimeout(r,20))}
   else f.wire(wires[0]);
   assert.equal(f.sent.at(-1).method,'v4/conversation/resync');assert.equal(f.sent.at(-1).params.forceSnapshot,true);assert.equal(f.conversation.state.snapshot.seq,0);assert.deepEqual(f.conversation.assemblyStats,{assemblies:0,stagedDecodedBytes:0});
  }finally{f.dispose()}
 }
});
test('B04 running/waiting/completed follow only correlated turn/interaction anchors, row CAS carries logEpoch',async()=>{
 const f=fixture();try{
  await f.open();const p=f.conversation.submit({type:'sendText',payload:{text:'fixture'},commandId:'anchored'});f.response(f.sent.at(-1),{...fixtures.success.accepted.result,commandId:'anchored'});await p;
  f.wire(turnWire('anchored'));assert.equal(f.conversation.command('anchored').state,'running');
  const waiting=clone(fixtures.success.online);waiting.logicalFrameId='waiting';waiting.logicalFrameOrdinal=3;waiting.frame.fromSeq=1;waiting.frame.toSeq=2;
  waiting.frame.payload.deltas=[{op:'state.updated',patch:{pendingInteractions:[{interactionId:'ask-1',kind:'userInput',anchorRowId:2,createdAt:0,payload:{kind:'userInput',prompt:'Fixture?',freeText:true}}]}}];f.wire(waiting);assert.equal(f.conversation.command('anchored').state,'waiting');
  const retry=f.conversation.submit({type:'retryTurn',payload:{target:{rowId:2,entityId:'turn-entity'}},commandId:'retry'});assert.equal(f.sent.at(-1).params.baseRevision,0);assert.equal(f.sent.at(-1).params.baseLogEpoch,fixtures.success.ack.ack.logEpoch);f.response(f.sent.at(-1),{...fixtures.success.accepted.result,commandId:'retry'});await retry;
  const stopProjection=clone(waiting);stopProjection.logicalFrameId='stop-projection';stopProjection.logicalFrameOrdinal=4;stopProjection.frame.fromSeq=2;stopProjection.frame.toSeq=3;stopProjection.frame.payload.deltas=[{op:'state.updated',patch:{control:{...fixtures.success.initial.frame.payload.snapshot.control,canStop:true,activeWorks:[{kind:'primaryTurn',foregroundExecutionId:'execution-1',startedAt:0}]}}}];f.wire(stopProjection);
  const stop=f.conversation.submit({type:'stop',payload:{expectedForegroundExecutionId:'execution-1'},commandId:'stop'});assert.equal(f.sent.at(-1).params.payload.expectedForegroundExecutionId,'execution-1');f.response(f.sent.at(-1),{...fixtures.success.accepted.result,commandId:'stop'});await stop;
 }finally{f.dispose()}
});
test('B04 wrong query key cannot update tracked command, and EOF closes state with no implicit retry',async()=>{
 const f=fixture();try{await f.open();const p=f.conversation.submit({type:'sendText',payload:{text:'fixture'},commandId:'key'});f.response(f.sent.at(-1),{...fixtures.success.accepted.result,commandId:'key'});await p;
  const q=f.conversation.queryCommand('key');f.response(f.sent.at(-1),{results:[{key:{sessionId:'foreign',commandId:'key'},result:'unknown'}]});await assert.rejects(q);assert.equal(f.peer.closed,true);assert.equal(f.sent.filter(x=>x.method==='v4/command').length,1);
 }finally{f.dispose()}
 const g=fixture();try{await g.open();const p=g.conversation.submit({type:'sendText',payload:{text:'fixture'},commandId:'eof'});g.input.end();const record=await p;assert.equal(record.state,'outcome-unknown');assert.equal(g.conversation.admission.allowed,false);assert.equal(g.conversation.state.error,'transport-eof')}finally{g.dispose()}
});
test('B03 recovery ACK/frame/gap in one batch schedules successor, and consumer cancel during status publication sends no orphan work',async()=>{
 const f=fixture();try{
  await f.open(fixtures.gap.initial);const p=f.conversation.resync();const req=f.sent.at(-1);const recovered=clone(fixtures.gap.ack);delete recovered.ack.openTiming;
  const nextGap=clone(fixtures.gap.gap);nextGap.logicalFrameOrdinal=5;nextGap.logicalFrameId='post-recovery-gap';nextGap.frame.fromSeq=15;nextGap.frame.toSeq=16;
  f.input.write([JSON.stringify({id:req.id,result:recovered}),JSON.stringify({method:'v4/conversation/frame',params:fixtures.gap.recovery}),JSON.stringify({method:'v4/conversation/frame',params:nextGap})].join('\n')+'\n');
  await p;await tick();assert.equal(f.conversation.state.status,'resyncing');assert.equal(f.conversation.admission.allowed,false);assert.equal(f.sent.filter(x=>x.method==='v4/conversation/resync').length,2);assert.equal(f.sent.at(-1).params.base.seq,14);
 }finally{f.dispose()}
 const g=fixture();let cancel;g.conversation.onChange=state=>{if(state.status==='connecting')cancel=g.conversation.cancel()};await g.conversation.connect();await cancel;assert.equal(g.sent.length,0);assert.equal(g.peer.pendingCount,0);g.dispose();
 const h=fixture();await h.open();h.conversation.onChange=state=>{if(state.status==='resyncing')cancel=h.conversation.cancel()};const p=h.conversation.resync();assert.equal(h.sent.at(-1).method,'v4/conversation/unsubscribe');h.response(h.sent.at(-1),{});await p;await cancel;assert.equal(h.sent.filter(x=>x.method==='v4/conversation/resync').length,0);h.dispose();
});
test('B03 unrouteable mandatory frame fails safe; foreign/optional notifications stay isolated',async()=>{
 const f=fixture();try{await f.open();f.receive({method:'v4/telemetry/event',params:{anything:'optional'}});assert.equal(f.sent.length,1);
  f.receive({method:'v4/conversation/frame',params:{kind:'complete'}});assert.equal(f.sent.at(-1).method,'v4/conversation/resync');assert.equal(f.conversation.admission.allowed,false);
 }finally{f.dispose()}
});
test('observer failure cannot corrupt projection or prevent transport owner cleanup',async()=>{
 const f=fixture({onChange:()=>{throw Error('Consumer failure')}});await f.open();assert.equal(f.conversation.state.status,'live');assert.ok(f.conversation.state.observerErrors>0);assert.equal(f.peer.closed,false);
 let closed;f.peer.onClose=code=>closed=code;f.peer.onClosed(()=>{throw Error('Teardown failure')});f.dispose();assert.equal(closed,'disposed');assert.equal(f.conversation.state.status,'closed');
});
test('unsubscribe rejection is visible after idempotent local cancellation',async()=>{
 const f=fixture();try{await f.open();const cancelled=f.conversation.cancel();f.receive({id:f.sent.at(-1).id,error:{code:-32602,message:'Rejected unsubscribe'}});await cancelled;
  assert.equal(f.conversation.state.status,'closed');assert.deepEqual(f.conversation.state.cleanupError,{code:'runtime-rejected',protocolCode:-32602});assert.equal(f.conversation.admission.allowed,false);await f.conversation.cancel();assert.equal(f.sent.filter(x=>x.method==='v4/conversation/unsubscribe').length,1);
 }finally{f.dispose()}
});
