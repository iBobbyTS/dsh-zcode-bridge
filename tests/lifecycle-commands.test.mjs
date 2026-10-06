import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COMMAND_REJECTIONS,requestedDelivery} from '../packages/driver/index.mjs';
import {DriverTransport} from '../packages/driver/transport.mjs';
import {installDriver} from '../packages/driver/factory.mjs';
import {driverFixture} from './helpers/zcode-driver-fixture.mjs';
import {commandWorld,message,queueItem,tick} from './helpers/lifecycle-commands.mjs';
import {row} from './helpers/zcode-runtime-fixture.mjs';

const commands=w=>w.peer.calls.filter(call=>call.method==='v4/command').map(call=>call.params);
function publish(w,edit){const snapshot=structuredClone(w.peer.snapshot);snapshot.seq++;snapshot.revision++;edit(snapshot);w.peer.publish(snapshot);assert.equal(w.agent.conversation.state.observerErrors,0)}

test('delivery table and consecutive idle followups avoid busy startNow preemption',async()=>{
  for(const state of ['idle','turn-running','queue-paused']){
    const w=await commandWorld(state);
    try{
      assert.equal(requestedDelivery('next-turn',w.peer.snapshot),state==='idle'?'startNow':'queue');
      assert.equal(requestedDelivery('next-step',w.peer.snapshot),'guide');
      w.agent.followup(message('one'));await w.drain();
      if(state==='queue-paused'){assert.equal(commands(w).length,0);assert.equal(w.agent.lastError.code,'held-queue-confirmation-required');continue}
      assert.equal(commands(w)[0].payload.requestedDelivery,state==='idle'?'startNow':'queue');
      w.agent.followup(message('two'));w.agent.steer(message('three'));await w.drain();
      assert.deepEqual(commands(w).map(c=>c.payload.requestedDelivery),[state==='idle'?'startNow':'queue','queue','guide']);
      assert.equal(w.events.filter(e=>e.type==='agent/inbox/spliced').length,3);
      const first=commands(w)[0];
      publish(w,s=>{s.rows.window=[row('turnHeader',1,{origin:'userInput',state:'completedSuccess',startedAt:0,sourceCommandId:first.commandId})]});
      assert.equal(w.agent.conversation.command(first.commandId).state,'completed');
      assert.equal(w.agent.inbox.nextTurn.some(m=>m.id==='one'),false);
      assert.throws(()=>w.agent.followup(message('one')),{code:'official-message-already-admitted'});
    }finally{await w.close()}
  }
});

test('factory carries firstInput, selection and mode into the validated create envelope',async()=>{
  const f=driverFixture(),requests=[];
  const transport=new DriverTransport({});
  transport.ready=async()=> '/workspace';
  transport.peer={request:async(method,params)=>{requests.push(params);return {commandId:params.commandId,status:'accepted',revisionAtDecision:0,result:{type:'createSession',sessionId:'ACK-session'}}}};
  const selection={providerId:'A',modelId:'model_a'};
  const signal=new AbortController().signal;
  await transport.create({cwd:'/workspace',signal,firstInput:{text:'first'},modelSelection:selection,mode:'plan'});
  assert.deepEqual(requests[0].payload.firstInput,{text:'first',modelSelection:selection,mode:'plan'});
  await transport.create({signal,modelSelection:selection,mode:'yolo'});
  assert.deepEqual(requests[1].payload.config,{modelSelection:selection,mode:'yolo'});
  await assert.rejects(transport.create({signal,firstInput:{text:'bad',mode:'invalid'}}),{code:'command-invalid'});
  assert.equal(requests.length,2);
  let received;f.transport.create=async options=>{received=options;return 'ACK-session'};
  const driver=installDriver(f.ctx,f.deps);
  try{const handle=await driver.factory.createAgent(f.owner,{sessionId:'native',firstInput:{text:'first'},modelSelection:selection,mode:'plan'});assert.deepEqual(received.firstInput,{text:'first'});assert.deepEqual(handle.agent.options,{modelSelection:selection,mode:'plan'})}finally{await driver.dispose()}
});

test('ambiguous create carries the original command id and never resends',async()=>{
  const transport=new DriverTransport({});transport.ready=async()=> '/workspace';let sent;
  transport.peer={request:async(_method,params)=>{sent=params;throw Object.assign(new Error('lost'),{code:'execution-disconnected'})}};
  await assert.rejects(transport.create({signal:new AbortController().signal}),error=>{assert.equal(error.state,'outcome-unknown');assert.equal(error.commandId,sent.commandId);return true});
});

test('bidirectional queue edit/sendNow/reorder/autodrain and rename retain official receipts',async()=>{
  const w=await commandWorld('queue-paused');
  try{
    const pending=w.agent.inbox.nextTurn[0];assert.equal(pending.id,'zcode-queue:queue-1');
    assert.equal(w.agent.inbox.replace(pending.id,message(pending.id,'edited')),true);await w.drain();
    assert.equal(w.agent.inbox.nextTurn[0].content[0].text,'queued','ACK is not a snapshot mutation');
    publish(w,s=>{s.queue.items[0].text='edited'});
    assert.equal(w.agent.inbox.nextTurn[0].content[0].text,'edited');
    const sent=await w.agent.queueAction({queueItemId:'queue-1',action:'sendNow'});assert.equal(sent.state,'completed');
    await w.agent.queueAction({queueItemId:'queue-1',action:'reorder',beforeQueueItemId:null});
    await w.agent.submitControl({type:'setAutoDrain',payload:{autoDrain:true}});
    await w.agent.submitControl({type:'switchModelConfig',payload:{provider:'A',model:'model_a',thought:''}});
    const renamed=await w.agent.rename('new title');assert.equal(renamed.ack.status,'accepted');assert.equal(renamed.state,'completed','rename is settled by the authoritative V4 ACK ledger');
    assert.deepEqual(commands(w).map(c=>c.type),['editQueueItem','sendQueuedNow','reorderQueueItem','setAutoDrain','switchModelConfig','renameSession']);
    publish(w,s=>{s.queue.items=[]});assert.deepEqual(w.agent.inbox.nextTurn,[]);
    assert.ok(w.events.every(e=>e.seq===w.events.indexOf(e)));
    assert.equal(w.agent.inbox.replace('missing',message('missing')),false);
  }finally{await w.close()}
});

test('paused input requires explicit current queue disposition and preserves its command id',async()=>{
  for(const disposition of ['keepQueueAndSend','clearQueueAndSend']){
    const w=await commandWorld('queue-paused');
    try{
      w.agent.followup(message('held'));await w.drain();const commandId=w.agent.inputs.get('held').commandId;
      assert.equal(commands(w).length,0);
      const base={messageId:'held',disposition,expectedQueueItemIds:['queue-1'],baseRevision:w.peer.snapshot.revision,baseLogEpoch:w.peer.snapshot.logEpoch};
      await assert.rejects(w.agent.confirmHeldInput({...base,baseRevision:base.baseRevision-1}),{code:'held-queue-confirmation-stale'});
      const result=await w.agent.confirmHeldInput(base);assert.equal(result.commandId,commandId);assert.equal(commands(w)[0].payload.heldQueueDisposition,disposition);
      assert.throws(()=>w.agent.confirmHeldInput(base),{code:'held-input-unconfirmed'});
    }finally{await w.close()}
  }
});

test('cancel keeps inbox for UI stop; clear rejects remote queue and clears undispatched native work',async()=>{
  const w=await commandWorld('turn-running');
  try{
    w.agent.followup(message());await w.drain();const before=w.agent.inbox.nextTurn;
    const stop=await w.agent.cancel({kind:'user'},{keepInbox:true});assert.equal(stop.ack.status,'accepted');assert.equal(commands(w).at(-1).payload.expectedForegroundExecutionId,'foreground-1');assert.deepEqual(w.agent.inbox.nextTurn,before);
    publish(w,s=>{s.control.canStop=false;s.control.activeWorks=[]});assert.equal(w.agent.status,'idle');await w.agent.whenIdle();
  }finally{await w.close()}
  const paused=await commandWorld('queue-paused');
  try{assert.throws(()=>paused.agent.cancel({kind:'user'}),{code:'official-queue-clear-unavailable'});assert.equal(commands(paused).length,0)}finally{await paused.close()}
});

test('stale CAS, reserved queue and missing stop target fail before wire dispatch',async()=>{
  const w=await commandWorld('queue-paused');
  try{
    await assert.rejects(w.agent.queueAction({queueItemId:'queue-1',action:'edit',newText:'bad',baseRevision:w.peer.snapshot.revision+1}),{code:'proto.staleRevision'});
    await assert.rejects(w.agent.queueAction({queueItemId:'queue-1',action:'sendNow',baseLogEpoch:'stale'}),{code:'proto.staleLogEpoch'});
    publish(w,s=>{s.queue.items[0].dispatch.state='reserved'});
    await assert.rejects(w.agent.queueAction({queueItemId:'queue-1',action:'sendNow'}),{code:'guard.queueItemReserved'});
    await assert.rejects(w.agent.submitControl({type:'stop',payload:{expectedForegroundExecutionId:'stale'}}),{code:'stop-target-unconfirmed'});
    assert.equal(commands(w).length,0);
  }finally{await w.close()}
});

test('frozen rejection table has no implicit fallthrough success',async()=>{
  assert.deepEqual(COMMAND_REJECTIONS,{remove:'official-queue-remove-unavailable',deleteQueueItem:'official-queue-remove-unavailable',clearQueue:'official-queue-clear-unavailable',inject:'official-inject-unavailable',userInput:'interaction-mapping-unavailable',fork:'official-history-unavailable',retry:'official-history-unavailable',editHistory:'official-history-unavailable',splice:'official-inbox-splice-unavailable',prepend:'official-inbox-prepend-unavailable'});
  const w=await commandWorld();
  try{
    assert.throws(()=>w.agent.inbox.remove('missing'),{code:COMMAND_REJECTIONS.remove});
    assert.throws(()=>w.agent.inbox.splice(),{code:COMMAND_REJECTIONS.splice});assert.throws(()=>w.agent.inbox.prepend(),{code:COMMAND_REJECTIONS.prepend});
    assert.throws(()=>w.agent.inject(message()),{code:COMMAND_REJECTIONS.inject});
    for(const type of ['deleteQueueItem','fork','retry','editHistory','unknown'])assert.throws(()=>w.agent.submitControl({type,payload:{}}),{code:COMMAND_REJECTIONS[type]??'official-operation-unavailable'});
    assert.equal(commands(w).length,0);
  }finally{await w.close()}
});

const permission={interactionId:'permission-1',kind:'permission',anchorRowId:null,createdAt:0,payload:{kind:'permission',toolCallId:'call-1',toolName:'Bash',summary:'Run?',detail:{},options:[{kind:'allowOnce',optionId:'once',label:'Once'},{kind:'deny',optionId:'deny',label:'Deny'}]}};
test('permission waterfall maps allow/reject/cancel/unavailable once; userInput explicitly rejects',async()=>{
  for(const [outcome,answer] of [['allowed-once',{optionId:'once',action:'accept'}],['rejected',{optionId:'deny',action:'decline'}],['cancelled',{action:'cancel'}],['unavailable',null]]){
    let calls=0;const w=await commandWorld('idle',{approval:async request=>{calls++;assert.equal(request.agent,w.agent);assert.equal(request.callId,'call-1');return outcome}});
    try{
      publish(w,s=>{s.pendingInteractions=[permission]});await w.drain();
      assert.equal(calls,1);assert.equal(commands(w).length,answer?1:0);
      if(answer)assert.deepEqual(commands(w)[0].payload.answer,answer);
      publish(w,s=>{});await w.drain();assert.equal(calls,1);
      assert.deepEqual(w.events.filter(e=>e.type.startsWith('approval/')).map(e=>e.type),['approval/asked','approval/decided']);
      publish(w,s=>{s.pendingInteractions=[{interactionId:'question',kind:'userInput',anchorRowId:null,createdAt:0,payload:{kind:'userInput',prompt:'Question?',freeText:true}}]});
      assert.equal(w.agent.lastError.code,'interaction-mapping-unavailable');
      await assert.rejects(w.agent.submitControl({type:'resolveInteraction',payload:{interactionId:'question',answer:{action:'accept'}}}),{code:'interaction-mapping-unavailable'});
    }finally{await w.close()}
  }
});

test('image and file legs use DSH store bytes and the real host 384KiB upload transaction',async()=>{
  const bytes=new Uint8Array(384*1024+1).fill(7),reads=[];
  const store={async readImage(ref){reads.push(ref.attachmentId);return {data:bytes}},async *readFileStream(ref){reads.push(ref.attachmentId);yield new Uint8Array([1,2]);yield new Uint8Array([3])}};
  const w=await commandWorld('idle',{store});const original=w.peer.request.bind(w.peer);let upload=0;
  w.peer.request=async(method,params,options)=>{
    if(!method.startsWith('v4/attachment/'))return original(method,params,options);
    w.peer.calls.push({method,params:structuredClone(params)});
    if(method.endsWith('/begin'))return {uploadId:params.uploadId,state:'staging',nextChunkIndex:0};
    if(method.endsWith('/chunk'))return {uploadId:params.uploadId,nextChunkIndex:params.chunkIndex+1};
    if(method.endsWith('/commit'))return {ref:'ref-'+(++upload)};
    if(method.endsWith('/abort'))return {};
    throw Error(method);
  };
  try{
    const input=message();input.content.push({type:'image',attachment:{attachmentId:'image-1',name:'one.png',mediaType:'image/png',bytes:bytes.length,width:1,height:1}},{type:'file',attachment:{attachmentId:'file-1',name:'note.txt',bytes:3}});
    w.agent.followup(input);await w.drain();
    assert.deepEqual(reads,['image-1','file-1']);
    const chunks=w.peer.calls.filter(c=>c.method==='v4/attachment/chunk');assert.deepEqual(chunks.map(c=>Buffer.from(c.params.dataBase64,'base64').length),[384*1024,1,3]);
    assert.ok(chunks.every(c=>c.params.sessionId===w.agent.zcodeConversationId));
    assert.deepEqual(commands(w)[0].payload.attachments,[{ref:'ref-1',fileName:'one.png',mime:'image/png',bytes:bytes.length},{ref:'ref-2',fileName:'note.txt',mime:'application/octet-stream',bytes:3}]);
    publish(w,s=>{const queued=queueItem('own-queue',commands(w)[0].commandId);queued.attachments=commands(w)[0].payload.attachments;s.queue.items=[queued]});
    assert.equal(w.agent.inbox.nextTurn[0].content[1].attachment.attachmentId,'image-1');
  }finally{await w.close()}
});

test('failed upload aborts its transaction and dispatches no input',async()=>{
  const w=await commandWorld('idle',{store:{readImage:async()=>({data:new Uint8Array([1])})}});const request=w.peer.request.bind(w.peer);
  w.peer.request=async(method,params,options)=>{
    if(!method.startsWith('v4/attachment/'))return request(method,params,options);
    w.peer.calls.push({method,params});
    if(method.endsWith('/begin'))return {uploadId:params.uploadId,state:'staging',nextChunkIndex:0};
    if(method.endsWith('/chunk'))throw Object.assign(new Error('failed'),{code:'chunk-failed'});
    if(method.endsWith('/abort'))return {};
  };
  try{const input=message();input.content.push({type:'image',attachment:{attachmentId:'image',mediaType:'image/png'}});w.agent.followup(input);await w.drain();assert.equal(w.agent.lastError.code,'chunk-failed');assert.equal(commands(w).length,0);assert.ok(w.peer.calls.some(c=>c.method==='v4/attachment/abort'))}finally{await w.close()}
});

test('paused sendNow respects the official availability guard',async()=>{
  const w=await commandWorld('queue-paused');
  try{publish(w,s=>{s.availability.sendQueuedNow={allowed:false,reasonCode:'sendQueuedNowRequiresRunning'}});await assert.rejects(w.agent.queueAction({queueItemId:'queue-1',action:'sendNow'}),{code:'sendQueuedNowRequiresRunning'});assert.equal(commands(w).length,0)}finally{await w.close()}
});

test('replayed inbox retains command identity and correlates a remote queue without resending',async()=>{
  const w=await commandWorld('turn-running');let resumed;
  try{
    w.agent.followup(message('durable'));await w.drain();const commandId=w.agent.inputs.get('durable').commandId;
    await w.agent.stop();
    const {V4Conversation}=await import('../packages/host/conversation.mjs');
    w.peer.snapshot.queue.items=[queueItem('restored-queue',commandId)];
    resumed=new w.agent.constructor(w.agent.ctx,w.agent.session,{},w.agent.zcodeConversationId,{
      createScope:()=>({ctx:w.agent.ctx}),agentEvents:()=>({emit(){},waterfall:async()=> 'unavailable'}),transport:{conversation:()=>new V4Conversation(w.peer,{
        address:{runtime:'zcode',authority:'official-host',workspace:'/workspace',sessionId:w.agent.zcodeConversationId},workspace:{workspacePath:'/workspace',workspaceKey:'/workspace'},connectionId:w.peer.connectionId,clientId:'resumed',clientMode:'desktop-continuous',runnable:true,managementAllowed:true,reconnectable:true,
      })},
    });
    assert.equal(resumed.inputs.get('durable').commandId,commandId);await resumed.ready();
    assert.equal(resumed.inbox.queueIds.get('durable'),'restored-queue');assert.equal(resumed.inbox.nextTurn.length,1);
    assert.equal(commands(w).length,1);assert.throws(()=>resumed.followup(message('durable')),{code:'official-message-already-admitted'});
  }finally{await resumed?.stop();await w.close()}
});

test('foreign attachment queue entries report an explicit mapping gap',async()=>{
  const w=await commandWorld();
  try{
    publish(w,s=>{const item=queueItem();item.attachments=[{ref:'foreign-ref',fileName:'one.png',mime:'image/png',bytes:1}];s.queue.items=[item]});
    assert.equal(w.agent.lastError.code,'official-queue-content-unavailable');assert.deepEqual(w.agent.inbox.nextTurn,[]);
    assert.equal(commands(w).length,0);
  }finally{await w.close()}
});
