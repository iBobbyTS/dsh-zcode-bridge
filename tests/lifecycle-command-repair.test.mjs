import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {installDriver} from '../packages/driver/factory.mjs';
import {installSessionCommandSeams} from '../packages/driver/session-commands.mjs';
import {V4Conversation} from '../packages/host/conversation.mjs';
import {MockPeer,baseSnapshot,row} from './helpers/zcode-runtime-fixture.mjs';
import {commandWorld,message,queueItem,tick} from './helpers/lifecycle-commands.mjs';

const writes=peer=>peer.calls.filter(call=>call.method==='v4/command').map(call=>call.params);
function publish(peer,edit){const snapshot=structuredClone(peer.snapshot);snapshot.seq++;snapshot.revision++;edit(snapshot);peer.publish(snapshot)}
const root=process.env.DSH_DRIVER_NPM_NODE_MODULES??'/private/tmp/dsh-local-npm-verify/npm/node_modules';
const cohort=['cordis','dsh-agent','dsh-session','dsh-session-projection','dsh-scope','dsh-session-title','dsh-typert-registry','dsh-api-session-controller','dsh-typert-protocol'];
const artifact=name=>join(root,'@deepseek-ai',name,'lib/index.js');
const available=cohort.every(name=>existsSync(artifact(name)));
const real={skip:available?false:'requires rc.2 npm artifacts; set DSH_DRIVER_NPM_NODE_MODULES'};
async function officialWorld(){
  const [{Context},{AgentRegistry,agentEvents},{SessionStore},{default:Projections},{createScope},
    {SessionTitleService,normalizeSessionTitle},{default:TypertRegistry},{SessionController},{RemoteError}]=await Promise.all(cohort.map(name=>import(pathToFileURL(artifact(name)))));
  const ctx=new Context();new AgentRegistry(ctx);new SessionStore(ctx);new Projections(ctx);new TypertRegistry(ctx);
  ctx.provide('fileUploads',{registerAgentResolver:()=>()=>{},retirePrompt(){}});
  ctx.provide('attachments',{imageLimits:{maxImageBytes:100,maxImagesPerMessage:1,maxMessageImageBytes:100,maxImagePixels:100,maxImageDimension:10,mediaTypes:['image/png']}});
  const titles=new SessionTitleService(ctx,{fallbackMaxWords:8,fallbackMaxBytes:80,maxTitleBytes:120});
  const controller=new SessionController(ctx,{nativeOpen:false});
  const originalRename=controller.commands.rename,originalUpdate=controller.commands.updateQueue,originalCancel=controller.commands.cancel;
  const peer=new MockPeer();peer.snapshot=baseSnapshot();peer.snapshot.rows.window=[];peer.snapshot.control.canStop=true;
  peer.snapshot.control.activeWorks=[{kind:'primaryTurn',foregroundExecutionId:'work',startedAt:0}];peer.snapshot.control.phase='running';
  peer.snapshot.inputRouting={mode:'enqueue'};peer.snapshot.availability.sendQueuedNow={allowed:true};
  const recoveries=new Set();peer.launcher={subscribe(callback){recoveries.add(callback);return ()=>recoveries.delete(callback)}};
  const transport={create:async()=>peer.snapshot.sessionId,dispose(){peer.close()},conversation:()=>new V4Conversation(peer,{
    address:{runtime:'zcode',authority:'official-host',workspace:'/workspace',sessionId:peer.snapshot.sessionId},workspace:{workspacePath:'/workspace',workspaceKey:'/workspace'},connectionId:peer.connectionId,clientId:'repair',clientMode:'desktop-continuous',runnable:true,managementAllowed:true,reconnectable:true,
  })};
  let driver;
  const provider=ctx.plugin({apply(owner){
    driver=installDriver(owner,{transport,createScope,agentEvents});
    installSessionCommandSeams(owner,driver.factory,{normalizeSessionTitle,RemoteError});
  }});
  await provider.await();
  const {agent}=await ctx.agents.create({sessionId:'native-repair',meta:{cwd:'/workspace'}});await agent.ready();await tick();
  return {ctx,peer,agent,controller,titles,driver,provider,originalRename,originalUpdate,originalCancel,recoveries,
    async drain(){await Promise.allSettled([...agent.tasks]);await tick()},async close(){await provider.dispose();await ctx.fiber.dispose()}};
}

// EVIDENCE_GAP: zcode-agent.mjs:264-269 already routes sendNow -> sendQueuedNow;
// vendor v4.mjs:8669 and transport-v4/success.json's sendQueuedNowRequiresRunning
// agree with official updateQueue.steer's running prerequisite. busy.json carries
// allowed:true, but its provenance says "injected-from-official-capture". HANDOFF
// marks real busy promotion NOT_RUN: this mapping does NOT prove guide vs new turn.
// Close the behavioral gap in "S05 隔离验收 --driver-mode 实证".
test('official compound steer promotes the original queued intent without a delete or fresh sendText',real,async()=>{
  const w=await officialWorld();
  try{
    const fixture=JSON.parse(await readFile(new URL('./fixtures/queue-guide-goal/busy.json',import.meta.url),'utf8'));
    assert.equal(fixture.initial.frame.payload.snapshot.availability.sendQueuedNow.allowed,true);
    assert.equal(fixture.provenance.kind,'injected-from-official-capture');
    publish(w.peer,s=>{s.queue.items=[queueItem()]});const id=w.agent.inbox.nextTurn[0].id;
    assert.deepEqual(await w.controller.updateQueue({sessionId:w.agent.id,itemId:id,action:{kind:'steer'}}),{accepted:true});
    assert.deepEqual(writes(w.peer).map(c=>c.type),['sendQueuedNow']);assert.equal(writes(w.peer)[0].payload.queueItemId,'queue-1');
    assert.equal(w.agent.conversation.command(writes(w.peer)[0].commandId).state,'completed');
    assert.equal(w.agent.inbox.nextTurn.length,1,'ACK does not counterfeit queue consumption');
    await assert.rejects(w.controller.updateQueue({sessionId:w.agent.id,itemId:id,action:{kind:'remove'}}),/official-queue-remove-unavailable/);
    assert.throws(()=>w.agent.inbox.remove(id),{code:'official-queue-remove-unavailable'});
    publish(w.peer,s=>{s.queue.items=[]});assert.deepEqual(w.agent.inbox.nextTurn,[]);
    assert.equal(w.agent.conversation.state.observerErrors,0);
  }finally{await w.close()}
});

test('compound steer transfers local-only input by durable splice and sends guide with the same id',real,async()=>{
  const w=await officialWorld();const original=w.peer.request.bind(w.peer);
  try{
    w.peer.loseAck=true;w.agent.followup(message('unknown-prior'));await w.drain();
    const priorId=w.agent.inputs.get('unknown-prior').commandId,priorAck=w.peer.acks.get(priorId);
    w.peer.acks.delete(priorId);w.peer.disconnect();
    const beforeAdmissionSeq=w.agent.session.seq;
    // The live running snapshot remains observable, but admission is blocked by an unknown ACK.
    w.agent.followup(message('local-only'));await w.drain();
    const input=w.agent.inputs.get('local-only'),commandId=input.commandId;
    assert.equal(w.agent.lastError.code,'command-outcome-unknown');assert.equal(w.agent.conversation.command(commandId),null);
    w.peer.acks.set(priorId,priorAck);
    const result=await w.controller.updateQueue({sessionId:w.agent.id,itemId:'local-only',action:{kind:'steer'}});
    assert.deepEqual(result,{accepted:true});
    const sent=writes(w.peer).filter(c=>c.type==='sendText'&&c.commandId===commandId);assert.equal(sent.length,1);
    assert.equal(sent[0].commandId,commandId);assert.equal(sent[0].payload.requestedDelivery,'guide');
    const splices=Array.from({length:w.agent.session.seq},(_,seq)=>w.agent.session.eventAt(seq)).filter(event=>event.type==='agent/inbox/spliced'&&event.seq>=beforeAdmissionSeq);
    assert.deepEqual(splices.map(event=>[event.data.target,event.data.removedCount??0,event.data.inserted.length]),[['next-turn',0,1],['next-turn',1,0],['next-step',0,1]]);
    assert.equal(w.agent.inbox.nextTurn.some(input=>input.id==='local-only'),false);assert.equal(w.agent.inbox.nextStep[0].id,'local-only');
  }finally{w.peer.request=original;await w.close()}
});

test('steer refuses idle, reserved and denied targets; overlapping remove cannot borrow transfer authority',real,async()=>{
  const w=await officialWorld();
  try{
    publish(w.peer,s=>{s.queue.items=[queueItem()]});const id=w.agent.inbox.nextTurn[0].id;
    const request={sessionId:w.agent.id,itemId:id,action:{kind:'steer'}};
    publish(w.peer,s=>{s.control.canStop=false;s.control.activeWorks=[]});
    await assert.rejects(w.controller.updateQueue(request),error=>error.code==='session/steer-unavailable');
    publish(w.peer,s=>{s.control.canStop=true;s.control.activeWorks=[{kind:'primaryTurn',foregroundExecutionId:'work',startedAt:0}];s.queue.items[0].dispatch.state='reserved'});
    await assert.rejects(w.controller.updateQueue(request),/guard.queueItemReserved/);
    publish(w.peer,s=>{s.queue.items[0].dispatch.state='queued';s.availability.sendQueuedNow={allowed:false,reasonCode:'sendQueuedNowRequiresRunning'}});
    await assert.rejects(w.controller.updateQueue(request),/sendQueuedNowRequiresRunning/);
    assert.equal(writes(w.peer).length,0);assert.equal(w.agent.inbox.nextTurn.length,1);
    publish(w.peer,s=>{s.availability.sendQueuedNow={allowed:true}});
    const original=w.peer.request.bind(w.peer),gate=Promise.withResolvers(),issued=Promise.withResolvers();
    w.peer.request=async(method,params,options)=>{if(params?.type==='sendQueuedNow'){issued.resolve();await gate.promise}return original(method,params,options)};
    const promotion=w.controller.updateQueue(request);await issued.promise;
    await assert.rejects(w.controller.updateQueue({...request,action:{kind:'remove'}}),/official-queue-remove-unavailable/);
    gate.resolve();await promotion;assert.equal(writes(w.peer).length,1);
    assert.throws(()=>w.agent.inbox.remove(id),{code:'official-queue-remove-unavailable'});
  }finally{await w.close()}
});

test('disconnect in flight -> followup -> recovered ready dispatches the retained input exactly once',async()=>{
  const w=await commandWorld();const original=w.peer.request.bind(w.peer),issued=Promise.withResolvers();
  try{
    w.peer.request=async(method,params,options)=>{
      if(method!=='v4/command')return original(method,params,options);
      w.peer.calls.push({method,params:structuredClone(params)});issued.resolve(params);
      return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('lost'),{code:'execution-disconnected'})),{once:true}));
    };
    w.agent.followup(message('in-flight'));const first=await issued.promise;w.peer.disconnect();await w.drain();
    w.peer.request=original;w.agent.followup(message('retained'));await w.drain();
    const input=w.agent.inputs.get('retained'),id=input.commandId;
    assert.equal(w.agent.conversation.command(id),null);assert.equal(w.agent.lastError.code,'command-outcome-unknown');assert.equal(w.agent.inbox.nextTurn.length,2);
    w.peer.acks.set(first.commandId,{commandId:first.commandId,status:'accepted',revisionAtDecision:w.peer.snapshot.revision});
    await Promise.all([w.agent.ready(),w.agent.ready()]);await w.drain();
    assert.equal(input.commandId,id);assert.equal(w.agent.conversation.command(id).ack.status,'accepted');
    assert.equal(writes(w.peer).filter(c=>c.commandId===id).length,1);assert.equal(writes(w.peer).filter(c=>c.commandId===first.commandId).length,1);
    await w.agent.ready();await w.drain();assert.equal(writes(w.peer).filter(c=>c.commandId===id).length,1);
    publish(w.peer,s=>{s.rows.window=[first.commandId,id].map((commandId,index)=>row('turnHeader',index+1,{origin:'userInput',state:'completedSuccess',startedAt:0,sourceCommandId:commandId}))});await w.drain();
    assert.deepEqual(w.agent.inbox.nextTurn,[]);
    assert.ok(w.events.some(event=>event.type==='agent/inbox/spliced'&&event.data.removedCount===1));
  }finally{await w.close()}
});

test('redispatch failure retains native input and emits an explicit agent error',async()=>{
  let reads=0;const w=await commandWorld('idle',{store:{async readImage(){reads++;throw Object.assign(new Error('unavailable'),{code:'store-unavailable'})}}});
  try{
    const input=message('attachment');input.content.push({type:'image',attachment:{attachmentId:'one',mediaType:'image/png'}});
    w.agent.followup(input);await w.drain();const id=w.agent.inputs.get(input.id).commandId;
    await w.agent.ready();await w.drain();assert.equal(reads,2);
    assert.equal(w.agent.inputs.get(input.id).commandId,id);assert.equal(w.agent.inbox.nextTurn[0].id,input.id);assert.equal(w.agent.conversation.command(id),null);
    assert.equal(w.notifications.filter(event=>event.type==='agent/error'&&event.payload.error.code==='store-unavailable').length,2);
  }finally{await w.close()}
});

function renamePeer(w,mode='success'){
  const original=w.peer.request.bind(w.peer);
  w.peer.request=async(method,params,options)=>{
    if(params?.type!=='renameSession')return original(method,params,options);
    if(mode==='reject'){
      w.peer.calls.push({method,params:structuredClone(params)});
      return options.onResult({commandId:params.commandId,status:'rejected',reasonCode:'rename.denied',revisionAtDecision:w.peer.snapshot.revision});
    }
    if(mode==='lost')w.peer.loseAck=true;
    const result=await original(method,params,options);
    if(mode==='success')publish(w.peer,s=>{s.meta.title=params.payload.title;s.meta.titleSource='custom'});
    return result;
  };
}

test('official rename waits for ZCode ACK and title read before committing the native title',real,async()=>{
  const w=await officialWorld();
  try{
    renamePeer(w);assert.equal(w.titles.get(w.agent.session),undefined);
    const result=await w.controller.rename({sessionId:w.agent.id,title:'  Native\n renamed  '});
    assert.equal(result.title,'Native renamed');assert.equal(w.titles.get(w.agent.session).title,result.title);
    assert.equal(w.agent.session.eventAt(result.seq).type,'session/title');
    const command=writes(w.peer)[0];assert.equal(command.type,'renameSession');assert.equal(command.payload.title,result.title);
    assert.equal(w.agent.conversation.command(command.commandId).state,'completed');assert.equal(w.agent.conversation.state.snapshot.meta.title,result.title);
    assert.ok(w.peer.calls.some(call=>call.method==='v4/conversation/resync'));
  }finally{await w.close()}
});

test('rename rejection or unconfirmed title leaves native title unchanged and surfaces errors',real,async()=>{
  for(const mode of ['reject','unchanged','lost']){
    const w=await officialWorld();
    try{
      const reported=[];w.ctx.on('api-session/error',(id,error)=>reported.push({id,error}));
      w.titles.rename(w.agent.session,'before');renamePeer(w,mode);
      await assert.rejects(w.controller.rename({sessionId:w.agent.id,title:'after'}),new RegExp(mode==='reject'?'rename.denied':mode==='lost'?'execution-outcome-unknown':'rename-title-unconfirmed'));
      assert.equal(w.titles.get(w.agent.session).title,'before');assert.ok(w.agent.lastError);
      assert.ok(reported.some(event=>event.id===w.agent.id),'official API error surface receives the rejection');
      const count=writes(w.peer).length;
      await assert.rejects(w.controller.rename({sessionId:w.agent.id,title:'\n   '}),error=>error.code==='session/title-invalid');
      assert.equal(writes(w.peer).length,count);
      if(mode==='lost')assert.equal(w.agent.conversation.command(writes(w.peer)[0].commandId).state,'outcome-unknown');
    }finally{await w.close()}
  }
});

test('real Cordis restores the command seams and preserves another owner wrapper',real,async()=>{
  for(const newerOwner of [false,true]){
    const w=await officialWorld();
    try{
      assert.notEqual(w.controller.commands.rename,w.originalRename);assert.notEqual(w.controller.commands.updateQueue,w.originalUpdate);
      const successor=async()=>({title:'successor',seq:0});if(newerOwner)w.controller.commands.rename=successor;
      await w.provider.dispose();assert.equal(w.controller.commands.rename,newerOwner?successor:w.originalRename);assert.equal(w.controller.commands.updateQueue,w.originalUpdate);assert.equal(w.controller.commands.cancel,w.originalCancel);
    }finally{await w.close()}
  }
});

test('snapshot error, unsupported interaction and unmappable queue each dispatch agent/error',async()=>{
  const w=await commandWorld();
  try{
    w.peer.disconnect();assert.ok(w.notifications.some(event=>event.type==='agent/error'&&event.payload.error.code==='execution-disconnected'));
    await w.agent.ready();
    publish(w.peer,s=>{s.pendingInteractions=[{interactionId:'ask',kind:'userInput',anchorRowId:null,createdAt:0,payload:{kind:'userInput',prompt:'?',freeText:true}}]});
    assert.ok(w.notifications.some(event=>event.type==='agent/error'&&event.payload.error.code==='interaction-mapping-unavailable'));
    publish(w.peer,s=>{const item=queueItem();item.attachments=[{ref:'foreign',fileName:'one.png',mime:'image/png',bytes:1}];s.queue.items=[item]});
    assert.ok(w.notifications.some(event=>event.type==='agent/error'&&event.payload.error.code==='official-queue-content-unavailable'));
  }finally{await w.close()}
});

test('launcher ready automatically recovers pending input and real Cordis removes its listener',real,async()=>{
  const w=await officialWorld();
  try{
    w.peer.loseAck=true;w.agent.followup(message('first'));await w.drain();
    w.peer.disconnect();let connected=false;
    w.agent.transport.ready=async()=>{if(!connected)throw Object.assign(new Error('offline'),{code:'execution-unavailable'})};
    w.agent.followup(message('on-recovery'));await w.drain();
    const input=w.agent.inputs.get('on-recovery');assert.equal(w.agent.conversation.command(input.commandId),null);
    assert.equal(w.recoveries.size,1);connected=true;
    for(const callback of w.recoveries)callback({phase:'ready'});
    assert.ok(w.agent.readiness);await w.agent.readiness;await w.drain();
    assert.equal(w.agent.conversation.command(input.commandId).ack.status,'accepted');
    assert.equal(writes(w.peer).filter(c=>c.commandId===input.commandId).length,1);
    await w.provider.dispose();assert.equal(w.recoveries.size,0);
    assert.equal(w.controller.commands.rename,w.originalRename);
  }finally{await w.close()}
});

for(const operation of ['edit','cancel'])for(const outcome of ['rejected','outcome-unknown']){
  test(`official control receipt: ${operation} / ${outcome} / live subscription`,real,async()=>{
    const w=await officialWorld(),original=w.peer.request.bind(w.peer),errors=[],apiErrors=[];
    w.ctx.on('agent/error',payload=>errors.push(payload));w.ctx.on('api-session/error',(id,error)=>apiErrors.push({id,error}));
    try{
      publish(w.peer,s=>{s.queue.items=[queueItem()]});await w.drain();
      const id=w.agent.inbox.nextTurn[0].id,expectedType=operation==='edit'?'editQueueItem':'stop';
      w.peer.request=async(method,params,options)=>{
        if(params?.type!==expectedType)return original(method,params,options);
        if(outcome==='outcome-unknown'){w.peer.loseAck=true;return original(method,params,options)}
        w.peer.calls.push({method,params:structuredClone(params)});
        return options.onResult({commandId:params.commandId,status:'rejected',reasonCode:'test.control-rejected',revisionAtDecision:w.peer.snapshot.revision});
      };
      const request=operation==='edit'?w.controller.updateQueue({sessionId:w.agent.id,itemId:id,action:{kind:'edit',content:[{type:'text',text:'replacement'}]}}):w.controller.cancel({sessionId:w.agent.id});
      let failure;
      await assert.rejects(Promise.resolve(request),error=>{failure=error;assert.equal(error.code,outcome==='rejected'?'test.control-rejected':'command-outcome-unknown');return true});
      await w.drain();
      const calls=writes(w.peer).filter(command=>command.type===expectedType);assert.equal(calls.length,1);
      const receipt=w.agent.conversation.command(calls[0].commandId);
      assert.equal(receipt.state,outcome);assert.equal(failure.commandId,receipt.commandId);assert.equal(failure.state,receipt.state);
      assert.ok(errors.some(event=>event.agent===w.agent&&event.error.code===failure.code));
      assert.ok(apiErrors.some(event=>event.id===w.agent.id));
      assert.equal(w.agent.conversation.state.status,'live','ACK loss does not close observation');
      assert.equal(w.peer.closed,false);assert.equal(w.peer.subscriptions.size,1);
      assert.equal(w.agent.inbox.nextTurn[0].content[0].text,'queued','receipt handling does not fabricate a snapshot mutation');
      assert.equal(w.agent.status,'running');
      if(outcome==='outcome-unknown'){
        const reconciled=await w.agent.conversation.queryCommand(receipt.commandId);
        assert.equal(reconciled.commandId,receipt.commandId);assert.equal(reconciled.ack.status,'accepted');
        assert.equal(writes(w.peer).filter(command=>command.type===expectedType).length,1,'query never retransmits');
      }
    }finally{await w.close()}
  });
}

test('control seam preserves accepted/noop receipts and idle cancellation semantics',real,async()=>{
  const w=await officialWorld(),request=w.peer.request.bind(w.peer),errors=[];
  w.ctx.on('agent/error',payload=>errors.push(payload));
  try{
    publish(w.peer,s=>{s.queue.items=[queueItem()]});await w.drain();const id=w.agent.inbox.nextTurn[0].id;
    const entered=Promise.withResolvers(),release=Promise.withResolvers();
    w.peer.request=async(method,params,options)=>{if(params?.type==='editQueueItem'){entered.resolve();await release.promise}return request(method,params,options)};
    let settled=false;const edit=w.controller.updateQueue({sessionId:w.agent.id,itemId:id,action:{kind:'edit',content:[{type:'text',text:'edit'}]}}).then(value=>{settled=true;return value});
    await entered.promise;await tick();assert.equal(settled,false,'API acceptance waits for its own ACK');release.resolve();assert.deepEqual(await edit,{accepted:true});
    w.peer.request=async(method,params,options)=>{
      if(params?.type!=='editQueueItem')return request(method,params,options);
      w.peer.calls.push({method,params:structuredClone(params)});
      return options.onResult({commandId:params.commandId,status:'noop',reasonCode:'queue.unchanged',revisionAtDecision:w.peer.snapshot.revision});
    };
    assert.deepEqual(await w.controller.updateQueue({sessionId:w.agent.id,itemId:id,action:{kind:'edit',content:[{type:'text',text:'queued'}]}}),{accepted:true});
    assert.deepEqual(await w.controller.cancel({sessionId:w.agent.id}),{accepted:true});assert.equal(w.agent.status,'running','ACK acceptance does not imply stopped execution');
    publish(w.peer,s=>{s.control.canStop=false;s.control.activeWorks=[]});await w.drain();const count=writes(w.peer).length;
    assert.deepEqual(await w.controller.cancel({sessionId:w.agent.id}),{accepted:true});assert.equal(writes(w.peer).length,count,'idle cancel sends no command');
    assert.equal(errors.length,0);
  }finally{await w.close()}
});
