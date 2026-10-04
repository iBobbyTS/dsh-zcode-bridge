import { BridgeError } from './installation.mjs';
import {
  zcodeMcpListParamsSchema, zcodeMcpListResultSchema,
  zcodePluginsListParamsSchema, zcodePluginsListResultSchema,
  zcodePluginsReferenceCatalogParamsSchema, zcodePluginsReferenceCatalogResultSchema,
  zcodeSkillsReferenceCatalogParamsSchema, zcodeSkillsReferenceCatalogResultSchema,
  zcodePluginsOverviewParamsSchema, zcodePluginsOverviewResultSchema,
  zcodePluginsSetEnabledParamsSchema, zcodePluginsSetEnabledResultSchema,
  zcodePluginsMarketplaceAddParamsSchema, zcodePluginsMarketplaceRemoveParamsSchema,
  zcodePluginsMarketplaceUpdateParamsSchema, zcodePluginsMarketplaceMutationResultSchema,
  zcodePluginsInstallParamsSchema, zcodePluginsInstallResultSchema,
  zcodePluginsCancelOperationParamsSchema, zcodePluginsCancelOperationResultSchema,
  zcodePluginsUninstallParamsSchema, zcodePluginsUninstallResultSchema,
  zcodePluginsUpdateParamsSchema,
  zcodePluginsRestoreBuiltinParamsSchema, zcodePluginsRestoreBuiltinResultSchema,
  zcodePluginsConfigureParamsSchema, zcodePluginsConfigureResultSchema,
  zcodePluginsResetConfigParamsSchema,
  zcodePluginsValidateParamsSchema, zcodePluginsValidateResultSchema,
  zcodePluginsDescribeParamsSchema, zcodePluginsDescribeResultSchema,
  zcodePluginOperationProgressNotificationSchema,
} from './vendor/zcode/v4.mjs';

const pick = (source, keys) => Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]));

// Read-only official directory carriers. Each entry is [method, paramsSchema, resultSchema, build].
// The bridge never carries a second catalog: every call reads the official app-server.
const READ_CARRIERS = Object.freeze({
  mcpList: Object.freeze(['mcp/list', zcodeMcpListParamsSchema, zcodeMcpListResultSchema,
    (workspace, params) => ({ workspace, mode: params.mode ?? 'status' })]),
  pluginsList: Object.freeze(['plugins/list', zcodePluginsListParamsSchema, zcodePluginsListResultSchema,
    (workspace, params) => ({ workspace, ...(params.configScope === undefined ? {} : { configScope: params.configScope }) })]),
  pluginReference: Object.freeze(['plugins/referenceCatalog', zcodePluginsReferenceCatalogParamsSchema, zcodePluginsReferenceCatalogResultSchema,
    (workspace, params) => ({ workspace, ...(params.sessionId === undefined ? {} : { sessionId: params.sessionId }) })]),
  skillReference: Object.freeze(['skills/referenceCatalog', zcodeSkillsReferenceCatalogParamsSchema, zcodeSkillsReferenceCatalogResultSchema,
    (workspace, params) => ({ workspace, ...(params.sessionId === undefined ? {} : { sessionId: params.sessionId }) })]),
  pluginsOverview: Object.freeze(['plugins/overview', zcodePluginsOverviewParamsSchema, zcodePluginsOverviewResultSchema,
    (workspace, params) => ({ workspace, ...(params.configScope === undefined ? {} : { configScope: params.configScope }) })]),
  pluginValidate: Object.freeze(['plugins/validate', zcodePluginsValidateParamsSchema, zcodePluginsValidateResultSchema,
    (workspace, params) => ({ workspace, ...pick(params, ['pluginName', 'marketplace', 'source']) })]),
  pluginDescribe: Object.freeze(['plugins/describe', zcodePluginsDescribeParamsSchema, zcodePluginsDescribeResultSchema,
    (workspace, params) => ({ workspace, pluginName: params.pluginName, marketplace: params.marketplace })]),
});

// Official management carriers. No local storage: install/uninstall/config all execute in the
// official app-server against official storage. Catalogue results are re-read, never cached.
const WRITE_CARRIERS = Object.freeze({
  marketplaceAdd: Object.freeze(['plugins/marketplace/add', zcodePluginsMarketplaceAddParamsSchema, zcodePluginsMarketplaceMutationResultSchema,
    (workspace, params) => ({ workspace, source: params.source, ...pick(params, ['dryRun', 'operationId']) }), true]),
  marketplaceRemove: Object.freeze(['plugins/marketplace/remove', zcodePluginsMarketplaceRemoveParamsSchema, zcodePluginsMarketplaceMutationResultSchema,
    (workspace, params) => ({ workspace, marketplace: params.marketplace }), false]),
  marketplaceUpdate: Object.freeze(['plugins/marketplace/update', zcodePluginsMarketplaceUpdateParamsSchema, zcodePluginsMarketplaceMutationResultSchema,
    (workspace, params) => ({ workspace, ...pick(params, ['marketplace', 'operationId']) }), true]),
  install: Object.freeze(['plugins/install', zcodePluginsInstallParamsSchema, zcodePluginsInstallResultSchema,
    (workspace, params) => ({ workspace, pluginName: params.pluginName, marketplace: params.marketplace, ...pick(params, ['scope', 'dryRun', 'operationId']) }), true]),
  uninstall: Object.freeze(['plugins/uninstall', zcodePluginsUninstallParamsSchema, zcodePluginsUninstallResultSchema,
    (workspace, params) => ({ workspace, ...pick(params, ['pluginId', 'pluginName', 'marketplace', 'removeCache']) }), false]),
  update: Object.freeze(['plugins/update', zcodePluginsUpdateParamsSchema, zcodePluginsInstallResultSchema,
    (workspace, params) => ({ workspace, ...pick(params, ['pluginId', 'marketplace']) }), false]),
  restoreBuiltin: Object.freeze(['plugins/restoreBuiltin', zcodePluginsRestoreBuiltinParamsSchema, zcodePluginsRestoreBuiltinResultSchema,
    (workspace, params) => ({ workspace, pluginId: params.pluginId }), false]),
  configure: Object.freeze(['plugins/configure', zcodePluginsConfigureParamsSchema, zcodePluginsConfigureResultSchema,
    (workspace, params) => ({ workspace, pluginId: params.pluginId, options: params.options, ...pick(params, ['clearOptionKeys', 'scope', 'dryRun']) }), false]),
  resetConfig: Object.freeze(['plugins/resetConfig', zcodePluginsResetConfigParamsSchema, zcodePluginsConfigureResultSchema,
    (workspace, params) => ({ workspace, pluginId: params.pluginId, ...pick(params, ['scope']) }), false]),
  setEnabled: Object.freeze(['plugins/setEnabled', zcodePluginsSetEnabledParamsSchema, zcodePluginsSetEnabledResultSchema,
    (workspace, params) => ({ workspace, pluginId: params.pluginId, enabled: params.enabled, ...pick(params, ['scope', 'operationId']) }), true]),
  cancelOperation: Object.freeze(['plugins/cancelOperation', zcodePluginsCancelOperationParamsSchema, zcodePluginsCancelOperationResultSchema,
    (_workspace, params) => ({ operationId: params.operationId }), false]),
});

const PROGRESS_NOTIFICATION = 'plugins/operationProgress';
const MAX_OPERATIONS = 64;
const TERMINAL_OPERATION = new Set(['completed', 'failed', 'cancelled']);

/** Workspace-scoped official MCP/plugin/skill directory and management carrier.
 *  One peer, one workspace. It owns no catalog store and no persisted copy. */
export class CatalogClient {
  #peer; #workspace; #managementAllowed; #operations = new Map(); #listeners = new Set(); #offNotification; #closed = false;
  constructor(peer, { workspace, managementAllowed = false } = {}) {
    if (!peer || typeof peer.request !== 'function' || typeof peer.onNotification !== 'function') throw new BridgeError('catalog-context-invalid');
    if (!workspace || typeof workspace.workspacePath !== 'string' || !workspace.workspacePath || workspace.workspaceKey !== workspace.workspacePath) throw new BridgeError('catalog-context-invalid');
    if (typeof managementAllowed !== 'boolean') throw new BridgeError('catalog-context-invalid');
    this.#peer = peer; this.#workspace = Object.freeze({ workspacePath: workspace.workspacePath, workspaceKey: workspace.workspaceKey }); this.#managementAllowed = managementAllowed;
    this.#offNotification = peer.onNotification(message => this.#onNotification(message));
  }
  get workspacePath() { return this.#workspace.workspacePath }
  get admission() {
    if (this.#closed) return { reads: { allowed: false, reason: 'closed' }, writes: { allowed: false, reason: 'closed' } };
    if (this.#peer.closed) return { reads: { allowed: false, reason: 'host-unreachable' }, writes: { allowed: false, reason: 'host-unreachable' } };
    return {
      reads: { allowed: true, reason: null },
      writes: this.#managementAllowed ? { allowed: true, reason: null } : { allowed: false, reason: 'management-unverified' },
    };
  }
  get pendingOperations() { return [...this.#operations.values()].filter(record => !TERMINAL_OPERATION.has(record.state)) }
  get operationCount() { return this.#operations.size }
  subscribe(listener) { if (this.#closed) return () => {}; this.#listeners.add(listener); return () => this.#listeners.delete(listener) }
  /** Read-only official query. Unknown kinds and unavailable admission fail closed. */
  async read(kind, params = {}, { signal } = {}) {
    const carrier = Object.hasOwn(READ_CARRIERS, kind) ? READ_CARRIERS[kind] : null;
    if (!carrier) throw new BridgeError('catalog-read-unknown');
    const admission = this.admission.reads;
    if (!admission.allowed) throw new BridgeError(admission.reason);
    const parsed = carrier[1].safeParse(carrier[3](this.#workspace, params));
    if (!parsed.success) throw new BridgeError('catalog-params-invalid');
    const result = await this.#peer.request(carrier[0], parsed.data, { signal });
    if (this.#closed) throw new BridgeError('catalog-closed');
    const validated = carrier[2].safeParse(result);
    if (!validated.success) throw new BridgeError('catalog-result-invalid');
    return validated.data;
  }
  /** Official management operation with an operationId-keyed in-flight record.
   *  The official result/error is authoritative; nothing is optimistically persisted. */
  async operate(operation, params = {}, { signal, operationId } = {}) {
    const carrier = Object.hasOwn(WRITE_CARRIERS, operation) ? WRITE_CARRIERS[operation] : null;
    if (!carrier) throw new BridgeError('catalog-operation-unknown');
    const admission = this.admission.writes;
    if (!admission.allowed) throw new BridgeError(admission.reason);
    const parsed = carrier[1].safeParse(carrier[3](this.#workspace, params));
    if (!parsed.success) throw new BridgeError('catalog-params-invalid');
    // cancelOperation names the operation being cancelled; it must not overwrite or collide
    // with that operation's own in-flight record.
    const id = operation === 'cancelOperation' ? undefined : (parsed.data.operationId ?? operationId);
    if (id !== undefined) {
      if (typeof id !== 'string' || !id) throw new BridgeError('catalog-params-invalid');
      const active = this.#operations.get(id);
      if (active && !TERMINAL_OPERATION.has(active.state)) throw new BridgeError('catalog-operation-active');
    }
    // The official server only registers the operation's AbortController (and therefore routes
    // plugins/cancelOperation and plugins/operationProgress by id) when request.params.operationId
    // is present. Carriers whose params schema accepts operationId are marked true and get the
    // caller's id merged into the official params; nothing is invented for the other carriers.
    const officialParams = carrier[4] === true && id !== undefined && parsed.data.operationId === undefined
      ? { ...parsed.data, operationId: id }
      : parsed.data;
    const record = { operation, operationId: id ?? null, state: 'pending', startedAt: new Date().toISOString(), progress: [], result: undefined, error: undefined };
    if (record.operationId) this.#remember(record);
    this.#publish();
    const abort = () => { void this.#cancel(record) };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const raw = await this.#peer.request(carrier[0], officialParams, { signal });
      if (this.#closed) throw Object.assign(new BridgeError('catalog-closed'), { sent: true });
      const validated = carrier[2].safeParse(raw);
      if (!validated.success) throw new BridgeError('catalog-result-invalid');
      record.state = 'completed'; record.result = structuredClone(validated.data); record.finishedAt = new Date().toISOString();
      this.#publish(); return validated.data;
    } catch (error) {
      // A resolution that arrives after dispose must not overwrite the bounded retained record
      // (dispose already marked it cancelled with catalog-closed for diagnostics). Drop it.
      if (this.#closed) throw error;
      if (error?.code === 'cancelled') { record.state = 'cancelled'; record.error = { code: 'cancelled' } }
      else { record.state = 'failed'; record.error = { code: error?.code ?? 'catalog-operation-failed', protocolCode: error?.protocolCode } }
      record.finishedAt = new Date().toISOString(); this.#publish(); throw error;
    } finally { signal?.removeEventListener('abort', abort) }
  }
  #remember(record) {
    this.#operations.set(record.operationId, record);
    if (this.#operations.size <= MAX_OPERATIONS) return;
    for (const [id, candidate] of this.#operations) { if (TERMINAL_OPERATION.has(candidate.state)) { this.#operations.delete(id); return } }
    this.#operations.delete(this.#operations.keys().next().value);
  }
  async #cancel(record) {
    if (TERMINAL_OPERATION.has(record.state) || !record.operationId) return;
    record.state = 'cancelled'; record.finishedAt = new Date().toISOString(); this.#publish();
    try { await this.#peer.request('plugins/cancelOperation', { operationId: record.operationId }) } catch { /* official cancel ack is best effort */ }
  }
  #onNotification(message) {
    if (this.#closed || !message || message.method !== PROGRESS_NOTIFICATION) return;
    const parsed = zcodePluginOperationProgressNotificationSchema.safeParse(message.params);
    if (!parsed.success) return;
    // Late progress for an unknown/finished operation is dropped; it never attaches to another operation.
    const record = this.#operations.get(parsed.data.operationId);
    if (!record || TERMINAL_OPERATION.has(record.state)) return;
    record.progress = [...record.progress, structuredClone(parsed.data)];
    this.#publish();
  }
  #publish() { for (const listener of this.#listeners) { try { listener(this) } catch { /* observer teardown cannot block the carrier */ } } }
  get operations() { return [...this.#operations.values()].map(record => structuredClone(record)) }
  // Disposal cancels pending work but keeps the bounded last-operation facts for diagnostics.
  dispose() { if (this.#closed) return; this.#closed = true; for (const record of this.#operations.values()) { if (!TERMINAL_OPERATION.has(record.state)) { record.state = 'cancelled'; record.error = { code: 'catalog-closed' } } } this.#offNotification?.(); this.#offNotification = undefined; this.#listeners.clear() }
}
export const CATALOG_READ_KINDS = Object.freeze(Object.keys(READ_CARRIERS));
export const CATALOG_OPERATIONS = Object.freeze(Object.keys(WRITE_CARRIERS));
