import test from 'node:test';
import assert from 'node:assert/strict';
import { s06Runtime } from './fixtures/s06-runtime.mjs';
import { inputSubmission, heldConfirmation, confirmHeld, optimisticQueue, executionSelection, commandResultText } from '../packages/client/input-controls.mjs';
import { parseCommandEnvelope } from '../packages/host/vendor/zcode/v4.mjs';

async function send(f, command, status = 'accepted', reason) {
  const promise = f.conversation.submit(command); f.ack(f.sent.at(-1), status, reason); return promise;
}

test('S06 official queue/guide/startNow payloads freeze selection; goal uses its own intent', async () => {
  const f = s06Runtime(); try {
    await f.open();
    for (const delivery of ['queue', 'guide', 'startNow']) {
      const command = inputSubmission(f.conversation.state.snapshot, `Message ${delivery}`, { delivery });
      await send(f, command);
      assert.equal(f.sent.at(-1).params.payload.requestedDelivery, delivery);
      assert.deepEqual(f.sent.at(-1).params.payload.modelSelection, f.conversation.state.snapshot.config.modelSelection);
      assert.equal(f.sent.at(-1).params.payload.mode, 'build');
    }
    await send(f, inputSubmission(f.conversation.state.snapshot, '/goal replace release safely', { goal: true, delivery: 'guide' }));
    assert.equal(f.sent.at(-1).params.type, 'sendGoalCommand');
    assert.equal(f.sent.at(-1).params.payload.requestedDelivery, undefined);
    assert.equal(f.sent.at(-1).params.payload.text, 'release safely');
    assert.equal(f.sent.at(-1).params.payload.displayText, '/goal replace release safely');
    assert.deepEqual(inputSubmission(f.conversation.state.snapshot, '/GOAL resume'), { type: 'resumeGoal', payload: {} });
    assert.throws(() => inputSubmission(f.conversation.state.snapshot, '/goal clear'), /unsupportedGoal/);
    assert.throws(() => inputSubmission(f.conversation.state.snapshot, '/goal replace'), /emptyGoal/);
    assert.ok(parseCommandEnvelope(f.sent.at(-1).params).ok);
    assert.throws(() => inputSubmission({ config: { mode: 'build' } }, 'hi'), /selection-missing/);
  } finally { f.dispose(); }
});

test('S06 queue edit/reorder/delete/promote keep official item id, command lineage, CAS and authoritative order', async () => {
  const f = s06Runtime(); try {
    await f.open();
    await send(f, { type: 'reorderQueueItem', payload: { queueItemId: 'input-b', beforeQueueItemId: 'input-a' } });
    assert.equal(f.sent.at(-1).params.baseRevision, 0);
    assert.deepEqual(f.conversation.state.snapshot.queue.items.map(x => x.queueItemId), ['input-a', 'input-b']);
    f.update(s => s.queue.items.reverse());
    assert.deepEqual(f.conversation.state.snapshot.queue.items.map(x => x.queueItemId), ['input-b', 'input-a']);
    for (const [type, payload] of [['editQueueItem', { newText: 'Edited BETA' }], ['deleteQueueItem', {}], ['sendQueuedNow', {}]]) {
      const record = await send(f, { type, payload: { queueItemId: 'input-b', ...payload } });
      assert.equal(f.sent.at(-1).params.baseRevision, 1);
      assert.equal(record.state, 'accepted-awaiting-terminal');
      assert.equal(f.conversation.state.snapshot.queue.items[0].sourceCommandId, 'command-input-b');
    }
    await assert.rejects(f.conversation.submit({ type: 'deleteQueueItem', payload: { queueItemId: 'absent' } }), e => e.code === 'queue-item-unconfirmed');
    f.update(s => { s.queue.items[0].dispatch.state = 'reserved'; });
    await assert.rejects(f.conversation.submit({ type: 'sendQueuedNow', payload: { queueItemId: 'input-b' } }), e => e.code === 'guard.queueItemReserved');
  } finally { f.dispose(); }
});

test('S06 held disposition binds confirmed membership; another endpoint insertion never clears a new item', async () => {
  const f = s06Runtime('held'); try {
    await f.open();
    const captured = heldConfirmation(f.conversation.state.snapshot, inputSubmission(f.conversation.state.snapshot, 'New held input'));
    const clear = confirmHeld(f.conversation.state.snapshot, captured, 'clearQueueAndSend');
    assert.deepEqual(clear.payload.expectedHeldQueueItemIds, ['input-a', 'input-b']);
    await send(f, confirmHeld(f.conversation.state.snapshot, captured, 'keepQueueAndSend'));
    f.update(s => s.queue.items.push({ ...structuredClone(s.queue.items[0]), queueItemId: 'input-other', sourceCommandId: 'command-other', text: 'Other client' }));
    assert.throws(() => confirmHeld(f.conversation.state.snapshot, captured, 'clearQueueAndSend'), /stale/);
    const count = f.sent.length;
    await assert.rejects(f.conversation.submit(clear), e => e.code === 'held-queue-confirmation-stale');
    assert.equal(f.sent.length, count);
    assert.equal(f.conversation.state.snapshot.queue.items[2].text, 'Other client');
    await assert.rejects(f.conversation.submit(inputSubmission(f.conversation.state.snapshot, 'Unconfirmed')), e => e.code === 'held-queue-confirmation-required');
    const replaced = structuredClone(f.conversation.state.snapshot); replaced.queue.items[0].sourceCommandId = 'reused-id';
    const fresh = heldConfirmation(f.conversation.state.snapshot, inputSubmission(f.conversation.state.snapshot, 'Confirmed'));
    assert.throws(() => confirmHeld(replaced, fresh, 'keepQueueAndSend'), /stale/);
  } finally { f.dispose(); }
});

test('S06 next model/mode changes leave active response and admitted queued selection intact', async () => {
  const f = s06Runtime(); try {
    await f.open();
    await send(f, { type: 'switchModelConfig', payload: { provider: 'fixture-provider', model: 'model-next', thought: 'low' } });
    await send(f, { type: 'switchCollaborationMode', payload: { mode: 'edit' } });
    assert.equal(executionSelection(f.conversation.state.snapshot).nextSelection.modelId, 'model-old');
    f.update(s => { s.config.modelSelection.modelId = 'model-next'; s.config.modelSelection.options.reasoningLevel = 'low'; s.config.mode = 'edit'; });
    const selection = executionSelection(f.conversation.state.snapshot);
    assert.equal(selection.currentModel, 'model-old'); assert.equal(selection.nextSelection.modelId, 'model-next');
    assert.equal(f.conversation.state.snapshot.queue.items[0].modelSelection.modelId, 'model-old');
    assert.equal(inputSubmission(f.conversation.state.snapshot, 'Later input').payload.mode, 'edit');
  } finally { f.dispose(); }
});

test('S06 failed and unknown commands clear only their identity-scoped local preview without undo or resend', async () => {
  const f = s06Runtime(); try {
    await f.open();
    const operation = { type: 'deleteQueueItem', payload: { queueItemId: 'input-a' }, sourceCommandId: 'command-input-a' };
    assert.equal(optimisticQueue(f.conversation.state.snapshot.queue.items, operation).length, 1);
    f.update(s => s.queue.items.push({ ...structuredClone(s.queue.items[0]), queueItemId: 'input-other', sourceCommandId: 'command-other' }));
    assert.deepEqual(optimisticQueue(f.conversation.state.snapshot.queue.items, operation).map(x => x.queueItemId), ['input-b', 'input-other']);
    const record = await send(f, { type: operation.type, payload: operation.payload }, 'stale', 'proto.staleRevision');
    assert.match(commandResultText(record), /does not undo/);
    assert.equal(optimisticQueue(f.conversation.state.snapshot.queue.items, null).length, 3);
    const pending = f.conversation.submit({ type: 'editQueueItem', payload: { queueItemId: 'input-a', newText: 'Maybe accepted' } });
    f.response(f.sent.at(-1), { commandId: f.sent.at(-1).params.commandId, status: 'future-success', revisionAtDecision: 1 });
    const unknown = await pending; assert.equal(unknown.state, 'outcome-unknown');
    assert.equal(f.conversation.state.status, 'closed');
    assert.match(commandResultText(undefined), /unknown/);
  } finally { f.dispose(); }
});

test('S06 lost ACK is queried by original id and unknown query never resubmits', async () => {
  const f = s06Runtime(); try {
    await f.open();
    const record = await f.conversation.submit({ type: 'deleteQueueItem', payload: { queueItemId: 'input-a' } });
    assert.equal(record.state, 'outcome-unknown');
    const requests = f.sent.length;
    const query = f.conversation.queryCommand(record.commandId);
    f.response(f.sent.at(-1), { results: [{ key: { sessionId: 'fixture-session', commandId: record.commandId }, result: 'unknown' }] });
    assert.equal((await query).state, 'outcome-unknown'); assert.equal(f.sent.length, requests + 1);
    assert.equal(f.sent.at(-1).method, 'v4/commands/query');
  } finally { f.dispose(); }
});

test('S06 followup/pause/config and stop isolation obey official guards; restricted producer emits no commands', async () => {
  const f = s06Runtime(); try {
    await f.open();
    for (const [type, payload] of [['setFollowupMode', { mode: 'guide' }], ['setAutoDrain', { autoDrain: false }], ['pauseGoal', {}], ['resumeGoal', {}]]) {
      await send(f, { type, payload }); assert.ok(parseCommandEnvelope(f.sent.at(-1).params).ok);
    }
    f.update(s => { s.control.activeWorks[0].foregroundExecutionId = 'execution-new'; });
    await assert.rejects(f.conversation.submit({ type: 'stop', payload: { expectedForegroundExecutionId: 'execution-old' } }), e => e.code === 'stop-target-unconfirmed');
    f.update(s => { s.availability.queueEdit = { allowed: false, reasonCode: 'fixture.denied' }; });
    await assert.rejects(f.conversation.submit({ type: 'deleteQueueItem', payload: { queueItemId: 'input-a' } }), e => e.code === 'fixture.denied');
  } finally { f.dispose(); }
  const restricted = s06Runtime('busy', { runnable: false }); try {
    await restricted.open(); const count = restricted.sent.length;
    await assert.rejects(restricted.conversation.submit({ type: 'setFollowupMode', payload: { mode: 'guide' } }), e => e.code === 'runtime-restricted');
    assert.equal(restricted.sent.length, count);
  } finally { restricted.dispose(); }
});

test('S06 workspace preference writes validate official responses, scope and unknown carriers without storing defaults', async () => {
  const f = s06Runtime(); try {
    await f.open();
    for (const [kind, preferences, result] of [
      ['interaction', { askUserQuestionAutoResolutionEnabled: false }, { askUserQuestionAutoResolutionEnabled: false, snoozedInteractionCount: 0 }],
      ['modelIo', { fullRetentionEnabled: true }, { fullRetentionEnabled: true, updatedSessionCount: 0 }],
    ]) {
      const operation = f.conversation.workspaceConfiguration(kind, preferences);
      const request = f.sent.at(-1);
      assert.deepEqual(request.params.workspace, f.conversation.workspace);
      assert.deepEqual(request.params.preferences, preferences);
      f.response(request, { workspace: f.conversation.workspace, ...result });
      assert.deepEqual(await operation, { workspace: f.conversation.workspace, ...result });
      assert.equal(f.conversation.state.snapshot.config.model, 'model-old');
    }
    await assert.rejects(f.conversation.workspaceConfiguration('interaction', { fakeDefault: true }), e => e.code === 'workspace-config-invalid');
    await assert.rejects(f.conversation.workspaceConfiguration('arbitrary', {}), e => e.code === 'workspace-config-unavailable');
    const mismatch = f.conversation.workspaceConfiguration('modelIo', { fullRetentionEnabled: true });
    f.response(f.sent.at(-1), { workspace: { workspacePath: '/other', workspaceKey: '/other' }, fullRetentionEnabled: true, updatedSessionCount: 0 });
    await assert.rejects(mismatch, e => e.code === 'workspace-config-identity-mismatch');
  } finally { f.dispose(); }
});
