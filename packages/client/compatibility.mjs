/**
 * Client-side ZCode version banner preference (R19).
 *
 * The banner preference is the bridge's own local UI setting (R14): it is stored under its own
 * key and never touches ZCode-managed data. It only hides the reminder — it does not clear the
 * host fail-safe (R20), which lives in the host's per-connection state.
 *
 * Modes:
 *  - once:             current client display session only; not persisted.
 *  - this-version:     persists the exact ZCode version key; a later higher version re-reminds.
 *  - new-next-version: persists and also skips the immediately next higher version once; a
 *                      subsequent even-higher version re-reminds.
 */
import { compareVersions, DISMISS_MODES, BRIDGE_PLUGIN_VERSIONS, parseVersion } from '../host/compatibility.mjs';

export const DISMISS_STORAGE_KEY = 'dsh.zcode.compat-dismiss';
export const CLIENT_PLUGIN_VERSION = BRIDGE_PLUGIN_VERSIONS.client;

const emptyState = () => ({ once: [], thisVersion: [], newNextVersion: [] });

/** Tolerant parse: a malformed/foreign value is treated as "no dismiss recorded", never thrown. */
export function parseDismissState(raw) {
  if (typeof raw !== 'string' || !raw) return emptyState();
  let value;
  try { value = JSON.parse(raw) } catch { return emptyState() }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyState();
  const versions = list => Array.isArray(list) ? list.filter(item => typeof item === 'string' && parseVersion(item) !== null) : [];
  const newNextVersion = Array.isArray(value.newNextVersion) ? value.newNextVersion
    .filter(entry => entry && typeof entry.from === 'string' && parseVersion(entry.from) !== null)
    .map(entry => ({ from: entry.from, skipped: typeof entry.skipped === 'string' && parseVersion(entry.skipped) !== null ? entry.skipped : null })) : [];
  return { once: [], thisVersion: versions(value.thisVersion), newNextVersion };
}

export function serializeDismissState(state) {
  return JSON.stringify({ v: 1, thisVersion: state.thisVersion, newNextVersion: state.newNextVersion });
}

/** Apply one dismiss choice. `once` stays in memory; the other two persist. */
export function dismissBanner(state, mode, version) {
  if (!DISMISS_MODES.includes(mode)) throw Object.assign(new Error('dismiss-mode-invalid'), { code: 'dismiss-mode-invalid' });
  if (typeof version !== 'string' || parseVersion(version) === null) throw Object.assign(new Error('dismiss-version-invalid'), { code: 'dismiss-version-invalid' });
  const next = { once: [...state.once], thisVersion: [...state.thisVersion], newNextVersion: state.newNextVersion.map(entry => ({ ...entry })) };
  let persisted = false;
  if (mode === 'once') { if (!next.once.includes(version)) next.once.push(version) }
  else if (mode === 'this-version') { if (!next.thisVersion.includes(version)) { next.thisVersion.push(version); persisted = true } }
  else if (!next.newNextVersion.some(entry => entry.from === version)) { next.newNextVersion.push({ from: version, skipped: null }); persisted = true }
  return { state: next, persisted };
}

/**
 * Decide whether the warning banner is visible for a compatibility classification. May record the
 * one-time skip for `new-next-version`; returns the (possibly updated) state.
 * A classification that is not `newer-unverified` never shows the newer-version banner.
 */
export function bannerDecision(state, compatibility) {
  const next = { once: [...state.once], thisVersion: [...state.thisVersion], newNextVersion: state.newNextVersion.map(entry => ({ ...entry })) };
  if (compatibility?.state !== 'newer-unverified') return { state: next, visible: false, reason: compatibility?.state ?? 'unknown', persisted: false };
  const version = compatibility.actual?.version ?? null;
  if (version === null) return { state: next, visible: false, reason: 'version-undetermined', persisted: false };
  if (next.once.includes(version)) return { state: next, visible: false, reason: 'dismissed-once', persisted: false };
  if (next.thisVersion.includes(version)) return { state: next, visible: false, reason: 'dismissed-this-version', persisted: false };
  let persisted = false;
  for (const entry of next.newNextVersion) {
    if (version === entry.from) return { state: next, visible: false, reason: 'dismissed-new-next-version', persisted: false };
    if (compareVersions(version, entry.from) > 0) {
      if (entry.skipped === null) { entry.skipped = version; return { state: next, visible: false, reason: 'dismissed-new-next-version', persisted: true } }
      if (version === entry.skipped) return { state: next, visible: false, reason: 'dismissed-new-next-version', persisted: false };
      if (compareVersions(version, entry.skipped) > 0) continue; // a later version re-reminds
    }
  }
  return { state: next, visible: true, reason: 'newer-than-highest-verified', persisted };
}

/** Host and client plugin versions must agree; otherwise an installed update needs a restart. */
export function restartRequired(compatibility) {
  if (!compatibility || typeof compatibility !== 'object') return false;
  const running = compatibility.bridge?.version;
  return typeof running !== 'string' || running !== BRIDGE_PLUGIN_VERSIONS.client;
}

/** Local dismiss preference store with an injectable storage (defaults to localStorage). */
export class CompatibilityStore {
  #storage; #listeners = new Set(); #snapshot; #closed = false;
  constructor({ storage } = {}) {
    this.#storage = storage ?? (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : undefined);
    this.#snapshot = { state: this.#load(), error: null, revision: 0 };
  }
  #load() {
    try { return parseDismissState(this.#storage?.getItem(DISMISS_STORAGE_KEY)) }
    catch { return emptyState() }
  }
  #persist(state) {
    try { this.#storage?.setItem(DISMISS_STORAGE_KEY, serializeDismissState(state)); this.#snapshot = { state, error: null, revision: this.#snapshot.revision + 1 } }
    catch { this.#snapshot = { state, error: 'local-settings-write-failed', revision: this.#snapshot.revision + 1 } }
    for (const listener of Array.from(this.#listeners)) { try { listener(this) } catch { /* observer teardown cannot block */ } }
  }
  getSnapshot = () => this.#snapshot;
  subscribe = listener => { if (this.#closed) return () => {}; this.#listeners.add(listener); return () => this.#listeners.delete(listener) };
  dismiss(mode, version) {
    if (this.#closed) throw Object.assign(new Error('disposed'), { code: 'disposed' });
    const { state, persisted } = dismissBanner(this.#snapshot.state, mode, version);
    if (persisted) this.#persist(state); else this.#snapshot = { state, error: this.#snapshot.error, revision: this.#snapshot.revision + 1 };
    return this.#snapshot;
  }
  /** Reconcile the one-time `new-next-version` skip and return the banner decision.
   *  This records the skip quietly (no listener notification) so it is safe to call during render. */
  decide(compatibility) {
    const { state, visible, reason, persisted } = bannerDecision(this.#snapshot.state, compatibility);
    if (persisted) {
      this.#snapshot = { state, error: null, revision: this.#snapshot.revision };
      try { this.#storage?.setItem(DISMISS_STORAGE_KEY, serializeDismissState(state)) }
      catch { this.#snapshot = { ...this.#snapshot, error: 'local-settings-write-failed' } }
    }
    return { visible, reason, version: compatibility?.actual?.version ?? null, highestVerified: compatibility?.highestVerified ?? null, restartRequired: restartRequired(compatibility) };
  }
  dispose() { this.#closed = true; this.#listeners.clear() }
}
