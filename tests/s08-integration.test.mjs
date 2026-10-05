import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ParityController} from '../packages/client/parity.mjs';
import {parityWorld,tick,row} from './helpers/s06-parity.mjs';
const history=JSON.parse(readFileSync(new URL('./fixtures/s08/success.json',import.meta.url)));
async function historyWorld(){
  const w=await parityWorld({sessionPath:'/imported'}),snapshot=structuredClone(history.initial.frame.payload.snapshot);
  snapshot.sessionId='one';snapshot.seq=w.official.snapshot.seq+1;w.official.publish(snapshot);await tick();
  w.responses.set('conversationFileChangesV4',history.fileChanges);w.responses.set('conversationFileRewindPreviewV4',history.preview);
  w.responses.set('conversationPlansV4',{plans:[],atSeq:snapshot.seq,atLogEpoch:snapshot.logEpoch});
  return w;
}
test('S08 history reads cross active relay using registered session/workspace and reject stale/spoofed targets',async()=>{
  const w=await historyWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});
  try{
    const snapshot=w.runtime.agents.get(w.id).conversation.state.snapshot,target={rowId:1,entityId:'header-1'};
    for(const kind of ['fileChanges','fileRewindPreview']){
      const value=await controller.call('history','read',kind,{target},{snapshot});assert.equal(value.kind,kind);
      const call=w.calls.at(-1);assert.equal(call.args[0].workspacePath,'/imported');assert.equal(call.args[0].sessionId,'one');assert.deepEqual(call.args[0].target,target);
    }
    const plans=await controller.call('history','read','plans');assert.deepEqual(plans.plans,[]);assert.equal(w.calls.at(-1).args[0].workspacePath,'/imported');
    const count=w.calls.length;
    await assert.rejects(controller.call('history','read','fileChanges',{target},{snapshot:{...snapshot,revision:snapshot.revision-1}}),{code:'proto.staleRevision'});
    await assert.rejects(controller.call('history','read','fileChanges',{target:{...target,entityId:'foreign'}},{snapshot}),{code:'row-target-unconfirmed'});
    await assert.rejects(controller.call('history','read','plans',{sessionId:'foreign'}),{code:'invalid-payload'});
    await assert.rejects(controller.call('history','start',undefined,{uploadId:'spoofed'}),{code:'parity-operation-denied'});
    assert.equal(w.calls.length,count);assert.equal(w.official.calls.some(c=>c.method==='v4/command'),false);
  }finally{controller.dispose();await w.close()}
});
test('S08 plan/file reads reject late epoch/revision changes and malformed official results',async()=>{
  const w=await historyWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});
  try{
    let release;w.responses.set('conversationPlansV4',()=>new Promise(ok=>release=ok));
    const pending=controller.call('history','read','plans');while(!release)await tick();
    const snapshot=structuredClone(w.runtime.agents.get(w.id).conversation.state.snapshot);snapshot.seq++;snapshot.revision++;w.official.publish(snapshot);await tick();
    release({plans:[],atSeq:snapshot.seq,atLogEpoch:snapshot.logEpoch});await assert.rejects(pending,{code:'proto.staleRevision'});
    w.responses.set('conversationPlansV4',{plans:[],atSeq:snapshot.seq,atLogEpoch:'foreign'});await assert.rejects(controller.call('history','read','plans'),{code:'proto.staleLogEpoch'});
    w.responses.set('conversationPlansV4',{plans:[{}],atSeq:snapshot.seq,atLogEpoch:snapshot.logEpoch});await assert.rejects(controller.call('history','read','plans'));
    w.responses.set('conversationFileChangesV4',()=>new Promise(ok=>release=ok));release=null;
    const late=controller.call('history','read','fileChanges',{target:{rowId:1,entityId:'header-1'}},{snapshot});while(!release)await tick();
    // A changed epoch on the old subscription invalidates projection admission before publishing.
    snapshot.seq++;snapshot.logEpoch='replacement';w.official.publish(snapshot);await tick();release(history.fileChanges);await assert.rejects(late,{code:'projection-unconfirmed'});
  }finally{controller.dispose();await w.close()}
});
test('S08 mode ACK never changes projected mode; authoritative frame controls subsequent input and persistence',async()=>{
  const w=await parityWorld(),controller=new ParityController(w.rpc,{sessionId:w.id});
  try{
    const agent=w.runtime.agents.get(w.id),snapshot=agent.conversation.state.snapshot;
    const receipt=await controller.command('switchCollaborationMode',{mode:'plan'},snapshot);assert.equal(receipt.ack.status,'accepted');
    assert.equal(agent.record.mode,'build');assert.equal(agent.conversation.state.snapshot.config.mode,'build');
    const call=w.calls.find(c=>c.name==='sendConversationCommandV4');assert.equal(call.args[0].envelope.type,'switchCollaborationMode');assert.equal(call.args[0].envelope.sessionId,'one');
    const next=structuredClone(snapshot);next.seq++;next.revision++;next.config.mode='plan';w.official.publish(next);await tick();assert.equal(agent.record.mode,'plan');
    agent.followup({id:'native-mode-input',role:'user',source:{kind:'user',rpcId:'mode-request'},content:[{type:'text',text:'mock input'}]});await tick();await tick();
    const sent=w.official.calls.find(c=>c.params?.type==='sendText');assert.equal(sent.params.payload.mode,'plan');assert.equal(w.store.records.get(w.id).mode,'plan');
    await assert.rejects(controller.command('switchCollaborationMode',{mode:'build'},snapshot),{code:'parity-projection-stale'});
    const before=w.calls.length;await assert.rejects(controller.command('switchCollaborationMode',{mode:'auto'},next));assert.equal(w.calls.length,before);
  }finally{controller.dispose();await w.close()}
});
