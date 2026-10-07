import {commandFault} from './commands.mjs';

/** History mutation family reachable from the plugin dock. The guards, CAS and ACK settlement
 * already live in the shared V4Conversation owner; this module only routes the five commands and
 * the rewind preview read for a native driver session. */
export const HISTORY_MUTATION_COMMANDS=Object.freeze(new Set(['editUserQuery','retryTurn','applyFileRewind','discardSharedContext','createSelectionSideSession']));
const HISTORY_READS=Object.freeze(new Set(['fileChanges','fileRewindPreview']));

/** Native-session parity ingress for the history family: `history` reads reuse the conversation's
 * own CAS-checked `historyQuery`, and command submits run through the same `submitControl` path as
 * every other driver command (so failure receipts, the permission/userInput kind guard and the
 * edit/retry log-epoch reconciliation stay in one place). */
export async function historyOperation(agent,payload,signal){
  const {domain,operation,kind,params={}}=payload??{};
  agent.assertAvailable();signal?.throwIfAborted();
  await agent.ready();signal?.throwIfAborted();
  if(domain==='history'){
    // A row-targeting read must carry the frozen baseline so a late reply cannot apply to a newer projection.
    if(operation!=='read'||!HISTORY_READS.has(kind))throw commandFault('parity-operation-denied');
    return agent.conversation.historyQuery({kind,target:params.target,baseRevision:payload.baseRevision,baseLogEpoch:payload.baseLogEpoch},{signal});
  }
  if(domain==='command'&&operation==='submit'&&HISTORY_MUTATION_COMMANDS.has(kind)){
    const snapshot=agent.conversation.state.snapshot;
    if(payload.baseRevision!==snapshot.revision||payload.baseLogEpoch!==snapshot.logEpoch)throw commandFault('parity-projection-stale');
    return agent.submitControl({type:kind,payload:params,baseRevision:payload.baseRevision,baseLogEpoch:payload.baseLogEpoch,signal});
  }
  throw commandFault('parity-operation-denied');
}
