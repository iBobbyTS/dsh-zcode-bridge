import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { FailSafeState, classifyFailure, commandAllowed, SAFE_COMMANDS } from '../packages/host/fail-safe.mjs';
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
