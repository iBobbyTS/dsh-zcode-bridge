import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ZCodeConversationView, ZCodeWorkPanel } from '../packages/client/conversation-view.jsx';

const lifecycle = JSON.parse(readFileSync(resolve('tests/fixtures/s10/lifecycle.json'), 'utf8'));
const empty = JSON.parse(readFileSync(resolve('tests/fixtures/s10/empty.json'), 'utf8'));
const successFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s03a/success.json'), 'utf8'));
const officialFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s03a/official.json'), 'utf8'));

afterEach(() => { cleanup(); });
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

function createConversationFixture({ runnable = false, address = { runtime: 'zcode' as const, authority: 'test-authority', workspace: '/fixture/workspace', sessionId: 'fixture-session' } } = {}) {
  const input = new PassThrough();
  const output = new PassThrough();
  const sent: any[] = [];
  output.on('data', b => sent.push(JSON.parse(b.toString())));
  const peer = new ProtocolPeer(input, output, { timeoutMs: 200 });
  const conversation = new V4Conversation(peer, {
    address,
    workspace: { workspacePath: address.workspace, workspaceKey: address.workspace },
    clientId: 'fixture-client', connectionId: 'fixture-connection', clientMode: 'web-remote-replayable', runnable, frameTimeoutMs: 500,
  });
  const response = (request: any, result: any) => input.write(JSON.stringify({ id: request.id, result }) + '\n');
  const fail = (request: any, code: number, message = 'official rejection') => input.write(JSON.stringify({ id: request.id, error: { code, message } }) + '\n');
  const wire = (frame: any) => input.write(JSON.stringify({ method: 'v4/conversation/frame', params: frame }) + '\n');
  async function open(initial: any = successFixture.initial, ack: any = successFixture.ack) {
    const p = conversation.connect();
    input.write(JSON.stringify({ id: sent.at(-1).id, result: ack }) + '\n' + JSON.stringify({ method: 'v4/conversation/frame', params: initial }) + '\n');
    await p; await tick();
    return conversation;
  }
  return { sent, peer, conversation, response, fail, wire, open, dispose: () => peer.close() };
}

describe('S10 background work and subagent panel', () => {
  it('renders the real empty official projection truthfully (no fabricated work)', async () => {
    const f = createConversationFixture();
    try {
      await f.open(); // real official empty snapshot
      await act(async () => { render(React.createElement(ZCodeConversationView, { conversation: f.conversation })); });
      expect(screen.getByTestId('zcode-work-empty').textContent).toContain('No background work');
      expect(screen.getByTestId('zcode-subagent-empty').textContent).toContain('No subagent instance');
      expect(screen.getByTestId('zcode-subagent-ended-total').textContent).toContain('0');
      expect(screen.getByTestId('zcode-work-admission').textContent).toContain('Official projection live');
    } finally { f.dispose(); }
  });

  it('renders official work status, cancel identity and output tail without inventing progress', async () => {
    const f = createConversationFixture();
    try {
      await f.open(lifecycle.initial, lifecycle.ack);
      await act(async () => { render(React.createElement(ZCodeConversationView, { conversation: f.conversation })); });
      const bash = lifecycle.works.bashWork;
      const subagent = lifecycle.works.subagentWork;
      expect(screen.getByTestId(`zcode-work-${bash.workId}`).getAttribute('data-work-kind')).toBe('bash');
      expect(screen.getByTestId(`zcode-work-status-${bash.workId}`).textContent).toBe('running');
      expect(screen.getByTestId(`zcode-work-output-btn-${bash.workId}`)).not.toBeNull();
      expect(screen.getByTestId(`zcode-work-status-${subagent.workId}`).textContent).toBe('running');
      // The output button is bash-only; a subagent work exposes no bash tail.
      expect(screen.queryByTestId(`zcode-work-output-btn-${subagent.workId}`)).toBeNull();
      // Cancel targets the official workId, not a UI-assigned id.
      expect(screen.getByTestId(`zcode-subagent-cancel-${lifecycle.subagents.running.childSessionId}`).textContent).toContain(subagent.workId);
    } finally { f.dispose(); }
  });

  it('reads the official bounded bash output and shows the official unavailable reason', async () => {
    const f = createConversationFixture();
    try {
      await f.open(lifecycle.initial, lifecycle.ack);
      await act(async () => { render(React.createElement(ZCodeConversationView, { conversation: f.conversation })); });
      const bash = lifecycle.works.bashWork;
      await act(async () => { fireEvent.click(screen.getByTestId(`zcode-work-output-btn-${bash.workId}`)); });
      const outputRequest = f.sent.at(-1);
      expect(outputRequest.method).toBe('v4/conversation/backgroundBashOutput');
      expect(outputRequest.params).toEqual({ sessionId: 'fixture-session', workId: bash.workId });
      await act(async () => { f.response(outputRequest, { kind: 'output', workId: bash.workId, status: 'running', output: 'official tail\n', truncated: true, outputPath: '/fixture/output.log' }); await tick(); });
      expect(screen.getByTestId(`zcode-work-output-${bash.workId}`).textContent).toContain('official tail');
      expect(screen.getByTestId(`zcode-work-output-meta-${bash.workId}`).textContent).toContain('truncated');

      // A later read that the official runtime answers with {kind:'unavailable'} must replace the tail
      // with the official reason, never keep showing a stale (possibly expired) tail as current.
      await act(async () => { fireEvent.click(screen.getByTestId(`zcode-work-output-btn-${bash.workId}`)); });
      const secondRequest = f.sent.at(-1);
      await act(async () => { f.response(secondRequest, { kind: 'unavailable', workId: bash.workId }); await tick(); });
      expect(screen.getByTestId(`zcode-work-output-unavailable-${bash.workId}`).textContent).toContain('unavailable');
      expect(screen.queryByTestId(`zcode-work-output-${bash.workId}`)).toBeNull();
    } finally { f.dispose(); }
  });

  it('cancel is authoritative: a rejected official ACK is shown and the work state is not optimistically changed', async () => {
    const f = createConversationFixture();
    try {
      await f.open(lifecycle.initial, lifecycle.ack);
      await act(async () => { render(React.createElement(ZCodeConversationView, { conversation: f.conversation })); });
      const bash = lifecycle.works.bashWork;
      await act(async () => { fireEvent.click(screen.getByTestId(`zcode-work-cancel-${bash.workId}`)); });
      const request = f.sent.at(-1);
      expect(request.params.type).toBe('cancelBackgroundWork');
      expect(request.params.payload).toEqual({ workId: bash.workId });
      const ack = { ...empty.rejections.cancelUnknownWorkCommand.result, commandId: request.params.commandId };
      await act(async () => { f.response(request, ack); await tick(); });
      // Official rejection reasonCode is surfaced; the official running status is untouched.
      expect(screen.getByTestId(`zcode-work-cancel-ack-${bash.workId}`).textContent).toContain('fault.command.backgroundWorkCancelRejected.not_found');
      expect(screen.getByTestId(`zcode-work-status-${bash.workId}`).textContent).toBe('running');
    } finally { f.dispose(); }
  });

  it('cancel settles from the official projection and never affects a later unrelated work', async () => {
    const f = createConversationFixture();
    try {
      await f.open(lifecycle.initial, lifecycle.ack);
      await act(async () => { render(React.createElement(ZCodeConversationView, { conversation: f.conversation })); });
      const bash = lifecycle.works.bashWork;
      await act(async () => { fireEvent.click(screen.getByTestId(`zcode-work-cancel-${bash.workId}`)); });
      const request = f.sent.at(-1);
      await act(async () => { f.response(request, { commandId: request.params.commandId, status: 'accepted', revisionAtDecision: 0 }); await tick(); });
      expect(screen.getByTestId(`zcode-work-status-${bash.workId}`).textContent).toBe('running');

      await act(async () => { f.wire(lifecycle.cancelled); await tick(); });
      expect(screen.getByTestId(`zcode-work-status-${bash.workId}`).textContent).toBe('cancelled');

      await act(async () => { f.wire(lifecycle.subagentSettled); await tick(); });
      expect(screen.getByTestId('zcode-subagent-ended-total').textContent).toContain('1');

      await act(async () => { f.wire(lifecycle.laterWorkStarted); await tick(); });
      const later = lifecycle.works.newWork;
      expect(screen.getByTestId(`zcode-work-status-${later.workId}`).textContent).toBe('running');
      // No cancel affordance/record is attached to the later unrelated work.
      expect(screen.getByTestId(`zcode-work-cancel-${later.workId}`)).not.toBeNull();
      expect(screen.queryByTestId(`zcode-work-cancel-ack-${later.workId}`)).toBeNull();
    } finally { f.dispose(); }
  });

  it('loads and paginates the official ended subagent page and reports the official rejection', async () => {
    const f = createConversationFixture();
    try {
      await f.open(lifecycle.initial, lifecycle.ack);
      await act(async () => { render(React.createElement(ZCodeConversationView, { conversation: f.conversation })); });
      await act(async () => { fireEvent.click(screen.getByTestId('zcode-subagent-load-ended')); });
      const request = f.sent.at(-1);
      expect(request.method).toBe('session/subagents');
      expect(request.params).toEqual({ sessionId: 'fixture-session', endedLimit: 20 });
      const page = { revision: 1, childSessionIds: [], running: [], ended: { total: 2, items: [{ childSessionId: 's10-ended-1', subagentType: 'general', title: 'ended one', status: 'success' }], nextCursor: 'cursor-1' } };
      await act(async () => { f.response(request, page); await tick(); });
      expect(screen.getByTestId('zcode-subagent-ended-s10-ended-1').textContent).toContain('success');
      expect(screen.getByTestId('zcode-subagent-load-more')).not.toBeNull();

      await act(async () => { fireEvent.click(screen.getByTestId('zcode-subagent-load-more')); });
      const next = f.sent.at(-1);
      expect(next.params).toEqual({ sessionId: 'fixture-session', endedCursor: 'cursor-1', endedLimit: 20 });
      await act(async () => {
        f.fail(next, -32004, 'Session not found: s10-never-created');
        await tick();
      });
      expect(screen.getByTestId('zcode-subagent-ended-error').textContent).toContain('runtime-rejected');
      // The previously loaded official page is retained; the failed page did not fabricate entries.
      expect(screen.getByTestId('zcode-subagent-ended-s10-ended-1')).not.toBeNull();
    } finally { f.dispose(); }
  });

  it('degrades bounded on an unknown official work kind and gates actions when observation admission is closed', async () => {
    const state = {
      status: 'live',
      snapshot: {
        backgroundWorks: [
          { workId: 'mystery-1', kind: 'mystery', title: 'future work kind', status: 'quantum', startedAt: 0, anchorRowId: null },
        ],
        subagents: { revision: 0, childSessionIds: [], running: [{ childSessionId: 'c1', subagentType: 'x', title: 't', status: 'teleporting' }], endedTotal: 0 },
        control: { activeWorks: [] },
      },
      commands: [],
      workAdmission: { allowed: false, reason: 'projection-unconfirmed' },
    };
    const controller = { listSubagents: vi.fn(), readBackgroundBashOutput: vi.fn(), cancelBackgroundWork: vi.fn() };
    await act(async () => { render(React.createElement(ZCodeWorkPanel, { state: state as any, controller: controller as any })); });
    expect(screen.getByTestId('zcode-work-mystery-1').getAttribute('data-work-kind')).toBe('unknown');
    expect(screen.getByTestId('zcode-work-mystery-1').textContent).toContain('[unrecognized official work]');
    expect(screen.getByTestId('zcode-subagent-status-c1').textContent).toContain('[unrecognized status]');
    expect(screen.getByTestId('zcode-work-admission').textContent).toContain('gated');
    fireEvent.click(screen.getByTestId('zcode-subagent-load-ended'));
    expect(controller.listSubagents).not.toHaveBeenCalled();
  });

  it('renders the real official headless runtime work face without model calls', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'zcode-s10-oracle-'));
    const installation = await inspectInstallation();
    if (!installation.verified) throw new Error('Official runtime identity mismatch');
    expect(installation.sha256).toBe(officialFixture.provenance.sha256);

    const child = spawn(installation.launcher, [installation.cjs, 'app-server', '--stdio'], {
      cwd: workspacePath,
      env: runtimeEnv(installation.providerConfig),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const exited = new Promise(resolve => child.once('close', resolve));
    const peer = new ProtocolPeer(child.stdout, child.stdin, { timeoutMs: 15000 });
    const workspace = { workspacePath, workspaceKey: workspacePath };
    let conversation: V4Conversation | undefined;
    try {
      await peer.request('runtime/capabilities', {});
      const created = await peer.request('v4/command', { commandId: randomUUID(), clientId: 's10-oracle', sessionId: null, type: 'createSession', payload: { workspaceId: workspacePath }, issuedAt: Date.now() });
      const sessionId = created?.result?.sessionId;
      expect(sessionId).toBeTruthy();
      conversation = new V4Conversation(peer, {
        address: { runtime: 'zcode', authority: 'official-headless', workspace: workspacePath, sessionId },
        workspace, connectionId: 's10-oracle-conn', clientId: 's10-oracle-client', runnable: false,
      });
      await conversation.connect();
      for (let i = 0; i < 300 && conversation.state.status !== 'live'; i++) await tick();
      expect(conversation.state.status).toBe('live');
      expect(conversation.state.snapshot.backgroundWorks).toEqual([]);
      expect(conversation.state.snapshot.subagents.running).toEqual([]);
      expect(conversation.state.workAdmission.allowed).toBe(true);
      expect(conversation.state.admission.allowed).toBe(false);

      // Official rejection for an unknown/expired workId, both observation and cancel faces.
      const unavailable = await conversation.readBackgroundBashOutput({ workId: 's10-never-created' });
      expect(unavailable).toEqual({ kind: 'unavailable', workId: 's10-never-created' });
      const cancelRecord = await conversation.cancelBackgroundWork({ workId: 's10-never-created' });
      expect(cancelRecord.ack?.status).toBe('failed');
      expect(cancelRecord.ack?.reasonCode).toBe('fault.command.backgroundWorkCancelRejected.not_found');
      // The legacy subagent list carrier rejects a non-persisted parent; the real empty projection is
      // still authoritative for running instances in the snapshot above.
      await expect(conversation.listSubagents()).rejects.toMatchObject({ code: 'runtime-rejected', protocolCode: -32004 });

      await act(async () => { render(React.createElement(ZCodeConversationView, { conversation })); });
      expect(screen.getByTestId('zcode-work-empty')).not.toBeNull();
      expect(screen.getByTestId('zcode-subagent-empty')).not.toBeNull();
    } finally {
      if (conversation) await conversation.cancel();
      peer.close();
      await stopOwned(child, exited);
      await rm(workspacePath, { recursive: true, force: true });
    }
  });
});
