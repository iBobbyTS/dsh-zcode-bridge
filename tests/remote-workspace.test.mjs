import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { BridgeHost } from '../packages/host/runtime.mjs';
import { REMOTE_CARRIERS, remoteState } from '../packages/host/remote.mjs';
import { handleRemote } from '../packages/host/index.mjs';
import { RemoteStore, remoteProjectionSchema } from '../packages/client/remote.mjs';
import { batchFaultChild, batchFaultInstallation } from './fixtures/batch-fault.mjs';
const read = async name => JSON.parse(await readFile(`tests/fixtures/remote-workspace/${name}.json`, 'utf8'));
const official = await read('official'), empty = await read('empty'), unknown = await read('unknown');

test('Remote workspace real official negatives prove outer carriers absent from app-server and v4 type rejected', () => {
  assert.equal(official.status, 'PASS'); assert.equal(official.provenance.paidModelCalls, 0);
  for (const carrier of REMOTE_CARRIERS) assert.equal(official.probes[carrier.name].error.protocolCode, -32601, carrier.method);
  assert.equal(official.probes.v4RemoteTypeRejected.result.status, 'rejected');
  assert.equal(official.probes.v4RemoteTypeRejected.result.reasonCode, 'proto.invalidPayload');
  assert.equal(official.v4LocalProjection.status, 'live');
  assert.equal(official.v4LocalProjection.remoteConnectionEstablished, false);
});
test('Remote workspace local empty is real; remote inventory unreadable never an invented empty list or identity', () => {
  assert.deepEqual(empty.localSessions.sessions, []);
  assert.equal(empty.provenance.kind, 'official-capture-projection');
  assert.equal(remoteProjectionSchema.safeParse(empty.remote).success, true);
  assert.equal(empty.remote.workspaces.items, null); assert.equal(empty.remote.sessions.items, null);
  assert.equal(empty.remote.connection.remoteAuthority, null); assert.equal(empty.remote.connection.remoteSessionId, null);
  for (const target of empty.remote.targets) assert.equal(target.available, false);
  assert.equal(empty.remote.targets.find(t => t.kind === 'wsl').reason, 'wsl-requires-windows-host');
});
test('Remote workspace remote endpoint accepts only state and never targets, credentials or stale session identities', async () => {
  let calls = 0;
  const host = { remoteState: () => { calls++; return remoteState(); } };
  assert.equal((await handleRemote(host, { operation: 'state' })).ok, true);
  for (const payload of [null, [], { operation: 'connect' }, { operation: 'state', target: { kind: 'ssh' } }, { operation: 'state', remoteSessionId: 'expired' }, { operation: 'state', workspaceIdentity: 'remote:ssh:unknown:22:user:/same' }, { operation: 'state', password: 'never-a-real-secret' }]) {
    assert.equal((await handleRemote(host, payload)).error.code, 'invalid-payload');
  }
  const signal = AbortSignal.abort();
  assert.equal((await handleRemote(host, { operation: 'state' }, signal)).error.code, 'cancelled');
  assert.equal(calls, 1);
});
test('Remote workspace known and unknown remote workspace identities cannot launch a local process', async () => {
  for (const kind of ['ssh', 'wsl', 'docker', 'future']) {
    let spawned = 0;
    const host = new BridgeHost({ workspacePath: `remote:${kind}:unknown:/same`, inspect: async () => batchFaultInstallation, spawnProcess: () => { spawned++; throw Error('must-not-launch'); } });
    try { assert.equal((await host.connect()).reason, 'remote-workspace-unavailable'); assert.equal(spawned, 0); assert.equal(host.remoteState().scope, null); }
    finally { await host.dispose(); }
  }
});
test('Remote workspace production projection is scoped to the local live process; foreign same-id address is rejected', async () => {
  const fixture = batchFaultChild('never');
  const host = new BridgeHost({ workspacePath: tmpdir(), inspect: async () => batchFaultInstallation, spawnProcess: () => fixture.child });
  try {
    const status = await host.connect();
    assert.equal(host.remoteState().scope.authority, status.sessionAuthority);
    await assert.rejects(host.listSessions({ address: { runtime: 'zcode', authority: 'remote:other', workspace: status.workspacePath, sessionId: 'same' } }), { code: 'source-address-mismatch' });
    await assert.rejects(host.listSessions({ address: { runtime: 'zcode', authority: status.sessionAuthority, workspace: 'remote:ssh:unknown:22:user:/same', sessionId: 'same' } }), { code: 'source-address-mismatch' });
    assert.equal(fixture.requests.some(r => REMOTE_CARRIERS.some(c => c.method === r.method)), false);
    fixture.child.stdout.end(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(host.remoteState().scope, null); assert.equal(host.remoteState().admission.allowed, false);
  } finally { fixture.finishClose(); await host.dispose(); }
});
test('Remote workspace unknown future/available/connected payloads fail safe and clear stale display facts', async () => {
  for (const invalid of [unknown.remote, { ...empty.remote, admission: { allowed: true, reason: 'pretend' } }, { ...empty.remote, connection: { ...empty.remote.connection, state: 'connected', available: true } }, { ...empty.remote, sessions: { ...empty.remote.sessions, items: [] } }]) {
    let value = empty.remote;
    const store = new RemoteStore({ call: async () => ({ ok: true, value }) });
    try { await store.refresh(); assert.ok(store.getSnapshot().projection); value = invalid; await store.refresh(); assert.equal(store.getSnapshot().error.code, 'remote-projection-invalid'); assert.equal(store.getSnapshot().projection, null); assert.equal(store.getSnapshot().admission.allowed, false); }
    finally { store.dispose(); }
  }
});
test('Remote workspace refresh rejection clears scope; generation fences old response and disposal releases observer', async () => {
  let notify, unsubscribe = 0, pending, mode = 'ok'; const calls = [];
  const store = new RemoteStore({ call: async (...args) => { calls.push(args); if (mode === 'hold') return new Promise(resolve => { pending = resolve; }); if (mode === 'fail') return { ok: false, error: { code: 'host-down', message: 'Disconnected' } }; return { ok: true, value: empty.remote }; } }, { connectionGeneration: { subscribe: fn => { notify = fn; return () => { unsubscribe++; }; } } });
  await store.refresh(); mode = 'fail'; await store.refresh(); assert.equal(store.getSnapshot().projection, null); assert.equal(store.getSnapshot().error.code, 'host-down');
  mode = 'hold'; const old = store.refresh(); notify(); mode = 'ok'; await store.refresh(); const current = store.getSnapshot(); pending({ ok: true, value: (await read('restricted')).remote }); await old; assert.equal(store.getSnapshot(), current);
  assert.ok(calls.every(([, endpoint, payload]) => endpoint === 'remote' && JSON.stringify(payload) === '{"operation":"state"}'));
  store.dispose(); assert.equal(unsubscribe, 1); assert.equal(store.getSnapshot().projection, null);
});
