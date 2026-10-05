// S01 item ④ mock round-trip checks. Run: node --test spike/s01-capability-admission/approval-bridge.test.mjs
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
  assert.equal(result.delivered, true);
  assert.equal(result.dshOutcome, 'allowed-once');
});

test('rejected maps to the offered deny option with a decline action', () => {
  const interaction = permission();
  const result = roundTrip(interaction, 'rejected', createMockInteractionBroker(interaction));
  assert.deepEqual(result.answer, { optionId: 'o-deny', action: 'decline' });
  assert.equal(result.dshOutcome, 'rejected');
});

test('cancelled maps to the cancel action and is delivered', () => {
  const interaction = permission();
  const result = roundTrip(interaction, 'cancelled', createMockInteractionBroker(interaction));
  assert.deepEqual(result.answer, { action: 'cancel' });
  assert.equal(result.delivered, true);
  assert.equal(result.dshOutcome, 'cancelled');
});

test('unavailable fails closed: no answer is delivered and the outcome stays unavailable', () => {
  const interaction = permission();
  const broker = createMockInteractionBroker(interaction);
  const result = roundTrip(interaction, 'unavailable', broker);
  assert.equal(result.answer, null);
  assert.equal(result.delivered, false);
  assert.equal(result.dshOutcome, 'unavailable');
  assert.equal(broker.answered, false, 'the pending interaction must be left untouched');
});

test('a late answer to an already-resolved interaction is an idempotent no-op (superseded, not an error)', () => {
  const interaction = permission();
  const broker = createMockInteractionBroker(interaction);
  assert.equal(roundTrip(interaction, 'allowed-once', broker).delivered, true);
  const late = roundTrip(interaction, 'rejected', broker);
  assert.equal(late.delivered, false);
  assert.equal(late.dshOutcome, 'superseded');
  assert.equal(interaction.answers.length, 1, 'the first decision stays authoritative');
});

test('a permission ask with no matching option falls back to the action-only answer', () => {
  const interaction = { kind: 'permission', options: [{ optionId: 'x', label: 'X', kind: 'custom' }], answers: [] };
  assert.deepEqual(toZcodeAnswer('allowed-once', interaction), { action: 'accept' });
  assert.deepEqual(toZcodeAnswer('rejected', interaction), { action: 'decline' });
});

test('userInput multi-question asks can carry content through the same envelope', () => {
  const interaction = { kind: 'userInput', options: [], answers: [] };
  const answer = { action: 'accept', content: { answer_0: ['notes'], answers: { 'Notes?': 'notes' } } };
  const broker = createMockInteractionBroker(interaction);
  assert.equal(broker.deliver(answer).delivered, true);
});
