import {test} from 'node:test';import assert from 'node:assert/strict';
import {world,catalogRow,directory,tick} from './helpers/conversation-runtime.mjs';

/** Driver-mode takeover: while the zcode driver occupies the factory, the host mirror directory
 * must not announce its own per-conversation records — the driver's lazy placeholders own the
 * catalog. A suspension set before start() prevents the import; a suspension after the fact
 * retires every imported mirror (withdraw + record deletion) and stops the poll. */
test('a suspended host directory imports nothing at start and ignores refresh calls',async()=>{
  const w=await world({catalog:async()=>directory([catalogRow('one'),catalogRow('two')])});
  w.host.directorySuspended='driver-occupied';
  try{
    await w.runtime.start();
    assert.equal(w.store.records.size,0,'no mirror record is created for a catalog row');
    assert.equal(w.sessions.size,0,'no mirror session is announced');
    assert.equal(w.runtime.directoryTimer??null,null,'the directory poll is never scheduled');
    await w.runtime.refreshDirectory();
    assert.equal(w.store.records.size,0,'a suspended refreshDirectory call is a no-op');
  }finally{await w.runtime.dispose()}
});

test('retireImportedMirrors withdraws announced mirrors, deletes their records, and keeps them retired',async()=>{
  const w=await world({catalog:async()=>directory([catalogRow('one'),catalogRow('two')])});
  try{
    await w.runtime.start();
    assert.equal(w.store.records.size,2,'the unsuspended host imports the catalog');
    assert.equal(w.sessions.size,2);
    const ids=[...w.store.records.keys()];
    w.host.directorySuspended='driver-occupied';
    const retired=await w.runtime.retireImportedMirrors();
    assert.deepEqual([...retired].sort(),[...ids].sort(),'both imported mirrors retire');
    assert.equal(w.store.records.size,0,'the mirror records are deleted, not just marked absent');
    assert.equal(w.sessions.size,0,'every announced mirror session is withdrawn from the store');
    await w.runtime.refreshDirectory();
    assert.equal(w.store.records.size,0,'the directory stays retired after the call');
    // A retirement before start() is the pre-occupation case: the import never runs.
    const early=await world({catalog:async()=>directory([catalogRow('three')])});
    early.host.directorySuspended='driver-occupied';
    await early.runtime.retireImportedMirrors();
    await early.runtime.start();
    assert.equal(early.store.records.size,0);
    await early.runtime.dispose();
  }finally{await w.runtime.dispose()}
});
