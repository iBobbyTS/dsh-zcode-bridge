import { afterEach, expect, it } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { s08Runtime } from './fixtures/s08-runtime.mjs';
import { ZCodeConversationView } from '../packages/client/conversation-view.jsx';
import { RemoteConversation } from '../packages/client/remote-conversation.mjs';
import { webcrypto } from 'node:crypto';
afterEach(cleanup);
async function mount(name = 'success', options = {}, onOpenBranch?: (address: object) => void) { const f = s08Runtime(name, options); await f.open(); render(React.createElement(ZCodeConversationView, { conversation: f.conversation, onOpenBranch })); return f; }
async function answer(f: ReturnType<typeof s08Runtime>, result?: object, status = 'accepted', reasonCode?: string) { await act(async () => { f.ack(f.sent.at(-1), result, status, reasonCode); }); }
const part = (id: number) => within(screen.getByTestId(`zcode-history-${id}`));

it('S08 forks a non-last stable response, renders full branch identity and opens through directory callback', async () => {
  const opened: object[] = []; const f = await mount('success', {}, address => { opened.push(address); });
  try { fireEvent.click(part(3).getByText('Fork conversation here (preserve files)'));
    expect(f.sent.at(-1).params.type).toBe('forkAssistant'); expect(f.sent.at(-1).params.payload.target).toEqual({ rowId: 3, entityId: 'reply-1' });
    await answer(f, { type: 'forkAssistant', sessionId: 'child-1' });
    expect(part(3).getByRole('status').textContent).toContain('workspace files were preserved'); fireEvent.click(part(3).getByText('Open ZCode branch'));
    expect(opened).toEqual([{ ...f.conversation.address, sessionId: 'child-1' }]);
    expect(screen.getAllByTestId('zcode-assistant-text-row')).toHaveLength(2);
  } finally { f.dispose(); }
});

it('S08 edit defaults to preserve and keeps original CAS; earlier non-editable inputs stay disabled', async () => {
  const f = await mount(); try {
    expect((part(2).getByText('Edit input') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(part(5).getByText('Edit input')); expect((screen.getByLabelText('Workspace mode') as HTMLSelectElement).value).toBe('preserve');
    fireEvent.change(screen.getByLabelText('Edited input'), { target: { value: 'Edited second input' } }); fireEvent.click(screen.getByText('Execute edited input'));
    const command = f.sent.at(-1).params; expect(command.type).toBe('editUserQuery'); expect(command.payload).toEqual({ target: { rowId: 5, entityId: 'input-2' }, newText: 'Edited second input', workspaceMode: 'preserve' }); expect(command.commandId).not.toBe('original-2'); expect(command.baseRevision).toBe(8);
    await answer(f, { type: 'editUserQuery', disposition: 'rewind', sessionId: 'fixture-session' });
    await act(async () => { f.update(s => { s.meta.title = 'Other client changed revision'; }); });
    expect((screen.getByText('Execute edited input') as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText('History changed; reopen the editor before executing.')).toBeDefined();
  } finally { f.dispose(); }
});

it('S08 attachment-only edit: clearing text with retained attachments stays executable and keeps canonical attachments on the wire', async () => {
  const f = await mount(); try {
    await act(async () => { f.update(s => { const target = s.rows.window.find(row => row.rowId === 5); target.attachments = [{ ref: 'zcode-artifact://fixture-session/tool-result-retained', fileName: 'retained.txt', mime: 'text/plain', bytes: 4 }]; }); });
    fireEvent.click(part(5).getByText('Edit input')); fireEvent.change(screen.getByLabelText('Edited input'), { target: { value: '' } });
    const button = screen.getByText('Execute edited input') as HTMLButtonElement; expect(button.disabled).toBe(false);
    fireEvent.click(button);
    const command = f.sent.at(-1).params; expect(command.type).toBe('editUserQuery');
    // Omitting attachments is the official "retain canonical attachments" signal; text may be empty.
    expect(command.payload).toEqual({ target: { rowId: 5, entityId: 'input-2' }, newText: '', workspaceMode: 'preserve' }); expect(command.payload.attachments).toBeUndefined();
    await answer(f, { type: 'editUserQuery', disposition: 'rewind', sessionId: 'fixture-session' });
  } finally { f.dispose(); }
});

it('S08 text-only edit still requires text: clearing whitespace with no retained attachment disables execute', async () => {
  const f = await mount(); try {
    fireEvent.click(part(5).getByText('Edit input'));
    for (const value of ['', '   ']) { fireEvent.change(screen.getByLabelText('Edited input'), { target: { value } }); expect((screen.getByText('Execute edited input') as HTMLButtonElement).disabled).toBe(true); }
  } finally { f.dispose(); }
});

it('S08 retry explains reexecution, produces a fresh command id each user action and never calls recovery resend', async () => {
  const f = await mount(); try {
    expect(part(6).getByText(/Previous tool side effects may happen again/)).toBeDefined();
    fireEvent.click(part(6).getByText('Retry turn: execute again')); const id = f.sent.at(-1).params.commandId; await answer(f);
    fireEvent.click(part(6).getByText('Retry turn: execute again')); expect(f.sent.at(-1).params.commandId).not.toBe(id); await answer(f);
    expect(f.sent.filter(r => r.method === 'v4/command' && r.params.type === 'retryTurn')).toHaveLength(2);
  } finally { f.dispose(); }
});

it('S08 file diff and rewind preview show paths and refuse expired apply; new preview applies files only', async () => {
  const f = await mount(); try {
    fireEvent.click(part(4).getByText('File changes')); expect(f.sent.at(-1).method).toBe('v4/conversation/fileChanges');
    await act(async () => { f.response(f.sent.at(-1), f.fixture.fileChanges); }); expect(part(4).getByTestId('zcode-file-changes').textContent).toContain('-version 1');
    fireEvent.click(part(4).getByText('Preview file rewind')); await act(async () => { f.response(f.sent.at(-1), f.fixture.preview); }); expect(part(4).getByTestId('zcode-rewind-preview').textContent).toContain('restore: sample.txt');
    await act(async () => { f.update(s => { s.meta.title = 'another revision'; }); }); expect((part(4).getByText('Apply file rewind (preserve conversation)') as HTMLButtonElement).disabled).toBe(true);
    expect(part(4).getByText('Preview expired; request a new preview.')).toBeDefined();
    fireEvent.click(part(4).getByText('Preview file rewind')); await act(async () => { f.response(f.sent.at(-1), f.fixture.preview); }); fireEvent.click(part(4).getByText('Apply file rewind (preserve conversation)'));
    expect(f.sent.at(-1).params.type).toBe('applyFileRewind'); await answer(f, { type: 'applyFileRewind', applied: true, preview: f.fixture.preview, response: 'restored sample.txt' }); expect(part(4).getByRole('status').textContent).toContain('ZCode applied file rewind');
  } finally { f.dispose(); }
});

it('S08 unsafe/ignored rewind is visible and apply remains disabled; combined edit blocked is explicit', async () => {
  const f = await mount(); try {
    fireEvent.click(part(4).getByText('Preview file rewind')); await act(async () => { f.response(f.sent.at(-1), { ...f.fixture.unsafe, ignoredFiles: [{ path: 'shell.txt', operationCount: 1, toolNames: ['Bash'], reason: 'bash_ignored' }] }); });
    expect(part(4).getByTestId('zcode-rewind-preview').textContent).toContain('external_modified'); expect(part(4).getByTestId('zcode-rewind-preview').textContent).toContain('bash_ignored'); expect((part(4).getByText('Apply file rewind (preserve conversation)') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(part(5).getByText('Edit input')); fireEvent.change(screen.getByLabelText('Workspace mode'), { target: { value: 'rewind' } }); fireEvent.click(screen.getByText('Execute edited input'));
    await answer(f, { type: 'editUserQuery', disposition: 'blocked', sessionId: 'fixture-session', reasonCode: 'guard.workspaceRewindUnsafeFiles', preview: f.fixture.unsafe }); expect(part(5).getByRole('status').textContent).toContain('Edit blocked');
  } finally { f.dispose(); }
});

it('S08 compaction is queued in busy/held as official; server rejection/lock stays visible', async () => {
  for (const name of ['busy', 'held']) { const f = await mount(name); try { fireEvent.click(screen.getByText('Queue context compaction')); expect(f.sent.at(-1).params.type).toBe('compact'); await answer(f, undefined, 'rejected', 'compactOperationLock'); expect(screen.getByTestId('zcode-history-controls').textContent).toContain('compact: rejected (compactOperationLock)'); } finally { f.dispose(); cleanup(); } }
  const locked = await mount('locked'); try { expect((screen.getByText('Queue context compaction') as HTMLButtonElement).disabled).toBe(true); } finally { locked.dispose(); }
});

it('S08 recovery renders compact success marker and preserved historical text, allowing subsequent actions', async () => {
  const f = await mount(); try { await act(async () => { await f.replaceEpoch('compact-recovery', s => { s.rows.window.push({ kind: 'timelineMarker', rowId: 7, entityId: 'compact-marker', turnId: 'maintenance', createdAt: 3, createdAtSeq: 9, marker: { type: 'compact', origin: 'manual', status: 'success', tokensBefore: 5000, tokensAfter: 1000 } }); s.rows.totalCount++; }); });
    expect(screen.getByTestId('zcode-compaction-marker').textContent).toContain('success'); expect(screen.getByTestId('zcode-compaction-marker').textContent).toContain('5000 → 1000'); expect(part(5).getByText('Write version 2')).toBeDefined(); expect((part(6).getByText('Retry turn: execute again') as HTMLButtonElement).disabled).toBe(false);
  } finally { f.dispose(); }
});

it('S08 restricted history stays gated for model actions; side creation uses empty carrier and selected first input needs admission', async () => {
  const f = await mount('success', { runnable: false }); try {
    expect((part(6).getByText('Retry turn: execute again') as HTMLButtonElement).disabled).toBe(true); expect((part(5).getByText('Edit input') as HTMLButtonElement).disabled).toBe(true); expect((screen.getByText('Compact context') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Create selection side session (preserve files)')); expect(f.sent.at(-1).params.payload).toEqual({}); await answer(f, undefined, 'failed', 'fault.command.executionFailed');
    expect(screen.getByTestId('zcode-history-controls').textContent).toContain('createSelectionSideSession: failed');
    fireEvent.change(screen.getByLabelText('Selected text for side session'), { target: { value: 'selected prompt' } }); expect((screen.getByText('Create selection side session (preserve files)') as HTMLButtonElement).disabled).toBe(true);
  } finally { f.dispose(); }
});

it('S08 selection first input and feedback use their exact official carriers', async () => {
  const f = await mount(); try {
    fireEvent.change(screen.getByLabelText('Selected text for side session'), { target: { value: 'Selected task context' } }); fireEvent.click(screen.getByText('Create selection side session (preserve files)')); expect(f.sent.at(-1).params.payload).toEqual({ firstInput: { text: 'Selected task context' } }); await answer(f, { type: 'createSelectionSideSession', sessionId: 'side-model' });
    fireEvent.click(part(6).getByText('Dislike response')); expect(f.sent.at(-1).params.type).toBe('setAssistantFeedback'); expect(f.sent.at(-1).params.payload.feedback).toBe('dislike'); await answer(f);
    fireEvent.click(part(6).getByText('Clear feedback')); expect(f.sent.at(-1).params.payload.feedback).toBeNull(); await answer(f);
  } finally { f.dispose(); }
});

it('S08 production remote owner carries pinned historyQuery and epoch; query recovery keeps original commandId', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto'); Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  const f = s08Runtime(); let remote: RemoteConversation | undefined; const calls: any[] = [];
  try { await f.open(); const rpc = { call: async (_channel: string, _endpoint: string, p: any) => { calls.push(p); let value;
    if (p.operation === 'open') value = { handle: 's08-prod', state: f.conversation.state };
    else if (p.operation === 'state') value = f.conversation.state;
    else if (p.operation === 'historyQuery') { const pending = f.conversation.historyQuery(p); f.response(f.sent.at(-1), f.fixture.preview); value = await pending; }
    else if (p.operation === 'command') { const pending = f.conversation.submit(p.command); f.ack(); value = await pending; }
    else if (p.operation === 'query') { const pending = f.conversation.queryCommand(p.commandId); f.response(f.sent.at(-1), { results: [{ key: { sessionId: f.conversation.address.sessionId, commandId: p.commandId }, result: 'unknown' }] }); value = await pending; }
    else if (p.operation === 'release') value = { released: true };
    else throw Error('unexpected operation'); return { ok: true, value }; } };
    remote = new RemoteConversation(rpc, f.conversation.address); await remote.connect(); const snapshot = f.conversation.state.snapshot; const t = { target: { rowId: 4, entityId: 'header-2' }, baseRevision: snapshot.revision, baseLogEpoch: snapshot.logEpoch };
    const preview = await remote.historyQuery({ kind: 'fileRewindPreview', ...t }); expect(preview.result.safeFiles[0].path).toBe('sample.txt'); expect(calls.at(-1).operation).toBe('historyQuery'); expect(calls.at(-1).baseLogEpoch).toBe(snapshot.logEpoch);
    const retry = await remote.submit({ type: 'retryTurn', payload: { target: { rowId: 6, entityId: 'reply-2' } }, baseRevision: snapshot.revision, baseLogEpoch: snapshot.logEpoch }); expect(retry.type).toBe('retryTurn'); await remote.queryCommand(retry.commandId); expect(calls.find(p => p.operation === 'query').commandId).toBe(retry.commandId); expect(calls.filter(p => p.operation === 'command')).toHaveLength(1);
  } finally { await remote?.cancel(); f.dispose(); if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor); }
});
