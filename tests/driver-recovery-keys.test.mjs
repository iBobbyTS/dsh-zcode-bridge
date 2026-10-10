import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DriverStateStore,RecoveryKeyIndex} from '../packages/driver/driver-state.mjs';
import {ConversationEventTranslator} from '../packages/driver/events.mjs';

test('recovery keys round-trip through the driver state file and survive index rebuilds',async()=>{
  const root=await mkdtemp(join(tmpdir(),'zcode-driver-recovery-'));
  try{
    const store=new DriverStateStore(root);
    await store.load();
    const recovery=new RecoveryKeyIndex();
    recovery.attach(store);

    // A discard replacement must be durable before the resend leaves (B6 identity).
    await recovery.recordReplacement('session-1','message-1','command-N1');
    // Completed-input fingerprints are best-effort appends.
    recovery.recordCompletion('session-1','command-C1');
    recovery.recordCompletion('session-1','command-C1');
    recovery.recordCompletion('session-1','command-C2');
    await store.save();

    const restored=new DriverStateStore(root);
    await restored.load();
    const rebuilt=new RecoveryKeyIndex();
    rebuilt.attach(restored);
    assert.equal(rebuilt.replacementsOf('session-1').get('message-1'),'command-N1');
    assert.deepEqual([...rebuilt.completedInputsOf('session-1')].sort(),['command-C1','command-C2']);
    // Other sessions stay isolated; unattached indices stay in-memory functional.
    assert.equal(rebuilt.replacementsOf('session-2').size,0);
    // Prototype-member message ids must resolve to undefined, never inherited functions.
    assert.equal(rebuilt.replacementsOf('session-1').get('constructor'),undefined);
    assert.equal(rebuilt.replacementsOf('session-1').get('toString'),undefined);
    const detached=new RecoveryKeyIndex();
    await detached.recordReplacement('s','m','c');
    assert.equal(detached.replacementsOf('s').get('m'),'c');
    // Keys buffered before attach must reach the file (not just memory) once attached.
    const early=new RecoveryKeyIndex();
    const replacementDurable=early.recordReplacement('session-early','message-early','command-E');
    early.recordCompletion('session-early','command-early');
    const lateStore=new DriverStateStore(root);
    await lateStore.load();
    early.attach(lateStore);
    await replacementDurable;
    await lateStore.writing;
    const coldStore=new DriverStateStore(root);
    await coldStore.load();
    const coldIndex=new RecoveryKeyIndex();
    coldIndex.attach(coldStore);
    assert.equal(coldIndex.replacementsOf('session-early').get('message-early'),'command-E','pre-attach replacement persisted');
    assert.ok(coldIndex.completedInputsOf('session-early').has('command-early'),'pre-attach completion persisted');
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test('a completed turn records its key through the callback without host-unknown event types (cold-read safety)',async()=>{
  const events=[];
  const session={id:'replay',get seq(){return events.length},eventAt:seq=>events[seq],snapshotEvents:()=>events,
    append(type,data,opts){const event={type,data:structuredClone(data),...opts,seq:events.length,time:1};events.push(event);return event}};
  const completedInputs=[];
  const translator=new ConversationEventTranslator({session,clock:()=>1,
    input:id => ({id,role:'user',source:{kind:'user',rpcId:id},content:[{type:'text',text:'t'}]}),
    completedInputs:new Set(),onInputCompleted:commandId=>completedInputs.push(commandId),
    syncInbox:()=>{},dispatch:{emit:()=>{}}});
  try{
    const {baseSnapshot,row}=await import('./helpers/zcode-runtime-fixture.mjs');
    const snap=(state,phase)=>{
      const value=baseSnapshot('replay');
      value.control={...value.control,phase,canStop:phase==='running',activeWorks:[],lastError:null};
      value.rows.window=[
        row('turnHeader',1,{origin:'userInput',state,startedAt:0,turnId:'t',sourceCommandId:'command-C'}),
        row('userInput',2,{origin:'realUser',text:'t',turnId:'t',sourceCommandId:'command-C'}),
        row('assistantText',3,{text:'answer',state:state==='running'?'streaming':'complete',model:'model_a',turnId:'t',assistantResponseId:'r'}),
      ];
      return value;
    };
    await translator.enqueue(snap('running','running'));
    await translator.enqueue(snap('completedSuccess','completedSuccess'));
    // The vocabulary refusal (storage-contract) applies to every persisted event type; the
    // fixture records everything the translator appends, so any host-unknown custom type
    // entering the log fails here — exactly the cold-read break the carrier switch removed.
    const types=events.map(event=>event.type);
    assert.ok(types.length>0,'the completion pass produced events');
    assert.ok(types.every(type=>type!=='agent/input/projection-completed'&&type!=='agent/input/command-replaced'),
      'no driver-private event types may enter the session log');
    assert.deepEqual(completedInputs,['command-C'],'the key travelled through the callback carrier');
  }finally{
    await translator.close();
  }
});

