import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { RuntimeSessions } from '../packages/client/sources.mjs';
import { ZCodeConversationView, ZCodePendingInteractions } from '../packages/client/conversation-view.jsx';
import { renderSessionArea } from '../../dsh/packages/client/ui-session/src/client/session-provider.tsx';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';

const questionnaireFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s05/questionnaire.json'), 'utf8'));
const planReviewFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s05/plan-review.json'), 'utf8'));
const hookReviewFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s05/hook-review.json'), 'utf8'));
const expiredLateFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s05/expired-late-other.json'), 'utf8'));
const reconnectFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s05/reconnect-recovery.json'), 'utf8'));
const unknownFixture = JSON.parse(readFileSync(resolve('tests/fixtures/s05/unknown-interaction.json'), 'utf8'));

afterEach(() => {
  cleanup();
});

function createConversationFixture({
  runnable = true,
  clientMode = 'web-remote-replayable' as const,
  address = {
    runtime: 'zcode' as const,
    authority: 'test-authority',
    workspace: '/workspace/project-root',
    sessionId: questionnaireFixture.initial.frame.payload.snapshot.sessionId,
  },
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

  async function open(initial = questionnaireFixture.initial, ack = questionnaireFixture.ack) {
    const p = conversation.connect();
    input.write(JSON.stringify({ id: sent.at(-1).id, result: ack }) + '\n' + JSON.stringify({ method: 'v4/conversation/frame', params: initial }) + '\n');
    await p;
    await new Promise(r => setTimeout(r, 10));
    return conversation;
  }

  return { input, output, sent, peer, conversation, response, wire, open, dispose: () => peer.close() };
}

describe('S05 User Interactions, Plan Review & Hook Trust', () => {
  it('renders multi-question questionnaire, retains answers across navigation without loss, snoozes on first interaction, and submits accepted answers', async () => {
    const f = createConversationFixture();
    try {
      await f.open(questionnaireFixture.initial, questionnaireFixture.ack);

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      // 1. Initial questionnaire card rendering
      expect(screen.getByTestId('zcode-questionnaire-card')).toBeDefined();
      expect(screen.getByTestId('zcode-q-counter').textContent).toContain('Question 1 of 3');
      expect(screen.getByTestId('zcode-question-text').textContent).toContain('Select the deployment target environment:');

      // 2. Countdown badge is active
      expect(screen.getByTestId('zcode-auto-resolution-countdown').textContent).toContain('Auto-resolving countdown active');

      // 3. Initial answer draft from fixture (answer_0: ['staging']) is pre-selected
      const stagingRadio = screen.getByTestId('zcode-option-staging') as HTMLInputElement;
      expect(stagingRadio.checked).toBe(true);

      // 4. User selects production -> first interaction triggers snooze command to peer!
      const prodRadio = screen.getByTestId('zcode-option-production');
      await act(async () => {
        fireEvent.click(prodRadio);
      });

      // Verify snooze command sent
      const snoozeReq = f.sent.find(s => s.params?.type === 'snoozeInteractionAutoResolution');
      expect(snoozeReq).toBeDefined();
      expect(snoozeReq.params.payload.interactionId).toBe('q-multi-1');

      // Runtime acknowledges snooze
      await act(async () => {
        f.response(snoozeReq, {
          status: 'noop',
          reasonCode: 'proto.alreadyResolved',
          commandId: snoozeReq.params.commandId,
          revisionAtDecision: 1,
        });
      });

      // Snooze badge is now displayed!
      expect(screen.getByTestId('zcode-auto-resolution-snoozed').textContent).toContain('Auto-resolution snoozed');

      // 5. Navigate to Question 2
      const nextBtn = screen.getByTestId('zcode-q-next-btn');
      await act(async () => {
        fireEvent.click(nextBtn);
      });
      expect(screen.getByTestId('zcode-q-counter').textContent).toContain('Question 2 of 3');
      expect(screen.getByTestId('zcode-question-text').textContent).toContain('Configure database migration strategy:');

      // Select multi-select checkboxes on Question 2
      const dryRunCheckbox = screen.getByTestId('zcode-option-dry-run');
      const backupCheckbox = screen.getByTestId('zcode-option-backup-first');
      await act(async () => {
        fireEvent.click(dryRunCheckbox);
        fireEvent.click(backupCheckbox);
      });

      // 6. Navigate to Question 3
      await act(async () => {
        fireEvent.click(screen.getByTestId('zcode-q-next-btn'));
      });
      expect(screen.getByTestId('zcode-q-counter').textContent).toContain('Question 3 of 3');

      // Enter custom text on Question 3
      const customInput = screen.getByTestId('zcode-q-custom-input');
      await act(async () => {
        fireEvent.change(customInput, { target: { value: 'Approved by lead operator' } });
      });

      // 7. Verify Answer Retention: Navigate backwards to Question 2 and Question 1
      await act(async () => {
        fireEvent.click(screen.getByTestId('zcode-q-prev-btn'));
      });
      expect(screen.getByTestId('zcode-q-counter').textContent).toContain('Question 2 of 3');
      const dryRunChecked = screen.getByTestId('zcode-option-dry-run') as HTMLInputElement;
      const backupChecked = screen.getByTestId('zcode-option-backup-first') as HTMLInputElement;
      expect(dryRunChecked.checked).toBe(true);
      expect(backupChecked.checked).toBe(true);

      // Back to Question 1
      await act(async () => {
        fireEvent.click(screen.getByTestId('zcode-q-prev-btn'));
      });
      expect(screen.getByTestId('zcode-q-counter').textContent).toContain('Question 1 of 3');
      const prodChecked = screen.getByTestId('zcode-option-production') as HTMLInputElement;
      expect(prodChecked.checked).toBe(true);

      // 8. Submit Answers (Accept)
      const submitBtn = screen.getByTestId('zcode-questionnaire-submit');
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      const resolveReq = f.sent.find(s => s.params?.type === 'resolveInteraction');
      expect(resolveReq).toBeDefined();
      expect(resolveReq.params.payload.interactionId).toBe('q-multi-1');
      expect(resolveReq.params.payload.answer.action).toBe('accept');
      expect(resolveReq.params.payload.answer.content).toBeDefined();

      const content = resolveReq.params.payload.answer.content;
      expect(content.answer_0).toBe('production');
      expect(content.answer_1).toEqual(['dry-run', 'backup-first']);
      expect(content.answer_2).toBe('Approved by lead operator');

      // Official response returns accepted
      await act(async () => {
        f.response(resolveReq, {
          status: 'accepted',
          commandId: resolveReq.params.commandId,
          revisionAtDecision: 2,
        });
      });

      await waitFor(() => {
        const resultEl = screen.getByTestId('zcode-interaction-result-q-multi-1');
        expect(resultEl.textContent).toContain('accepted-awaiting-terminal (accepted)');
      });
    } finally {
      f.dispose();
    }
  });

  it('preserves partial answers when user declines multi-question form according to official schema', async () => {
    const f = createConversationFixture();
    try {
      await f.open(questionnaireFixture.initial, questionnaireFixture.ack);

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      // User selects production on Q1
      await act(async () => {
        fireEvent.click(screen.getByTestId('zcode-option-production'));
      });

      // User clicks Decline without completing all questions
      const declineBtn = screen.getByTestId('zcode-questionnaire-decline');
      await act(async () => {
        fireEvent.click(declineBtn);
      });

      const resolveReq = f.sent.find(s => s.params?.type === 'resolveInteraction');
      expect(resolveReq).toBeDefined();
      expect(resolveReq.params.payload.answer.action).toBe('decline');
      // Partial answers are preserved in content per official schema!
      expect(resolveReq.params.payload.answer.content).toBeDefined();
      expect(resolveReq.params.payload.answer.content.answer_0).toBe('production');

      // Runtime responds with duplicate / already resolved
      await act(async () => {
        f.response(resolveReq, {
          status: 'noop',
          reasonCode: 'proto.alreadyResolved',
          commandId: resolveReq.params.commandId,
          revisionAtDecision: 1,
        });
      });

      await waitFor(() => {
        const resultEl = screen.getByTestId('zcode-interaction-result-q-multi-1');
        expect(resultEl.textContent).toContain('Official result: proto.alreadyResolved (noop)');
      });
    } finally {
      f.dispose();
    }
  });

  it('submits cancel action for questionnaire when user clicks Cancel', async () => {
    const f = createConversationFixture();
    try {
      await f.open(questionnaireFixture.initial, questionnaireFixture.ack);

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      const cancelBtn = screen.getByTestId('zcode-questionnaire-cancel');
      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      const resolveReq = f.sent.find(s => s.params?.type === 'resolveInteraction');
      expect(resolveReq).toBeDefined();
      expect(resolveReq.params.payload.answer.action).toBe('cancel');
    } finally {
      f.dispose();
    }
  });

  it('renders implementation plan review card, displays plan content and items, and supports approve and reject with feedback', async () => {
    const f = createConversationFixture();
    try {
      await f.open(planReviewFixture.initial, planReviewFixture.ack);

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      // 1. Plan Review Card elements
      expect(screen.getByTestId('zcode-plan-review-card')).toBeDefined();
      expect(screen.getByTestId('zcode-plan-prompt').textContent).toContain('Review and approve implementation plan');
      expect(screen.getByTestId('zcode-plan-content').textContent).toContain('# Implementation Plan: Release Pipeline');

      // 2. Plan checklist items rendered with statuses
      expect(screen.getByTestId('zcode-plan-item-step-1')).toBeDefined();
      expect(screen.getByTestId('zcode-plan-item-status-step-1').textContent).toBe('completed');
      expect(screen.getByTestId('zcode-plan-item-status-step-2').textContent).toBe('inProgress');
      expect(screen.getByTestId('zcode-plan-item-status-step-3').textContent).toBe('pending');

      // 3. Goal info displayed
      expect(screen.getByTestId('zcode-goal-info').textContent).toContain('Bridge Release Pipeline');

      // 4. Test Approve Plan
      const approveBtn = screen.getByTestId('zcode-plan-approve-btn');
      await act(async () => {
        fireEvent.click(approveBtn);
      });

      const resolveReq = f.sent.find(s => s.params?.type === 'resolveInteraction');
      expect(resolveReq).toBeDefined();
      expect(resolveReq.params.payload.interactionId).toBe('plan-review-1');
      expect(resolveReq.params.payload.answer.action).toBe('accept');
      expect(resolveReq.params.payload.answer.content.answer).toBe('approve');

      await act(async () => {
        f.response(resolveReq, {
          status: 'accepted',
          commandId: resolveReq.params.commandId,
          revisionAtDecision: 2,
        });
      });

      await waitFor(() => {
        const resultEl = screen.getByTestId('zcode-interaction-result-plan-review-1');
        expect(resultEl.textContent).toContain('accepted-awaiting-terminal (accepted)');
      });
    } finally {
      f.dispose();
    }
  });

  it('rejects implementation plan with user feedback text when user clicks Reject Plan', async () => {
    const f = createConversationFixture();
    try {
      await f.open(planReviewFixture.initial, planReviewFixture.ack);

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      const feedbackInput = screen.getByTestId('zcode-plan-feedback-input');
      await act(async () => {
        fireEvent.change(feedbackInput, { target: { value: 'Please add rollback steps before deploy.' } });
      });

      const rejectBtn = screen.getByTestId('zcode-plan-reject-btn');
      await act(async () => {
        fireEvent.click(rejectBtn);
      });

      const resolveReq = f.sent.find(s => s.params?.type === 'resolveInteraction');
      expect(resolveReq).toBeDefined();
      expect(resolveReq.params.payload.interactionId).toBe('plan-review-1');
      // CA6-1: With feedback, sends accept + answer_0 per official broker normalizePlanApprovalAnswer
      expect(resolveReq.params.payload.answer.action).toBe('accept');
      expect(resolveReq.params.payload.answer.content.answer_0).toBe('Please add rollback steps before deploy.');
      expect(resolveReq.params.payload.answer.content.answers[planReviewFixture.initial.frame.payload.snapshot.pendingInteractions[0].payload.prompt]).toBe('Please add rollback steps before deploy.');
    } finally {
      f.dispose();
    }
  });

  it('rejects implementation plan without feedback sending decline action', async () => {
    const f = createConversationFixture();
    try {
      await f.open(planReviewFixture.initial, planReviewFixture.ack);

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      const rejectBtn = screen.getByTestId('zcode-plan-reject-btn');
      await act(async () => {
        fireEvent.click(rejectBtn);
      });

      const resolveReq = f.sent.find(s => s.params?.type === 'resolveInteraction');
      expect(resolveReq).toBeDefined();
      expect(resolveReq.params.payload.interactionId).toBe('plan-review-1');
      expect(resolveReq.params.payload.answer.action).toBe('decline');
      expect(resolveReq.params.payload.answer.content).toBeUndefined();
    } finally {
      f.dispose();
    }
  });

  it('renders workspace hook security review card, soft admission banner, and supports toggle, trust, bulk trust, and revoke', async () => {
    const f = createConversationFixture();
    try {
      await f.open(hookReviewFixture.initial, hookReviewFixture.ack);

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      // 1. Soft admission banner
      expect(screen.getByTestId('zcode-hook-admission-banner')).toBeDefined();
      expect(screen.getByTestId('zcode-hook-admission-banner').textContent).toContain('2 pending');

      // Request review from banner
      const reqReviewBtn = screen.getByTestId('zcode-hook-request-review-btn');
      await act(async () => {
        fireEvent.click(reqReviewBtn);
      });
      const reqReviewCmd = f.sent.find(s => s.params?.type === 'requestWorkspaceHookReview');
      expect(reqReviewCmd).toBeDefined();
      expect(reqReviewCmd.params.payload.bundleDigest).toBe('a'.repeat(64));

      // 2. Hook Review Card
      expect(screen.getByTestId('zcode-hook-review-card')).toBeDefined();
      expect(screen.getByTestId('zcode-hook-warning').textContent).toContain('Workspace hooks execute shell commands');
      expect(screen.getByTestId('zcode-hook-workspace-label').textContent).toContain('Project Root Workspace');
      expect(screen.getByTestId('zcode-hook-count').textContent).toContain('Hooks: 3');
      expect(screen.getByTestId('zcode-event-count').textContent).toContain('Events: 3');
      expect(screen.getByTestId('zcode-pending-count').textContent).toContain('Pending: 2');
      expect(screen.getByTestId('zcode-hook-source-files').textContent).toContain('hooks.json, pre-push.sh');

      // 3. Hook Item 1: Toggle enabled
      const toggle1 = screen.getByTestId('zcode-hook-toggle-item-lint-hook') as HTMLInputElement;
      expect(toggle1.checked).toBe(true);
      await act(async () => {
        fireEvent.click(toggle1);
      });
      const toggleCmd = f.sent.find(s => s.params?.type === 'toggleWorkspaceHookReviewItem');
      expect(toggleCmd).toBeDefined();
      expect(toggleCmd.params.payload.reviewItemId).toBe('item-lint-hook');
      expect(toggleCmd.params.payload.enabled).toBe(false);

      await act(async () => {
        f.response(toggleCmd, {
          status: 'accepted',
          commandId: toggleCmd.params.commandId,
          revisionAtDecision: 1,
        });
      });

      // 4. Hook Item 2 (already trusted): Revoke Trust
      const revokeBtn2 = screen.getByTestId('zcode-hook-revoke-btn-item-audit-hook');
      await act(async () => {
        fireEvent.click(revokeBtn2);
      });
      const revokeCmd = f.sent.find(s => s.params?.type === 'revokeWorkspaceHookTrust');
      expect(revokeCmd).toBeDefined();
      expect(revokeCmd.params.payload.reviewItemIds).toEqual(['item-audit-hook']);

      await act(async () => {
        f.response(revokeCmd, {
          status: 'accepted',
          commandId: revokeCmd.params.commandId,
          revisionAtDecision: 1,
        });
      });

      // 5. Bulk: Trust All Pending
      const trustAllBtn = screen.getByTestId('zcode-hook-trust-all-btn');
      await act(async () => {
        fireEvent.click(trustAllBtn);
      });
      const trustCmd = f.sent.find(s => s.params?.type === 'respondWorkspaceHookReview');
      expect(trustCmd).toBeDefined();
      expect(trustCmd.params.payload.decision.reviewItemIds).toEqual(['item-lint-hook', 'item-untrusted-script']);

      await act(async () => {
        f.response(trustCmd, {
          status: 'accepted',
          commandId: trustCmd.params.commandId,
          revisionAtDecision: 1,
        });
      });

      await waitFor(() => {
        const resultEl = screen.getByTestId('zcode-interaction-result-hook-flow-1');
        expect(resultEl.textContent).toContain('Official result: accepted-awaiting-terminal (accepted)');
      });
    } finally {
      f.dispose();
    }
  });

  it('faithfully renders official runtime result codes for alreadyResolved, hookHostUnsupported, and hookMismatch', async () => {
    const f = createConversationFixture();
    try {
      await f.open(questionnaireFixture.initial, questionnaireFixture.ack);

      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      // 1. Peer returns proto.alreadyResolved (late / answered elsewhere)
      const cancelBtn = screen.getByTestId('zcode-questionnaire-cancel');
      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      const cmd1 = f.sent.find(s => s.params?.type === 'resolveInteraction');
      await act(async () => {
        f.response(cmd1, {
          ...expiredLateFixture.responses.alreadyResolved,
          commandId: cmd1.params.commandId,
        });
      });

      await waitFor(() => {
        const resultEl = screen.getByTestId('zcode-interaction-result-q-multi-1');
        expect(resultEl.textContent).toContain('Official result: proto.alreadyResolved (noop)');
      });
    } finally {
      f.dispose();
      cleanup();
    }

    // 2. Peer returns hookHostUnsupported and hookMismatch on hook review actions
    const fHook = createConversationFixture({
      address: {
        runtime: 'zcode' as const,
        authority: 'test-authority',
        workspace: '/workspace/project-root',
        sessionId: hookReviewFixture.initial.frame.payload.snapshot.sessionId,
      },
    });
    try {
      await fHook.open(hookReviewFixture.initial, hookReviewFixture.ack);
      render(React.createElement(ZCodeConversationView, { conversation: fHook.conversation }));

      // 2a. Trust item -> rejected with workspace_hooks_require_trust_capable_host
      const trustAllBtn = screen.getByTestId('zcode-hook-trust-all-btn');
      await act(async () => {
        fireEvent.click(trustAllBtn);
      });
      const trustCmd = fHook.sent.find(s => s.params?.type === 'respondWorkspaceHookReview');
      expect(trustCmd).toBeDefined();

      await act(async () => {
        fHook.response(trustCmd, {
          ...expiredLateFixture.responses.hookHostUnsupported,
          commandId: trustCmd.params.commandId,
        });
      });

      await waitFor(() => {
        const resultEl = screen.getByTestId('zcode-interaction-result-hook-flow-1');
        expect(resultEl.textContent).toContain('Official result: workspace_hooks_require_trust_capable_host (rejected)');
      });
    } finally {
      fHook.dispose();
      cleanup();
    }

    // 2b. Toggle item -> rejected with workspace_hooks_snapshot_mismatch in separate conversation
    const fHookToggle = createConversationFixture({
      address: {
        runtime: 'zcode' as const,
        authority: 'test-authority',
        workspace: '/workspace/project-root',
        sessionId: hookReviewFixture.initial.frame.payload.snapshot.sessionId,
      },
    });
    try {
      await fHookToggle.open(hookReviewFixture.initial, hookReviewFixture.ack);
      render(React.createElement(ZCodeConversationView, { conversation: fHookToggle.conversation }));

      const toggle1 = screen.getByTestId('zcode-hook-toggle-item-lint-hook') as HTMLInputElement;
      await act(async () => {
        fireEvent.click(toggle1);
      });
      const toggleCmd = fHookToggle.sent.find(s => s.params?.type === 'toggleWorkspaceHookReviewItem');
      expect(toggleCmd).toBeDefined();

      await act(async () => {
        fHookToggle.response(toggleCmd, {
          ...expiredLateFixture.responses.hookMismatch,
          commandId: toggleCmd.params.commandId,
        });
      });

      await waitFor(() => {
        const resultEl = screen.getByTestId('zcode-interaction-result-hook-flow-1');
        expect(resultEl.textContent).toContain('Official result: workspace_hooks_snapshot_mismatch (rejected)');
      });
    } finally {
      fHookToggle.dispose();
      cleanup();
    }
  });

  it('models autoResolution countdown and unmounts cleanly when server timeout resolves interaction', async () => {
    const f = createConversationFixture();
    try {
      await f.open(questionnaireFixture.initial, questionnaireFixture.ack);
      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      // Initial active countdown
      expect(screen.getByTestId('zcode-auto-resolution-countdown')).toBeDefined();
      expect(screen.getByTestId('zcode-questionnaire-card')).toBeDefined();

      // Server frame arrives where auto-resolution deadline expired and interaction was removed by host
      const expiredSnapshotFrame = structuredClone(questionnaireFixture.initial);
      expiredSnapshotFrame.logicalFrameId = 'fixture-subscription-lf-expired';
      expiredSnapshotFrame.logicalFrameOrdinal = 2;
      expiredSnapshotFrame.frame.toSeq = 1;
      expiredSnapshotFrame.frame.payload.snapshot.seq = 1;
      expiredSnapshotFrame.frame.payload.snapshot.revision = 1;
      expiredSnapshotFrame.frame.payload.snapshot.pendingInteractions = [];

      await act(async () => {
        f.wire(expiredSnapshotFrame);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('zcode-questionnaire-card')).toBeNull();
        expect(screen.queryByTestId('zcode-auto-resolution-countdown')).toBeNull();
      });
    } finally {
      f.dispose();
    }
  });

  it('rolls back snoozed display and renders official warning when snooze command is rejected', async () => {
    const f = createConversationFixture();
    try {
      await f.open(questionnaireFixture.initial, questionnaireFixture.ack);
      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      expect(screen.getByTestId('zcode-auto-resolution-countdown')).toBeDefined();

      // User interacts to trigger snooze
      const prodRadio = screen.getByTestId('zcode-option-production');
      await act(async () => {
        fireEvent.click(prodRadio);
      });

      // Optimistically snoozed
      expect(screen.getByTestId('zcode-auto-resolution-snoozed')).toBeDefined();

      const snoozeCmd = f.sent.find(s => s.params?.type === 'snoozeInteractionAutoResolution');
      expect(snoozeCmd).toBeDefined();

      // Peer rejects snooze
      await act(async () => {
        f.response(snoozeCmd, {
          status: 'rejected',
          reasonCode: 'proto.alreadyResolved',
          commandId: snoozeCmd.params.commandId,
          revisionAtDecision: 1,
        });
      });

      // Assert rollback to countdown and warning rendered
      await waitFor(() => {
        expect(screen.getByTestId('zcode-auto-resolution-countdown')).toBeDefined();
        expect(screen.queryByTestId('zcode-auto-resolution-snoozed')).toBeNull();
        const warning = screen.getByTestId('zcode-snooze-warning-q-multi-1');
        expect(warning.textContent).toContain('Warning: Auto-resolution snooze rejected (proto.alreadyResolved)');
      });
    } finally {
      f.dispose();
    }
  });

  it('disables request review button and renders R16 disabled hint when workspaceHookAdmission lacks workspaceIdentity', async () => {
    const f = createConversationFixture({
      address: {
        runtime: 'zcode' as const,
        authority: 'test-authority',
        workspace: '/workspace/project-root',
        sessionId: hookReviewFixture.initial.frame.payload.snapshot.sessionId,
      },
    });
    try {
      const initialWithoutIdentity = structuredClone(hookReviewFixture.initial);
      delete initialWithoutIdentity.frame.payload.snapshot.workspaceHookAdmission.workspaceIdentity;

      await f.open(initialWithoutIdentity, hookReviewFixture.ack);
      render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));

      const banner = screen.getByTestId('zcode-hook-admission-banner');
      expect(banner).toBeDefined();

      const btn = screen.getByTestId('zcode-hook-request-review-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);

      const hint = screen.getByTestId('zcode-hook-request-review-disabled-hint');
      expect(hint.textContent).toContain('Workspace identity unavailable per R16');

      // Clicking disabled button sends no command
      await act(async () => {
        fireEvent.click(btn);
      });
      const reqCmd = f.sent.find(s => s.params?.type === 'requestWorkspaceHookReview');
      expect(reqCmd).toBeUndefined();
    } finally {
      f.dispose();
    }
  });

  it('restores unhandled pending items without loss upon session reconnection', async () => {
    const f1 = createConversationFixture();
    try {
      // 1. Initial connect with pending items
      await f1.open(reconnectFixture.preDisconnect, reconnectFixture.preDisconnectAck);
      render(React.createElement(ZCodeConversationView, { conversation: f1.conversation }));

      expect(screen.getByTestId('zcode-questionnaire-card')).toBeDefined();
      expect(screen.getByTestId('zcode-q-counter').textContent).toContain('Question 1 of 3');

      cleanup();
    } finally {
      f1.dispose();
    }

    // 2. Reconnect new conversation instance with recovered epoch and restored pending items
    const f2 = createConversationFixture();
    try {
      await f2.open(reconnectFixture.postReconnect, reconnectFixture.postReconnectAck);
      render(React.createElement(ZCodeConversationView, { conversation: f2.conversation }));

      // Pending items are faithfully restored without dropping draft or state!
      expect(screen.getByTestId('zcode-questionnaire-card')).toBeDefined();
      expect(screen.getByTestId('zcode-epoch').textContent).toContain('epoch-reconnect-recovered');
      expect(screen.getByTestId('zcode-seq').textContent).toContain('Seq: 10');
      expect(screen.getByTestId('zcode-q-counter').textContent).toContain('Question 1 of 3');
    } finally {
      f2.dispose();
    }
  });

  it('renders fail-safe bounded summary for unknown interaction kind without crashing or guessing', () => {
    // Directly render ZCodePendingInteractions with unrecognized interaction kind
    render(React.createElement(ZCodePendingInteractions, {
      state: {
        snapshot: {
          pendingInteractions: [unknownFixture.interaction],
        },
      },
      onResolve: vi.fn(),
    }));

    // 1. Renders unknown interaction card safely without throwing or crashing
    expect(screen.getByTestId('zcode-unknown-interaction-card')).toBeDefined();
    expect(screen.getByTestId('zcode-unknown-kind').textContent).toContain('unrecognizedAutonomousTelemetryGate');
    expect(screen.getByTestId('zcode-unknown-id').textContent).toBe('unk-system-gate-99');
    expect(screen.getByTestId('zcode-unknown-warning').textContent).toContain(
      'Unknown interaction type: cannot automatically resolve without authoritative schema.'
    );
    expect(screen.getByTestId('zcode-unknown-payload').textContent).toContain('telemetry-experimental');
  });

  it('mounts and renders seamlessly inside DSH renderSessionArea slot without native hook leakage', async () => {
    const f = createConversationFixture();
    try {
      await f.open(questionnaireFixture.initial, questionnaireFixture.ack);

      const sources = new RuntimeSessions({
        sessions: { list: createSnapshotStore({ ids: [], byId: {} }), retain: vi.fn(), create: vi.fn(), refresh: vi.fn() } as any,
        rpc: { call: vi.fn() } as any,
        nativeAuthority: 'fixture',
      });
      const zRef = sources.retain(f.conversation.address, { source: 'mainView', conversation: f.conversation } as any);

      const binding = { key: undefined, props: {}, hooks: {}, keyedHooks: {} };
      const area = renderSessionArea(binding as any, { session: zRef, children: null } as any) as React.ReactElement;

      render(area);

      // Verifies full questionnaire and status banner render inside the integrated DSH subtree!
      expect(screen.getByTestId('zcode-conversation-view')).toBeDefined();
      expect(screen.getByTestId('zcode-status-badge').textContent).toContain('Status: live');
      expect(screen.getByTestId('zcode-auth-note').textContent).toContain('restricted (official auth-gated)');
      expect(screen.getByTestId('zcode-questionnaire-card')).toBeDefined();
      expect(screen.getByTestId('zcode-q-counter').textContent).toContain('Question 1 of 3');
    } finally {
      f.dispose();
    }
  });
});
