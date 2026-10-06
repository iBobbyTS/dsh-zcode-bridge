// Capability admission mock round-trip checks. Run: node --test spike/capability-admission/approval-bridge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockInteractionBroker, roundTrip, toZcodeAnswer } from './approval-bridge.mjs';

const permission = () => ({
  kind: 'permission',
  options: [
    { optionId: 'o-allow', label: 'Allow once', kind: 'allowOnce' },
    { optionId: 'o-allow-always', label: 'Always', kind: 'allowAlways' },
    { optionId: 'o-deny', label: 'Deny', kind: 'deny' },
  ],
  answers: [],
});

test('allowed-once maps to the offered allowOnce option with an accept action', () => {
  const interaction = permission();
  const result = roundTrip(interaction, 'allowed-once', createMockInteractionBroker(interaction));
  assert.deepEqual(result.answer, { optionId: 'o-allow', action: 'accept' });
  assert.equal(result.commandResult, undefined);
  assert.equal(result.dshOutcome, 'allowed-once');
});

test('rejected maps to the offered deny option with a decline action', () => {
  const interaction = permission();
  const result = roundTrip(interaction, 'rejected', createMockInteractionBroker(interaction));
  assert.deepEqual(result.answer, { optionId: 'o-deny', action: 'decline' });
  assert.equal(result.commandResult, undefined);
  assert.equal(result.dshOutcome, 'rejected');
});

test('cancelled maps to the cancel action; the command response is undefined', () => {
  const interaction = permission();
  const result = roundTrip(interaction, 'cancelled', createMockInteractionBroker(interaction));
  assert.deepEqual(result.answer, { action: 'cancel' });
  assert.equal(result.commandResult, undefined);
  assert.equal(result.dshOutcome, 'cancelled');
});

test('unavailable fails closed: no answer is delivered and the outcome stays unavailable', () => {
  const interaction = permission();
  const broker = createMockInteractionBroker(interaction);
  const result = roundTrip(interaction, 'unavailable', broker);
  assert.equal(result.answer, null);
  assert.equal(result.commandResult, undefined);
  assert.equal(result.dshOutcome, 'unavailable');
  assert.equal(broker.observation().resolved, false, 'the pending interaction must be left untouched');
});

test('a late answer is an idempotent no-op, and the command response cannot distinguish it from a win', () => {
  const interaction = permission();
  const broker = createMockInteractionBroker(interaction);
  const first = roundTrip(interaction, 'allowed-once', broker);
  const late = roundTrip(interaction, 'rejected', broker);
  // Real resolveInteraction returns undefined for BOTH outcomes (interaction-background.ts:49).
  assert.equal(first.commandResult, undefined);
  assert.equal(late.commandResult, undefined);
  // First-come-first-served holds in broker state, which is mock-only, not wire-visible.
  assert.equal(interaction.answers.length, 1, 'the first decision stays authoritative');
  assert.equal(broker.observation().resolved, true);
  assert.equal(broker.observation().deliveredCount, 1);
  // 'superseded' is NOT a DSH ApprovalOutcome; the round trip must not invent it.
  assert.notEqual(late.dshOutcome, 'superseded');
});

test('a permission ask with no matching option falls back to the action-only answer', () => {
  const interaction = { kind: 'permission', options: [{ optionId: 'x', label: 'X', kind: 'custom' }], answers: [] };
  assert.deepEqual(toZcodeAnswer('allowed-once', interaction), { action: 'accept' });
  assert.deepEqual(toZcodeAnswer('rejected', interaction), { action: 'decline' });
});

test('userInput multi-question asks carry their content through the same envelope', () => {
  const interaction = { kind: 'userInput', options: [], answers: [] };
  const answer = { action: 'accept', content: { answer_0: ['notes'], answers: { 'Notes?': 'notes' } } };
  const broker = createMockInteractionBroker(interaction);
  assert.equal(broker.deliver(answer), undefined);
  assert.deepEqual(interaction.answers, [answer], 'the delivered payload carries the question content');
  assert.deepEqual(interaction.answers[0].content.answer_0, ['notes']);
  assert.deepEqual(interaction.answers[0].content.answers, { 'Notes?': 'notes' });
});
