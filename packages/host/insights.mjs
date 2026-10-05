import { zcodeProviderTestModelConnectivityParamsSchema, zcodeProviderTestModelConnectivityResultSchema } from './vendor/zcode/v4.mjs';
import { BridgeError } from './installation.mjs';
import {
  zcodeUsageStatsParamsSchema, zcodeUsageStatsResultSchema,
  zcodeProcessChildProcessesParamsSchema, zcodeProcessChildProcessesResultSchema,
  zcodeProcessResourceSampleSchema,
} from './vendor/zcode/v4.mjs';

/**
 * No app-server RPC exposes login/logout/account/subscription state. AUTH-SOURCE-RESEARCH E06:
 * the account request-auth producer lives inside the local Host and is deliberately not exposed to
 * the generic RPC channel; the only account-shaped method is provider/updateAccountConfig (a config
 * sync, not a login/state query). Account state is therefore UNKNOWN, never guessed signed-in/out,
 * and the login entry is not provided by this client. R15: never read private credentials, reverse
 * the auth implementation or call internal services to fill the gap.
 */
export const ACCOUNT_REASON = 'official-account-carrier-not-exposed';

// Model-executing carriers the official GUI exposes (workspace auxiliary generation / cancel,
// provider connectivity test). The bridge does not invoke them while model execution is not
// admitted; they are presented gated with this static reason rather than faked or dropped.
export const GATED_CARRIERS = Object.freeze({
  generateText: Object.freeze({ method: 'workspace/generateText', reason: 'model-execution-gated' }),
  cancelGenerateText: Object.freeze({ method: 'workspace/cancelGenerateText', reason: 'model-execution-gated' }),
  testModelConnectivity: Object.freeze({ method: 'provider/testModelConnectivity', reason: 'model-execution-gated' }),
});

// Read-only official carriers. Each is [method, paramsSchema, resultSchema, build]. None is a second
// store: every call reads the official app-server. Workspace identity is not caller-supplied.
const READ_CARRIERS = Object.freeze({
  // v4/usage/stats is the live carrier: zcodeAgentService migrated off the @deprecated legacy
  // usage/stats (official index.ts:3652-3658; transport.ts usageStats). Same handler and schemas
  // are dispatched for both names (server.ts v4 usage query case), so only the method string moves.
  usageStats: Object.freeze(['v4/usage/stats', zcodeUsageStatsParamsSchema, zcodeUsageStatsResultSchema,
    (_workspace, params) => ({ range: params.range, ...(params.timeZone === undefined ? {} : { timeZone: params.timeZone }) })]),
  childProcesses: Object.freeze(['process/childProcesses', zcodeProcessChildProcessesParamsSchema, zcodeProcessChildProcessesResultSchema,
    () => ({})]),
});

/** Workspace-scoped official usage and diagnostics carrier. Owns no usage/diagnostic store; the only
 *  retained value is the latest bounded process resource sample notification. */
export class InsightsClient {
  #peer; #auth; #resourceSample = null; #offNotification; #closed = false;
  constructor(peer, { auth = 'unconfirmed', executionAllowed = false, workspace } = {}) {
    if (!peer || typeof peer.request !== 'function' || typeof peer.onNotification !== 'function') throw new BridgeError('insights-context-invalid');
    this.#peer = peer; this.#auth = auth; this.executionAllowed = executionAllowed; this.workspace = workspace ? Object.freeze({...workspace}) : undefined;
    this.#offNotification = peer.onNotification(message => this.#onNotification(message));
  }
  get admission() {
    if (this.#closed) return { allowed: false, reason: 'closed' };
    if (this.#peer.closed) return { allowed: false, reason: 'host-unreachable' };
    return { allowed: true, reason: null };
  }
  get auth() { return this.#auth }
  /** Latest validated process resource sample, or null when the official runtime has not sent one yet. */
  get resourceSample() { return this.#resourceSample ? structuredClone(this.#resourceSample) : null }
  /** Honest account projection. `auth` is the bridge's own request-auth availability fact, not a
   *  login state; the account query itself has no official carrier and stays UNKNOWN. */
  account() {
    return {
      state: 'unknown',
      reason: ACCOUNT_REASON,
      auth: this.#auth,
      query: { available: false, reason: ACCOUNT_REASON },
      login: { available: false, reason: ACCOUNT_REASON },
    };
  }
  async operate(kind,params={}, {signal}={}) {
    if(kind!=='testModelConnectivity'||!this.executionAllowed)throw new BridgeError('insights-operation-denied');
    if(!this.admission.allowed)throw new BridgeError(this.admission.reason);
    if(!params||typeof params!=='object'||Array.isArray(params)||Object.keys(params).some(key=>key!=='selection'))throw new BridgeError('insights-params-invalid');
    const parsed=zcodeProviderTestModelConnectivityParamsSchema.safeParse({workspace:this.workspace,...params});
    if(!parsed.success)throw new BridgeError('insights-params-invalid');
    return zcodeProviderTestModelConnectivityResultSchema.parse(await this.#peer.request('provider/testModelConnectivity',parsed.data,{signal}));
  }
  /** Gated model-executing surfaces: unavailable with the reason, never a fabricated result. */
  gated() {
    if(this.executionAllowed)return {testModelConnectivity:{available:this.admission.allowed,reason:this.admission.reason,method:'provider/testModelConnectivity'}};
    return Object.fromEntries(Object.entries(GATED_CARRIERS).map(([kind, carrier]) => [kind, { available: this.executionAllowed && kind==='testModelConnectivity' && this.admission.allowed, reason: this.executionAllowed && kind==='testModelConnectivity' ? this.admission.reason : carrier.reason, method: carrier.method }]));
  }
  state() { return { account: this.account(), gated: this.gated(), resourceSample: this.resourceSample, admission: this.admission } }
  /** Read-only official query. Unknown kinds and unavailable admission fail closed. */
  async read(kind, params = {}, { signal } = {}) {
    const carrier = Object.hasOwn(READ_CARRIERS, kind) ? READ_CARRIERS[kind] : null;
    if (!carrier) throw new BridgeError('insights-read-unknown');
    // Null/primitive params would make a carrier's build() throw a bare TypeError before schema
    // validation; treat them as invalid input and fail closed with the domain code.
    if (params === null || typeof params !== 'object' || Array.isArray(params)) throw new BridgeError('insights-params-invalid');
    const admission = this.admission;
    if (!admission.allowed) throw new BridgeError(admission.reason);
    const parsed = carrier[1].safeParse(carrier[3](undefined, params));
    if (!parsed.success) throw new BridgeError('insights-params-invalid');
    const result = await this.#peer.request(carrier[0], parsed.data, { signal });
    if (this.#closed) throw new BridgeError('insights-closed');
    const validated = carrier[2].safeParse(result);
    if (!validated.success) throw new BridgeError('insights-result-invalid');
    return validated.data;
  }
  #onNotification(message) {
    if (this.#closed || !message || message.method !== 'process/resourceSample') return;
    // Unknown/invalid samples are dropped, never shown as a diagnostic fact. The schema rejects
    // paths/workspace tokens by construction (instanceToken carries no pid/path).
    const parsed = zcodeProcessResourceSampleSchema.safeParse(message.params);
    if (!parsed.success) return;
    this.#resourceSample = parsed.data;
  }
  dispose() { if (this.#closed) return; this.#closed = true; this.#offNotification?.(); this.#offNotification = undefined; this.#resourceSample = null }
}
export const INSIGHTS_READ_KINDS = Object.freeze(Object.keys(READ_CARRIERS));
