import { afterEach, beforeEach, expect, it } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StatusCard } from '../packages/client/lib/client-test.mjs';
import { CompatibilityStore, parseDismissState } from '../packages/client/compatibility.mjs';
import { runtimeSessionKey, parseRuntimeSessionAddress } from '@deepseek-ai/dsh-api-session-controller/client';
import { B02 } from './fixtures/b02.mjs';

afterEach(cleanup);
beforeEach(() => { try { localStorage.clear() } catch { /* jsdom storage optional */ } });

const memoryStorage = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v) }, removeItem: (k: string) => { map.delete(k) } };
};

const classification = (overrides: Record<string, unknown> = {}) => {
  const version = (overrides.actual as any)?.version ?? '3.15.0';
  return {
    state: 'newer-unverified', reason: 'newer-than-highest-verified', actual: { version, build: `${version}.1`, sha256: 'x' },
    highestVerified: '3.14.4', verified: false, digestMatches: false, incompatible: false, failSafe: 'non-core', bannerRequired: true,
    bridge: { version: '0.1.0', plugins: { host: '0.1.0', client: '0.1.0' } }, ...overrides,
  };
};

it('persists this-version and new-next-version dismissals but never once', () => {
  const storage = memoryStorage();
  const store = new CompatibilityStore({ storage });
  store.dismiss('once', '3.15.0');
  store.dismiss('this-version', '3.15.0');
  store.dismiss('new-next-version', '3.16.0');
  const persisted = parseDismissState(storage.getItem('dsh.zcode.compat-dismiss'));
  expect(persisted.thisVersion).toContain('3.15.0');
  expect(persisted.newNextVersion.map(entry => entry.from)).toContain('3.16.0');
  expect(persisted.once).toHaveLength(0);
  const reloaded = new CompatibilityStore({ storage });
  expect(reloaded.decide(classification()).visible).toBe(false);
  // Skip-next is one-shot and stored quietly by decide(); a subsequent version re-reminds.
  expect(reloaded.decide(classification({ actual: { version: '3.16.1', build: '3.16.1.1', sha256: 'x' } })).visible).toBe(false);
  expect(reloaded.decide(classification({ actual: { version: '3.16.2', build: '3.16.2.1', sha256: 'x' } })).visible).toBe(true);
});

it('keeps once in memory only and re-reminds on reload', () => {
  const storage = memoryStorage();
  const store = new CompatibilityStore({ storage });
  store.dismiss('once', '3.15.0');
  expect(store.decide(classification()).visible).toBe(false);
  const reloaded = new CompatibilityStore({ storage });
  expect(reloaded.decide(classification()).visible).toBe(true);
});

it('renders the warning banner with three dismiss modes and hides it locally', async () => {
  const status = { state: 'restricted', reason: 'runtime-unverified', auth: 'unavailable', connected: true, compatibility: classification(), failSafe: { level: 'none', incompatible: false, isolated: [] } };
  const rpc = { call: async () => ({ ok: true, value: status }) };
  render(React.createElement(StatusCard, { rpc, connectionState: { subscribe: () => () => {} } }));
  await waitFor(() => expect(screen.getByTestId('zcode-version-banner')).toBeTruthy());
  expect(screen.getByTestId('zcode-dismiss-once')).toBeTruthy();
  expect(screen.getByTestId('zcode-dismiss-this-version')).toBeTruthy();
  expect(screen.getByTestId('zcode-dismiss-new-next-version')).toBeTruthy();
  fireEvent.click(screen.getByTestId('zcode-dismiss-this-version'));
  await waitFor(() => expect(screen.queryByTestId('zcode-version-banner')).toBeNull());
  expect(parseDismissState(localStorage.getItem('dsh.zcode.compat-dismiss')).thisVersion).toContain('3.15.0');
});

it('shows an unknown version as neutral, never as available', async () => {
  const status = { state: 'restricted', reason: 'runtime-unverified', auth: 'unavailable', connected: true, compatibility: classification({ state: 'unknown', reason: 'version-undetermined', actual: { version: null, build: null, sha256: null }, bannerRequired: false }), failSafe: { level: 'none', incompatible: false, isolated: [] } };
  const rpc = { call: async () => ({ ok: true, value: status }) };
  render(React.createElement(StatusCard, { rpc, connectionState: { subscribe: () => () => {} } }));
  await waitFor(() => expect(screen.getByTestId('zcode-version-neutral')).toBeTruthy());
  expect(screen.queryByTestId('zcode-version-banner')).toBeNull();
});

it('dismissing the banner never clears the core fail-safe', async () => {
  const status = { state: 'restricted', reason: 'runtime-unverified', auth: 'unavailable', connected: true, compatibility: classification(), failSafe: { level: 'core', incompatible: true, stopsNewSideEffects: true, isolated: [] } };
  const rpc = { call: async () => ({ ok: true, value: status }) };
  render(React.createElement(StatusCard, { rpc, connectionState: { subscribe: () => () => {} } }));
  await waitFor(() => expect(screen.getByTestId('zcode-version-banner')).toBeTruthy());
  expect(screen.getByTestId('zcode-failsafe-core')).toBeTruthy();
  fireEvent.click(screen.getByTestId('zcode-dismiss-new-next-version'));
  await waitFor(() => expect(screen.queryByTestId('zcode-version-banner')).toBeNull());
  expect(screen.getByTestId('zcode-failsafe-core')).toBeTruthy();
});

it('isolates a non-core denial and reports restart-required for an inactive update', async () => {
  const status = { state: 'restricted', reason: 'official-auth-source-missing', auth: 'unavailable', connected: true, compatibility: classification({ state: 'verified', reason: 'exact-verified-tuple', actual: { version: '3.14.4', build: '3.14.4.7912', sha256: 'fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f' }, bannerRequired: false, bridge: { version: '0.1.1', plugins: { host: '0.1.1', client: '0.1.1' } } }), failSafe: { level: 'non-core', incompatible: false, isolated: [{ capability: 'directory', code: 'catalog-result-invalid' }] } };
  const rpc = { call: async () => ({ ok: true, value: status }) };
  render(React.createElement(StatusCard, { rpc, connectionState: { subscribe: () => () => {} } }));
  await waitFor(() => expect(screen.getByTestId('zcode-failsafe-isolated')).toBeTruthy());
  expect(screen.getByTestId('zcode-restart-required')).toBeTruthy();
});

it('keeps native and ZCode runtime identities distinct for the same session id', () => {
  const nativeKey = runtimeSessionKey(B02.D1 as never), zcodeKey = runtimeSessionKey(B02.Z1 as never);
  expect(nativeKey).not.toBe(zcodeKey);
  expect(parseRuntimeSessionAddress(B02.D1 as never).runtime).toBe('native');
  expect(parseRuntimeSessionAddress(B02.Z1 as never).runtime).toBe('zcode');
  expect(nativeKey).toContain(B02.D1.sessionId);
  expect(zcodeKey).toContain(B02.Z1.sessionId);
});
