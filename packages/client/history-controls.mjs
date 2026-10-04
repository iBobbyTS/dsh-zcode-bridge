/** Immutable action target from the rendered projection. Never retarget a captured row after rewind. */
export function historyTarget(state, row) {
  const s = state?.snapshot;
  if (!s || !row?.entityId) return null;
  return { target: { rowId: row.rowId, entityId: row.entityId }, baseRevision: s.revision, baseLogEpoch: s.logEpoch };
}
/** Uses authoritative row actions and availability; busy/held compact may be queued by the official runtime. */
export function historyAllowed(state, row, type) {
  if (state?.status !== 'live' || !state.snapshot) return false;
  if (type === 'compact') return state.admission?.allowed === true && state.snapshot.availability?.compact?.allowed === true;
  const model = type === 'editUserQuery' || type === 'retryTurn';
  if (!(model ? state.admission : state.managementAdmission)?.allowed || !row?.entityId) return false;
  const action = { forkAssistant: 'canFork', editUserQuery: 'canEdit', retryTurn: 'canRetry', applyFileRewind: 'canRewindFiles' }[type];
  if (type === 'setAssistantFeedback') return row.kind === 'assistantText';
  return action ? row.actions?.[action] === true : false;
}
/**
 * Official editUserQuery admits "text or retained attachment" (same rule as the S07 input submission):
 * omitting `attachments` keeps the canonical input's attachments, so an empty edited text is a valid
 * attachment-only edit. Guards (admission, canEdit, CAS) stay outside this helper.
 */
export function historyEditSubmittable(row, text) {
  return Boolean(String(text ?? '').trim()) || (Array.isArray(row?.attachments) && row.attachments.length > 0);
}
/** Preview confirmation and editor keep the original CAS rather than silently adopting a new revision. */
export function historyTargetCurrent(state, token) {
  const s = state?.snapshot;
  return !!token && state.status === 'live' && s?.logEpoch === token.baseLogEpoch && s.revision === token.baseRevision && s.rows.window.some(r => r.rowId === token.target.rowId && r.entityId === token.target.entityId);
}
/** Explain command-specific facts without treating accepted/query as completion. */
export function historyResultText(record) {
  const ack = record?.ack, result = ack?.result;
  if (result?.type === 'editUserQuery' && result.disposition === 'blocked') return `Edit blocked: ${result.reasonCode ?? ack.reasonCode ?? 'workspace rewind unavailable'}`;
  if (result?.type === 'applyFileRewind') return result.applied ? `ZCode applied file rewind: ${result.response}` : `Files were not reverted: ${result.response}`;
  if (record?.branchAddress) return `ZCode created conversation branch ${record.branchAddress.sessionId}; workspace files were preserved.`;
  const native = ack?.reasonCode ?? record?.error;
  return `${record?.type ?? 'Command'}: ${record?.state ?? 'unknown'}${native ? ` (${native})` : ''}${ack?.message ? ` — ${ack.message}` : ''}`;
}
