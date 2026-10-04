import { z } from 'zod';
const reason = z.string().min(1);
const inventory = z.object({ available: z.literal(false), state: z.literal('unknown'), reason, items: z.null() }).strict();
// This is the bridge projection contract, not an invented official remote protocol/schema.
export const remoteProjectionSchema = z.object({
  schemaVersion: z.literal(1), hostPlatform: z.literal('darwin'), transport: z.literal('app-server-stdio'),
  scope: z.object({ authority: reason, workspace: reason }).strict().nullable(),
  connection: z.object({ available: z.literal(false), state: z.literal('unavailable'), reason, remoteAuthority: z.null(), remoteSessionId: z.null() }).strict(),
  workspaces: inventory, sessions: inventory,
  targets: z.array(z.object({ kind: z.enum(['ssh', 'wsl', 'docker']), available: z.literal(false), state: z.literal('unknown'), reason }).strict()).length(3).refine(rows => new Set(rows.map(row => row.kind)).size === 3),
  carriers: z.array(z.object({ name: reason, method: reason, owner: z.enum(['desktop-main', 'independent-server']), transport: z.enum(['electron-ipc', 'http-ws']), direction: z.enum(['request', 'notification']), requestable: z.literal(false), deprecated: z.boolean() }).strict()),
  admission: z.object({ allowed: z.literal(false), reason }).strict(),
}).strict();
const initial = (reason = 'not-connected') => Object.freeze({ loaded: false, busy: false, error: null, projection: null, admission: { allowed: false, reason } });
const errorOf = error => ({ code: error?.code ?? 'remote-unavailable', message: error?.message ?? 'Remote projection unavailable' });
/** Ephemeral display mirror only; no connection/credentials/session storage, no remote operations. */
export class RemoteStore {
  #rpc; #listeners = new Set(); #snapshot = initial(); #closed = false; #generation = 0; #refreshPromise; #off;
  constructor(rpc, { connectionGeneration } = {}) {
    if (typeof rpc?.call !== 'function') throw Error('remote-rpc-required');
    this.#rpc = rpc;
    this.#off = connectionGeneration?.subscribe(() => { this.#generation++; this.#refreshPromise = undefined; this.#publish(initial('host-unreachable')); });
  }
  getSnapshot = () => this.#snapshot;
  subscribe = listener => { if (this.#closed) return () => {}; this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  #publish(snapshot) {
    if (this.#closed) return;
    this.#snapshot = Object.freeze(snapshot);
    for (const listener of Array.from(this.#listeners)) { try { listener(); } catch { /* observers cannot break the carrier */ } }
  }
  refresh() {
    if (this.#closed) return Promise.reject(Object.assign(new Error('disposed'), { code: 'disposed' }));
    if (this.#refreshPromise) return this.#refreshPromise;
    const generation = this.#generation;
    const operation = (async () => {
      this.#publish({ ...initial(), busy: true });
      try {
        const response = await this.#rpc.call('/zcode-bridge', 'remote', { operation: 'state' });
        if (this.#closed || generation !== this.#generation) return;
        if (response?.ok !== true) throw Object.assign(new Error(response?.error?.message ?? 'Remote projection unavailable'), { code: response?.error?.code ?? 'remote-unavailable' });
        const parsed = remoteProjectionSchema.safeParse(response.value);
        if (!parsed.success) throw Object.assign(new Error('Unrecognized remote projection'), { code: 'remote-projection-invalid' });
        this.#publish({ loaded: true, busy: false, error: null, projection: parsed.data, admission: parsed.data.admission });
      } catch (error) {
        if (this.#closed || generation !== this.#generation) return;
        this.#publish({ ...initial('remote-unavailable'), loaded: true, error: errorOf(error) });
      }
    })();
    this.#refreshPromise = operation;
    void operation.finally(() => { if (this.#refreshPromise === operation) this.#refreshPromise = undefined; }).catch(() => {});
    return operation;
  }
  dispose() { if (this.#closed) return; this.#closed = true; this.#generation++; this.#off?.(); this.#off = undefined; this.#listeners.clear(); this.#snapshot = initial('disposed'); }
}
