import { parseV4VisibleSlashCommand } from './vendor/zcode/input-commands.mjs';

const modes = new Set(['build', 'edit', 'plan', 'yolo']);
const deliveries = new Set(['queue', 'guide', 'startNow']);
const queueCommands = new Set(['editQueueItem', 'deleteQueueItem', 'reorderQueueItem', 'sendQueuedNow']);

/** Freeze the official selection in this input; never consult DSH defaults. */
export function inputSubmission(snapshot, text, { goal = false, delivery } = {}) {
  const slash = parseV4VisibleSlashCommand(goal && !text.trim().startsWith('/') ? `/goal ${text}` : text);
  if (slash?.kind === 'resumeGoal') return { type: 'resumeGoal', payload: {} };
  if (slash && slash.kind !== 'sendGoalCommand') throw new Error(`input-command-unavailable:${slash.kind}`);
  if (goal && !slash) throw new Error('goal-objective-required');
  const selection = snapshot?.config?.modelSelection;
  if (!selection?.providerId || !selection?.modelId) throw new Error('selection-missing');
  if (!modes.has(snapshot.config.mode)) throw new Error('submission-mode-unavailable');
  if (!text.trim()) throw new Error('input-empty');
  if (delivery !== undefined && !deliveries.has(delivery)) throw new Error('delivery-invalid');
  return {
    type: slash?.kind === 'sendGoalCommand' ? 'sendGoalCommand' : 'sendText',
    payload: {
      text: slash?.kind === 'sendGoalCommand' ? slash.objective : text,
      ...(slash?.kind === 'sendGoalCommand' ? { displayText: slash.displayText } : {}),
      modelSelection: structuredClone(selection),
      mode: snapshot.config.mode,
      ...(snapshot.config.planEnabled !== undefined ? { planEnabled: snapshot.config.planEnabled } : {}),
      ...(!slash && delivery ? { requestedDelivery: delivery } : {}),
    },
  };
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
