import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation, WORK_COMMANDS } from '../packages/host/conversation.mjs';
import { zcodeSessionCancelBackgroundTaskParamsSchema, zcodeSessionCancelBackgroundTaskResultSchema, v4BackgroundBashOutputParamsSchema } from '../packages/host/vendor/zcode/v4.mjs';

const lifecycle = JSON.parse(await readFile(new URL('./fixtures/background-subagents/lifecycle.json', import.meta.url)));
const empty = JSON.parse(await readFile(new URL('./fixtures/background-subagents/empty.json', import.meta.url)));
const success = JSON.parse(await readFile(new URL('./fixtures/transport-v4/success.json', import.meta.url)));
const tick = () => new Promise(resolve => setImmediate(resolve));

// runnable=false mirrors the restricted bridge host: no new model admission, yet background work
// observation/cancel is still a session-scoped official face.
function fixture({ runnable = false, clientMode = 'web-remote-replayable' } = {}) {
  const input = new PassThrough(), output = new PassThrough(), sent = [];
  output.on('data', b => sent.push(JSON.parse(b)));
  const peer = new ProtocolPeer(input, output, { timeoutMs: 100 });
  const conversation = new V4Conversation(peer, {
    address: { runtime: 'zcode', authority: 'test-authority', workspace: '/fixture/workspace', sessionId: 'fixture-session' },
    workspace: { workspacePath: '/fixture/workspace', workspaceKey: '/fixture/workspace' },
    clientId: 'fixture-client', connectionId: 'fixture-connection', clientMode, runnable, frameTimeoutMs: 500,
  });
  const receive = message => input.write(JSON.stringify(message) + '\n');
  const response = (request, result) => receive({ id: request.id, result });
  const fail = (request, code, message = 'official rejection') => receive({ id: request.id, error: { code, message } });
  const wire = frame => receive({ method: 'v4/conversation/frame', params: frame });
  async function open(initial = success.initial, ack = success.ack) {
    const p = conversation.connect();
    input.write(JSON.stringify({ id: sent.at(-1).id, result: ack }) + '\n' + JSON.stringify({ method: 'v4/conversation/frame', params: initial }) + '\n');
    await p; await tick();
    return conversation;
  }
  return { input, output, sent, peer, conversation, receive, response, fail, wire, open, dispose: () => peer.close() };
}

test('Background subagents restricted runtime still observes: real empty projection and observation-only admission', async () => {
  const f = fixture();
  try {
    await f.open(); // real official empty snapshot (backgroundWorks [], subagents empty)
    const state = f.conversation.state;
    assert.equal(state.status, 'live');
    assert.equal(state.admission.allowed, false, 'no new model admission in the restricted runtime');
    assert.equal(state.workAdmission.allowed, true, 'background work observation is session-scoped');
    assert.deepEqual(state.snapshot.backgroundWorks, []);
    assert.deepEqual(state.snapshot.subagents, { revision: 0, childSessionIds: [], running: [], endedTotal: 0 });
  } finally { f.dispose(); }
});

test('Background subagents listSubagents uses the official carrier, validates the result and surfaces official rejection', async () => {
  const f = fixture();
  try {
    await f.open();
    const pending = f.conversation.listSubagents({ endedLimit: 5 });
    const request = f.sent.at(-1);
    assert.equal(request.method, 'session/subagents');
    assert.deepEqual(request.params, { sessionId: 'fixture-session', endedLimit: 5 });
    f.response(request, empty.subagentsEmpty); // real captured official empty result
    assert.deepEqual(await pending, empty.subagentsEmpty);

    const unknown = f.conversation.listSubagents({ endedLimit: 20 });
    const unknownRequest = f.sent.at(-1);
    assert.equal(unknownRequest.method, 'session/subagents');
    f.fail(unknownRequest, -32004, 'Session not found: subagents-never-created');
    await assert.rejects(unknown, error => error.code === 'runtime-rejected' && error.protocolCode === -32004);

    const malformed = f.conversation.listSubagents();
    f.response(f.sent.at(-1), { revision: -1, running: [] });
    await assert.rejects(malformed, error => error.code === 'subagents-result-invalid');

    const invalid = f.conversation.listSubagents({ endedLimit: 0 });
    await assert.rejects(invalid, error => error.code === 'subagents-params-invalid');
  } finally { f.dispose(); }
});

test('Background subagents backgroundBashOutput passes through official output/unavailable and fails closed on malformed results', async () => {
  const f = fixture();
  try {
    await f.open();
    const unavailable = f.conversation.readBackgroundBashOutput({ workId: 'subagents-never-created' });
    assert.deepEqual(f.sent.at(-1).params, { sessionId: 'fixture-session', workId: 'subagents-never-created' });
    f.response(f.sent.at(-1), empty.rejections.bashOutputUnknown.result); // real official {kind:'unavailable'}
    assert.deepEqual(await unavailable, empty.rejections.bashOutputUnknown.result);

    const output = { kind: 'output', workId: 'subagents-work-bash', status: 'running', output: 'tail\n', truncated: true, outputPath: '/fixture/output.log' };
    const reading = f.conversation.readBackgroundBashOutput({ workId: 'subagents-work-bash' });
    f.response(f.sent.at(-1), output);
    assert.deepEqual(await reading, output);

    const malformed = f.conversation.readBackgroundBashOutput({ workId: 'subagents-work-bash' });
    f.response(f.sent.at(-1), { kind: 'output', workId: 'subagents-work-bash' });
    await assert.rejects(malformed, error => error.code === 'background-output-result-invalid');

    const invalid = f.conversation.readBackgroundBashOutput({ workId: '' });
    await assert.rejects(invalid, error => error.code === 'background-output-params-invalid');
  } finally { f.dispose(); }
});

test('Background subagents unknown/expired workId keeps the official rejection and never fakes a cancellation', async () => {
  const f = fixture();
  try {
    await f.open();
    const pending = f.conversation.cancelBackgroundWork({ workId: 'subagents-never-created' });
    const request = f.sent.at(-1);
    assert.equal(request.method, 'v4/command');
    assert.equal(request.params.type, 'cancelBackgroundWork');
    assert.deepEqual(request.params.payload, { workId: 'subagents-never-created' });
    // The exact official ack captured from the real runtime for an unknown workId.
    f.response(request, { ...empty.rejections.cancelUnknownWorkCommand.result, commandId: request.params.commandId });
    const record = await pending;
    assert.equal(record.state, 'failed');
    assert.equal(record.ack.reasonCode, 'fault.command.backgroundWorkCancelRejected.not_found');
    assert.equal(record.workId, 'subagents-never-created');
    assert.equal(f.conversation.state.snapshot.backgroundWorks.length, 0, 'a rejected cancel must not mutate the projection');
    assert.ok(WORK_COMMANDS.has('cancelBackgroundWork'));
  } finally { f.dispose(); }
});

test('Background subagents cancel settles only from the official projection and never touches a later unrelated work', async () => {
  const f = fixture();
  try {
    await f.open(lifecycle.initial, lifecycle.ack);
    const bash = lifecycle.works.bashWork;
    assert.deepEqual(f.conversation.state.snapshot.backgroundWorks.map(work => work.workId), [bash.workId, lifecycle.works.subagentWork.workId]);

    const pending = f.conversation.cancelBackgroundWork({ workId: bash.workId });
    const request = f.sent.at(-1);
    const commandId = request.params.commandId;
    f.response(request, { commandId, status: 'accepted', revisionAtDecision: f.conversation.state.snapshot.revision });
    const accepted = await pending;
    // ACK accepted + the work still running in the official projection = execution phase, not a
    // settled cancellation. Optimistic UI stays in the waiting phase only.
    assert.equal(accepted.state, 'running');
    assert.equal(accepted.ack.status, 'accepted');
    assert.equal(f.conversation.state.snapshot.backgroundWorks[0].status, 'running');

    f.wire(lifecycle.cancelled);
    await tick();
    assert.equal(f.conversation.state.snapshot.backgroundWorks[0].status, 'cancelled');
    assert.equal(f.conversation.state.commands.find(record => record.commandId === commandId).state, 'completed');

    f.wire(lifecycle.subagentSettled);
    await tick();
    assert.deepEqual(f.conversation.state.snapshot.subagents.running, []);
    assert.equal(f.conversation.state.snapshot.subagents.endedTotal, 1);

    f.wire(lifecycle.laterWorkStarted);
    await tick();
    const later = f.conversation.state.snapshot.backgroundWorks.find(work => work.workId === lifecycle.works.newWork.workId);
    assert.equal(later.status, 'running', 'a later unrelated execution must be unaffected by the earlier cancel');
    assert.equal(f.conversation.state.commands.some(record => record.workId === lifecycle.works.newWork.workId), false);
    assert.equal(f.conversation.state.commands.find(record => record.commandId === commandId).state, 'completed');
  } finally { f.dispose(); }
});

test('Background subagents legacy session/cancelBackgroundTask is a verified but unwired carrier over the same taskId identity', () => {
  // The real headless capture shows the legacy carrier returns the structured cancellation result
  // (not an exception) for an unknown taskId. The bridge deliberately wires the v4 command instead;
  // this validates the official schema against the real capture and pins the taskId === workId identity.
  const result = empty.rejections.cancelUnknownTaskLegacy.result;
  const parsedResult = zcodeSessionCancelBackgroundTaskResultSchema.safeParse(result);
  assert.equal(parsedResult.success, true);
  assert.equal(result.cancelled, false);
  assert.equal(result.reason, 'background_task_not_found');
  assert.equal(result.status, 'lost');
  assert.equal(result.taskId, 'subagents-never-created');
  const params = zcodeSessionCancelBackgroundTaskParamsSchema.safeParse({ sessionId: 'fixture-session', taskId: 'subagents-work-bash' });
  assert.equal(params.success, true);
  assert.equal(v4BackgroundBashOutputParamsSchema.safeParse({ sessionId: 'fixture-session', workId: 'subagents-work-bash' }).success, true);
});

test('Background subagents cancel is gated on live projection and rejects an empty target before any official request', async () => {
  const idle = fixture();
  try {
    assert.ok(idle.conversation.workAdmission.reason === 'projection-unconfirmed');
    await assert.rejects(idle.conversation.cancelBackgroundWork({ workId: 'subagents-work-bash' }), error => error.code === 'projection-unconfirmed');
  } finally { idle.dispose(); }

  const f = fixture();
  try {
    await f.open(lifecycle.initial, lifecycle.ack);
    const before = f.sent.length;
    await assert.rejects(f.conversation.cancelBackgroundWork({ workId: '' }), error => error.code === 'command-invalid');
    assert.equal(f.sent.length, before, 'an invalid target must not reach the official runtime');
  } finally { f.dispose(); }
});
