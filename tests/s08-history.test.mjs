import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { s08Runtime } from './fixtures/s08-runtime.mjs';
import { historyTarget, historyAllowed, historyResultText } from '../packages/client/history-controls.mjs';
const row = (f, id) => f.conversation.state.snapshot.rows.window.find(r => r.rowId === id);
const token = (f, id) => historyTarget(f.conversation.state, row(f, id));
async function send(f, type, id, extra = {}, result) { const t = id ? token(f, id) : {}; const p = f.conversation.submit({ type, payload: { ...(t.target ? { target: t.target } : {}), ...extra }, ...t }); f.ack(f.sent.at(-1), result); return p; }

test('S08 non-last stable assistant fork preserves parent rows and uses complete branch address', async () => {
  const f = s08Runtime(); try { await f.open(); const before = f.conversation.state.snapshot;
    const result = await send(f, 'forkAssistant', 3, {}, { type: 'forkAssistant', sessionId: 'child-s08' });
    assert.deepEqual(result.branchAddress, { ...f.conversation.address, sessionId: 'child-s08' });
    assert.deepEqual(f.conversation.state.snapshot, before);
    assert.equal(f.sent.at(-1).params.baseRevision, 8); assert.equal(f.sent.at(-1).params.baseLogEpoch, before.logEpoch);
    assert.match(historyResultText(result), /workspace files were preserved/);
    assert.equal(f.sent.some(r => r.method === 'session/close'), false);
  } finally { f.dispose(); }
});

test('S08 preserve edit cuts only conversation; injected test port owns file rewind, hash oracle uses actual temporary file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 's08-fixture-')), file = join(dir, 'sample.txt'), f = s08Runtime();
  const hash = async () => createHash('sha256').update(await readFile(file)).digest('hex');
  try {
    // The two fixture turns wrote this file; no bridge or DSH production code accesses it.
    await writeFile(file, 'version 1\n'); const first = await hash(); await writeFile(file, 'version 2\n'); const second = await hash();
    await f.open();
    const edited = await send(f, 'editUserQuery', 5, { newText: 'Write edited version', workspaceMode: 'preserve' }, { type: 'editUserQuery', disposition: 'rewind', sessionId: f.conversation.address.sessionId });
    assert.equal(await hash(), second); assert.equal(f.sent.at(-1).params.payload.workspaceMode, 'preserve');
    assert.notEqual(edited.commandId, 'original-2');
    await f.replaceEpoch('edited-branch', s => { s.rows.window = s.rows.window.filter(r => r.turnId !== 'turn-2'); s.rows.window.push({ ...row(f, 4), rowId: 7, entityId: 'rerun-header', sourceCommandId: edited.commandId, state: 'completedSuccess' }); s.rows.totalCount = s.rows.window.length; });
    assert.equal(f.conversation.command(edited.commandId).state, 'completed');
    const t = token(f, 1); const preview = f.conversation.historyQuery({ kind: 'fileRewindPreview', ...t }); f.response(f.sent.at(-1), f.fixture.preview); const previewed = await preview;
    const p = f.conversation.submit({ type: 'applyFileRewind', payload: { target: t.target }, ...t });
    // Explicit fake official-server effect: does not claim live ZCode checkpoint coverage.
    await writeFile(file, 'version 1\n'); f.ack(f.sent.at(-1), { type: 'applyFileRewind', applied: true, preview: previewed.result, response: 'restored sample.txt' });
    const applied = await p; assert.equal(await hash(), first); assert.equal(applied.ack.result.applied, true); assert.equal(f.conversation.state.snapshot.logEpoch, 'edited-branch');
  } finally { f.dispose(); await rm(dir, { recursive: true, force: true }); }
});

test('S08 combined edit rewind carries explicit mode and blocked result is never reported as executed', async () => {
  const f = s08Runtime(); try { await f.open(); const record = await send(f, 'editUserQuery', 5, { newText: 'changed', workspaceMode: 'rewind' }, { type: 'editUserQuery', disposition: 'blocked', sessionId: 'fixture-session', reasonCode: 'guard.workspaceRewindUnsafeFiles', preview: f.fixture.unsafe });
    assert.equal(f.sent.at(-1).params.payload.workspaceMode, 'rewind'); assert.match(historyResultText(record), /Edit blocked.*workspaceRewindUnsafeFiles/);
    assert.equal(f.conversation.state.snapshot.rows.window.length, 6);
  } finally { f.dispose(); }
});

test('S08 stale row/entity, epoch and revision cannot reach any history write', async () => {
  const f = s08Runtime(); try { await f.open(); const t = token(f, 6), count = f.sent.length;
    for (const [patch, code] of [[{ baseLogEpoch: 'old-epoch' }, 'proto.staleLogEpoch'], [{ baseRevision: 7 }, 'proto.staleRevision'], [{ payload: { target: { rowId: 6, entityId: 'foreign' } } }, 'row-target-unconfirmed']]) await assert.rejects(f.conversation.submit({ type: 'retryTurn', payload: { target: t.target }, ...t, ...patch }), { code });
    assert.equal(f.sent.length, count);
    await assert.rejects(send(f, 'editUserQuery', 2, { newText: 'old' }), { code: 'guard.actionUnavailable' });
  } finally { f.dispose(); }
});

test('S08 official diff and preview enforce schemas, row action and CAS and discard a late preview', async () => {
  const f = s08Runtime(); try { await f.open(); const t = token(f, 4);
    const diffs = f.conversation.historyQuery({ kind: 'fileChanges', ...t }); assert.equal(f.sent.at(-1).method, 'v4/conversation/fileChanges'); f.response(f.sent.at(-1), f.fixture.fileChanges); assert.equal((await diffs).result.items[0].path, 'sample.txt');
    const preview = f.conversation.historyQuery({ kind: 'fileRewindPreview', ...t }); const request = f.sent.at(-1); await f.replaceEpoch('next-epoch'); f.response(request, f.fixture.preview); await assert.rejects(preview, { code: 'proto.staleLogEpoch' });
    const count = f.sent.length; await assert.rejects(f.conversation.historyQuery({ kind: 'fileChanges', ...t }), { code: 'proto.staleLogEpoch' }); assert.equal(count, f.sent.length);
  } finally { f.dispose(); }
});

test('S08 retry generates new execution command IDs; B04 lost ACK queries only its original ID', async () => {
  const f = s08Runtime('success', { timeoutMs: 15 }); try { await f.open();
    const first = await send(f, 'retryTurn', 6), second = await send(f, 'retryTurn', 6); assert.notEqual(first.commandId, second.commandId);
    const t = token(f, 6), p = f.conversation.submit({ type: 'retryTurn', payload: { target: t.target }, ...t }); const req = f.sent.at(-1); const unknown = await p; assert.equal(unknown.state, 'outcome-unknown');
    const commands = f.sent.filter(r => r.method === 'v4/command').length; const q = f.conversation.queryCommand(unknown.commandId);
    f.response(f.sent.at(-1), { results: [{ key: { sessionId: 'fixture-session', commandId: unknown.commandId }, result: { commandId: unknown.commandId, status: 'accepted', revisionAtDecision: 8 } }] }); await q;
    assert.equal(f.sent.filter(r => r.method === 'v4/command').length, commands); assert.equal(req.params.commandId, unknown.commandId);
    await f.replaceEpoch('retry-new-epoch', s => { s.rows.window[3].sourceCommandId = second.commandId; });
    assert.equal(f.conversation.command(second.commandId).state, 'completed'); assert.equal(f.conversation.command(first.commandId).state, 'accepted-awaiting-terminal');
  } finally { f.dispose(); }
});

test('S08 compaction uses official availability: busy and held queue, locked compact rejects without sending', async () => {
  for (const name of ['success', 'busy', 'held', 'locked']) { const f = s08Runtime(name); try { await f.open();
    if (name === 'locked') { const count = f.sent.length; await assert.rejects(f.conversation.submit({ type: 'compact', payload: {} }), { code: 'compactOperationLock' }); assert.equal(count, f.sent.length); }
    else { const original = f.conversation.state.snapshot.rows; const result = await send(f, 'compact'); assert.equal(result.state, 'accepted-awaiting-terminal'); assert.equal(f.sent.at(-1).params.baseRevision, undefined); assert.deepEqual(original, f.conversation.state.snapshot.rows); }
  } finally { f.dispose(); } }
});

test('S08 compaction recovery consumes official marker and retained history without rewriting text', async () => {
  const f = s08Runtime(); try { await f.open(); await send(f, 'compact'); const text = f.conversation.state.snapshot.rows.window.filter(r => r.text).map(r => r.text);
    const p = f.conversation.resync({ forceSnapshot: true }); const request = f.sent.at(-1); f.response(request, f.fixture.ack);
    f.update(s => { s.rows.window.push({ kind: 'timelineMarker', rowId: 7, entityId: 'compact-1', turnId: 'maintenance', createdAt: 3, createdAtSeq: 9, marker: { type: 'compact', origin: 'manual', status: 'success', tokensBefore: 5000, tokensAfter: 1000 } }); s.rows.totalCount++; }, { recovery: true }); await p;
    assert.equal(f.conversation.state.status, 'live'); assert.deepEqual(f.conversation.state.snapshot.rows.window.filter(r => r.text).map(r => r.text), text);
    assert.equal(f.conversation.state.snapshot.rows.window.at(-1).marker.status, 'success');
  } finally { f.dispose(); }
});

test('S08 restricted resources stay distinct from model retry/edit/compact and selection first input', async () => {
  const f = s08Runtime('success', { runnable: false }); try { await f.open(); assert.equal(f.conversation.admission.allowed, false);
    for (const type of ['retryTurn', 'editUserQuery', 'compact']) await assert.rejects(f.conversation.submit({ type, payload: {} }), { code: 'runtime-restricted' });
    await assert.rejects(f.conversation.submit({ type: 'createSelectionSideSession', payload: { firstInput: { text: 'selected' } } }), { code: 'runtime-restricted' });
    const branch = await send(f, 'createSelectionSideSession', null, {}, { type: 'createSelectionSideSession', sessionId: 'side' }); assert.equal(branch.branchAddress.authority, f.conversation.address.authority);
    const p = f.conversation.historyQuery({ kind: 'fileChanges', ...token(f, 4) }); f.response(f.sent.at(-1), f.fixture.fileChanges); await p;
    assert.equal(historyAllowed(f.conversation.state, row(f, 6), 'retryTurn'), false); assert.equal(historyAllowed(f.conversation.state, row(f, 3), 'forkAssistant'), true);
  } finally { f.dispose(); }
});

test('S08 feedback follows official row carrier and null clears without mutating local historical text', async () => {
  const f = s08Runtime(); try { await f.open(); for (const feedback of ['like', 'dislike', null]) { await send(f, 'setAssistantFeedback', 6, { feedback }); assert.equal(f.sent.at(-1).params.payload.feedback, feedback); }
    assert.equal(row(f, 6).feedback, undefined); await assert.rejects(send(f, 'setAssistantFeedback', 5, { feedback: 'like' }), { code: 'guard.actionUnavailable' });
  } finally { f.dispose(); }
});

test('S08 actual Host RPC router admits scoped non-model history queries/fork, requires observed CAS and keeps model commands gated', async () => {
  const { BridgeHost } = await import('../packages/host/runtime.mjs');
  const { controlledStore } = await import('./fixtures/s04-store.mjs');
  const store = controlledStore(), data = JSON.parse(await readFile('tests/fixtures/s08/success.json', 'utf8'));
  const host = new BridgeHost({ workspacePath: tmpdir(), inspect: async () => ({ launcher: 'fixture', cjs: 'fixture', providerConfig: 'fixture', verified: true }), spawnProcess: () => {
    const child = store.child(), writeIn = child.stdin.write.bind(child.stdin), writeOut = child.stdout.write.bind(child.stdout);
    // Adapter injects only test history/diff facts into the existing store carrier.
    child.stdout.write = (bytes, ...args) => {
      const message = JSON.parse(bytes.toString());
      if (message.method === 'v4/conversation/frame') {
        const snapshot = message.params.frame.payload.snapshot;
        snapshot.rows = structuredClone(data.initial.frame.payload.snapshot.rows);
        snapshot.control.phase = 'completedSuccess'; snapshot.availability.compact = { allowed: true };
      }
      if (message.result?.commandId && store.requests.at(-1)?.params.type === 'forkAssistant') message.result.result = { type: 'forkAssistant', sessionId: 'fixture-child' };
      return writeOut(JSON.stringify(message) + '\n', ...args);
    };
    child.stdin.write = (bytes, ...args) => {
      const request = JSON.parse(bytes.toString());
      if (request.method === 'v4/conversation/fileChanges' || request.method === 'v4/conversation/fileRewindPreview') { store.requests.push(request); child.stdout.write(JSON.stringify({ id: request.id, result: request.method.endsWith('fileChanges') ? data.fileChanges : data.preview }) + '\n'); return true; }
      return writeIn(bytes, ...args);
    };
    return child;
  } });
  try {
    await host.connect(); const address = (await host.listSessions()).sessions[0].address, owner = await host.openConversation(address);
    const observed = { baseRevision: owner.state.snapshot.revision, baseLogEpoch: owner.state.snapshot.logEpoch };
    const query = await host.conversationOperation({ operation: 'historyQuery', handle: owner.handle, kind: 'fileRewindPreview', target: { rowId: 4, entityId: 'header-2' }, ...observed });
    assert.equal(query.result.safeFiles[0].path, 'sample.txt');
    const fork = { type: 'forkAssistant', payload: { target: { rowId: 3, entityId: 'reply-1' } } };
    await assert.rejects(host.conversationOperation({ operation: 'command', handle: owner.handle, command: fork }), { code: 'history-target-unconfirmed' });
    const record = await host.conversationOperation({ operation: 'command', handle: owner.handle, command: { ...fork, ...observed } }); assert.deepEqual(record.branchAddress, { ...address, sessionId: 'fixture-child' });
    assert.equal(host.status.state, 'restricted');
    await assert.rejects(host.conversationOperation({ operation: 'command', handle: owner.handle, command: { type: 'compact', payload: {} } }), { code: 'runtime-restricted' });
    assert.equal(store.requests.some(r => r.method === 'session/close'), false);
  } finally { await host.dispose(); }
});

test('S08 explicit edit attachments remain session-bound and invalid branch ACK never supplies a navigation identity', async () => {
  const f = s08Runtime(); try { await f.open();
    await assert.rejects(f.conversation.submit({ type: 'editUserQuery', payload: { target: token(f, 5).target, newText: 'edited', attachments: [{ ref: '/foreign/path', fileName: 'f', mime: 'text/plain', bytes: 1 }] }, ...token(f, 5) }), { code: 'attachment-ref-unbound' });
    const p = f.conversation.submit({ type: 'forkAssistant', payload: { target: token(f, 3).target }, ...token(f, 3) }); f.ack(f.sent.at(-1), { type: 'createSelectionSideSession', sessionId: 'wrong-carrier' });
    const result = await p; assert.equal(result.branchAddress, undefined); assert.equal(result.error, 'command-result-mismatch');
  } finally { f.dispose(); }
});
