import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { InsightsClient, INSIGHTS_READ_KINDS, GATED_CARRIERS } from '../packages/host/insights.mjs';
import { handleInsights } from '../packages/host/index.mjs';
import { InsightsStore, USAGE_RANGES } from '../packages/client/insights.mjs';

const usage = JSON.parse(await readFile('./tests/fixtures/s14/usage.json', 'utf8'));
const account = JSON.parse(await readFile('./tests/fixtures/s14/account.json', 'utf8'));
const unknown = JSON.parse(await readFile('./tests/fixtures/s14/unknown.json', 'utf8'));
const success = JSON.parse(await readFile('./tests/fixtures/s03a/success.json', 'utf8'));
const tick = () => new Promise(resolve => setImmediate(resolve));

function peerStub(handlers = {}) {
  const notifications = new Set(), requests = [];
  return {
    closed: false, requests,
    onNotification(listener) { notifications.add(listener); return () => notifications.delete(listener) },
    notify(method, params) { for (const listener of notifications) listener({ method, params }) },
    request(method, params, { signal } = {}) {
      requests.push({ method, params });
      const handler = handlers[method];
      if (!handler) return Promise.reject(Object.assign(new Error('method-not-found'), { code: 'runtime-rejected', protocolCode: -32601, sent: true }));
      return handler({ method, params, signal });
    },
  };
}

test('S14 InsightsClient reads official usage/diagnostics, forwards only the official params and fails closed', async () => {
  const calls = [];
  const peer = peerStub({
    'v4/usage/stats': ({ params }) => { calls.push(params); return Promise.resolve(usage.emptyUsage) },
    'process/childProcesses': ({ params }) => { calls.push(params); return Promise.resolve(usage.childProcesses) },
  });
  const client = new InsightsClient(peer, { auth: 'unavailable' });
  try {
    assert.deepEqual(await client.read('usageStats', { range: '30d' }), usage.emptyUsage);
    assert.deepEqual(calls[0], { range: '30d' }, 'workspace/secret fields are never forwarded to the official usage carrier');
    assert.equal(peer.requests[0].method, 'v4/usage/stats', 'the live v4 carrier name is used, not the @deprecated legacy usage/stats');
    // Caller-supplied extras (e.g. workspace identity) are dropped by the schema.
    await client.read('usageStats', { range: '7d', workspace: { workspacePath: '/evil' } });
    assert.deepEqual(calls[1], { range: '7d' });
    assert.deepEqual(await client.read('childProcesses'), { processes: [] });
    await assert.rejects(client.read('usageStats', { range: 'not-a-range' }), { code: 'insights-params-invalid' });
    // Null/primitive params fail closed with the domain code, never a bare TypeError from build().
    const beforeNull = peer.requests.length;
    await assert.rejects(client.read('usageStats', null), { code: 'insights-params-invalid' });
    await assert.rejects(client.read('childProcesses', null), { code: 'insights-params-invalid' });
    await assert.rejects(client.read('usageStats', '30d'), { code: 'insights-params-invalid' });
    assert.equal(peer.requests.length, beforeNull, 'invalid params never reach the official runtime');
    await assert.rejects(client.read('unverifiedKind'), { code: 'insights-read-unknown' });
    assert.equal(peer.requests.some(r => r.method === 'unverifiedKind'), false, 'unknown kinds never reach the official runtime');
    const bad = new InsightsClient(peerStub({ 'v4/usage/stats': () => Promise.resolve({ ...usage.emptyUsage, summary: 'not-an-object' }) }));
    await assert.rejects(bad.read('usageStats', { range: '30d' }), { code: 'insights-result-invalid' });
    bad.dispose();
    assert.deepEqual(INSIGHTS_READ_KINDS, ['usageStats', 'childProcesses']);
  } finally { client.dispose(); }
});

test('S14 account stays UNKNOWN and login is unavailable; model-executing surfaces present as gated without a call', async () => {
  const peer = peerStub({});
  const client = new InsightsClient(peer, { auth: 'unavailable' });
  try {
    const projection = client.account();
    assert.equal(projection.state, 'unknown');
    assert.equal(projection.reason, 'official-account-carrier-not-exposed');
    assert.equal(projection.login.available, false);
    assert.equal(projection.query.available, false);
    assert.equal(projection.auth, 'unavailable');
    assert.notEqual(projection.state, 'signed-in');
    assert.notEqual(projection.state, 'signed-out');
    const gated = client.gated();
    for (const kind of ['generateText', 'cancelGenerateText', 'testModelConnectivity']) {
      assert.equal(gated[kind].available, false);
      assert.equal(gated[kind].reason, 'model-execution-gated');
      assert.equal(gated[kind].method, GATED_CARRIERS[kind].method);
    }
    // The gated surfaces are never requested: no official method was called at all.
    assert.equal(peer.requests.length, 0);
    assert.equal(client.state().resourceSample, null, 'no sample is invented before the official runtime sends one');
  } finally { client.dispose(); }
});

test('S14 valid process resource sample is retained; unknown or malformed samples are dropped', async () => {
  const peer = peerStub({});
  const client = new InsightsClient(peer, { auth: 'unavailable' });
  try {
    peer.notify('process/resourceSample', usage.resourceSample);
    assert.deepEqual(client.resourceSample, usage.resourceSample);
    peer.notify('process/resourceSample', { platform: 'darwin', rssKb: -1 });
    assert.deepEqual(client.resourceSample, usage.resourceSample, 'an invalid sample never replaces the last valid one');
    peer.notify('process/resourceSample', { ...usage.resourceSample, path: '/secret/workspace' });
    assert.deepEqual(client.resourceSample, usage.resourceSample, 'extra fields are rejected (strict schema)');
    assert.equal(JSON.stringify(client.resourceSample).includes('/secret'), false);
    client.dispose();
    assert.equal(client.resourceSample, null);
  } finally { client.dispose(); }
});

test('S14 InsightsClient admission fails closed after dispose or a closed peer', async () => {
  const peer = peerStub({ 'v4/usage/stats': () => Promise.resolve(usage.emptyUsage) });
  const client = new InsightsClient(peer);
  client.dispose();
  assert.equal(client.admission.allowed, false);
  await assert.rejects(client.read('usageStats', { range: '30d' }), { code: 'closed' });
  const closed = new InsightsClient(Object.assign(peerStub({}), { closed: true }));
  assert.equal(closed.admission.reason, 'host-unreachable');
  await assert.rejects(closed.read('childProcesses'), { code: 'host-unreachable' });
  closed.dispose();
});

test('S14 handleInsights exposes only state/read, rejects extra payload keys and cannot carry a workspace', async () => {
  const seen = [];
  const host = {
    insightsState: () => ({ account: account.account, gated: account.gated, resourceSample: null, admission: { allowed: true, reason: null } }),
    insightsRead: (kind, params) => { seen.push({ kind, params }); return Promise.resolve(kind === 'usageStats' ? usage.emptyUsage : usage.childProcesses) },
  };
  const state = await handleInsights(host, { operation: 'state' }, undefined);
  assert.equal(state.ok, true);
  assert.equal(state.value.account.state, 'unknown');
  assert.equal(state.value.gated.generateText.reason, 'model-execution-gated');
  const read = await handleInsights(host, { operation: 'read', kind: 'usageStats', params: { range: '30d' } });
  assert.equal(read.ok, true);
  assert.deepEqual(seen[0], { kind: 'usageStats', params: { range: '30d' } });
  for (const payload of [null, [], { operation: 'read', kind: 'usageStats', params: {}, workspace: '/evil' }, { operation: 'operate' }, { operation: 'read' }]) {
    const denied = await handleInsights(host, payload);
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, 'invalid-payload');
  }
  const unknownKind = await handleInsights({ insightsRead: () => Promise.reject(Object.assign(new Error('x'), { code: 'insights-read-unknown' })) }, { operation: 'read', kind: 'nope', params: {} });
  assert.equal(unknownKind.ok, false);
  assert.equal(unknownKind.error.code, 'insights-read-unknown');
});

test('S14 sessionUsage is scoped to the bound address and validates the official result', async () => {
  const input = new PassThrough(), output = new PassThrough(), sent = [];
  output.on('data', b => sent.push(JSON.parse(b)));
  const peer = new ProtocolPeer(input, output, { timeoutMs: 100 });
  const conversation = new V4Conversation(peer, {
    address: { runtime: 'zcode', authority: 'test-authority', workspace: '/fixture/workspace', sessionId: 'fixture-session' },
    workspace: { workspacePath: '/fixture/workspace', workspaceKey: '/fixture/workspace' },
    clientId: 'fixture-client', connectionId: 'fixture-connection', runnable: false, frameTimeoutMs: 500,
  });
  const receive = message => input.write(JSON.stringify(message) + '\n');
  const response = (request, result) => receive({ id: request.id, result });
  try {
    // No confirmed projection yet: the scoped read is not admitted.
    await assert.rejects(conversation.sessionUsage(), { code: 'projection-unconfirmed' });
    const p = conversation.connect();
    input.write(JSON.stringify({ id: sent.at(-1).id, result: success.ack }) + '\n' + JSON.stringify({ method: 'v4/conversation/frame', params: success.initial }) + '\n');
    await p; await tick();
    // A caller-supplied sessionId is ignored: only the bound address identity is sent.
    const pending = conversation.sessionUsage({ sessionId: 'other-session' });
    const request = sent.at(-1);
    assert.equal(request.method, 'v4/conversation/usage');
    assert.deepEqual(request.params, { sessionId: 'fixture-session' });
    response(request, usage.emptySessionUsage);
    assert.deepEqual(await pending, usage.emptySessionUsage);
    const malformed = conversation.sessionUsage();
    response(sent.at(-1), { ...usage.emptySessionUsage, totalTokens: -1 });
    await assert.rejects(malformed, { code: 'session-usage-result-invalid' });
  } finally { peer.close(); }
});

test('S14 a sessionUsage reply that lands after its owner was replaced is not delivered', async () => {
  const input = new PassThrough(), output = new PassThrough(), sent = [];
  output.on('data', b => sent.push(JSON.parse(b)));
  const peer = new ProtocolPeer(input, output, { timeoutMs: 100 });
  const conversation = new V4Conversation(peer, {
    address: { runtime: 'zcode', authority: 'test-authority', workspace: '/fixture/workspace', sessionId: 'fixture-session' },
    workspace: { workspacePath: '/fixture/workspace', workspaceKey: '/fixture/workspace' },
    clientId: 'fixture-client', connectionId: 'fixture-connection', runnable: false, frameTimeoutMs: 500,
  });
  const receive = message => input.write(JSON.stringify(message) + '\n');
  try {
    const connecting = conversation.connect();
    input.write(JSON.stringify({ id: sent.at(-1).id, result: success.ack }) + '\n' + JSON.stringify({ method: 'v4/conversation/frame', params: success.initial }) + '\n');
    await connecting; await tick();
    const pending = conversation.sessionUsage();
    const request = sent.at(-1);
    assert.equal(request.method, 'v4/conversation/usage');
    // The owner is replaced (release/reopen) while the official read is still in flight.
    void conversation.cancel();
    receive({ id: request.id, result: usage.nonEmptySessionUsage });
    await assert.rejects(pending, { code: 'session-usage-owner-replaced' });
  } finally { peer.close(); }
});

test('S14 InsightsStore mirrors official usage/diagnostics per section and never fabricates rows', async () => {
  const rpc = { call: async (_channel, _endpoint, payload) => {
    if (payload.operation === 'state') return { ok: true, value: { account: account.account, gated: account.gated, resourceSample: null, admission: { allowed: true, reason: null } } };
    if (payload.kind === 'usageStats') return payload.params.range === '7d' ? { ok: false, error: { code: 'insights-result-invalid', message: 'bad' } } : { ok: true, value: usage.emptyUsage };
    return { ok: true, value: usage.childProcesses };
  } };
  const store = new InsightsStore(rpc);
  try {
    await store.refresh();
    let snapshot = store.getSnapshot();
    assert.equal(snapshot.usage.summary.totalTokens, 0);
    assert.deepEqual(snapshot.diagnostics.processes, []);
    assert.equal(snapshot.account.state, 'unknown');
    assert.equal(snapshot.admission.allowed, true);
    await assert.rejects(store.setRange('90d'), { code: 'usage-range-invalid' });
    // A failed section fails closed: the usage error is recorded, the diagnostics section still loads.
    await store.setRange('7d');
    snapshot = store.getSnapshot();
    assert.equal(snapshot.usage, null);
    assert.deepEqual(snapshot.sectionErrors.usage, { code: 'insights-result-invalid', message: 'bad' });
    assert.deepEqual(snapshot.diagnostics.processes, []);
    assert.deepEqual(USAGE_RANGES, ['all', '7d', '30d']);
  } finally { store.dispose(); }
});

test('S14 InsightsStore reset clears a stale official connection snapshot', async () => {
  let notify;
  const generation = { subscribe: listener => { notify = listener; return () => { notify = undefined } } };
  const rpc = { call: async (_channel, _endpoint, payload) => payload.operation === 'state'
    ? { ok: true, value: { account: account.account, gated: account.gated, resourceSample: null, admission: { allowed: true, reason: null } } }
    : { ok: true, value: payload.kind === 'usageStats' ? usage.nonEmptyUsage : usage.childProcessesNonEmpty } };
  const store = new InsightsStore(rpc, { connectionGeneration: generation });
  try {
    await store.refresh();
    assert.equal(store.getSnapshot().usage.summary.totalTokens, usage.nonEmptyUsage.summary.totalTokens);
    notify();
    const snapshot = store.getSnapshot();
    assert.equal(snapshot.usage, null);
    assert.equal(snapshot.loaded, false);
    assert.equal(snapshot.admission.allowed, false);
    assert.equal(snapshot.admission.reason, 'host-unreachable');
  } finally { store.dispose(); }
});

test('S14 unknown account state and unknown read kind degrade without a fabricated fact', async () => {
  const rpc = { call: async (_channel, _endpoint, payload) => {
    if (payload.operation === 'state') return { ok: true, value: { account: unknown.accountUnknown, gated: account.gated, resourceSample: null, admission: { allowed: true, reason: null } } };
    if (payload.kind === 'usageStats') return { ok: true, value: usage.emptyUsage };
    return { ok: true, value: usage.childProcesses };
  } };
  const store = new InsightsStore(rpc);
  try {
    await store.refresh();
    assert.equal(store.getSnapshot().account.state, 'future_state');
  } finally { store.dispose(); }
});
