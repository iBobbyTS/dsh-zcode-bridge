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
 *  reads/observation, ownership release, command-status query, the upload cancel path and host
 *  registration (a fresh plugins/list + mcp/list directory read, not a write). Everything not listed
 *  here (a fresh command, attachment staging/commit, workflow-store writes, workspace preference
 *  writes) is a new side effect and must be refused. */
export const SAFE_OPERATIONS = Object.freeze(new Set([
  'release', 'state', 'connect', 'query', 'historyQuery', 'workflowRead', 'sessionUsage',
  'subagents', 'backgroundOutput', 'attachmentRead', 'conversationAttachmentStat',
  'conversationAttachmentRead', 'attachmentAbort', 'hostRegistration',
]));

/** Core decode/authority codes. Their invariant is reason-bearing, so they are listed explicitly.
 *
 *  The `proto.*` entries are the terminal faults the V4 conversation decoder actually publishes
 *  (V4Conversation#fault/#fail in packages/host/conversation.mjs plus the TopicWireFrameAssembler
 *  reasonCodes in packages/host/vendor/zcode/v4.mjs). Only terminal wire/frame-assembly/projection
 *  corruption is graded core; a fault that is always recoverable, is a local staging/resource
 *  condition, or merely supersedes an assembly stays neutral on purpose:
 *    - proto.frameAssemblySuperseded      a strictly newer ordinal replaced an in-flight assembly
 *    - proto.frameAssemblyConcurrentLimit local concurrent-assembly capacity, not peer corruption
 *    - proto.frameAssemblyBudgetExceeded  local staged-byte budget, not peer corruption
 *    - proto.frameAssemblyTimedOut        assembly liveness timeout, not a decode verdict
 *  None of those assert peer incompatibility, so escalating them would fabricate one (R20). */
const CORE_CODES = Object.freeze({
  'protocol-invalid': 'core protocol frame could not be decoded',
  'protocol-truncated': 'core protocol frame was truncated',
  'capabilities-invalid': 'core runtime capability contract is incompatible',
  'sessions-invalid': 'core session authority projection is incompatible',
  'conversation-result-invalid': 'core conversation envelope is incompatible',
  'conversation-handle-invalid': 'core conversation ownership was lost',
  // V4 conversation wire/projection faults (terminal through the bounded recovery path).
  'proto.invalidWire': 'core V4 wire envelope could not be decoded',
  'proto.unroutableFrame': 'core V4 frame carried no routable conversation envelope',
  'proto.invalidSeq': 'core V4 frame sequence metadata is invalid',
  'proto.snapshotIdentityMismatch': 'core V4 snapshot identity does not match the subscribed conversation',
  'proto.revisionRegressed': 'core V4 projection revision regressed',
  'proto.missingAppliedBase': 'core V4 delta arrived without a held baseline',
  'proto.sequenceGap': 'core V4 frame sequence continuity was lost',
  'proto.initialDeliveryMismatch': 'core V4 initial delivery contract was violated',
  // Frame-assembly corruption/decoding faults from the vendored assembler.
  'proto.frameAssemblyInvalidPayload': 'core V4 frame payload could not be decoded',
  'proto.frameAssemblyMetadataMismatch': 'core V4 assembly metadata does not match its envelope',
  'proto.frameAssemblyOrdinalConflict': 'core V4 frame ordinal was reused with a different identity',
  'proto.frameAssemblyFragmentConflict': 'core V4 frame fragment bytes conflict',
  'proto.frameAssemblyLengthMismatch': 'core V4 assembly length does not match',
  'proto.frameAssemblyChecksumMismatch': 'core V4 assembly checksum does not match',
  'proto.frameAssemblyInvalidUtf8': 'core V4 frame payload is not valid UTF-8',
  'proto.frameAssemblyInvalidJson': 'core V4 frame payload is not valid JSON',
  'proto.frameAssemblyInvalidBase64': 'core V4 frame fragment is not valid base64',
  'proto.frameAssemblyTooLarge': 'core V4 logical frame exceeds the accepted assembly bound',
  'proto.frameEnvelopeTooLarge': 'core V4 wire envelope exceeds the accepted physical bound',
  'proto.frameFragmentCountExceeded': 'core V4 fragment count exceeds the accepted bound',
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
