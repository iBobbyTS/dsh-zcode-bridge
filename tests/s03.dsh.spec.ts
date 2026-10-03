import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { RuntimeSessions } from '../packages/client/sources.mjs';
import { ZCodeConversationView, ConversationController } from '../packages/client/conversation-view.jsx';
import { renderSessionArea } from '../../dsh/packages/client/ui-session/src/client/session-provider.tsx';
import { parseRuntimeSessionAddress } from '@deepseek-ai/dsh-api-session-controller/client';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { B02 } from './fixtures/b02.mjs';

const successFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s03a/success.json'), 'utf8'));
const gapFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s03a/gap.json'), 'utf8'));
const failureFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s03a/failure.json'), 'utf8'));
const lateframeFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s03a/lateframe.json'), 'utf8'));
const officialFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s03a/official.json'), 'utf8'));

afterEach(() => {
  cleanup();
});

function createConversationFixture({
  runnable = false,
  clientMode = 'web-remote-replayable' as const,
  address = { runtime: 'zcode' as const, authority: 'test-authority', workspace: '/fixture/workspace', sessionId: 'fixture-session' },
} = {}) {
  const input = new PassThrough();
  const output = new PassThrough();
  const sent: any[] = [];
  output.on('data', b => sent.push(JSON.parse(b.toString())));
  const peer = new ProtocolPeer(input, output, { timeoutMs: 100 });
  const conversation = new V4Conversation(peer, {
    address,
    workspace: { workspacePath: address.workspace, workspaceKey: address.workspace },
    clientId: 'fixture-client',
    connectionId: 'fixture-connection',
    clientMode,
    runnable,
    frameTimeoutMs: 200,
  });

  const response = (req: any, result: any) => {
    input.write(JSON.stringify({ id: req.id, result }) + '\n');
  };

  const wire = (frame: any) => {
    input.write(JSON.stringify({ method: 'v4/conversation/frame', params: frame }) + '\n');
  };

  async function open(initial = successFixture.initial, ack = successFixture.ack) {
    const p = conversation.connect();
    input.write(JSON.stringify({ id: sent.at(-1).id, result: ack }) + '\n' + JSON.stringify({ method: 'v4/conversation/frame', params: initial }) + '\n');
    await p;
    await new Promise(r => setTimeout(r, 10));
    return conversation;
  }

  return { input, output, sent, peer, conversation, response, wire, open, dispose: () => peer.close() };
}

describe('S03.B ZCode Conversation View & Controls', () => {
  it('renders all lifecycle states with dedicated metadata chips (R08)', async () => {
    const f = createConversationFixture();
    try {
      // 1. Idle state
      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));
      expect(screen.getByTestId('zcode-status-badge').textContent).toContain('Status: idle');
      expect(screen.getByTestId('zcode-epoch').textContent).toContain('Epoch: —');
      expect(screen.getByTestId('zcode-seq').textContent).toContain('Seq: —');
      expect(screen.getByTestId('zcode-auth-note').textContent).toContain('restricted (official auth-gated)');

      cleanup();

      // 2. Open to live with real success fixture
      await act(async () => {
        await f.open();
      });

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));
      expect(screen.getByTestId('zcode-status-badge').textContent).toContain('Status: live');
      expect(screen.getByTestId('zcode-epoch').textContent).toContain(successFixture.initial.frame.payload.snapshot.logEpoch);
      expect(screen.getByTestId('zcode-seq').textContent).toContain('Seq: 0');
      expect(screen.getByTestId('zcode-revision').textContent).toContain('Rev: 0');
      expect(screen.getByTestId('zcode-profile').textContent).toContain('Profile: replayable');
    } finally {
      f.dispose();
    }
  });

  it('renders dedicated reasoning block, tool calls, and turn history without flattening into text (R08)', async () => {
    const f = createConversationFixture();
    try {
      await f.open();

      // Delta frame appending rows: turnHeader, userInput, reasoning, toolCall, assistantText
      const deltaFrame = structuredClone(successFixture.online);
      deltaFrame.logicalFrameId = 'rows-test';
      deltaFrame.logicalFrameOrdinal = 2;
      deltaFrame.frame.fromSeq = 0;
      deltaFrame.frame.toSeq = 1;
      deltaFrame.frame.payload.deltas = [
        {
          op: 'row.appended',
          row: {
            rowId: 1,
            turnId: 'turn-1',
            entityId: 'ent-1',
            kind: 'turnHeader',
            origin: 'userInput',
            state: 'running',
            startedAt: Date.now(),
            createdAt: Date.now(),
            createdAtSeq: 1,
          },
        },
        {
          op: 'row.appended',
          row: {
            rowId: 2,
            turnId: 'turn-1',
            entityId: 'ent-2',
            kind: 'userInput',
            origin: 'realUser',
            text: 'Please list files and explain directory structure.',
            createdAt: Date.now(),
            createdAtSeq: 1,
          },
        },
        {
          op: 'row.appended',
          row: {
            rowId: 3,
            turnId: 'turn-1',
            entityId: 'ent-3',
            kind: 'reasoning',
            text: 'I should first inspect the project workspace root with a shell command.',
            state: 'complete',
            durationMs: 340,
            createdAt: Date.now(),
            createdAtSeq: 1,
          },
        },
        {
          op: 'row.appended',
          row: {
            rowId: 4,
            turnId: 'turn-1',
            entityId: 'ent-4',
            kind: 'toolCall',
            toolCallId: 'call-1',
            toolName: 'ls_directory',
            status: 'success',
            inputText: 'ls -la',
            output: {
              text: 'package.json\nsrc\ntests',
            },
            createdAt: Date.now(),
            createdAtSeq: 1,
          },
        },
        {
          op: 'row.appended',
          row: {
            rowId: 5,
            turnId: 'turn-1',
            entityId: 'ent-5',
            kind: 'assistantText',
            text: 'Here is the project root listing: package.json, src, and tests.',
            state: 'complete',
            createdAt: Date.now(),
            createdAtSeq: 1,
          },
        },
      ];

      await act(async () => {
        f.wire(deltaFrame);
        await new Promise(r => setTimeout(r, 20));
      });

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      // 1. Turn Header
      expect(screen.getByTestId('zcode-turn-header').textContent).toContain('Turn #turn-1');

      // 2. User Input
      expect(screen.getByTestId('zcode-user-input-row').textContent).toContain('Please list files and explain directory structure.');

      // 3. Reasoning Node: MUST BE in dedicated reasoning element, NOT flattened into assistant text!
      const reasoningRow = screen.getByTestId('zcode-reasoning-row');
      expect(reasoningRow).not.toBeNull();
      expect(screen.getByTestId('zcode-reasoning-header').textContent).toContain('Model Reasoning (complete) · 340ms');
      expect(screen.getByTestId('zcode-reasoning-text').textContent).toContain('I should first inspect the project workspace root');

      // Reasoning text must NOT be inside the assistant text row
      const assistantText = screen.getByTestId('zcode-assistant-text-row');
      expect(assistantText.textContent).not.toContain('I should first inspect the project workspace root');
      expect(assistantText.textContent).toContain('Here is the project root listing');

      // 4. Tool Call
      expect(screen.getByTestId('zcode-tool-name').textContent).toBe('ls_directory');
      expect(screen.getByTestId('zcode-tool-status').textContent).toBe('success');
      expect(screen.getByTestId('zcode-tool-input').textContent).toBe('ls -la');
      expect(screen.getByTestId('zcode-tool-output').textContent).toContain('package.json');
    } finally {
      f.dispose();
    }
  });

  it('renders command ledger with ACK / execution / terminal separation', async () => {
    const f = createConversationFixture({ runnable: true });
    try {
      await f.open();

      // Submit command 1 (ACK received, awaiting terminal)
      let p1: any;
      await act(async () => {
        p1 = f.conversation.submit({ type: 'setFollowupMode', payload: { mode: 'queue' }, commandId: 'cmd-accepted' });
        f.response(f.sent.at(-1), { ...successFixture.accepted.result, commandId: 'cmd-accepted' });
        await p1;
      });

      // Submit command 2 (rejected with official reason code from failureFixture)
      let p2: any;
      await act(async () => {
        p2 = f.conversation.submit({ type: 'sendText', payload: { text: 'bad' }, commandId: 'cmd-rejected' });
        f.response(f.sent.at(-1), {
          ...failureFixture.commands[0].result,
          commandId: 'cmd-rejected',
        });
        await p2;
      });

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      const cmd1El = screen.getByTestId('zcode-command-cmd-accepted');
      expect(cmd1El.getAttribute('data-command-status')).toBe('accepted-awaiting-terminal');
      expect(cmd1El.textContent).toContain('setFollowupMode');

      const cmd2El = screen.getByTestId('zcode-command-cmd-rejected');
      expect(cmd2El.getAttribute('data-command-status')).toBe('rejected');
      expect(cmd2El.textContent).toContain('proto.invalidPayload');
    } finally {
      f.dispose();
    }
  });

  it('renders basic permission and ask-user controls and displays official runtime result on duplicate/expired resolution', async () => {
    const f = createConversationFixture({ runnable: true });
    try {
      await f.open();

      // Wire pendingInteractions into snapshot
      const deltaInteractions = structuredClone(successFixture.online);
      deltaInteractions.logicalFrameId = 'pending-interactions-frame';
      deltaInteractions.logicalFrameOrdinal = 2;
      deltaInteractions.frame.fromSeq = 0;
      deltaInteractions.frame.toSeq = 1;
      deltaInteractions.frame.payload.deltas = [
        {
          op: 'state.updated',
          patch: {
            pendingInteractions: [
              {
                interactionId: 'perm-tool-1',
                kind: 'permission',
                anchorRowId: null,
                createdAt: 0,
                payload: {
                  kind: 'permission',
                  toolCallId: 'tool-call-1',
                  toolName: 'bash_exec',
                  summary: 'Run "npm test" in workspace',
                  detail: {},
                  options: [
                    { optionId: 'allowOnce', label: 'Allow Once', kind: 'allowOnce' },
                    { optionId: 'deny', label: 'Deny', kind: 'deny' },
                  ],
                },
              },
              {
                interactionId: 'ask-user-1',
                kind: 'userInput',
                anchorRowId: null,
                createdAt: 0,
                payload: {
                  kind: 'userInput',
                  prompt: 'Which test suite would you like to run?',
                  freeText: true,
                },
              },
            ],
          },
        },
      ];

      await act(async () => {
        f.wire(deltaInteractions);
        await new Promise(r => setTimeout(r, 20));
      });

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      // Verification of fixture-driven label
      expect(screen.getByTestId('zcode-interaction-label').textContent).toContain('Fixture-driven pending interaction (live runtime is auth-gated)');

      // 1. Permission request card
      expect(screen.getByTestId('zcode-permission-tool').textContent).toBe('bash_exec');
      expect(screen.getByTestId('zcode-permission-summary').textContent).toContain('Run "npm test"');
      const allowBtn = screen.getByTestId('zcode-permission-btn-allowOnce');
      const denyBtn = screen.getByTestId('zcode-permission-btn-deny');
      expect(allowBtn).not.toBeNull();
      expect(denyBtn).not.toBeNull();

      // 2. User input card
      expect(screen.getByTestId('zcode-user-input-prompt').textContent).toContain('Which test suite would you like to run?');
      const textInput = screen.getByTestId('zcode-user-input-text');
      const submitBtn = screen.getByTestId('zcode-user-input-submit');
      expect(textInput).not.toBeNull();
      expect(submitBtn).not.toBeNull();

      // 3. User clicks Allow Once -> runtime returns duplicate / already resolved official noop
      await act(async () => {
        fireEvent.click(allowBtn);
      });

      // Peer receives v4/command for resolveInteraction:
      const resolveReq = f.sent.find(s => s.params?.type === 'resolveInteraction');
      expect(resolveReq).toBeDefined();
      expect(resolveReq.params.payload.interactionId).toBe('perm-tool-1');
      expect(resolveReq.params.payload.answer.optionId).toBe('allowOnce');

      // Official response returns noop / proto.alreadyResolved
      await act(async () => {
        f.response(resolveReq, {
          status: 'noop',
          reasonCode: 'proto.alreadyResolved',
          commandId: resolveReq.params.commandId,
          revisionAtDecision: 1,
        });
      });

      // UI MUST show the official runtime result without claiming false success!
      await waitFor(() => {
        const resultEl = screen.getByTestId('zcode-interaction-result-perm-tool-1');
        expect(resultEl.textContent).toContain('Official result: proto.alreadyResolved (noop)');
      });
    } finally {
      f.dispose();
    }
  });

  it('Stop UI targets foreground execution and is disabled with explanation when restricted (B04)', async () => {
    // A. Restricted runtime
    const restrictedF = createConversationFixture({ runnable: false });
    try {
      await restrictedF.open();

      render(React.createElement(ZCodeConversationView, { conversation: restrictedF.conversation }));

      const stopBtn = screen.getByTestId('zcode-stop-button') as HTMLButtonElement;
      expect(stopBtn.disabled).toBe(true);
      expect(screen.getByTestId('zcode-stop-disabled-reason').textContent).toContain('runtime restricted (official auth-gated)');
    } finally {
      restrictedF.dispose();
    }

    cleanup();

    // B. Runnable runtime with active execution
    const liveF = createConversationFixture({ runnable: true });
    try {
      await liveF.open();

      // Wire active works with foregroundExecutionId and canStop: true
      const activeWorkFrame = structuredClone(successFixture.online);
      activeWorkFrame.logicalFrameId = 'active-work-frame';
      activeWorkFrame.logicalFrameOrdinal = 2;
      activeWorkFrame.frame.fromSeq = 0;
      activeWorkFrame.frame.toSeq = 1;
      activeWorkFrame.frame.payload.deltas = [
        {
          op: 'state.updated',
          patch: {
            control: {
              ...successFixture.initial.frame.payload.snapshot.control,
              canStop: true,
              activeWorks: [
                {
                  kind: 'primaryTurn',
                  foregroundExecutionId: 'exec-target-77',
                  startedAt: Date.now(),
                },
              ],
            },
          },
        },
      ];

      await act(async () => {
        liveF.wire(activeWorkFrame);
        await new Promise(r => setTimeout(r, 20));
      });

      render(React.createElement(ZCodeConversationView, { conversation: liveF.conversation }));

      const stopBtn = screen.getByTestId('zcode-stop-button') as HTMLButtonElement;
      expect(stopBtn.disabled).toBe(false);
      expect(screen.queryByTestId('zcode-stop-disabled-reason')).toBeNull();

      // Click Stop -> submits stop command targeting ONLY expectedForegroundExecutionId
      await act(async () => {
        fireEvent.click(stopBtn);
      });

      const stopReq = liveF.sent.find(s => s.params?.type === 'stop');
      expect(stopReq).toBeDefined();
      expect(stopReq.params.payload.expectedForegroundExecutionId).toBe('exec-target-77');

      // Stop response
      await act(async () => {
        liveF.response(stopReq, {
          status: 'accepted',
          commandId: stopReq.params.commandId,
          revisionAtDecision: 1,
        });
      });
    } finally {
      liveF.dispose();
    }
  });

  it('renders resyncing, sequence gap, and deterministic error with Reconnect button', async () => {
    const f = createConversationFixture();
    try {
      await f.open(gapFixture.initial);

      // 1. Stale/foreign subscription frame from lateframeFixture is safely dropped
      await act(async () => {
        f.wire(lateframeFixture.frame);
        await new Promise(r => setTimeout(r, 10));
      });
      expect(f.conversation.state.status).toBe('live');

      // Advance sequence to 12
      await act(async () => {
        f.wire(gapFixture.advance);
        await new Promise(r => setTimeout(r, 20));
      });

      // Wire gap frame (expected 12 -> 13, received 13 -> 14)
      await act(async () => {
        f.wire(gapFixture.gap);
        await new Promise(r => setTimeout(r, 20));
      });

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      // Sequence gap alert visible
      expect(screen.getByTestId('zcode-gap-alert').textContent).toContain('Sequence gap detected');

      // Resyncing alert visible
      expect(screen.getByTestId('zcode-resyncing-alert').textContent).toContain('Resyncing session state');

      // Now inject deterministic error
      const errState = {
        ...f.conversation.state,
        status: 'error',
        error: new Error('transport-eof'),
      };
      const mockController = new ConversationController(null);
      vi.spyOn(mockController, 'getSnapshot').mockReturnValue(errState as any);
      const connectSpy = vi.spyOn(mockController, 'connect').mockResolvedValue(undefined as any);

      cleanup();
      render(React.createElement(ZCodeConversationView, { controller: mockController }));

      const errorAlert = screen.getByTestId('zcode-error-alert');
      expect(errorAlert.textContent).toContain('Deterministic session error: transport-eof');

      const reconnectBtn = screen.getByTestId('zcode-reconnect-button');
      expect(reconnectBtn).not.toBeNull();
      fireEvent.click(reconnectBtn);
      expect(connectSpy).toHaveBeenCalled();
    } finally {
      f.dispose();
    }
  });

  it('integrates seamlessly with DSH renderSessionArea seam', async () => {
    const f = createConversationFixture();
    try {
      await f.open();

      const sources = new RuntimeSessions({
        sessions: { list: createSnapshotStore({ ids: [], byId: {} }), retain: vi.fn(), create: vi.fn(), refresh: vi.fn() } as any,
        rpc: { call: vi.fn() } as any,
        nativeAuthority: B02.D1.authority,
      });

      // 1. ZCode reference retained WITH conversation renders ZCodeConversationView
      const zcodeRef = sources.retain(parseRuntimeSessionAddress(B02.Z1), {
        source: 'mainView',
        conversation: f.conversation,
      } as any);

      expect(typeof zcodeRef.renderSessionArea).toBe('function');

      const rendered = renderSessionArea(
        { key: undefined, props: {}, hooks: {}, keyedHooks: {} },
        { session: zcodeRef as any, empty: () => React.createElement('div', { 'data-testid': 'empty-fallback' }, 'Empty') },
      );

      render(rendered as React.ReactElement);
      expect(screen.getByTestId('zcode-conversation-view')).not.toBeNull();
      expect(screen.queryByTestId('empty-fallback')).toBeNull();

      cleanup();

      // 2. ZCode reference WITHOUT conversation falls back to empty() (preserves S02.B FB2-3)
      const bareZcodeRef = sources.retain(parseRuntimeSessionAddress(B02.Z1), { source: 'mainView' });
      expect(bareZcodeRef.renderSessionArea).toBeUndefined();

      const bareRendered = renderSessionArea(
        { key: undefined, props: {}, hooks: {}, keyedHooks: {} },
        { session: bareZcodeRef as any, empty: () => React.createElement('div', { 'data-testid': 'empty-fallback' }, 'Empty') },
      );

      render(bareRendered as React.ReactElement);
      expect(screen.getByTestId('empty-fallback')).not.toBeNull();
      expect(screen.queryByTestId('zcode-conversation-view')).toBeNull();
    } finally {
      f.dispose();
    }
  });

  it('renders official headless unmodeled draft session in real DOM without model calls', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'zcode-s03b-oracle-'));
    const installation = await inspectInstallation();
    if (!installation.verified) throw new Error('Official runtime identity mismatch');
    expect(installation.sha256).toBe(officialFixture.provenance.sha256);

    const child = spawn(installation.launcher, [installation.cjs, 'app-server', '--stdio'], {
      cwd: workspacePath,
      env: runtimeEnv(installation.providerConfig),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const exited = new Promise(r => child.once('close', r));
    const peer = new ProtocolPeer(child.stdout, child.stdin, { timeoutMs: 15000 });
    const workspace = { workspacePath, workspaceKey: workspacePath };

    let conversation: V4Conversation | undefined;
    try {
      await peer.request('runtime/capabilities', {});
      const draft = await peer.request('v4/command', {
        commandId: randomUUID(),
        clientId: 's03b-oracle',
        sessionId: null,
        type: 'createSession',
        payload: { workspaceId: workspacePath },
        issuedAt: Date.now(),
      });
      const sessionId = draft?.result?.sessionId;
      expect(sessionId).toBeTruthy();

      conversation = new V4Conversation(peer, {
        address: { runtime: 'zcode', authority: 'official-headless', workspace: workspacePath, sessionId },
        workspace,
        connectionId: 's03b-oracle-conn',
        clientId: 's03b-oracle-client',
        runnable: true,
      });

      await conversation.connect();
      expect(['live', 'idle', 'connecting']).toContain(conversation.state.status);

      // Render to DOM
      render(React.createElement(ZCodeConversationView, { conversation }));

      expect(screen.getByTestId('zcode-conversation-view')).not.toBeNull();
      expect(screen.getByTestId('zcode-status-badge')).not.toBeNull();
      expect(screen.getByTestId('zcode-auth-note').textContent).toContain('restricted');

      console.log(JSON.stringify({
        oracle: 'official-runtime-conversation-render',
        status: conversation.state.status,
        logEpoch: conversation.state.logEpoch,
        paidModelCalls: 0,
        sharedSessions: 'unverified',
      }));
    } finally {
      if (conversation) await conversation.cancel();
      peer.close();
      await stopOwned(child, exited);
      await rm(workspacePath, { recursive: true, force: true });
    }
  });
});
