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
import {commandWorld} from './helpers/lifecycle-commands.mjs';

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
