import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';

const hookFixture = JSON.parse(readFileSync(resolve('tests/fixtures/interaction-plan-review-trust/hook-review.json'), 'utf8'));
const qFixture = JSON.parse(readFileSync(resolve('tests/fixtures/interaction-plan-review-trust/questionnaire.json'), 'utf8'));
const planFixture = JSON.parse(readFileSync(resolve('tests/fixtures/interaction-plan-review-trust/plan-review.json'), 'utf8'));

function createTestConversation({ runnable = true } = {}) {
  const input = new PassThrough();
  const output = new PassThrough();
  const sent = [];
  output.on('data', b => sent.push(JSON.parse(b.toString())));
  const peer = new ProtocolPeer(input, output, { timeoutMs: 100 });
  const address = {
    runtime: 'zcode',
    authority: 'test-authority',
    workspace: '/workspace/project-root',
    sessionId: hookFixture.initial.frame.payload.snapshot.sessionId,
  };
  const conversation = new V4Conversation(peer, {
    address,
    workspace: { workspacePath: address.workspace, workspaceKey: address.workspace },
    clientId: 'fixture-client',
    connectionId: 'fixture-connection',
    runnable,
    frameTimeoutMs: 200,
  });

  const response = (req, result) => {
    input.write(JSON.stringify({ id: req.id, result }) + '\n');
  };

  const wire = (frame) => {
    input.write(JSON.stringify({ method: 'v4/conversation/frame', params: frame }) + '\n');
  };

  async function open(initial = hookFixture.initial, ack = hookFixture.ack) {
    const p = conversation.connect();
    input.write(JSON.stringify({ id: sent.at(-1).id, result: ack }) + '\n' + JSON.stringify({ method: 'v4/conversation/frame', params: initial }) + '\n');
    await p;
    await new Promise(r => setTimeout(r, 10));
    return conversation;
  }

  return { input, output, sent, peer, conversation, response, wire, open, dispose: () => peer.close() };
}

describe('V4Conversation Interaction Commands & Carrier Enforcement', () => {
  it('enforces interaction-unconfirmed for unconfirmed snooze, hook review, and toggle commands', async () => {
    const f = createTestConversation();
    try {
      await f.open();

      // 1. Snooze for non-existent interaction fails with interaction-unconfirmed
      await assert.rejects(
        () => f.conversation.submit({
          type: 'snoozeInteractionAutoResolution',
          payload: { interactionId: 'non-existent-interaction-id' },
        }),
        err => err.code === 'interaction-unconfirmed'
      );

      // 2. Respond hook review for non-existent interaction fails with interaction-unconfirmed
      const target = {
        sessionId: f.conversation.address.sessionId,
        taskId: 't-1',
        runId: 'r-1',
        workspaceIdentity: '/workspace/project-root',
        bundleDigest: 'a'.repeat(64),
        reviewFlowId: 'f-1',
        generation: 1,
        interactionId: 'unconfirmed-hook-interaction',
      };
      await assert.rejects(
        () => f.conversation.submit({
          type: 'respondWorkspaceHookReview',
          payload: { ...target, decision: { action: 'trust_selected', reviewItemIds: ['item-1'] } },
        }),
        err => err.code === 'interaction-unconfirmed'
      );

      // 3. Toggle hook item for non-existent interaction fails with interaction-unconfirmed
      await assert.rejects(
        () => f.conversation.submit({
          type: 'toggleWorkspaceHookReviewItem',
          payload: { ...target, reviewItemId: 'item-1', enabled: true },
        }),
        err => err.code === 'interaction-unconfirmed'
      );

      // 4. Revoke with unconfirmed flow interactionId fails with interaction-unconfirmed
      await assert.rejects(
        () => f.conversation.submit({
          type: 'revokeWorkspaceHookTrust',
          payload: { ...target, reviewItemIds: ['item-1'] },
        }),
        err => err.code === 'interaction-unconfirmed'
      );
    } finally {
      f.dispose();
    }
  });

  it('submits confirmed hook review, toggle, and revoke commands with verified wire shape', async () => {
    const f = createTestConversation();
    try {
      await f.open();

      const hookInteraction = hookFixture.initial.frame.payload.snapshot.pendingInteractions[0];
      const target = {
        sessionId: hookInteraction.payload.sessionId,
        taskId: hookInteraction.payload.taskId,
        runId: hookInteraction.payload.runId,
        workspaceIdentity: hookInteraction.payload.workspaceIdentity,
        bundleDigest: hookInteraction.payload.bundleDigest,
        reviewFlowId: hookInteraction.payload.reviewFlowId,
        generation: hookInteraction.payload.generation,
        interactionId: hookInteraction.payload.interactionId,
      };

      // 1. Submit respondWorkspaceHookReview
      const trustPromise = f.conversation.submit({
        type: 'respondWorkspaceHookReview',
        payload: {
          ...target,
          decision: { action: 'trust_selected', reviewItemIds: ['item-lint-hook'] },
        },
      });
      const trustReq = f.sent.find(s => s.params?.type === 'respondWorkspaceHookReview');
      assert.ok(trustReq, 'respondWorkspaceHookReview request should be sent');
      assert.equal(trustReq.params.payload.interactionId, 'hook-flow-1');
      assert.deepEqual(trustReq.params.payload.decision.reviewItemIds, ['item-lint-hook']);

      f.response(trustReq, {
        status: 'accepted',
        commandId: trustReq.params.commandId,
        revisionAtDecision: 1,
      });
      const trustRecord = await trustPromise;
      assert.equal(trustRecord.state, 'accepted-awaiting-terminal');

      // 2. Submit toggleWorkspaceHookReviewItem
      const togglePromise = f.conversation.submit({
        type: 'toggleWorkspaceHookReviewItem',
        payload: {
          ...target,
          reviewItemId: 'item-lint-hook',
          enabled: false,
        },
      });
      const toggleReq = f.sent.find(s => s.params?.type === 'toggleWorkspaceHookReviewItem');
      assert.ok(toggleReq, 'toggleWorkspaceHookReviewItem request should be sent');
      assert.equal(toggleReq.params.payload.enabled, false);

      f.response(toggleReq, {
        status: 'accepted',
        commandId: toggleReq.params.commandId,
        revisionAtDecision: 1,
      });
      const toggleRecord = await togglePromise;
      assert.equal(toggleRecord.state, 'accepted-awaiting-terminal');

      // 3. Submit revokeWorkspaceHookTrust (flow-based)
      const revokePromise = f.conversation.submit({
        type: 'revokeWorkspaceHookTrust',
        payload: {
          ...target,
          reviewItemIds: ['item-audit-hook'],
        },
      });
      const revokeReq = f.sent.find(s => s.params?.type === 'revokeWorkspaceHookTrust');
      assert.ok(revokeReq, 'revokeWorkspaceHookTrust request should be sent');
      assert.deepEqual(revokeReq.params.payload.reviewItemIds, ['item-audit-hook']);

      f.response(revokeReq, {
        status: 'accepted',
        commandId: revokeReq.params.commandId,
        revisionAtDecision: 1,
      });
      const revokeRecord = await revokePromise;
      assert.equal(revokeRecord.state, 'accepted-awaiting-terminal');

      // 4. Submit requestWorkspaceHookReview (soft admission)
      const reqReviewPromise = f.conversation.submit({
        type: 'requestWorkspaceHookReview',
        payload: {
          sessionId: target.sessionId,
          workspaceIdentity: target.workspaceIdentity,
          bundleDigest: target.bundleDigest,
        },
      });
      const reqReviewReq = f.sent.find(s => s.params?.type === 'requestWorkspaceHookReview');
      assert.ok(reqReviewReq, 'requestWorkspaceHookReview request should be sent');
      assert.equal(reqReviewReq.params.payload.bundleDigest, target.bundleDigest);

      f.response(reqReviewReq, {
        status: 'accepted',
        commandId: reqReviewReq.params.commandId,
        revisionAtDecision: 1,
      });
      const reqReviewRecord = await reqReviewPromise;
      assert.equal(reqReviewRecord.state, 'accepted-awaiting-terminal');
    } finally {
      f.dispose();
    }
  });

  it('submits snooze command for confirmed questionnaire and accepts official noop', async () => {
    const f = createTestConversation();
    try {
      await f.open(qFixture.initial, qFixture.ack);

      const qInteraction = qFixture.initial.frame.payload.snapshot.pendingInteractions[0];
      const snoozePromise = f.conversation.submit({
        type: 'snoozeInteractionAutoResolution',
        payload: { interactionId: qInteraction.interactionId },
      });

      const snoozeReq = f.sent.find(s => s.params?.type === 'snoozeInteractionAutoResolution');
      assert.ok(snoozeReq, 'snoozeInteractionAutoResolution should be sent');
      assert.equal(snoozeReq.params.payload.interactionId, 'q-multi-1');

      f.response(snoozeReq, {
        status: 'noop',
        reasonCode: 'proto.alreadyResolved',
        commandId: snoozeReq.params.commandId,
        revisionAtDecision: 1,
      });
      const snoozeRecord = await snoozePromise;
      assert.equal(snoozeRecord.state, 'noop');
      assert.equal(snoozeRecord.ack.reasonCode, 'proto.alreadyResolved');
    } finally {
      f.dispose();
    }
  });

  it('submits plan approval resolve commands matching official broker normalization logic', async () => {
    const f = createTestConversation();
    try {
      await f.open(planFixture.initial, planFixture.ack);

      const planInteraction = planFixture.initial.frame.payload.snapshot.pendingInteractions[0];
      const prompt = planInteraction.payload.prompt;

      // 1. Rejection with feedback: wire sends accept + answer_0/answers
      const rejectWithFeedbackPromise = f.conversation.submit({
        type: 'resolveInteraction',
        payload: {
          interactionId: planInteraction.interactionId,
          answer: {
            action: 'accept',
            content: {
              answers: { [prompt]: 'Needs rollback steps' },
              answer_0: 'Needs rollback steps',
              answer: 'Needs rollback steps',
            },
          },
        },
      });

      const reqWithFeedback = f.sent.find(
        s => s.params?.type === 'resolveInteraction' && s.params?.payload?.answer?.action === 'accept'
      );
      assert.ok(reqWithFeedback, 'resolveInteraction for plan reject with feedback should be sent');
      assert.equal(reqWithFeedback.params.payload.answer.action, 'accept');
      assert.equal(reqWithFeedback.params.payload.answer.content.answer_0, 'Needs rollback steps');

      // Verify alignment with official broker normalizePlanApprovalAnswer logic:
      // answers[prompt] ?? answer_0 produces the feedback, which triggers deny with plan_approval_feedback
      const extractedAnswer = reqWithFeedback.params.payload.answer.content.answers[prompt]
        ?? reqWithFeedback.params.payload.answer.content.answer_0;
      assert.equal(extractedAnswer, 'Needs rollback steps');
      assert.notEqual(extractedAnswer, 'approve');

      f.response(reqWithFeedback, {
        status: 'accepted',
        commandId: reqWithFeedback.params.commandId,
        revisionAtDecision: 1,
      });
      const recordFeedback = await rejectWithFeedbackPromise;
      assert.equal(recordFeedback.state, 'accepted-awaiting-terminal');

      // 2. Rejection without feedback: wire sends decline without content
      const rejectNoFeedbackPromise = f.conversation.submit({
        type: 'resolveInteraction',
        payload: {
          interactionId: planInteraction.interactionId,
          answer: {
            action: 'decline',
          },
        },
      });

      const reqNoFeedback = f.sent.find(
        s => s.params?.type === 'resolveInteraction' && s.params?.payload?.answer?.action === 'decline'
      );
      assert.ok(reqNoFeedback, 'resolveInteraction for plan reject without feedback should be sent');
      assert.equal(reqNoFeedback.params.payload.answer.action, 'decline');
      assert.equal(reqNoFeedback.params.payload.answer.content, undefined);

      f.response(reqNoFeedback, {
        status: 'accepted',
        commandId: reqNoFeedback.params.commandId,
        revisionAtDecision: 2,
      });
      const recordNoFeedback = await rejectNoFeedbackPromise;
      assert.equal(recordNoFeedback.state, 'accepted-awaiting-terminal');
    } finally {
      f.dispose();
    }
  });

  it('tracks snooze command rejection and transitions record state to rejected', async () => {
    const f = createTestConversation();
    try {
      await f.open(qFixture.initial, qFixture.ack);

      const qInteraction = qFixture.initial.frame.payload.snapshot.pendingInteractions[0];
      const snoozePromise = f.conversation.submit({
        type: 'snoozeInteractionAutoResolution',
        payload: { interactionId: qInteraction.interactionId },
      });

      const snoozeReq = f.sent.find(s => s.params?.type === 'snoozeInteractionAutoResolution');
      assert.ok(snoozeReq);

      f.response(snoozeReq, {
        status: 'rejected',
        reasonCode: 'proto.alreadyResolved',
        commandId: snoozeReq.params.commandId,
        revisionAtDecision: 1,
      });

      const snoozeRecord = await snoozePromise;
      assert.equal(snoozeRecord.state, 'rejected');
      assert.equal(snoozeRecord.ack.status, 'rejected');
      assert.equal(snoozeRecord.ack.reasonCode, 'proto.alreadyResolved');
    } finally {
      f.dispose();
    }
  });
});
