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
 * semantics (interaction-background.ts:36).
 *
 * `deliver` models the REAL resolveInteraction command response: the handler
 * consumes its internal `delivered` boolean and returns `undefined` for BOTH a
 * first (winning) answer and an already-resolved late answer
 * (interaction-background.ts:49-62). The only difference is internal broker
 * state, exposed here through `observation()` — explicitly mock-only, never a
 * field the wire response carries.
 */
export function createMockInteractionBroker(interaction) {
  let resolved = false;
  let resolveCount = 0;
  return {
    deliver(answer) {
      const claimed = !resolved;
      if (claimed) {
        resolved = true;
        interaction.answers.push(answer);
      }
      resolveCount += 1;
      // Same shape for a win and a no-op: the command response is not a signal.
      return undefined;
    },
    /** Mock-only view of broker state; NOT part of the wire command response. */
    observation() {
      return { resolved, resolveCount, deliveredCount: interaction.answers.length };
    },
  };
}

/**
 * One full mock round trip: a DSH outcome becomes a ZCode answer and the broker
 * returns the real command response.
 *
 * Returns { answer, commandResult, dshOutcome, settlement }.
 *
 * `settlement` deliberately does NOT claim that this client won: because the
 * command response is `undefined` whether or not another client already
 * resolved the interaction, the DSH side cannot detect a competing answerer
 * from it. Detecting "another client already resolved" requires an
 * authoritative event source and is UNPROVEN. `dshOutcome` is therefore only
 * this client's own decision, and 'superseded' is intentionally NOT one of the
 * DSH four-value ApprovalOutcome.
 */
export function roundTrip(interaction, outcome, broker) {
  const answer = toZcodeAnswer(outcome, interaction);
  if (answer === null) {
    return { answer: null, commandResult: undefined, dshOutcome: 'unavailable', settlement: 'fail-closed' };
  }
  const commandResult = broker.deliver(answer);
  return { answer, commandResult, dshOutcome: outcome, settlement: 'assumed-single-answerer' };
}
