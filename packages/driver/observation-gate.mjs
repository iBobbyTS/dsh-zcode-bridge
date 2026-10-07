/** Gate the chat follow's opening observation on the legacy content sync.
 *
 * The official client anchors its transcript with ONE bounded tail snapshot
 * (session.follow → sessionQuery.observeSession with 'all' projections) and afterwards
 * only accepts incremental appends. If that snapshot observes the announced placeholder
 * (title + marker turn), the client's cursor parks at 3 events and the factory's later
 * announce — `session/created` — replays the whole backfilled history past that cursor as
 * live appends: the chat renders everything top-to-bottom for seconds. Holding the
 * observation until `ensureReadable` has persisted the transcript keeps the official
 * contract: the snapshot itself is the bounded full tail (bottom-anchored, latest turn
 * first) and the announce replays essentially nothing.
 *
 * Scope: only the follow/history read shape waits, and only for catalog rows that still need
 * the handover (content not synced, or the placeholder is still the announced live source —
 * observing it would anchor the client on the 3-event marker). List surfaces, header reads,
 * loadOlder pages ('none' projections) and ordinary driver sessions pass through untouched.
 * Cordis forbids re-providing a service owned by another fiber, so this patches the service
 * object's method and restores it on unload. */
export function installObservationGate({sessionQuery,directory}){
  if(!sessionQuery||typeof sessionQuery.observeSession!=='function')return()=>{};
  const original=sessionQuery.observeSession;
  if(original[GATED])return()=>{};
  const gated=async function observeSession(id,options){
    if(options?.projectionMode==='all'&&directory.requiresHandover(id))
      await directory.ensureReadable(id,{signal:options.signal});
    return original.call(this,id,options);
  };
  Object.defineProperty(gated,GATED,{value:true});
  sessionQuery.observeSession=gated;
  return ()=>{if(sessionQuery.observeSession===gated)sessionQuery.observeSession=original};
}
const GATED=Symbol('zcode-driver observation gate');
