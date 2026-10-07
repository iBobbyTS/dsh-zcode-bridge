// History mutation family: gate releases, the native parity route, CAS/ACK semantics through the
// shared V4Conversation owner, the rewind preview/apply split, and branch-binding consistency after
// an edit cuts the active branch. conversation.mjs guards are reused read-only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EXECUTION_COMMANDS} from '../packages/host/launcher/execution.mjs';
import {PARITY_MIRROR_COMMANDS} from '../packages/host/parity.mjs';
import {ROUTED_COMMANDS} from '../packages/driver/commands.mjs';
import {HISTORY_MUTATION_COMMANDS,historyOperation} from '../packages/driver/history.mjs';
import {HISTORY_COMMANDS,MANAGEMENT_COMMANDS} from '../packages/host/conversation.mjs';
import {ParityController} from '../packages/client/parity.mjs';
import {ParityService} from '../packages/host/parity.mjs';
import {commandWorld} from './helpers/lifecycle-commands.mjs';
import {parityWorld,tick} from './helpers/settings-panel-parity.mjs';

const history=JSON.parse(readFileSync(new URL('./fixtures/history-management/success.json',import.meta.url)));
const contextFixture=JSON.parse(readFileSync(new URL('./fixtures/attachments-context/success.json',import.meta.url)));
const attachedFixture=JSON.parse(readFileSync(new URL('./fixtures/attachments-context/attached.json',import.meta.url)));
const fixtureRows=()=>structuredClone(history.initial.frame.payload.snapshot.rows);
const five=['editUserQuery','retryTurn','applyFileRewind','discardSharedContext','createSelectionSideSession'];
const publish=(w,edit)=>{const snapshot=structuredClone(w.peer.snapshot);snapshot.seq++;snapshot.revision++;edit(snapshot);w.peer.publish(snapshot)};
const commands=w=>w.peer.calls.filter(call=>call.method==='v4/command').map(call=>call.params);
const boundEvents=agent=>Array.from({length:agent.session.seq},(_,seq)=>agent.session.eventAt(seq)).filter(event=>event.type==='zcode-driver/conversation-bound');

test('all four gates carry the five history mutations and the conversation owner already owns their guards',()=>{
  assert.deepEqual([...HISTORY_MUTATION_COMMANDS].sort(),[...five].sort());
  for(const type of five){
    assert.ok(EXECUTION_COMMANDS.has(type),`execution relay allows ${type}`);
    assert.ok(PARITY_MIRROR_COMMANDS.has(type),`mirror parity fourth gate allows ${type}`);
    assert.ok(ROUTED_COMMANDS.has(type),`driver routes ${type}`);
    assert.ok(HISTORY_COMMANDS.has(type)||MANAGEMENT_COMMANDS.has(type),`conversation owner defines ${type}`);
  }
});

test('the native history route serves the CAS-pinned rewind preview read and forwards command submits through submitControl',async()=>{
  const snapshot={revision:7,logEpoch:'epoch-7'};
  const submitted=[],reads=[];
  const agent={assertAvailable(){},async ready(){},
    conversation:{state:{snapshot},historyQuery:async request=>(reads.push(request),{kind:request.kind,target:request.target,baseRevision:request.baseRevision,baseLogEpoch:request.baseLogEpoch,result:{canApply:true,safeFiles:[],unsafeFiles:[],ignoredFiles:[]}})},
    submitControl(command){submitted.push(command);return {commandId:'c1',type:command.type,state:'completed',ack:{status:'accepted'}}},
  };
  const read=await historyOperation(agent,{domain:'history',operation:'read',kind:'fileRewindPreview',params:{target:{rowId:3,entityId:'row-3'}},baseRevision:7,baseLogEpoch:'epoch-7'});
  assert.equal(read.kind,'fileRewindPreview');
  assert.deepEqual(reads[0],{kind:'fileRewindPreview',target:{rowId:3,entityId:'row-3'},baseRevision:7,baseLogEpoch:'epoch-7'});
  const result=await historyOperation(agent,{domain:'command',operation:'submit',kind:'applyFileRewind',params:{target:{rowId:3,entityId:'row-3'}},baseRevision:7,baseLogEpoch:'epoch-7'});
  assert.equal(result.ack.status,'accepted');
  assert.deepEqual(submitted,[{type:'applyFileRewind',payload:{target:{rowId:3,entityId:'row-3'}},baseRevision:7,baseLogEpoch:'epoch-7',signal:undefined}]);
  await assert.rejects(historyOperation(agent,{domain:'command',operation:'submit',kind:'editUserQuery',params:{target:{rowId:1,entityId:'row-1'},newText:'x'},baseRevision:6,baseLogEpoch:'epoch-7'}),error=>error.code==='parity-projection-stale','a stale baseline is rejected before the wire');
  await assert.rejects(historyOperation(agent,{domain:'history',operation:'read',kind:'forkPlan',params:{}}),error=>error.code==='parity-operation-denied');
  await assert.rejects(historyOperation(agent,{domain:'command',operation:'submit',kind:'sendText',params:{}}),error=>error.code==='parity-operation-denied');
});

test('editing the active branch keeps the same ZCode conversation binding and the next command routes on it',async()=>{
  const w=await commandWorld('idle');
  try{
    const bound=w.agent.zcodeConversationId;
    publish(w,s=>{s.rows=fixtureRows()});
    await w.drain();
    const base=w.agent.conversation.state.snapshot;
    await w.agent.submitControl({type:'editUserQuery',payload:{target:{rowId:5,entityId:'input-2'},newText:'edited',workspaceMode:'preserve'},baseRevision:base.revision,baseLogEpoch:base.logEpoch});
    const edited=commands(w).find(command=>command.type==='editUserQuery');
    assert.equal(edited.sessionId,bound,'the edit command targets the bound ZCode conversation');
    assert.equal(w.agent.zcodeConversationId,bound,'the binding is unchanged by an in-session branch cut');
    assert.equal(w.agent.conversation.address.sessionId,bound,'the conversation still owns the bound address');
    publish(w,s=>{s.sharedContextImport=structuredClone(contextFixture.initial.frame.payload.snapshot.sharedContextImport)});
    await w.drain();
    const next=w.agent.conversation.state.snapshot;
    await w.agent.submitControl({type:'discardSharedContext',payload:{contextId:'ctx-fixture-1'},baseRevision:next.revision,baseLogEpoch:next.logEpoch});
    const discarded=commands(w).find(command=>command.type==='discardSharedContext');
    assert.equal(discarded.sessionId,bound,'the follow-up command still routes on the same binding');
  }finally{await w.close()}
});

test('a stale CAS baseline is rejected and discard is only accepted for the pending matching import',async()=>{
  const w=await commandWorld('idle');
  try{
    publish(w,s=>{s.sharedContextImport=structuredClone(contextFixture.initial.frame.payload.snapshot.sharedContextImport)});
    await w.drain();
    const snapshot=w.agent.conversation.state.snapshot;
    await assert.rejects(w.agent.submitControl({type:'discardSharedContext',payload:{contextId:'ctx-fixture-1'},baseRevision:snapshot.revision-1,baseLogEpoch:snapshot.logEpoch}),{code:'proto.staleRevision'});
    await assert.rejects(w.agent.submitControl({type:'discardSharedContext',payload:{contextId:'foreign'},baseRevision:snapshot.revision,baseLogEpoch:snapshot.logEpoch}),{code:'shared-context-unconfirmed'});
    publish(w,s=>{s.sharedContextImport=structuredClone(attachedFixture.initial.frame.payload.snapshot.sharedContextImport)});
    await w.drain();
    const attached=w.agent.conversation.state.snapshot;
    await assert.rejects(w.agent.submitControl({type:'discardSharedContext',payload:{contextId:'ctx-fixture-2'},baseRevision:attached.revision,baseLogEpoch:attached.logEpoch}),{code:'shared-context-unconfirmed'});
    assert.equal(commands(w).some(command=>command.type==='discardSharedContext'),false,'no withdraw reaches the wire before it is valid');
  }finally{await w.close()}
});

test('file rewind preview and apply are two receipts: the apply reuses the preview baseline',async()=>{
  const w=await commandWorld('idle');
  try{
    const original=w.peer.request.bind(w.peer);
    w.peer.request=async(method,params,options)=>{
      if(method==='v4/conversation/fileRewindPreview'){w.peer.calls.push({method,params:structuredClone(params)});return structuredClone(history.preview)}
      return original(method,params,options);
    };
    publish(w,s=>{s.rows=fixtureRows()});
    await w.drain();
    const snapshot=w.agent.conversation.state.snapshot;
    const read=await w.agent.historyOperation({domain:'history',operation:'read',kind:'fileRewindPreview',params:{target:{rowId:1,entityId:'header-1'}},baseRevision:snapshot.revision,baseLogEpoch:snapshot.logEpoch});
    assert.equal(read.kind,'fileRewindPreview');
    assert.equal(read.result.canApply,true);
    await w.agent.submitControl({type:'applyFileRewind',payload:{target:read.target},baseRevision:read.baseRevision,baseLogEpoch:read.baseLogEpoch});
    const applied=commands(w).find(command=>command.type==='applyFileRewind');
    assert.equal(applied.baseRevision,read.baseRevision);
    assert.equal(applied.baseLogEpoch,read.baseLogEpoch);
  }finally{await w.close()}
});

test('createSelectionSideSession preserves the empty and firstInput variants on the same binding',async()=>{
  const w=await commandWorld('idle');
  try{
    const snapshot=w.agent.conversation.state.snapshot;
    await w.agent.submitControl({type:'createSelectionSideSession',payload:{},baseRevision:snapshot.revision,baseLogEpoch:snapshot.logEpoch});
    await w.agent.submitControl({type:'createSelectionSideSession',payload:{firstInput:{text:'selected'}},baseRevision:snapshot.revision,baseLogEpoch:snapshot.logEpoch});
    const sent=commands(w).filter(command=>command.type==='createSelectionSideSession');
    assert.equal(sent.length,2);
    assert.deepEqual(sent[0].payload,{});
    assert.deepEqual(sent[1].payload,{firstInput:{text:'selected'}});
    assert.ok(sent.every(command=>command.sessionId===w.agent.zcodeConversationId));
  }finally{await w.close()}
});

// Assembly coverage locking the M1 CAS-shape gap: the plugin chain must deliver a real revision
// and log epoch for the projection-snapshot ingress (side session / discard), and the row-target
// envelope must carry both fields. Mirror sessions go through the bridge parity host path; native
// sessions through ParityService -> DriverAgent.historyOperation.
test('assembly (mirror): side session and discard arrive with a real CAS baseline and a stale one is refused before the wire',async()=>{
  const w=await parityWorld();const controller=new ParityController(w.rpc,{sessionId:w.id});
  try{
    const current=w.runtime.agents.get(w.id).conversation.state.snapshot;
    const next=structuredClone(current);next.seq++;next.revision++;next.sharedContextImport=structuredClone(contextFixture.initial.frame.payload.snapshot.sharedContextImport);
    w.official.publish(next);await tick();
    const snapshot=w.runtime.agents.get(w.id).conversation.state.snapshot;
    await controller.command('discardSharedContext',{contextId:'ctx-fixture-1'},{revision:snapshot.revision,logEpoch:snapshot.logEpoch});
    const discard=w.calls.filter(call=>call.name==='sendConversationCommandV4').at(-1).args[0].envelope;
    assert.equal(discard.type,'discardSharedContext');
    assert.equal(discard.sessionId,w.runtime.agents.get(w.id).conversation.address.sessionId,'the wire targets the official conversation');
    await controller.command('createSelectionSideSession',{},{revision:snapshot.revision,logEpoch:snapshot.logEpoch});
    const side=w.calls.filter(call=>call.name==='sendConversationCommandV4').at(-1).args[0].envelope;
    assert.equal(side.type,'createSelectionSideSession');
    // A missing baseline (the pre-fix card shape) is refused by the parity ingress, not the wire.
    const before=w.calls.length;
    await assert.rejects(controller.command('discardSharedContext',{contextId:'ctx-fixture-1'},{revision:undefined,logEpoch:undefined}),error=>error.code==='parity-projection-stale');
    assert.equal(w.calls.length,before,'no command reaches the wire with a missing CAS baseline');
    // A row-target command carries both fields in the envelope.
    const withRows=structuredClone(w.runtime.agents.get(w.id).conversation.state.snapshot);withRows.seq++;withRows.revision++;withRows.rows=fixtureRows();
    w.official.publish(withRows);await tick();
    const rows=w.runtime.agents.get(w.id).conversation.state.snapshot;
    const editRow=rows.rows.window.find(row=>row.actions?.canEdit===true);
    await controller.command('editUserQuery',{target:{rowId:editRow.rowId,entityId:editRow.entityId},newText:'edited',workspaceMode:'preserve'},{revision:rows.revision,logEpoch:rows.logEpoch});
    const edit=w.calls.filter(call=>call.name==='sendConversationCommandV4').at(-1).args[0].envelope;
    assert.equal(edit.type,'editUserQuery');
    assert.equal(edit.baseRevision,rows.revision);
    assert.equal(edit.baseLogEpoch,rows.logEpoch);
  }finally{controller.dispose();await w.close()}
});

test('assembly (native): ParityController -> ParityService -> DriverAgent.historyOperation preserves the CAS baseline for side session, discard and a row target',async()=>{
  const w=await commandWorld('idle');
  try{
    publish(w,s=>{s.sharedContextImport=structuredClone(contextFixture.initial.frame.payload.snapshot.sharedContextImport)});
    await w.drain();
    const agent=w.agent;
    const runtime={disposed:false,ctx:{agents:{get:id=>id===agent.id?agent:undefined}}};
    const parity=new ParityService(runtime);
    const rpc={call:async(_channel,_endpoint,payload)=>{try{return {ok:true,value:await parity.handle(payload)}}catch(error){return {ok:false,error:{code:error.code??'mock-failure',message:error.message}}}}};
    const controller=new ParityController(rpc,{sessionId:agent.id});
    try{
      const snapshot=agent.conversation.state.snapshot;
      await controller.command('discardSharedContext',{contextId:'ctx-fixture-1'},{revision:snapshot.revision,logEpoch:snapshot.logEpoch});
      const discard=commands(w).filter(command=>command.type==='discardSharedContext').at(-1);
      assert.equal(discard.sessionId,agent.zcodeConversationId);
      await controller.command('createSelectionSideSession',{},{revision:snapshot.revision,logEpoch:snapshot.logEpoch});
      assert.equal(commands(w).filter(command=>command.type==='createSelectionSideSession').length,1);
      await assert.rejects(controller.command('createSelectionSideSession',{},{revision:undefined,logEpoch:undefined}),error=>error.code==='parity-projection-stale');
      publish(w,s=>{s.rows=fixtureRows()});
      await w.drain();
      const rows=agent.conversation.state.snapshot;
      await controller.command('editUserQuery',{target:{rowId:5,entityId:'input-2'},newText:'edited',workspaceMode:'preserve'},{revision:rows.revision,logEpoch:rows.logEpoch});
      const edit=commands(w).filter(command=>command.type==='editUserQuery').at(-1);
      assert.equal(edit.baseRevision,rows.revision);
      assert.equal(edit.baseLogEpoch,rows.logEpoch);
      assert.deepEqual(edit.payload.target,{rowId:5,entityId:'input-2'});
    }finally{controller.dispose()}
  }finally{await w.close()}
});
