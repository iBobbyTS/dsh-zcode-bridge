import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { CatalogClient } from '../packages/host/catalog.mjs';
import { handleCatalog } from '../packages/host/index.mjs';
import { CatalogStore, operationOutcome } from '../packages/client/catalog.mjs';
import { catalogStore } from './fixtures/s09-store.mjs';

const directory = JSON.parse(await readFile('tests/fixtures/s09/directory.json', 'utf8'));
const operations = JSON.parse(await readFile('tests/fixtures/s09/operations.json', 'utf8'));
const progress = JSON.parse(await readFile('tests/fixtures/s09/progress.json', 'utf8'));
const workspace = { workspacePath: '/fixture/ws', workspaceKey: '/fixture/ws' };

function peerStub(handlers = {}) {
  const notifications = new Set(), requests = [];
  return {
    closed: false, requests,
    onNotification(listener) { notifications.add(listener); return () => notifications.delete(listener) },
    notify(method, params) { for (const listener of notifications) listener({ method, params }) },
    request(method, params, { signal } = {}) {
      requests.push({ method, params });
      const handler = handlers[method];
      if (!handler) return Promise.reject(Object.assign(new Error('method-not-found'), { code: 'runtime-rejected', sent: true }));
      return handler({ method, params, signal });
    },
  };
}
function deferred() { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }
const protocolError = (code, protocolCode) => Object.assign(new Error(code), { code, protocolCode, sent: true });

test('S09 CatalogClient read validates official params/result and never forwards caller MCP credentials', async () => {
  const calls = [];
  const peer = peerStub({
    'mcp/list': ({ params }) => { calls.push(params); return Promise.resolve(directory.mcpList) },
    'plugins/list': () => Promise.resolve(directory.pluginsList),
    'plugins/overview': () => Promise.resolve({ marketplaces: [] }),
  });
  const client = new CatalogClient(peer, { workspace, managementAllowed: true });
  try {
    assert.deepEqual(await client.read('pluginsList'), directory.pluginsList);
    await client.read('mcpList', { mcpServers: [{ name: 'leak', command: 'x', args: [], env: [{ name: 'TOKEN', value: 'secret' }] }] });
    // The official wire receives only workspace + mode; caller-supplied server config/secrets are dropped.
    assert.deepEqual(calls[0], { workspace, mode: 'status' });
    assert.equal(JSON.stringify(calls).includes('TOKEN'), false);
    await assert.rejects(client.read('mcpList', { mode: 'not-a-mode' }), { code: 'catalog-params-invalid' });
    await assert.rejects(client.read('unverifiedKind'), { code: 'catalog-read-unknown' });
    // An official result that violates the checked schema fails closed rather than being displayed.
    const bad = new CatalogClient(peerStub({ 'plugins/overview': () => Promise.resolve({ marketplaces: 'not-an-array' }) }), { workspace, managementAllowed: true });
    await assert.rejects(bad.read('pluginsOverview'), { code: 'catalog-result-invalid' });
  } finally { client.dispose(); }
});

test('S09 CatalogClient admission: unverified management is read-only and closed peer is unavailable', async () => {
  const peer = peerStub({ 'plugins/list': () => Promise.resolve(directory.pluginsList) });
  const readonly = new CatalogClient(peer, { workspace, managementAllowed: false });
  assert.equal(readonly.admission.reads.allowed, true);
  assert.equal(readonly.admission.writes.allowed, false);
  await assert.rejects(readonly.operate('install', { pluginName: 'a', marketplace: 'm' }), { code: 'management-unverified' });
  assert.equal(peer.requests.some(r => r.method === 'plugins/install'), false);
  readonly.dispose();
  peer.closed = true;
  const closed = new CatalogClient(peer, { workspace, managementAllowed: true });
  assert.equal(closed.admission.reads.reason, 'host-unreachable');
  await assert.rejects(closed.read('pluginsList'), { code: 'host-unreachable' });
  closed.dispose();
});

test('S09 CatalogClient operation records the official result and rejects a duplicate active operationId', async () => {
  const held = deferred();
  const peer = peerStub({ 'plugins/install': () => held.promise });
  const client = new CatalogClient(peer, { workspace, managementAllowed: true });
  try {
    const pending = client.operate('install', { pluginName: 's09-demo', marketplace: 's09-local', scope: 'workspace' }, { operationId: 'op-install' });
    assert.equal(client.pendingOperations.length, 1);
    // The official runtime only registers the operation signal when request.params.operationId is
    // present, so the caller's UI id must reach the official install params unchanged.
    assert.equal(peer.requests.find(r => r.method === 'plugins/install').params.operationId, 'op-install');
    await assert.rejects(client.operate('install', { pluginName: 's09-demo', marketplace: 's09-local' }, { operationId: 'op-install' }), { code: 'catalog-operation-active' });
    held.resolve(operations.install);
    assert.deepEqual(await pending, operations.install);
    const record = client.operations.find(r => r.operationId === 'op-install');
    assert.equal(record.state, 'completed');
    assert.deepEqual(record.result.installedPlugins[0].id, operations.install.installedPlugins[0].id);
  } finally { client.dispose(); }
});

test('S09 CatalogClient only merges operationId into carriers whose official params schema accepts it', async () => {
  const peer = peerStub({ 'plugins/marketplace/remove': () => Promise.resolve({ marketplaces: [] }) });
  const client = new CatalogClient(peer, { workspace, managementAllowed: true });
  try {
    // marketplaceRemove's schema has no operationId: the caller id must not be fabricated onto the official wire.
    await client.operate('marketplaceRemove', { marketplace: 's09-local' }, { operationId: 'op-remove' });
    assert.deepEqual(peer.requests.find(r => r.method === 'plugins/marketplace/remove').params, { workspace, marketplace: 's09-local' });
  } finally { client.dispose(); }
});

test('S09 CatalogClient progress attaches by operationId; late, unknown and invalid progress are dropped', async () => {
  const held = deferred();
  const peer = peerStub({ 'plugins/install': () => held.promise });
  const client = new CatalogClient(peer, { workspace, managementAllowed: true });
  try {
    const pending = client.operate('install', { pluginName: 's09-demo', marketplace: 's09-local' }, { operationId: 's09-op-1' });
    peer.notify('plugins/operationProgress', progress.refreshing);
    assert.deepEqual(client.operations.find(r => r.operationId === 's09-op-1').progress, [progress.refreshing]);
    peer.notify('plugins/operationProgress', progress.unknownOperation);
    peer.notify('plugins/operationProgress', progress.invalid);
    assert.equal(client.operations.find(r => r.operationId === 's09-op-1').progress.length, 1);
    held.resolve(operations.install);
    await pending;
    peer.notify('plugins/operationProgress', progress.late);
    assert.equal(client.operations.find(r => r.operationId === 's09-op-1').progress.length, 1);
  } finally { client.dispose(); }
});

test('S09 CatalogClient abort routes an official plugins/cancelOperation and never claims success', async () => {
  const peer = peerStub({
    'plugins/install': ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(protocolError('cancelled')), { once: true })),
    'plugins/cancelOperation': ({ params }) => Promise.resolve({ operationId: params.operationId, cancelled: true }),
  });
  const client = new CatalogClient(peer, { workspace, managementAllowed: true });
  try {
    const controller = new AbortController();
    const pending = client.operate('install', { pluginName: 's09-demo', marketplace: 's09-local' }, { signal: controller.signal, operationId: 'op-cancel' });
    controller.abort();
    await assert.rejects(pending, { code: 'cancelled' });
    assert.deepEqual(peer.requests.find(r => r.method === 'plugins/cancelOperation').params, { operationId: 'op-cancel' });
    assert.equal(client.operations.find(r => r.operationId === 'op-cancel').state, 'cancelled');
  } finally { client.dispose(); }
});

test('S09 CatalogClient dispose cancels pending operations and fails new reads closed', async () => {
  const held = deferred();
  const client = new CatalogClient(peerStub({ 'plugins/install': () => held.promise }), { workspace, managementAllowed: true });
  const pending = client.operate('install', { pluginName: 'a', marketplace: 'm' }, { operationId: 'op-dispose' });
  client.dispose();
  assert.equal(client.operations.find(r => r.operationId === 'op-dispose').state, 'cancelled');
  await assert.rejects(client.read('pluginsList'), { code: 'closed' });
  held.resolve(operations.install);
  await pending.catch(() => {});
  // The late resolution after dispose is dropped; it must not flip the retained fact to failed.
  const retained = client.operations.find(r => r.operationId === 'op-dispose');
  assert.equal(retained.state, 'cancelled');
  assert.equal(retained.error.code, 'catalog-closed');
});

function rpcStub(handler) { return { call: async (_channel, _endpoint, payload, signal) => handler(payload, signal) } }
const stateValue = { admission: { reads: { allowed: true, reason: null }, writes: { allowed: true, reason: null } }, auth: 'unavailable', installationVerified: true, workspace: '/fixture/ws', operations: [] };

test('S09 CatalogStore refresh mirrors official sections and fails a denied section closed without faking data', async () => {
  const rpc = rpcStub(payload => {
    if (payload.operation === 'state') return { ok: true, value: stateValue };
    if (payload.operation === 'read') {
      if (payload.kind === 'skillReference') return { ok: false, error: { code: 'catalog-unavailable', message: 'denied' } };
      return { ok: true, value: { mcpList: directory.mcpList, pluginsList: directory.pluginsList, pluginsOverview: directory.pluginsOverview, pluginReference: directory.pluginReference }[payload.kind] };
    }
    return { ok: false, error: { code: 'unexpected' } };
  });
  const store = new CatalogStore(rpc);
  try {
    await store.refresh();
    const snapshot = store.getSnapshot();
    assert.equal(snapshot.loaded, true);
    assert.deepEqual(snapshot.sections.mcp.value, directory.mcpList);
    assert.equal(snapshot.sections.skills.value, null);
    assert.equal(snapshot.sections.skills.error.code, 'catalog-unavailable');
    assert.equal(snapshot.error.code, 'catalog-unavailable');
    assert.equal(snapshot.admission.writes.allowed, true);
    assert.equal(snapshot.auth, 'unavailable');
  } finally { store.dispose(); }
});

test('S09 CatalogStore shows pending only while awaiting and replaces it with the official result; diagnostics failures stay failures', async () => {
  const held = deferred();
  const rpc = rpcStub(payload => {
    if (payload.operation === 'operate' && payload.action === 'install') return held.promise;
    if (payload.operation === 'state') return { ok: true, value: stateValue };
    if (payload.operation === 'read') return { ok: true, value: payload.kind === 'mcpList' ? directory.mcpList : {} };
    return { ok: false, error: { code: 'unexpected' } };
  });
  const store = new CatalogStore(rpc);
  try {
    const pending = store.operate('install', { pluginName: 's09-demo', marketplace: 's09-local' }, 'op-1');
    assert.equal(store.getSnapshot().operations[0].state, 'pending');
    held.resolve({ ok: true, value: operations.install });
    assert.deepEqual(await pending, operations.install);
    assert.equal(store.getSnapshot().operations[0].state, 'completed');
    // A real official failure is returned as diagnostics, not a thrown RPC error.
    const outcome = operationOutcome(operations.installFailure);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.errors[0].code, 'plugin_dependency_missing');
    assert.equal(operations.installFailure.installedPlugins.length, 0);
  } finally { store.dispose(); }
});

test('S09 CatalogStore marks official RPC failures failed and cancel routes through cancelOperation', async () => {
  const rpc = rpcStub(payload => {
    if (payload.operation === 'operate' && payload.action === 'install') return { ok: false, error: { code: 'catalog-result-invalid', details: { protocolCode: -32603 } } };
    if (payload.operation === 'operate' && payload.action === 'cancelOperation') return { ok: true, value: { operationId: payload.params.operationId, cancelled: true } };
    if (payload.operation === 'state') return { ok: true, value: stateValue };
    if (payload.operation === 'read') return { ok: true, value: {} };
    return { ok: false, error: { code: 'unexpected' } };
  });
  const store = new CatalogStore(rpc);
  try {
    await assert.rejects(store.operate('install', { pluginName: 'a', marketplace: 'm' }, 'op-fail'), { code: 'catalog-result-invalid' });
    assert.equal(store.getSnapshot().operations.find(r => r.operationId === 'op-fail').state, 'failed');
    assert.deepEqual(await store.cancel('op-fail'), { operationId: 'op-fail', cancelled: true });
    assert.equal(store.getSnapshot().operations.find(r => r.operationId === 'op-fail').state, 'cancelled');
  } finally { store.dispose(); }
});

test('S09 CatalogStore keeps a pending operation pending when the official cancel reports cancelled:false', async () => {
  const held = deferred();
  const rpc = rpcStub(payload => {
    if (payload.operation === 'operate' && payload.action === 'install') return held.promise;
    if (payload.operation === 'operate' && payload.action === 'cancelOperation') return { ok: true, value: { operationId: payload.params.operationId, cancelled: false } };
    if (payload.operation === 'state') return { ok: true, value: stateValue };
    if (payload.operation === 'read') return { ok: true, value: {} };
    return { ok: false, error: { code: 'unexpected' } };
  });
  const store = new CatalogStore(rpc);
  try {
    const pending = store.operate('install', { pluginName: 'a', marketplace: 'm' }, 'op-refused');
    assert.equal(store.getSnapshot().operations.find(r => r.operationId === 'op-refused').state, 'pending');
    // cancelled:false is authoritative: the official runtime has no controller for this id and the
    // operation is still running. The mirror must not fake completion.
    assert.deepEqual(await store.cancel('op-refused'), { operationId: 'op-refused', cancelled: false });
    assert.equal(store.getSnapshot().operations.find(r => r.operationId === 'op-refused').state, 'pending');
    assert.equal(store.getSnapshot().operations.find(r => r.operationId === 'op-refused').error, null);
    held.resolve({ ok: true, value: operations.install });
    await pending;
    assert.equal(store.getSnapshot().operations.find(r => r.operationId === 'op-refused').state, 'completed');
  } finally { store.dispose(); }
});

test('S06 CatalogStore refresh reads pluginsList for the rendered source status', async () => {
  const kinds = [];
  const rpc = rpcStub(payload => {
    if (payload.operation === 'read') { kinds.push(payload.kind); return { ok: true, value: {} } }
    if (payload.operation === 'state') return { ok: true, value: stateValue };
    return { ok: false, error: { code: 'unexpected' } };
  });
  const store = new CatalogStore(rpc);
  try {
    await store.refresh();
    assert.equal(kinds.includes('pluginsList'), true);
    assert.equal(kinds.includes('mcpList'), true);
  } finally { store.dispose(); }
});

test('S09 CatalogStore connection reset wins over an in-flight refresh', async () => {
  let fire; const generation = { subscribe(listener) { fire = listener; return () => {} } };
  const held = deferred();
  const rpc = rpcStub(payload => {
    if (payload.operation === 'read') return held.promise;
    if (payload.operation === 'state') return { ok: true, value: stateValue };
    return { ok: false, error: { code: 'unexpected' } };
  });
  const store = new CatalogStore(rpc, { connectionGeneration: generation });
  try {
    const refreshing = store.refresh();
    fire();
    assert.equal(store.getSnapshot().loaded, false);
    assert.equal(store.getSnapshot().admission.reads.reason, 'host-unreachable');
    held.resolve({ ok: true, value: {} });
    await refreshing.catch(() => {});
    // The stale refresh must not resurrect sections or a host-reachable admission after reset.
    assert.equal(store.getSnapshot().loaded, false);
    assert.equal(store.getSnapshot().sections.mcp, null);
    assert.equal(store.getSnapshot().admission.reads.reason, 'host-unreachable');
    assert.equal(store.getSnapshot().busy, false);
  } finally { store.dispose(); }
});

test('S09 CatalogStore connection generation reset clears the display mirror', async () => {
  let fire; const generation = { subscribe(listener) { fire = listener; return () => {} } };
  const rpc = rpcStub(payload => payload.operation === 'state' ? { ok: true, value: stateValue } : { ok: true, value: {} });
  const store = new CatalogStore(rpc, { connectionGeneration: generation });
  try {
    await store.refresh();
    assert.equal(store.getSnapshot().loaded, true);
    fire();
    assert.equal(store.getSnapshot().loaded, false);
    assert.equal(store.getSnapshot().admission.reads.reason, 'host-unreachable');
  } finally { store.dispose(); }
});

test('CB10-1: a connection reset during an in-flight state RPC drops the late admission instead of restoring the old connection', async () => {
  let fire; const generation = { subscribe(listener) { fire = listener; return () => {} } };
  const held = deferred();
  const rpc = rpcStub(payload => {
    if (payload.operation === 'state') return held.promise;
    return { ok: false, error: { code: 'unexpected' } };
  });
  const store = new CatalogStore(rpc, { connectionGeneration: generation });
  try {
    const pending = store.state();
    fire();
    assert.equal(store.getSnapshot().admission.reads.reason, 'host-unreachable');
    // The old connection's state response resolves after the reset: publishing it would bring the
    // stale reads/writes allowed admission and workspace back into the reset store.
    held.resolve({ ok: true, value: stateValue });
    assert.deepEqual(await pending, stateValue);
    const snapshot = store.getSnapshot();
    assert.equal(snapshot.admission.reads.reason, 'host-unreachable', 'late state response must not restore the reset admission');
    assert.equal(snapshot.admission.writes.allowed, false);
    assert.equal(snapshot.workspace, null, 'the old connection workspace must not be restored');
    assert.equal(snapshot.auth, 'unconfirmed');
  } finally { store.dispose(); }
});

test('CB10-1: a connection reset in the trailing state RPC window of refresh keeps the reset store without a host-reachable admission', async () => {
  let fire; const generation = { subscribe(listener) { fire = listener; return () => {} } };
  const held = deferred();
  const rpc = rpcStub(payload => {
    if (payload.operation === 'read') return { ok: true, value: {} };
    if (payload.operation === 'state') return held.promise;
    return { ok: false, error: { code: 'unexpected' } };
  });
  const store = new CatalogStore(rpc, { connectionGeneration: generation });
  try {
    const refreshing = store.refresh();
    // Let refresh finish the eager reads and park on the trailing state RPC.
    await new Promise(resolve => setTimeout(resolve, 0));
    fire();
    assert.equal(store.getSnapshot().admission.reads.reason, 'host-unreachable');
    held.resolve({ ok: true, value: stateValue });
    await refreshing.catch(() => {});
    const snapshot = store.getSnapshot();
    assert.equal(snapshot.admission.reads.reason, 'host-unreachable', 'the reset admission must survive the late state response');
    assert.equal(snapshot.admission.writes.allowed, false);
    assert.equal(snapshot.workspace, null, 'the old workspace must not reappear');
    assert.equal(snapshot.loaded, false);
  } finally { store.dispose(); }
});

test('S09 catalog endpoint rejects foreign payload keys and unknown operations before reaching the host', async () => {
  const host = {
    catalogState: () => ({ admission: { reads: { allowed: true, reason: null }, writes: { allowed: true, reason: null } }, operations: [] }),
    catalogRead: async (kind, params) => ({ kind, params }),
    catalogOperate: async (action, params, { operationId }) => ({ action, params, operationId }),
  };
  assert.equal((await handleCatalog(host, { operation: 'read', kind: 'pluginsList', params: {} })).ok, true);
  assert.equal((await handleCatalog(host, { operation: 'operate', action: 'install', params: { pluginName: 'a', marketplace: 'm' }, operationId: 'o' })).ok, true);
  assert.equal((await handleCatalog(host, { operation: 'state' })).ok, true);
  for (const payload of [{ operation: 'read', kind: 'x', params: {}, workspace: '/evil' }, { operation: 'bogus' }, null, []]) {
    assert.equal((await handleCatalog(host, payload)).error.code, 'invalid-payload');
  }
  const denied = await handleCatalog({ ...host, catalogRead: async () => { throw Object.assign(new Error(), { code: 'catalog-unavailable' }) } }, { operation: 'read', kind: 'pluginsList', params: {} });
  assert.equal(denied.error.code, 'catalog-unavailable');
});

test('S09 BridgeHost wires the official catalog carrier with verified-management admission and no second store', async () => {
  const { BridgeHost } = await import('../packages/host/runtime.mjs');
  const store = catalogStore({ responses: {
    'mcp/list': directory.mcpList,
    'plugins/list': directory.pluginsList,
    'plugins/install': operations.install,
  } });
  const host = new BridgeHost({ workspacePath: tmpdir(), inspect: async () => ({ launcher: 'fixture', cjs: 'fixture', providerConfig: 'fixture', verified: true }), spawnProcess: store.child });
  try {
    await host.connect();
    assert.equal(host.status.connected, true);
    assert.deepEqual(await host.catalogRead('pluginsList', {}), directory.pluginsList);
    assert.deepEqual(await host.catalogRead('mcpList', {}), directory.mcpList);
    assert.deepEqual(await host.catalogOperate('install', { pluginName: 's09-demo', marketplace: 's09-local', scope: 'workspace' }, { operationId: 'op-host' }), operations.install);
    const state = host.catalogState();
    assert.equal(state.admission.writes.allowed, true);
    assert.equal(state.operations.find(r => r.operationId === 'op-host').state, 'completed');
    assert.equal(store.requests.filter(r => r.method === 'plugins/install').length, 1);
    assert.equal(store.requests.some(r => /tools\/call|tools\/list|resources\/read/.test(r.method)), false);
  } finally { await host.dispose(); }
});

test('S09 BridgeHost keeps catalog management read-only when the installation is unverified', async () => {
  const { BridgeHost } = await import('../packages/host/runtime.mjs');
  const store = catalogStore({ responses: { 'plugins/list': directory.pluginsList } });
  const host = new BridgeHost({ workspacePath: tmpdir(), inspect: async () => ({ launcher: 'fixture', cjs: 'fixture', providerConfig: 'fixture', verified: false }), spawnProcess: store.child });
  try {
    await host.connect();
    assert.equal(host.catalogState().admission.writes.allowed, false);
    await assert.rejects(host.catalogOperate('install', { pluginName: 'a', marketplace: 'm' }), { code: 'management-unverified' });
    assert.deepEqual(await host.catalogRead('pluginsList', {}), directory.pluginsList);
    assert.equal(store.requests.some(r => r.method === 'plugins/install'), false);
  } finally { await host.dispose(); }
});
