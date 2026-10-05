/**
 * S01 item ④ spike — approval round-trip translation (mock, no I/O).
 *
 * DSH side (reference/deepseek-harness):
 *   packages/interaction/user-approval/src/types.ts:32
 *     ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable' (closed)
 *   packages/client/ui-approval/src/client/index.ts:36
 *     the browser consumes this as the Agent-scoped `approval/request` waterfall.
 *
 * ZCode side (reference/ZCode):
 *   apps/zcode-cli/packages/bootstrap/src/zcode-protocol-v4/commands/handlers/
 *     interaction-background.ts:36 resolveInteraction is idempotent: a late answer
 *     (already answered / unknown id) is a harmless no-op (delivered === false).
 *   packages/shared/src/zcode-protocol-v4/command.ts:176
 *     resolveInteraction { interactionId, answer: { optionId?, freeText?, action?: accept|decline|cancel, content? } }
 *   packages/shared/src/zcode-protocol-v4/snapshot.ts:229
 *     permission options carry kind allowOnce|allowAlways|deny|custom; PERMISSION_FULL_ACCESS_OPTION_ID = 'fullAccess'.
 */

/** Pick the ZCode option id for a permission outcome from the interaction's offered options. */
export function optionIdForOutcome(outcome, options = []) {
  const wanted = outcome === 'allowed-once' ? 'allowOnce' : outcome === 'rejected' ? 'deny' : undefined;
  if (wanted === undefined) return undefined;
  return options.find(option => option.kind === wanted)?.optionId;
}

/**
 * Translate a DSH approval outcome (+ the pending ZCode interaction) into the
 * `answer` payload for resolveInteraction, or null when nothing should be sent.
 * 'unavailable' fails closed: the pending interaction is left untouched.
 */
export function toZcodeAnswer(outcome, interaction) {
  if (outcome === 'unavailable') return null;
  if (outcome === 'cancelled') return { action: 'cancel' };
  if (outcome === 'allowed-once') {
    const optionId = optionIdForOutcome(outcome, interaction.options);
    return optionId === undefined ? { action: 'accept' } : { optionId, action: 'accept' };
  }
  if (outcome === 'rejected') {
    const optionId = optionIdForOutcome(outcome, interaction.options);
    return optionId === undefined ? { action: 'decline' } : { optionId, action: 'decline' };
  }
  throw new Error('unknown DSH approval outcome: ' + String(outcome));
}

/**
 * Mock the ZCode broker: deliver one answer with first-come-first-served
 * semantics (interaction-background.ts:36). A second delivery is an idempotent
 * no-op returning { delivered: false }.
 */
export function createMockInteractionBroker(interaction) {
  let answered = false;
  return {
    deliver(answer) {
      if (answered) return { delivered: false };
      answered = true;
      interaction.answers.push(answer);
      return { delivered: true };
    },
    get answered() { return answered; },
  };
}

/**
 * One full mock round trip: a DSH outcome becomes a ZCode answer, the broker
 * reports delivery, and the DSH-side settlement is derived.
 * Returns { answer, delivered, dshOutcome }.
 */
export function roundTrip(interaction, outcome, broker) {
  const answer = toZcodeAnswer(outcome, interaction);
  if (answer === null) return { answer: null, delivered: false, dshOutcome: 'unavailable' };
  const { delivered } = broker.deliver(answer);
  if (!delivered) return { answer, delivered: false, dshOutcome: 'superseded' };
  return { answer, delivered: true, dshOutcome: outcome };
}
