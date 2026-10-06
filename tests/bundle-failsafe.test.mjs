import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { FailSafeState, classifyFailure, commandAllowed, SAFE_COMMANDS, SAFE_OPERATIONS } from '../packages/host/fail-safe.mjs';
import { BridgeHost } from '../packages/host/runtime.mjs';
import { classifyInstallation } from '../packages/host/compatibility.mjs';
import { batchFaultChild, batchFaultInstallation } from './fixtures/batch-fault.mjs';
import { bundleRuntime, bundleInstallation } from './fixtures/installable-bundle-runtime.mjs';
import { controlledStore } from './fixtures/session-lifecycle-store.mjs';

test('failures are graded by invariant: core decode/authority vs optional capability vs unknown', () => {
  for (const code of ['protocol-invalid', 'protocol-truncated', 'capabilities-invalid', 'sessions-invalid']) {
    const classified = classifyFailure(code);
    assert.equal(classified.level, 'core', `${code} is core`);
    assert.equal(classified.incompatible, true);
    assert.equal(classified.stopsNewSideEffects, true);
  }
  for (const code of ['catalog-result-invalid', 'insights-unavailable', 'automation-unavailable', 'remote-unavailable']) {
    const classified = classifyFailure(code);
    assert.equal(classified.level, 'non-core');
    assert.equal(classified.incompatible, false);
    assert.equal(classified.stopsNewSideEffects, false);
    assert.ok(classified.capability, 'a non-core failure names the isolated capability');
  }
  const unknown = classifyFailure('something-new');
  assert.equal(unknown.level, 'neutral');
  assert.equal(unknown.incompatible, false, 'an unknown code must not assert incompatibility');
  assert.equal(unknown.stopsNewSideEffects, false);
});

test('core stops new side effects but the explicit safe stop path remains', () => {
  assert.equal(commandAllowed('core', 'sendText'), false);
  assert.equal(commandAllowed('core', 'deleteSession'), false);
  assert.equal(commandAllowed('core', 'stop'), true);
  assert.equal(commandAllowed('core', 'cancelBackgroundWork'), true);
  assert.equal(commandAllowed('non-core', 'sendText'), true);
  assert.equal(commandAllowed('none', 'sendText'), true);
  assert.deepEqual([...SAFE_COMMANDS].sort(), ['cancelBackgroundWork', 'stop']);
  // The operation whitelist is read/release/safe-stop only; every write surface is absent.
  for (const write of ['attachmentStart', 'attachmentChunk', 'attachmentCommit', 'workflowManage', 'workspaceConfig', 'command']) {
    assert.equal(SAFE_OPERATIONS.has(write), false, `${write} must not be a safe operation`);
  }
  for (const read of ['state', 'query', 'historyQuery', 'workflowRead', 'attachmentRead', 'hostRegistration']) {
    assert.equal(SAFE_OPERATIONS.has(read), true, `${read} is an allowed operation`);
  }
});

test('FailSafeState records core, isolates non-core, stays neutral on unknown and resets per connection', () => {
  const state = new FailSafeState();
  state.observe('catalog-result-invalid');
  assert.equal(state.level, 'non-core');
  assert.equal(state.blocksNewSideEffects, false, 'a directory shape denial must not stop chat');
  assert.equal(state.state.isolated[0].capability, 'directory');
  state.observe('unknown-future-code');
  assert.equal(state.level, 'non-core', 'an unknown code does not escalate');
  state.observe('protocol-invalid');
  assert.equal(state.level, 'core');
  assert.equal(state.blocksNewSideEffects, true);
  assert.equal(state.state.incompatible, true);
  state.reset();
  assert.equal(state.level, 'none');
  assert.deepEqual(state.state.isolated, []);
});

test('a core decode error marks the runtime incompatible and blocks new side effects', async () => {
  const fixture = batchFaultChild('session/list');
  const host = new BridgeHost({ workspacePath: tmpdir(), inspect: async () => batchFaultInstallation, spawnProcess: () => fixture.child });
  try {
    const connecting = host.connect();
    await fixture.eof;
    await new Promise(resolve => setImmediate(resolve));
    fixture.finishClose();
    const status = await connecting;
    assert.equal(status.connected, false);
    assert.equal(status.reason, 'protocol-invalid');
    assert.equal(status.failSafe.level, 'core');
    assert.equal(status.failSafe.incompatible, true);
    assert.equal(status.failSafe.stopsNewSideEffects, true);
    await assert.rejects(host.conversationOperation({ operation: 'command', handle: 'any', command: { type: 'sendText', payload: {} } }), { code: 'runtime-incompatible' });
    await assert.rejects(host.conversationOperation({ operation: 'command', handle: 'any', command: { type: 'stop', payload: {} } }), { code: 'conversation-handle-invalid' });
  } finally { fixture.finishClose(); await host.dispose() }
});

test('an optional capability denial is isolated while the runtime and chat path keep working', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-workspace-'));
  const runtime = bundleRuntime({ workspacePath, sessions: [{ sessionId: 'bundle-session', title: 'kept' }] });
  const host = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: () => runtime.child });
  try {
    const status = await host.connect();
    assert.equal(status.connected, true);
    assert.equal(status.failSafe.level, 'none');
    await assert.rejects(host.catalogRead('mcpList'), { code: 'catalog-result-invalid' });
    const after = host.status;
    assert.equal(after.connected, true, 'the runtime stays connected');
    assert.equal(after.failSafe.level, 'non-core');
    assert.equal(after.failSafe.blocksNewSideEffects, false, 'chat paths are not blocked by a directory denial');
    assert.equal(after.failSafe.isolated[0].capability, 'directory');
    // A safe read still reaches the official carrier after the denial.
    const catalog = await host.listSessions({});
    assert.deepEqual(catalog.sessions.map(session => session.address.sessionId), ['bundle-session']);
  } finally { runtime.child.stdin.end(); await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});

test('CA17-1: a post-connect sessions-invalid marks the runtime incompatible and stops new side effects', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-sessions-drift-'));
  // The connect handshake consumes session/list call 1; the next catalog read gets a non-array.
  const runtime = bundleRuntime({ workspacePath, sessions: [{ sessionId: 'bundle-session', title: 'kept' }], badSessionListOnCall: 2 });
  const host = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: () => runtime.child });
  try {
    const status = await host.connect();
    assert.equal(status.connected, true);
    assert.equal(status.failSafe.level, 'none');
    await assert.rejects(host.listSessions({}), { code: 'sessions-invalid' });
    const after = host.status;
    assert.equal(after.connected, true, 'the peer is still alive; the core grade comes from the observed failure');
    assert.equal(after.failSafe.level, 'core');
    assert.equal(after.failSafe.incompatible, true);
    assert.equal(after.failSafe.stopsNewSideEffects, true);
    assert.equal(after.failSafe.blocksNewSideEffects, true);
    // New side effects are refused while the peer survives; the explicit safe stop path is not.
    await assert.rejects(host.conversationOperation({ operation: 'command', handle: 'any', command: { type: 'sendText', payload: {} } }), { code: 'runtime-incompatible' });
    await assert.rejects(host.catalogOperate('toolCall', {}), { code: 'runtime-incompatible' });
    await assert.rejects(host.conversationOperation({ operation: 'command', handle: 'any', command: { type: 'stop', payload: {} } }), { code: 'conversation-handle-invalid' });
  } finally { runtime.child.stdin.end(); await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});

test('CA17-3: a core incompatibility blocks every write surface but keeps reads and safe stop', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-core-whitelist-'));
  const runtime = bundleRuntime({ workspacePath, badSessionListOnCall: 2 });
  const host = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: () => runtime.child });
  try {
    await host.connect();
    await assert.rejects(host.listSessions({}), { code: 'sessions-invalid' });
    assert.equal(host.status.failSafe.blocksNewSideEffects, true);
    const blocked = [
      { operation: 'attachmentStart', handle: 'any', attachment: {} },
      { operation: 'attachmentChunk', handle: 'any', uploadId: 'u', chunkIndex: 0, dataBase64: '' },
      { operation: 'attachmentCommit', handle: 'any', uploadId: 'u' },
      { operation: 'workflowManage', handle: 'any', kind: 'delete', params: {} },
      { operation: 'workspaceConfig', handle: 'any', kind: 'interaction', preferences: {} },
    ];
    for (const call of blocked) {
      await assert.rejects(host.conversationOperation(call), { code: 'runtime-incompatible' }, `${call.operation} must be refused under core`);
    }
    const allowed = [
      { operation: 'state', handle: 'any' },
      { operation: 'attachmentAbort', handle: 'any', uploadId: 'u' },
      { operation: 'workflowManage', handle: 'any', kind: 'list', params: {} },
      { operation: 'workflowRead', handle: 'any', kind: 'runs', params: {} },
      { operation: 'workspaceConfig', handle: 'any', kind: 'presentation' },
      { operation: 'historyQuery', handle: 'any', kind: 'fileChanges' },
      { operation: 'hostRegistration', handle: 'any' },
      { operation: 'command', handle: 'any', command: { type: 'stop', payload: {} } },
      { operation: 'command', handle: 'any', command: { type: 'cancelBackgroundWork', payload: { workId: 'w' } } },
    ];
    for (const call of allowed) {
      await assert.rejects(host.conversationOperation(call), { code: 'conversation-handle-invalid' }, `${call.operation}/${call.kind ?? call.command?.type} must pass the core gate`);
    }
  } finally { runtime.child.stdin.end(); await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});

test('RD17-1: host registration stays reachable on a live handle under core while write surfaces stay blocked', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-registration-'));
  // A valid official plugin/mcp directory payload; the session/list after the listing used for the
  // address (call 3: connect handshake, address lookup, post-connect read) is malformed.
  const plugin = { id: 'browser-use@zcode-plugins-official', name: 'browser-use', enabled: true, source: 'official', marketplace: 'zcode-plugins-official', skillRootCount: 0, commandRootCount: 0, mcpServerNames: [], rootPath: '/fixture/plugins/browser-use' };
  const store = controlledStore({ count: 1, badSessionListOnCall: 3, catalog: { plugins: [plugin], mcpStatuses: {} } });
  const host = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: () => store.child() });
  try {
    await host.connect();
    const address = (await host.listSessions()).sessions[0].address;
    const opened = await host.openConversation(address);
    assert.equal(host.status.failSafe.level, 'none');
    await assert.rejects(host.listSessions({}), { code: 'sessions-invalid' });
    assert.equal(host.status.failSafe.blocksNewSideEffects, true);
    // Registration is a pure plugins/mcp directory read and must still reach the official carrier.
    const registration = await host.conversationOperation({ handle: opened.handle, operation: 'hostRegistration' });
    assert.deepEqual(registration.plugins, [{ id: plugin.id, enabled: true, hostMcpServerNames: [], mcpServerNames: [] }]);
    assert.deepEqual(registration.mcpStatuses, {});
    // Contrast: genuine write surfaces are refused on the same live handle.
    await assert.rejects(host.conversationOperation({ handle: opened.handle, operation: 'attachmentStart', attachment: {} }), { code: 'runtime-incompatible' });
    await assert.rejects(host.conversationOperation({ handle: opened.handle, operation: 'command', command: { type: 'sendText', payload: { text: 'forbidden' } } }), { code: 'runtime-incompatible' });
    await assert.rejects(host.conversationOperation({ handle: opened.handle, operation: 'workspaceConfig', kind: 'interaction', preferences: {} }), { code: 'runtime-incompatible' });
  } finally { await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});

test('CA17-2: a conversation error published as a bare string code is observed by the host', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-observer-code-'));
  // `#publish({status:'error',error:code})` sets a bare string; the object shape stays supported.
  for (const error of ['sessions-invalid', { code: 'conversation-result-invalid' }]) {
    const runtime = bundleRuntime({ workspacePath });
    const host = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: () => runtime.child });
    try {
      const status = await host.connect();
      const conversation = host.createConversation({ runtime: 'zcode', authority: status.sessionAuthority, workspace: status.workspacePath, sessionId: 'bundle-session' });
      assert.equal(host.status.failSafe.level, 'none');
      conversation.onChange({ status: 'error', error });
      assert.equal(host.status.failSafe.level, 'core', `error ${JSON.stringify(error)} must reach the fail-safe`);
      assert.equal(host.status.failSafe.incompatible, true);
    } finally { runtime.child.stdin.end(); await host.dispose() }
  }
  await rm(workspacePath, { recursive: true, force: true });
});

test('CB17-1: real V4 terminal decode/projection faults are core while recoverable assembly faults stay neutral', () => {
  const core = [
    'proto.invalidWire', 'proto.unroutableFrame', 'proto.invalidSeq', 'proto.snapshotIdentityMismatch',
    'proto.revisionRegressed', 'proto.missingAppliedBase', 'proto.sequenceGap', 'proto.initialDeliveryMismatch',
    'proto.frameAssemblyInvalidPayload', 'proto.frameAssemblyMetadataMismatch', 'proto.frameAssemblyOrdinalConflict',
    'proto.frameAssemblyFragmentConflict', 'proto.frameAssemblyLengthMismatch', 'proto.frameAssemblyChecksumMismatch',
    'proto.frameAssemblyInvalidUtf8', 'proto.frameAssemblyInvalidJson', 'proto.frameAssemblyInvalidBase64',
    'proto.frameAssemblyTooLarge', 'proto.frameEnvelopeTooLarge', 'proto.frameFragmentCountExceeded',
  ];
  for (const code of core) {
    const classified = classifyFailure(code);
    assert.equal(classified.level, 'core', `${code} is a core terminal fault`);
    assert.equal(classified.incompatible, true, `${code} asserts incompatibility`);
    assert.equal(classified.stopsNewSideEffects, true, `${code} stops new side effects`);
  }
  // Benign supersede, local staging/resource limits, liveness timeout and unknown prefix peers are
  // not corruption, so they must not fabricate an incompatibility claim.
  for (const code of ['proto.frameAssemblySuperseded', 'proto.frameAssemblyConcurrentLimit', 'proto.frameAssemblyBudgetExceeded', 'proto.frameAssemblyTimedOut', 'proto.futureUnknownCode']) {
    const classified = classifyFailure(code);
    assert.equal(classified.level, 'neutral', `${code} must stay neutral`);
    assert.equal(classified.incompatible, false, `${code} must not assert incompatibility`);
    assert.equal(classified.stopsNewSideEffects, false, `${code} must not stop new side effects`);
  }
});

test('CB17-1: a real malformed wire frame escalates the host fail-safe and blocks another session write', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-invalid-wire-'));
  const store = controlledStore({ count: 2 });
  const host = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: () => store.child() });
  const until = async (predicate, timeoutMs = 2000) => {
    const start = Date.now();
    for (;;) {
      if (predicate()) return;
      if (Date.now() - start > timeoutMs) throw new Error('condition not reached');
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  };
  try {
    await host.connect();
    const sessions = (await host.listSessions({})).sessions.map(session => session.address);
    await host.openConversation(sessions[0]);
    const second = await host.openConversation(sessions[1]);
    assert.equal(host.status.failSafe.level, 'none');
    const slotA = [...store.slots.values()].find(slot => slot.sessionId === sessions[0].sessionId);
    assert.ok(slotA, 'the first conversation owns a live subscription slot');
    // An undecodable frame (wireVersion 99) on the live subscription requests a bounded recovery.
    store.malformedFrame(slotA);
    await until(() => store.requests.some(request => request.method === 'v4/conversation/resync'));
    // The recovery delivery is undecodable too, so the fault is terminal: proto.invalidWire reaches
    // the host fail-safe, which must grade it core instead of letting writes continue.
    store.malformedFrame(slotA, { deliveryKind: 'recovery' });
    await until(() => host.status.failSafe.level === 'core');
    assert.equal(host.status.failSafe.incompatible, true);
    assert.equal(host.status.failSafe.stopsNewSideEffects, true);
    assert.equal(host.status.failSafe.blocksNewSideEffects, true);
    // The second conversation's handle is still owned; its rename is a new side effect and is refused.
    await assert.rejects(
      host.conversationOperation({ handle: second.handle, operation: 'command', command: { type: 'renameSession', payload: { title: 'must-not-apply' } } }),
      { code: 'runtime-incompatible' },
    );
    assert.equal(store.rows.get(sessions[1].sessionId).title, 'Title 1', 'the blocked rename never rewrote the controlled store');
  } finally { await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});

/** Wrap a controlled-store child so the `v4/conversation/resync` ACK the host sees is rewritten.
 *  Subscribe, frames, commands and every other response stay the real carrier; only the recovery
 *  acknowledgment travels through `corruptAck`. */
function storeWithCorruptResyncAck({ count = 2, corruptAck }) {
  const store = controlledStore({ count });
  const spawn = () => {
    const inner = store.child();
    const stdout = new PassThrough();
    const child = new EventEmitter();
    child.stdin = inner.stdin; child.stdout = stdout; child.stderr = inner.stderr; child.pid = inner.pid;
    child.kill = (...args) => inner.kill(...args);
    inner.stdout.on('data', chunk => {
      for (const line of chunk.toString().split('\n')) {
        if (!line) continue;
        let message; try { message = JSON.parse(line) } catch { stdout.write(line + '\n'); continue }
        if (message.id !== undefined && message.result) {
          const request = store.requests.find(request => request.id === message.id);
          if (request?.method === 'v4/conversation/resync') message.result = { ack: corruptAck(message.result.ack) };
        }
        stdout.write(JSON.stringify(message) + '\n');
      }
    });
    inner.stdout.on('end', () => stdout.end());
    inner.on('close', code => child.emit('close', code));
    inner.on('error', error => child.emit('error', error));
    return child;
  };
  return { store, spawn };
}

test('FB17-1: a mismatched recovery resync ACK is core and blocks another session write', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-resync-identity-'));
  const { store, spawn } = storeWithCorruptResyncAck({ count: 2, corruptAck: ack => ({ ...ack, subscriptionId: 'forged-subscription' }) });
  const host = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: spawn });
  const until = async (predicate, timeoutMs = 2000) => {
    const start = Date.now();
    for (;;) {
      if (predicate()) return;
      if (Date.now() - start > timeoutMs) throw new Error('condition not reached');
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  };
  try {
    await host.connect();
    const sessions = (await host.listSessions({})).sessions.map(session => session.address);
    await host.openConversation(sessions[0]);
    const second = await host.openConversation(sessions[1]);
    assert.equal(host.status.failSafe.level, 'none');
    const slotA = [...store.slots.values()].find(slot => slot.sessionId === sessions[0].sessionId);
    assert.ok(slotA, 'the first conversation owns a live subscription slot');
    // An undecodable frame requests a bounded recovery; the ACK names a different subscription id.
    store.malformedFrame(slotA);
    await until(() => host.status.failSafe.level === 'core');
    assert.equal(host.status.failSafe.incompatible, true);
    assert.equal(host.status.failSafe.stopsNewSideEffects, true);
    assert.equal(host.status.failSafe.blocksNewSideEffects, true);
    await assert.rejects(
      host.conversationOperation({ handle: second.handle, operation: 'command', command: { type: 'renameSession', payload: { title: 'must-not-apply' } } }),
      { code: 'runtime-incompatible' },
    );
    assert.equal(store.rows.get(sessions[1].sessionId).title, 'Title 1', 'the blocked rename never rewrote the controlled store');
  } finally { await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});

test('FB17-1: a recovery resync ACK missing subscriptionId/logEpoch is core and blocks another session write', async () => {
  for (const [label, corruptAck] of [
    ['empty subscriptionId', ack => ({ ...ack, subscriptionId: '' })],
    ['empty logEpoch', ack => ({ ...ack, logEpoch: '' })],
  ]) {
    const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-resync-ack-'));
    const { store, spawn } = storeWithCorruptResyncAck({ count: 2, corruptAck });
    const host = new BridgeHost({ workspacePath, inspect: async () => bundleInstallation, spawnProcess: spawn });
    const until = async (predicate, timeoutMs = 2000) => {
      const start = Date.now();
      for (;;) {
        if (predicate()) return;
        if (Date.now() - start > timeoutMs) throw new Error(`condition not reached (${label})`);
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    };
    try {
      await host.connect();
      const sessions = (await host.listSessions({})).sessions.map(session => session.address);
      await host.openConversation(sessions[0]);
      const second = await host.openConversation(sessions[1]);
      assert.equal(host.status.failSafe.level, 'none');
      const slotA = [...store.slots.values()].find(slot => slot.sessionId === sessions[0].sessionId);
      assert.ok(slotA, `the first conversation owns a live subscription slot (${label})`);
      store.malformedFrame(slotA);
      await until(() => host.status.failSafe.level === 'core');
      assert.equal(host.status.failSafe.incompatible, true, `${label} asserts incompatibility`);
      assert.equal(host.status.failSafe.blocksNewSideEffects, true, `${label} blocks new side effects`);
      await assert.rejects(
        host.conversationOperation({ handle: second.handle, operation: 'command', command: { type: 'renameSession', payload: { title: 'must-not-apply' } } }),
        { code: 'runtime-incompatible' },
        `${label} must refuse the rename`,
      );
      assert.equal(store.rows.get(sessions[1].sessionId).title, 'Title 1', `${label}: the blocked rename never rewrote the controlled store`);
    } finally { await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
  }
});

test('FB17-1: unknown recovery fallbacks and local preconditions stay neutral (no over-escalation)', () => {
  for (const code of ['resync-invalid', 'subscription-unconfirmed', 'conversation-closed']) {
    const classified = classifyFailure(code);
    assert.equal(classified.level, 'neutral', `${code} must stay neutral, not fabricate incompatibility`);
    assert.equal(classified.incompatible, false, `${code} must not assert incompatibility`);
    assert.equal(classified.stopsNewSideEffects, false, `${code} must not stop new side effects`);
  }
  const state = new FailSafeState();
  state.observe('resync-invalid');
  assert.equal(state.level, 'none', 'an unknown recovery fallback must not escalate');
  assert.equal(state.blocksNewSideEffects, false);
  state.observe('subscription-unconfirmed');
  assert.equal(state.level, 'none', 'a local precondition must not escalate');
});

test('an unknown version is neutral: no compatibility claim and no new-side-effect stop', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'bundle-unknown-'));
  const runtime = bundleRuntime({ workspacePath });
  const installation = { ...bundleInstallation, version: undefined, build: undefined, sha256: undefined, verified: false };
  const host = new BridgeHost({ workspacePath, inspect: async () => installation, spawnProcess: () => runtime.child });
  try {
    await host.connect();
    const status = host.status;
    assert.equal(status.compatibility.state, 'unknown');
    assert.equal(status.compatibility.failSafe, 'neutral');
    assert.equal(status.compatibility.bannerRequired, false);
    assert.equal(status.failSafe.incompatible, false);
    assert.equal(status.failSafe.blocksNewSideEffects, false);
    assert.equal(classifyInstallation(null).state, 'unknown');
  } finally { runtime.child.stdin.end(); await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});
