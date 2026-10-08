import {eventRowKey} from '../driver/events.mjs';

/** Bridge-facing waiting summary for one driver session: what the official conversation is
 *  sitting on between turns. `backgroundWorks` is live state, not transcript history, so this
 *  is a read of the current snapshot only — entries vanish once their result is delivered
 *  (delivery always opens the next origin=backgroundResult turn). */
export function backgroundWaiting(agent){
  const snapshot=agent.conversation?.state?.snapshot;
  const works=(snapshot?.backgroundWorks??[]).map(work=>({
    workId:work.workId,
    kind:work.kind,
    title:work.title,
    status:work.status,
    startedAt:work.startedAt,
    endedAt:work.endedAt??null,
    cancellable:work.cancellable===true,
    ...(work.childSessionId?{childSessionId:work.childSessionId}:{}),
  }));
  const translator=agent.translator;
  let lastTurn=null;
  for(const turn of translator?.turns?.values()??[])lastTurn=Math.max(lastTurn,turn.turn);
  if(works.length){
    // Turn attribution: the launching row carries the same workId, and every row carries its
    // turnId; the translator map holds the durable dsh turn number for that (logEpoch,turnId).
    const anchor=new Map();
    for(const row of snapshot?.rows?.window??[]){
      if((row.kind==='toolCall'||row.kind==='subagent')&&row.workId&&!anchor.has(row.workId))anchor.set(row.workId,row);
    }
    for(const work of works){
      const entry=anchor.get(work.workId);
      const turnEntry=entry===undefined?undefined:translator?.turns?.get(eventRowKey(snapshot.logEpoch,entry.turnId));
      work.turn=turnEntry?.turn??null;
    }
  }
  return {phase:snapshot?.control?.phase??null,lastTurn,works};
}
