import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { AutomationClient, AUTOMATION_CARRIERS, AUTOMATION_REVERSE_METHODS, AUTOMATION_MANAGEMENT_REASON, AUTOMATION_FEEDBACK_REASON, OFF_PEAK_ENTITLEMENT_REASON } from '../packages/host/automation.mjs';
import { handleAutomation } from '../packages/host/index.mjs';
import { AutomationStore } from '../packages/client/automation.mjs';
import {
  zcodeAutomationListResultSchema, zcodeAutomationCreateResultSchema, zcodeAutomationUpdateResultSchema,
  zcodeAutomationDeleteResultSchema, zcodeAutomationCheckTaskBindingResultSchema,
  zcodeOffPeakListResultSchema, zcodeOffPeakCreateResultSchema,
} from '../packages/host/vendor/zcode/v4.mjs';

const empty = JSON.parse(await readFile('./tests/fixtures/s13/empty.json', 'utf8'));
const projection = JSON.parse(await readFile('./tests/fixtures/s13/projection.json', 'utf8'));
const restricted = JSON.parse(await readFile('./tests/fixtures/s13/restricted.json', 'utf8'));
const unknown = JSON.parse(await readFile('./tests/fixtures/s13/unknown.json', 'utf8'));
const tick = () => new Promise(resolve => setImmediate(resolve));

function peerStub() {
  const handlers = new Map(), observers = new Set(), closures = new Set(), requests = [];
  return {
    closed: false, requests, reverse(method) { return handlers.get(method) },
    registerRequestHandler(method, handler) { if (handlers.has(method)) throw Object.assign(new Error('host-handler-invalid'), { code: 'host-handler-invalid' }); handlers.set(method, handler); return () => handlers.delete(method) },
    onReverseSettled(listener) { observers.add(listener); return () => observers.delete(listener) },
    onClosed(listener) { closures.add(listener); return () => closures.delete(listener) },
    request(method, params) { requests.push({ method, params }); return Promise.reject(Object.assign(new Error('runtime-rejected'), { code: 'runtime-rejected', protocolCode: -32601 })) },
    settle(event) { for (const listener of observers) listener(event) },
    close() { this.closed = true; for (const listener of closures) listener() },
  };
}

test('S13 the real capture records the official -32601 for every management carrier and a policy-only success', async () => {
  for (const name of ['automationList', 'automationCheckTaskBindingUnknown', 'automationUpdateUnknown', 'automationDeleteUnknown', 'automationCreate', 'offPeakList', 'offPeakCreate']) {
    assert.equal(empty.probes[name].error.protocolCode, -32601, `${name} must be the official method-not-found`);
    assert.equal(empty.probes[name].error.code, 'runtime-rejected');
  }
  // The only requestable off-peak-adjacent carrier is the Host→CLI tool policy; it is not management.
  assert.deepEqual(empty.probes.updateOffPeakToolPolicy.result, { workspace: { workspacePath: '/fixture/s13-workspace', workspaceKey: '/fixture/s13-workspace' }, enabled: false });
  assert.equal(empty.productionOracle.state.management.available, false);
  assert.equal(empty.provenance.paidModelCalls, 0);
});

test('S13 AutomationClient owns no store: management/feedback unavailable, entitlement and account UNKNOWN', async () => {
  const peer = peerStub();
  const client = new AutomationClient(peer, { auth: 'unavailable' });
  try {
    const state = client.state();
    assert.equal(state.management.available, false);
    assert.equal(state.management.reason, AUTOMATION_MANAGEMENT_REASON);
    assert.equal(state.offPeak.available, false);
    assert.equal(state.offPeak.entitlement.state, 'unknown');
    assert.equal(state.offPeak.entitlement.reason, OFF_PEAK_ENTITLEMENT_REASON);
    assert.equal(state.runFeedback.available, false);
    assert.equal(state.runFeedback.reason, AUTOMATION_FEEDBACK_REASON);
    assert.equal(state.runFeedback.execution.state, 'gated');
    assert.equal(state.account.state, 'unknown');
    assert.notEqual(state.account.state, 'signed-in');
    assert.equal(state.admission.allowed, false);
    for (const carrier of AUTOMATION_CARRIERS) assert.equal(carrier.requestable, false, `${carrier.method} is a Host-consumed reverse carrier`);
    assert.deepEqual(AUTOMATION_REVERSE_METHODS, ['automation/create', 'automation/update', 'automation/checkTaskBinding', 'automation/list', 'automation/delete', 'offPeak/create', 'offPeak/list']);
    // No official request is issued just to report the state: this is a static verified fact.
    assert.equal(peer.requests.length, 0);
    // The client rejects double ownership of a reverse method (never a silent second host).
    assert.throws(() => new AutomationClient(peer), { code: 'host-handler-invalid' });
  } finally { client.dispose(); }
});

test('S13 reverse automation callbacks fail closed over the real transport and are observed, never faked', async () => {
  const input = new PassThrough(), output = new PassThrough(), sent = [];
  output.on('data', b => sent.push(JSON.parse(b)));
  const peer = new ProtocolPeer(input, output, { timeoutMs: 100 });
  const client = new AutomationClient(peer, { auth: 'unavailable' });
  const receive = message => input.write(JSON.stringify(message) + '\n');
  try {
    // A well-formed list must be refused: this bridge is not the automation Host.
    receive({ id: 'cli-rev-1', method: 'automation/list', params: {} });
    await tick();
    assert.equal(sent[0].id, 'cli-rev-1');
    assert.equal(sent[0].error.code, -32601);
    assert.equal(sent[0].result, undefined);
    // Unknown/expired identity is still refused truthfully (no local filtering to fake a deletion).
    receive({ id: 'cli-rev-2', method: 'automation/delete', params: { automationId: 's13-expired-automation' } });
    await tick();
    assert.equal(sent[1].error.code, -32601);
    assert.equal(sent[1].result, undefined);
    // Malformed params fail with the official invalid-params code.
    receive({ id: 'cli-rev-3', method: 'automation/update', params: { automationId: 'x' } });
    await tick();
    assert.equal(sent[2].error.code, -32602);
    const state = client.state();
    assert.equal(state.reverse.records.length, 3);
    assert.equal(state.reverse.records[0].method, 'automation/list');
    assert.equal(state.reverse.records[0].outcome, 'rejected');
    assert.deepEqual(state.reverse.records[1].identity, { key: 'automationId', value: 's13-expired-automation' });
    assert.equal(state.reverse.records[2].status, 'invalid');
    assert.equal(JSON.stringify(state).includes('automations'), false, 'no task list is ever fabricated');
    // Disposal closes pending observations without flipping them to success.
    client.dispose();
    assert.equal(client.state().reverse.allowed, false);
  } finally { peer.close(); }
});

test('S13 injected lifecycle frames are exactly the official schemas; the honest state never consumes them', () => {
  const validations = {
    automationList: zcodeAutomationListResultSchema,
    automationCreate: zcodeAutomationCreateResultSchema,
    automationUpdate: zcodeAutomationUpdateResultSchema,
    automationDelete: zcodeAutomationDeleteResultSchema,
    automationCheckTaskBinding: zcodeAutomationCheckTaskBindingResultSchema,
    offPeakList: zcodeOffPeakListResultSchema,
    offPeakCreate: zcodeOffPeakCreateResultSchema,
    offPeakCreateFailure: zcodeOffPeakCreateResultSchema,
  };
  for (const [name, schema] of Object.entries(validations)) assert.equal(schema.safeParse(projection.frames[name]).success, true, `${name} must match the official schema`);
  assert.equal(projection.provenance.kind, 'injected-semantic-fixture');
  // These frames are fixtures only: the client state must not surface a task/run/count from them.
  const peer = peerStub();
  const client = new AutomationClient(peer, { auth: 'unavailable' });
  try {
    const serialized = JSON.stringify(client.state());
    for (const leak of ['Fixture scheduled task', 'Fixture off-peak task', 's13-fixture-automation', 'runCount']) assert.equal(serialized.includes(leak), false, `state must not fabricate ${leak}`);
  } finally { client.dispose(); }
});

test('S13 restricted account/entitlement stays UNKNOWN and reverse records render as refused facts', async () => {
  assert.equal(restricted.account.state, 'unknown');
  assert.equal(restricted.offPeakEntitlement.state, 'unknown');
  assert.equal(restricted.offPeakSupportUnsupported.supported, false);
  assert.equal(restricted.provenance.kind, 'injected-semantic-fixture');
  const value = {
    admission: { allowed: false, reason: AUTOMATION_MANAGEMENT_REASON },
    management: { available: false, reason: AUTOMATION_MANAGEMENT_REASON, carriers: AUTOMATION_CARRIERS.filter(c => c.domain === 'automation') },
    offPeak: { available: false, reason: AUTOMATION_MANAGEMENT_REASON, entitlement: restricted.offPeakEntitlement, carriers: AUTOMATION_CARRIERS.filter(c => c.domain === 'offPeak') },
    runFeedback: { available: false, reason: AUTOMATION_FEEDBACK_REASON, execution: { state: 'gated', reason: 'model-execution-gated' } },
    account: restricted.account,
    reverse: restricted.reverse,
  };
  const rpc = { call: async () => ({ ok: true, value }) };
  const store = new AutomationStore(rpc);
  try {
    await store.refresh();
    const snapshot = store.getSnapshot();
    assert.equal(snapshot.offPeak.entitlement.state, 'unknown');
    assert.equal(snapshot.account.state, 'unknown');
    assert.equal(snapshot.management.available, false);
    assert.equal(snapshot.reverse.records.length, 2);
    assert.equal(snapshot.reverse.records[1].identity.value, 's13-expired-automation');
  } finally { store.dispose(); }
});

test('S13 unknown future frames fail safe and are never turned into a created/succeeded claim', () => {
  assert.equal(zcodeAutomationListResultSchema.safeParse({ automations: [unknown.automation] }).success, false);
  assert.equal(zcodeOffPeakListResultSchema.safeParse({ tasks: [unknown.offPeakTask] }).success, false);
  assert.equal(zcodeOffPeakCreateResultSchema.safeParse(unknown.offPeakFailure).success, false);
  assert.equal(unknown.provenance.kind, 'injected-semantic-fixture');
  const client = new AutomationClient(peerStub());
  try {
    const serialized = JSON.stringify(client.state());
    for (const leak of ['future_status', 'future_code', 'created', 'succeeded']) assert.equal(serialized.includes(leak), false);
  } finally { client.dispose(); }
});

test('S13 handleAutomation exposes only the honest state and rejects extra payload keys', async () => {
  const host = { automationState: () => ({ management: { available: false, reason: AUTOMATION_MANAGEMENT_REASON, carriers: AUTOMATION_CARRIERS.filter(c => c.domain === 'automation') }, offPeak: { available: false, entitlement: { state: 'unknown' } }, runFeedback: { available: false }, account: { state: 'unknown' }, reverse: { allowed: true, records: [] }, admission: { allowed: false, reason: AUTOMATION_MANAGEMENT_REASON } }) };
  const state = await handleAutomation(host, { operation: 'state' });
  assert.equal(state.ok, true);
  assert.equal(state.value.management.available, false);
  assert.equal(state.value.reverse.records.length, 0);
  for (const payload of [null, [], { operation: 'list' }, { operation: 'state', kind: 'automationList' }, { operation: 'create', params: {} }]) {
    const denied = await handleAutomation(host, payload);
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, 'invalid-payload');
  }
});

test('S13 AutomationStore mirrors the honest state, fails closed per refresh and resets on a new connection', async () => {
  let notify;
  const generation = { subscribe: listener => { notify = listener; return () => { notify = undefined } } };
  let mode = 'ok';
  const state = { admission: { allowed: false, reason: AUTOMATION_MANAGEMENT_REASON }, management: { available: false, reason: AUTOMATION_MANAGEMENT_REASON, carriers: AUTOMATION_CARRIERS.filter(c => c.domain === 'automation') }, offPeak: { available: false, reason: AUTOMATION_MANAGEMENT_REASON, entitlement: { state: 'unknown', reason: OFF_PEAK_ENTITLEMENT_REASON }, carriers: AUTOMATION_CARRIERS.filter(c => c.domain === 'offPeak') }, runFeedback: { available: false, reason: AUTOMATION_FEEDBACK_REASON, execution: { state: 'gated', reason: 'model-execution-gated' } }, account: { state: 'unknown', reason: 'official-account-carrier-not-exposed', auth: 'unavailable' }, reverse: { allowed: true, reason: AUTOMATION_MANAGEMENT_REASON, records: [] } };
  const rpc = { call: async (_channel, _endpoint, payload) => { if (mode === 'fail') return { ok: false, error: { code: 'automation-unavailable', message: 'host-down' } }; if (payload.operation !== 'state') return { ok: false, error: { code: 'invalid-payload' } }; return { ok: true, value: state } } };
  const store = new AutomationStore(rpc, { connectionGeneration: generation });
  try {
    await store.refresh();
    let snapshot = store.getSnapshot();
    assert.equal(snapshot.loaded, true);
    assert.equal(snapshot.management.available, false);
    assert.equal(snapshot.offPeak.entitlement.state, 'unknown');
    assert.equal(snapshot.admission.allowed, false);
    mode = 'fail';
    await store.refresh();
    snapshot = store.getSnapshot();
    assert.equal(snapshot.error.code, 'automation-unavailable');
    assert.equal(snapshot.management.available, false, 'a later failure never upgrades the availability');
    notify();
    snapshot = store.getSnapshot();
    assert.equal(snapshot.loaded, false);
    assert.equal(snapshot.management, null);
    assert.equal(snapshot.admission.reason, 'host-unreachable');
  } finally { store.dispose(); }
});
