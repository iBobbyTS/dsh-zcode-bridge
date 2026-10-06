import {BINDING_EVENT} from './factory.mjs';

/** One-shot first-start migration: hide every pre-existing Native (non-ZCode) Session from the
 * official grouping surfaces with a durable archive. The archive SET is snapshotted before the
 * first write and persisted, so an interrupted run resumes the same set and a Session created
 * after migration started is never archived. Archives are idempotent and delete no data. */
export async function runNativeArchive({store,listSessionIds,readEvents,archive,onProgress}={}){
  if(typeof store?.save!=='function'||typeof listSessionIds!=='function'||typeof readEvents!=='function'||typeof archive!=='function')throw Object.assign(new Error('native-archive-deps-invalid'),{code:'native-archive-deps-invalid'});
  let state=store.value.nativeArchive;
  if(state?.done)return {outcome:'already-migrated',archived:state.archived.length};
  if(!state){
    const ids=await listSessionIds();
    const snapshot=[];
    for(const id of ids){
      const events=await readEvents(id);
      // A Session this driver already bound is ZCode-owned, never a legacy Native row.
      if((events??[]).some(event=>event.type===BINDING_EVENT))continue;
      snapshot.push(id);
    }
    state={snapshot,archived:[],done:false};
    store.value.nativeArchive=state;
    await store.save();
  }
  for(const id of state.snapshot){
    if(state.archived.includes(id))continue;
    await archive(id);
    state.archived.push(id);
    await store.save();
    onProgress?.(id,state.archived.length,state.snapshot.length);
  }
  state.done=true;
  await store.save();
  return {outcome:'migrated',archived:state.archived.length};
}
