/**
 * Graded fail-safe classification (R20).
 *
 * Failures are graded by the invariant they affect, not by HTTP/method naming:
 *  - core:     the failure breaks a core session/order/permission/authority contract, or a core
 *              protocol frame could not be decoded. New side effects stop and the runtime is
 *              marked incompatible. Safe queries and the explicit stop path stay available.
 *  - non-core: an optional capability (directory/account/automation/remote/workflow surface) is
 *              denied or its response shape is not understood. Only that capability is isolated;
 *              already-confirmed paths (conversation reads, chat) keep working.
 *  - neutral:  an unknown code, or an unknown/unverified version. Nothing is asserted as
 *              incompatible and nothing is blocked: the bridge does not fabricate a compatibility
 *              conclusion in either direction.
 */

/** Commands that remain safe once a core incompatibility stopped new side effects. */
export const SAFE_COMMANDS = Object.freeze(new Set(['stop', 'cancelBackgroundWork']));

/** Conversation operations that remain safe once a core incompatibility stopped new side effects:
 *  reads/observation, ownership release, command-status query, and the upload cancel path. Everything
 *  not listed here (a fresh command, attachment staging/commit, workflow-store writes, workspace
 *  preference writes, host registration) is a new side effect and must be refused. */
export const SAFE_OPERATIONS = Object.freeze(new Set([
  'release', 'state', 'connect', 'query', 'historyQuery', 'workflowRead', 'sessionUsage',
  'subagents', 'backgroundOutput', 'attachmentRead', 'conversationAttachmentStat',
  'conversationAttachmentRead', 'attachmentAbort',
]));

/** Core decode/authority codes. Their invariant is reason-bearing, so they are listed explicitly. */
const CORE_CODES = Object.freeze({
  'protocol-invalid': 'core protocol frame could not be decoded',
  'protocol-truncated': 'core protocol frame was truncated',
  'capabilities-invalid': 'core runtime capability contract is incompatible',
  'sessions-invalid': 'core session authority projection is incompatible',
  'conversation-result-invalid': 'core conversation envelope is incompatible',
  'conversation-handle-invalid': 'core conversation ownership was lost',
});

/** Optional capability codes. A denial here is isolated to the named capability. */
const NON_CORE_CODES = Object.freeze({
  'catalog-read-unknown': 'directory',
  'catalog-operation-unknown': 'directory',
  'catalog-params-invalid': 'directory',
  'catalog-result-invalid': 'directory',
  'catalog-operation-active': 'directory',
  'catalog-operation-failed': 'directory',
  'catalog-unavailable': 'directory',
  'catalog-closed': 'directory',
  'insights-unavailable': 'account',
  'automation-unavailable': 'automation',
  'remote-unavailable': 'remote',
  'source-unavailable': 'session-source',
  'management-command-unavailable': 'session-command',
});

/**
 * Classify one BridgeError/protocol code. Unknown codes are neutral on purpose: asserting
 * incompatibility from an unknown code would be an unsupported compatibility claim.
 */
export function classifyFailure(code) {
  if (typeof code === 'string' && Object.hasOwn(CORE_CODES, code)) {
    return { level: 'core', capability: null, incompatible: true, stopsNewSideEffects: true, reason: CORE_CODES[code], code };
  }
  if (typeof code === 'string' && Object.hasOwn(NON_CORE_CODES, code)) {
    return { level: 'non-core', capability: NON_CORE_CODES[code], incompatible: false, stopsNewSideEffects: false, reason: `optional capability ${NON_CORE_CODES[code]} is isolated`, code };
  }
  return { level: 'neutral', capability: null, incompatible: false, stopsNewSideEffects: false, reason: 'unknown failure code; no compatibility claim', code: typeof code === 'string' ? code : null };
}

/** True when a command may still run under the current fail-safe level. */
export function commandAllowed(level, type) {
  if (level !== 'core') return true;
  return SAFE_COMMANDS.has(type);
}

const EMPTY = Object.freeze({ level: 'none', incompatible: false, stopsNewSideEffects: false, blocksNewSideEffects: false, reason: null, isolated: Object.freeze([]) });

/** Bounded per-connection fail-safe state. Reset on every new connection attempt. */
export class FailSafeState {
  #level = 'none'; #reason = null; #isolated = new Map();
  get level() { return this.#level }
  get blocksNewSideEffects() { return this.#level === 'core' }
  get state() {
    if (this.#level === 'none') return { ...EMPTY };
    return {
      level: this.#level,
      incompatible: this.#level === 'core',
      stopsNewSideEffects: this.#level === 'core',
      blocksNewSideEffects: this.#level === 'core',
      reason: this.#reason,
      isolated: [...this.#isolated.values()].map(entry => ({ ...entry })),
    };
  }
  /** Record one observed failure code. Returns the applied classification. */
  observe(code) {
    const classification = classifyFailure(code);
    if (classification.level === 'core') {
      this.#level = 'core'; this.#reason = classification.reason;
    } else if (classification.level === 'non-core') {
      this.#isolated.set(classification.capability, { capability: classification.capability, code: classification.code, reason: classification.reason, at: new Date().toISOString() });
      if (this.#level !== 'core') { this.#level = 'non-core'; this.#reason = classification.reason }
    }
    return classification;
  }
  reset() { this.#level = 'none'; this.#reason = null; this.#isolated.clear() }
}
