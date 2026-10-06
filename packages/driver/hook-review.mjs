import {z} from 'zod';
import {parseCommandEnvelope} from '../host/vendor/zcode/v4.mjs';
import {commandFault} from './commands.mjs';

export const HOOK_REVIEW_COMMANDS=new Set(['respondWorkspaceHookReview','toggleWorkspaceHookReviewItem','revokeWorkspaceHookTrust','requestWorkspaceHookReview']);
export const INTERACTION_COMMANDS=new Set(['resolveInteraction','snoozeInteractionAutoResolution',...HOOK_REVIEW_COMMANDS]);
// Exact copies of the unexported vendored v4.mjs:7447-7463 contracts. No DTO
// or reason vocabulary is inferred from the official DSH approval interface.
const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const trustGrantParamsSchema=z.object({workspace:z.object({workspacePath:z.string().trim().min(1),workspaceKey:z.string().trim().min(1),workspaceIdentity:z.string().trim().min(1).optional(),remoteSessionId:z.string().trim().min(1).optional()}).strict(),bundleDigest:digest,hookDeclarationDigest:digest}).strict();
export const TRUST_GRANT_REASONS=Object.freeze({
  workspace_hooks_blocked_by_policy:'rejected',
  workspace_hooks_bundle_changed:'stale',
  workspace_hooks_snapshot_mismatch:'stale',
  workspace_hooks_policy_requires_pretrust:'rejected',
  workspace_hooks_trust_store_corrupt:'rejected',
  workspace_hooks_config_unreadable:'rejected',
});
const grantResultSchema=z.object({accepted:z.boolean(),reasonCode:z.enum(Object.keys(TRUST_GRANT_REASONS)).optional()}).strict();
export function translateTrustGrant(raw){
  const parsed=grantResultSchema.safeParse(raw);
  if(!parsed.success||parsed.data.accepted&&parsed.data.reasonCode)throw commandFault('hook-trust-result-invalid');
  return {...parsed.data,outcome:parsed.data.accepted?'confirmed':TRUST_GRANT_REASONS[parsed.data.reasonCode]??'rejected'};
}
export async function grantWorkspaceHookTrust(peer,workspace,params,{signal,current=()=>true}={}){
  const parsed=trustGrantParamsSchema.safeParse({workspace,...params});
  if(!parsed.success||parsed.data.workspace.workspacePath!==workspace.workspacePath||parsed.data.workspace.workspaceKey!==workspace.workspaceKey)throw commandFault('hook-trust-params-invalid');
  signal?.throwIfAborted();const generation=peer.generation;
  let raw;
  try{raw=await peer.request('workspace/hooks/trustGrant',parsed.data,{signal})}
  catch(error){if(error.sent===false)throw error;throw Object.assign(commandFault('hook-trust-outcome-unknown'),{cause:error})}
  if(signal?.aborted||!current()||peer.generation!==generation)throw commandFault('hook-trust-outcome-unknown');
  try{return translateTrustGrant(raw)}catch(error){throw Object.assign(commandFault('hook-trust-outcome-unknown'),{cause:error})}
}
const targetKeys=['sessionId','taskId','runId','remoteSessionId','workspaceIdentity','bundleDigest','reviewFlowId','generation','interactionId'];
export function hookReviewTarget(payload){return Object.fromEntries(targetKeys.filter(key=>payload[key]!==undefined).map(key=>[key,payload[key]]))}
export function validateHookReview(conversation,command){
  if(!HOOK_REVIEW_COMMANDS.has(command.type))return;
  const state=conversation.state,snapshot=state.snapshot;
  if(!state.admission.allowed||!state.managementAdmission.allowed)throw commandFault(state.admission.reason??state.managementAdmission.reason??'projection-unconfirmed');
  const payload=command.payload??{};
  const parsed=parseCommandEnvelope({commandId:'hook-review-validation',clientId:conversation.clientId,sessionId:conversation.address.sessionId,type:command.type,payload,issuedAt:0,baseRevision:command.baseRevision??snapshot.revision});
  if(!parsed.ok)throw commandFault('command-invalid');
  if((command.baseRevision!==undefined&&command.baseRevision!==snapshot.revision)||(command.baseLogEpoch!==undefined&&command.baseLogEpoch!==snapshot.logEpoch))throw commandFault('hook-review-stale');
  if(payload.interactionId){
    const interaction=snapshot.pendingInteractions.find(item=>item.interactionId===payload.interactionId);
    if(!interaction)throw commandFault('interaction-unconfirmed');
    if(interaction.kind!=='workspaceHookReview')throw commandFault('interaction-mapping-unavailable');
    const review=interaction.payload;
    if(targetKeys.some(key=>payload[key]!==review[key]))throw commandFault('hook-review-stale');
    const ids=command.type==='respondWorkspaceHookReview'?payload.decision.reviewItemIds:command.type==='toggleWorkspaceHookReviewItem'?[payload.reviewItemId]:payload.reviewItemIds;
    if(!ids?.length||new Set(ids).size!==ids.length)throw commandFault('hook-review-item-invalid');
    const items=ids.map(id=>review.items.find(item=>item.reviewItemId===id));
    if(items.some(item=>!item))throw commandFault('hook-review-item-unconfirmed');
    if(command.type==='toggleWorkspaceHookReviewItem'&&items.some(item=>!item.editable))throw commandFault('hook-review-item-readonly');
    if(command.type==='respondWorkspaceHookReview'&&items.some(item=>!['pending_trust','revoked','stale_digest'].includes(item.trustState)))throw commandFault('hook-review-item-not-trustable');
  }else{
    const admission=snapshot.workspaceHookAdmission;
    if(payload.sessionId!==snapshot.sessionId||!admission?.workspaceIdentity||payload.workspaceIdentity!==admission.workspaceIdentity||payload.bundleDigest!==admission.bundleDigest||payload.remoteSessionId!==undefined)throw commandFault('hook-review-stale');
  }
}
/** Bounded plugin ingress for native Driver sessions, without a mirror record. */
export async function driverHookOperation(agent,payload,signal){
  const {domain,operation,kind,params={}}=payload;
  agent.assertAvailable();signal?.throwIfAborted();
  if(domain==='snapshot'&&operation==='read'){
    // A lost control ACK blocks new commands, not observation of its ledger and
    // still-pending review. Reconnect only when the projection itself is absent.
    if(agent.conversation.state.status!=='live')await agent.ready();
    signal?.throwIfAborted();return agent.conversation.state;
  }
  await agent.ready();signal?.throwIfAborted();
  if(domain==='hooks'&&operation==='grant'){
    const state=agent.conversation.state;
    if(!state.managementAdmission.allowed)throw commandFault(state.managementAdmission.reason);
    return grantWorkspaceHookTrust(agent.conversation.peer,agent.conversation.workspace,params,{signal,current:()=>!agent.disposed&&agent.conversation.state.managementAdmission.allowed});
  }
  if(domain==='command'&&operation==='submit'&&INTERACTION_COMMANDS.has(kind)){
    const snapshot=agent.conversation.state.snapshot;
    if(payload.baseRevision!==snapshot.revision||payload.baseLogEpoch!==snapshot.logEpoch)throw commandFault('parity-projection-stale');
    return agent.submitControl({type:kind,payload:params,baseRevision:payload.baseRevision,baseLogEpoch:payload.baseLogEpoch,signal});
  }
  throw commandFault('parity-operation-denied');
}
