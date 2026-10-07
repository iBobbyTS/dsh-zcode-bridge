import { parseV4VisibleSlashCommand } from './vendor/zcode/input-commands.mjs';

const modes = new Set(['build', 'edit', 'plan', 'yolo']);
const deliveries = new Set(['queue', 'guide', 'startNow']);
const queueCommands = new Set(['editQueueItem', 'deleteQueueItem', 'reorderQueueItem', 'sendQueuedNow']);

/** Freeze the official selection in this input; never consult DSH defaults. */
export function inputSubmission(snapshot, text, { goal = false, delivery, attachments, sharedContextRefs } = {}) {
  const slash = parseV4VisibleSlashCommand(goal && !text.trim().startsWith('/') ? `/goal ${text}` : text);
  if (slash?.kind === 'resumeGoal') return { type: 'resumeGoal', payload: {} };
  if (slash?.kind === 'compact') {
    if (text.trim().split(/\s+/).length !== 1) throw new Error('compact-arguments-unavailable');
    if (attachments?.length || sharedContextRefs?.length) throw new Error('compact-attachments-unavailable');
    return { type: 'compact', payload: {} };
  }
  if (slash && slash.kind !== 'sendGoalCommand') throw new Error(`input-command-unavailable:${slash.kind}`);
  if (goal && !slash) throw new Error('goal-objective-required');
  const selection = snapshot?.config?.modelSelection;
  if (!selection?.providerId || !selection?.modelId) throw new Error('selection-missing');
  if (!modes.has(snapshot.config.mode)) throw new Error('submission-mode-unavailable');
  const attachmentRefs = Array.isArray(attachments) ? attachments : [];
  const contextRefs = Array.isArray(sharedContextRefs) ? sharedContextRefs : [];
  const goalCommand = slash?.kind === 'sendGoalCommand';
  if (goalCommand && (attachmentRefs.length || contextRefs.length)) throw new Error('goal-attachments-unavailable');
  if (!text.trim() && attachmentRefs.length === 0) throw new Error('input-empty');
  if (delivery !== undefined && !deliveries.has(delivery)) throw new Error('delivery-invalid');
  return {
    type: goalCommand ? 'sendGoalCommand' : 'sendText',
    payload: {
      text: goalCommand ? slash.objective : text,
      ...(goalCommand ? { displayText: slash.displayText } : {}),
      ...(attachmentRefs.length ? { attachments: attachmentRefs } : {}),
      ...(contextRefs.length ? { context_refs: contextRefs } : {}),
      modelSelection: structuredClone(selection),
      mode: snapshot.config.mode,
      ...(snapshot.config.planEnabled !== undefined ? { planEnabled: snapshot.config.planEnabled } : {}),
      ...(!slash && delivery ? { requestedDelivery: delivery } : {}),
    },
  };
}

/** The official imported shared context, if the session projection exposes one. */
export function sharedContextState(snapshot) {
  const context = snapshot?.sharedContextImport;
  if (!context || typeof context.contextId !== 'string' || !context.contextId.trim()) return null;
  return {
    contextId: context.contextId,
    title: typeof context.title === 'string' ? context.title : null,
    shareUrl: typeof context.shareUrl === 'string' ? context.shareUrl : null,
    status: typeof context.status === 'string' ? context.status : null,
  };
}

/** A use-ref is valid only for the pending/reserved import the projection currently shows. */
export function sharedContextRefs(snapshot) {
  const context = sharedContextState(snapshot);
  if (!context || !['pending', 'reserved'].includes(context.status)) return [];
  return [{ kind: 'shared_context_import', context_id: context.contextId }];
}

/** Withdraw is only meaningful for a pending import; attached/legacy states stay untouched. */
export function canDiscardSharedContext(snapshot) {
  const context = sharedContextState(snapshot);
  return Boolean(context && context.status === 'pending');
}

/** A local confirmation draft, not a second runtime pending-interaction registry. */
export function heldConfirmation(snapshot, command) {
  return {
    logEpoch: snapshot.logEpoch,
    items: snapshot.queue.items.map(({ queueItemId, sourceCommandId }) => ({ queueItemId, sourceCommandId })),
    command: structuredClone(command),
  };
}

/** Membership is bound to what was shown, including the original command identity. */
export function confirmHeld(snapshot, confirmation, disposition) {
  if (!['clearQueueAndSend', 'keepQueueAndSend'].includes(disposition)) throw new Error('held-disposition-invalid');
  if (snapshot?.logEpoch !== confirmation.logEpoch || snapshot.inputRouting.mode !== 'choice' ||
      snapshot.queue.items.length !== confirmation.items.length ||
      !confirmation.items.every(item => snapshot.queue.items.some(current => current.queueItemId === item.queueItemId && current.sourceCommandId === item.sourceCommandId))) {
    throw new Error('held-queue-confirmation-stale');
  }
  if (confirmation.command.type === 'compact') {
    // ZCode compact is a typed FIFO maintenance intent (goal-compact.ts:52-54),
    // with payload {}. It cannot clear or preempt the confirmed held queue.
    if (disposition !== 'keepQueueAndSend') throw new Error('compact-queue-disposition-unavailable');
    return structuredClone(confirmation.command);
  }
  return {
    ...confirmation.command,
    payload: {
      ...confirmation.command.payload,
      heldQueueDisposition: disposition,
      expectedHeldQueueItemIds: confirmation.items.map(item => item.queueItemId),
    },
  };
}

/** Apply only a transient presentation patch to the current authoritative queue. */
export function optimisticQueue(items, operation) {
  if (!operation || !queueCommands.has(operation.type)) return items;
  const index = items.findIndex(item => item.queueItemId === operation.payload.queueItemId && item.sourceCommandId === operation.sourceCommandId);
  if (index < 0) return items;
  if (operation.type === 'editQueueItem') return items.map((item, i) => i === index ? { ...item, text: operation.payload.newText } : item);
  if (operation.type === 'deleteQueueItem') return items.filter((_, i) => i !== index);
  if (operation.type !== 'reorderQueueItem') return items;
  const result = items.filter((_, i) => i !== index);
  const before = operation.payload.beforeQueueItemId;
  const target = before === null ? result.length : result.findIndex(item => item.queueItemId === before);
  if (target < 0) return items;
  result.splice(target, 0, items[index]);
  return result;
}

/** ACK is receipt only; projection and query remain the execution authority. */
export function commandResultText(record) {
  if (!record?.commandId || !record.state) return 'Command outcome unknown. Query the command before deciding to send again.';
  if (record.state === 'outcome-unknown') return 'Official result: outcome-unknown. Query the original command before deciding to send again. Only the local preview was cleared; no runtime undo was requested.';
  const status = record.ack?.status ?? record.state;
  const reason = record.ack?.reasonCode ?? record.error;
  return `Official result: ${status}${reason ? ` (${reason})` : ''}. ${['accepted', 'duplicate'].includes(status) ? 'Awaiting authoritative state.' : 'Only the local preview was cleared; this does not undo an accepted command.'}`;
}

/** An active response carries its own model; config describes subsequent execution. */
export function executionSelection(snapshot) {
  const running = snapshot?.rows?.window?.filter(row => row.kind === 'turnHeader' && row.state === 'running').at(-1);
  const response = running && snapshot.rows.window.filter(row => row.turnId === running.turnId && row.kind === 'assistantText' && row.model).at(-1);
  return { currentModel: response?.model ?? null, nextSelection: snapshot?.config?.modelSelection ?? null };
}
