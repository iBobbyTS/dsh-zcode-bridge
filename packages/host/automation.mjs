import { BridgeError } from './installation.mjs';
import { HostCallbackError } from './protocol.mjs';
import {
  zcodeAutomationCreateParamsSchema, zcodeAutomationUpdateParamsSchema, zcodeAutomationListParamsSchema,
  zcodeAutomationCheckTaskBindingParamsSchema, zcodeAutomationDeleteParamsSchema,
  zcodeOffPeakCreateParamsSchema, zcodeOffPeakListParamsSchema,
} from './vendor/zcode/v4.mjs';

/**
 * Automation / Off-Peak carrier classification (S01-CARRIERS rows 65–71, re-probed live for S13).
 *
 * The `automation/*` and `offPeak/*` legacy methods are **reverse Host-consumed** carriers: the CLI
 * agent asks its attached Host to serve them (`createProtocolAutomationPort` /
 * `createProtocolOffPeakPort` call `context.requestClient('automation/…')`), and the *official Host*
 * owns the store (packages/services/src/zcode-agent/zcodeAgentService.ts:2491–2817,
 * automationService/offPeakTaskService). The app-server CLI dispatcher has **no** case for them, so a
 * client attached to `app-server --stdio` cannot request them: a real probe returns -32601 for every
 * one (tests/fixtures/s13/official.json). There is no v4 management command either — the only v4
 * carriers (`sendText` payload automationId/offPeakTaskId and `offPeakToolEnabled`) mark a dispatch or
 * a tool-policy flag, not management.
 *
 * This client therefore owns no automation/off-peak store and no scheduler: management is unavailable,
 * run execution is model-gated, off-peak entitlement is a Host-service fact (UNKNOWN here), and every
 * incoming reverse request is answered fail-closed instead of being faked. The bridge deliberately does
 * not become a second automation host, write `.zcode` task files, or invent task/run feedback.
 */
export const AUTOMATION_MANAGEMENT_REASON = 'official-host-consumed-reverse-carrier';
export const AUTOMATION_FEEDBACK_REASON = 'no-official-projection-carrier';
export const OFF_PEAK_ENTITLEMENT_REASON = 'off-peak-entitlement-is-host-service-only';

// Reverse carriers with their official request schemas. The schema is used only to reject malformed
// requests with the official -32602 shape; a well-formed request still fails closed because this
// bridge is not the automation Host. No schema parses a caller-supplied workspace.
const REVERSE_CARRIERS = Object.freeze({
  'automation/create': zcodeAutomationCreateParamsSchema,
  'automation/update': zcodeAutomationUpdateParamsSchema,
  'automation/checkTaskBinding': zcodeAutomationCheckTaskBindingParamsSchema,
  'automation/list': zcodeAutomationListParamsSchema,
  'automation/delete': zcodeAutomationDeleteParamsSchema,
  'offPeak/create': zcodeOffPeakCreateParamsSchema,
  'offPeak/list': zcodeOffPeakListParamsSchema,
});

// Static verified classification. `requestable:false` is the live -32601 fact, not an assumption.
export const AUTOMATION_CARRIERS = Object.freeze([
  Object.freeze({ name: 'automationCreate', method: 'automation/create', domain: 'automation', direction: 'cli-to-host-reverse', requestable: false }),
  Object.freeze({ name: 'automationUpdate', method: 'automation/update', domain: 'automation', direction: 'cli-to-host-reverse', requestable: false }),
  Object.freeze({ name: 'automationCheckTaskBinding', method: 'automation/checkTaskBinding', domain: 'automation', direction: 'cli-to-host-reverse', requestable: false }),
  Object.freeze({ name: 'automationList', method: 'automation/list', domain: 'automation', direction: 'cli-to-host-reverse', requestable: false }),
  Object.freeze({ name: 'automationDelete', method: 'automation/delete', domain: 'automation', direction: 'cli-to-host-reverse', requestable: false }),
  Object.freeze({ name: 'offPeakCreate', method: 'offPeak/create', domain: 'offPeak', direction: 'cli-to-host-reverse', requestable: false }),
  Object.freeze({ name: 'offPeakList', method: 'offPeak/list', domain: 'offPeak', direction: 'cli-to-host-reverse', requestable: false }),
]);

const MAX_RECORDS = 64;
const identityOf = params => {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
  for (const key of ['automationId', 'targetTaskId']) if (typeof params[key] === 'string' && params[key]) return { key, value: params[key] };
  return null;
};

/**
 * Automation/Off-Peak honesty surface. Registers fail-closed reverse handlers for the official
 * Host-consumed carriers so a CLI tool turn gets a truthful rejection (and a bounded observation)
 * rather than a fabricated task store. No task, run or feedback value is ever created here.
 */
export class AutomationClient {
  #peer; #auth; #closed = false; #records = new Map(); #off = [];
  constructor(peer, { auth = 'unconfirmed' } = {}) {
    if (!peer || typeof peer.registerRequestHandler !== 'function' || typeof peer.onReverseSettled !== 'function') throw new BridgeError('automation-context-invalid');
    this.#peer = peer; this.#auth = auth;
    for (const method of Object.keys(REVERSE_CARRIERS)) this.#off.push(peer.registerRequestHandler(method, (message, options) => this.#reverse(message, options)));
    this.#off.push(peer.onReverseSettled(event => this.#settled(event)), peer.onClosed(() => this.dispose()));
  }
  get auth() { return this.#auth }
  get admission() {
    if (this.#closed) return { allowed: false, reason: 'closed' };
    if (this.#peer.closed) return { allowed: false, reason: 'host-unreachable' };
    return { allowed: false, reason: AUTOMATION_MANAGEMENT_REASON };
  }
  /** Honest projection: management/feedback unavailable, off-peak entitlement UNKNOWN, execution gated. */
  state() {
    return structuredClone({
      management: { available: false, reason: AUTOMATION_MANAGEMENT_REASON, carriers: AUTOMATION_CARRIERS.filter(c => c.domain === 'automation') },
      offPeak: {
        available: false,
        reason: AUTOMATION_MANAGEMENT_REASON,
        entitlement: { state: 'unknown', reason: OFF_PEAK_ENTITLEMENT_REASON },
        carriers: AUTOMATION_CARRIERS.filter(c => c.domain === 'offPeak'),
      },
      runFeedback: {
        available: false,
        reason: AUTOMATION_FEEDBACK_REASON,
        execution: { state: 'gated', reason: 'model-execution-gated' },
      },
      account: { state: 'unknown', reason: 'official-account-carrier-not-exposed', auth: this.#auth },
      reverse: { allowed: !this.#closed && !this.#peer.closed, reason: this.#closed ? 'closed' : this.#peer.closed ? 'host-unreachable' : AUTOMATION_MANAGEMENT_REASON, records: [...this.#records.values()] },
      admission: this.admission,
    });
  }
  /** Record then fail closed: a malformed request is -32602, a well-formed one is -32601. Never
   *  returns a task/list result because this client owns no official automation store. */
  async #reverse(message, { signal } = {}) {
    const method = message.method;
    const schema = REVERSE_CARRIERS[method];
    const parsed = schema.safeParse(message.params);
    this.#remember({
      id: message.id, method, identity: identityOf(message.params),
      status: parsed.success ? 'rejected' : 'invalid', protocolCode: parsed.success ? -32601 : -32602,
      reason: parsed.success ? AUTOMATION_MANAGEMENT_REASON : 'invalid-official-params',
    });
    if (!parsed.success) throw new HostCallbackError(-32602, `Invalid ${method} params`);
    if (this.#closed || signal?.aborted) throw new HostCallbackError(-32603, 'Host callback unavailable');
    // R16/R18/R22: no store, no scheduler, no fabricated task. The official Host owns this capability.
    throw new HostCallbackError(-32601, 'Automation management is owned by the official Host, not this bridge');
  }
  #settled({ request, response, outcome }) {
    const record = this.#records.get(request.id);
    if (!record) return;
    record.outcome = outcome === 'outcome-unknown' ? 'outcome-unknown' : response?.error ? 'rejected' : 'responded';
    if (outcome === 'outcome-unknown') record.protocolCode = -32000;
  }
  #remember(record) {
    if (this.#records.size >= MAX_RECORDS) this.#records.delete(this.#records.keys().next().value);
    this.#records.set(record.id, record);
  }
  dispose() {
    if (this.#closed) return;
    this.#closed = true;
    for (const off of this.#off) off();
    this.#off = [];
    for (const record of this.#records.values()) if (!record.outcome) { record.outcome = 'outcome-unknown'; record.protocolCode = -32000; record.reason = record.reason ?? 'host-closed'; }
  }
}
export const AUTOMATION_REVERSE_METHODS = Object.freeze(Object.keys(REVERSE_CARRIERS));
