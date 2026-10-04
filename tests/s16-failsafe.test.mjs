import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { FailSafeState, classifyFailure, commandAllowed, SAFE_COMMANDS, SAFE_OPERATIONS } from '../packages/host/fail-safe.mjs';
import { BridgeHost } from '../packages/host/runtime.mjs';
import { classifyInstallation } from '../packages/host/compatibility.mjs';
import { batchFaultChild, batchFaultInstallation } from './fixtures/batch-fault.mjs';
import { s16Runtime, s16Installation } from './fixtures/s16-runtime.mjs';

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
  for (const write of ['attachmentStart', 'attachmentChunk', 'attachmentCommit', 'workflowManage', 'workspaceConfig', 'hostRegistration', 'command']) {
    assert.equal(SAFE_OPERATIONS.has(write), false, `${write} must not be a safe operation`);
  }
  for (const read of ['state', 'query', 'historyQuery', 'workflowRead', 'attachmentRead']) {
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
  const workspacePath = await mkdtemp(join(tmpdir(), 's16-workspace-'));
  const runtime = s16Runtime({ workspacePath, sessions: [{ sessionId: 's16-session', title: 'kept' }] });
  const host = new BridgeHost({ workspacePath, inspect: async () => s16Installation, spawnProcess: () => runtime.child });
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
    assert.deepEqual(catalog.sessions.map(session => session.address.sessionId), ['s16-session']);
  } finally { runtime.child.stdin.end(); await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});

test('CA17-1: a post-connect sessions-invalid marks the runtime incompatible and stops new side effects', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 's16-sessions-drift-'));
  // The connect handshake consumes session/list call 1; the next catalog read gets a non-array.
  const runtime = s16Runtime({ workspacePath, sessions: [{ sessionId: 's16-session', title: 'kept' }], badSessionListOnCall: 2 });
  const host = new BridgeHost({ workspacePath, inspect: async () => s16Installation, spawnProcess: () => runtime.child });
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
  const workspacePath = await mkdtemp(join(tmpdir(), 's16-core-whitelist-'));
  const runtime = s16Runtime({ workspacePath, badSessionListOnCall: 2 });
  const host = new BridgeHost({ workspacePath, inspect: async () => s16Installation, spawnProcess: () => runtime.child });
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
      { operation: 'hostRegistration', handle: 'any' },
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
      { operation: 'command', handle: 'any', command: { type: 'stop', payload: {} } },
      { operation: 'command', handle: 'any', command: { type: 'cancelBackgroundWork', payload: { workId: 'w' } } },
    ];
    for (const call of allowed) {
      await assert.rejects(host.conversationOperation(call), { code: 'conversation-handle-invalid' }, `${call.operation}/${call.kind ?? call.command?.type} must pass the core gate`);
    }
  } finally { runtime.child.stdin.end(); await host.dispose(); await rm(workspacePath, { recursive: true, force: true }) }
});

test('CA17-2: a conversation error published as a bare string code is observed by the host', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 's16-observer-code-'));
  // `#publish({status:'error',error:code})` sets a bare string; the object shape stays supported.
  for (const error of ['sessions-invalid', { code: 'conversation-result-invalid' }]) {
    const runtime = s16Runtime({ workspacePath });
    const host = new BridgeHost({ workspacePath, inspect: async () => s16Installation, spawnProcess: () => runtime.child });
    try {
      const status = await host.connect();
      const conversation = host.createConversation({ runtime: 'zcode', authority: status.sessionAuthority, workspace: status.workspacePath, sessionId: 's16-session' });
      assert.equal(host.status.failSafe.level, 'none');
      conversation.onChange({ status: 'error', error });
      assert.equal(host.status.failSafe.level, 'core', `error ${JSON.stringify(error)} must reach the fail-safe`);
      assert.equal(host.status.failSafe.incompatible, true);
    } finally { runtime.child.stdin.end(); await host.dispose() }
  }
  await rm(workspacePath, { recursive: true, force: true });
});

test('an unknown version is neutral: no compatibility claim and no new-side-effect stop', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 's16-unknown-'));
  const runtime = s16Runtime({ workspacePath });
  const installation = { ...s16Installation, version: undefined, build: undefined, sha256: undefined, verified: false };
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
