import { afterEach, expect, it } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { InsightsStore } from '../packages/client/insights.mjs';
import { ZCodeInsightsPanel, SessionUsage } from '../packages/client/insights-view.jsx';

afterEach(cleanup);
const read = (name: string) => JSON.parse(readFileSync(`tests/fixtures/s14/${name}`, 'utf8'));
const usage = read('usage.json');
const account = read('account.json');
const unknown = read('unknown.json');
const admitted = { allowed: true, reason: null };

type Options = { usageResult?: any; usageError?: boolean; diagnosticsResult?: any; account?: any; gated?: any; resourceSample?: any; admission?: any };
function harness(options: Options = {}) {
  const calls: any[] = [];
  const rpc = { call: async (_channel: string, _endpoint: string, payload: any) => {
    calls.push(payload);
    if (payload.operation === 'state') return { ok: true, value: { account: options.account ?? account.account, gated: 'gated' in options ? options.gated : account.gated, resourceSample: options.resourceSample ?? null, admission: options.admission ?? admitted } };
    if (payload.kind === 'usageStats') return options.usageError ? { ok: false, error: { code: 'insights-result-invalid', message: 'bad' } } : { ok: true, value: options.usageResult ?? usage.emptyUsage };
    return { ok: true, value: options.diagnosticsResult ?? usage.childProcesses };
  } };
  return { rpc, calls };
}
async function mount(options: Options = {}) {
  const h = harness(options); const store = new InsightsStore(h.rpc);
  render(React.createElement(ZCodeInsightsPanel, { sources: store }));
  await act(async () => { await store.refresh(); });
  return { ...h, store };
}

it('S14 account is shown as UNKNOWN and login unavailable, never a signed-in claim', async () => {
  const { store } = await mount();
  try {
    expect(screen.getByLabelText('ZCode account, usage and diagnostics')).toBeDefined();
    const accountLine = document.querySelector('[data-account-state="unknown"]') as HTMLElement;
    expect(accountLine.textContent).toContain('UNKNOWN');
    expect(accountLine.textContent).toContain('official-account-carrier-not-exposed');
    expect(document.querySelector('[data-login-available="false"]')!.textContent).toContain('unavailable');
    expect(screen.getByText(/no official app-server carrier/i)).toBeDefined();
    expect(screen.queryByText(/signed in/i)).toBeNull();
  } finally { store.dispose(); }
});

it('S14 an empty official usage range renders an empty state, not fabricated numbers', async () => {
  const { store } = await mount();
  try {
    expect(document.querySelector('[data-usage-empty="true"]')).toBeTruthy();
    expect(document.querySelector('[data-usage="loaded"]')).toBeNull();
    expect(screen.queryByText(/123,456/)).toBeNull();
  } finally { store.dispose(); }
});

it('S14 non-empty official usage keeps units and the selected range', async () => {
  const { store, calls } = await mount({ usageResult: usage.nonEmptyUsage });
  try {
    const loaded = document.querySelector('[data-usage="loaded"]') as HTMLElement;
    expect(loaded.textContent).toContain('123,456');
    expect(loaded.textContent).toContain('100,000');
    expect(loaded.textContent).toContain('23,456');
    // modelErrorRate is a 0..1 official ratio (0.02 here): it must render as a percentage, not a raw number.
    expect(loaded.textContent).toContain('2%');
    expect(calls.some(c => c.operation === 'read' && c.kind === 'usageStats' && c.params.range === '30d')).toBe(true);
  } finally { store.dispose(); }
});

it('S14 process/MCP diagnostics list real child processes or an honest empty state', async () => {
  const { store } = await mount({ diagnosticsResult: usage.childProcessesNonEmpty });
  try {
    const rows = document.querySelectorAll('[data-process-pid]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('s14-demo');
    expect(rows[0].textContent).toContain('browser-use');
    expect(document.querySelector('[data-resource-sample="absent"]')!.textContent).toContain('No official process sample');
  } finally { store.dispose(); }
  const empty = await mount();
  try {
    expect(document.querySelector('[data-processes-empty="true"]')).toBeTruthy();
  } finally { empty.store.dispose(); }
});

it('S14 the resource sample renders bounded process metrics when the official runtime sends one', async () => {
  const { store } = await mount({ resourceSample: usage.resourceSample });
  try {
    const line = document.querySelector('[data-resource-sample="present"]') as HTMLElement;
    expect(line.textContent).toContain('123,456');
    expect(line.textContent).toContain('6.25');
  } finally { store.dispose(); }
});

it('S14 auxiliary generation is presented gated and is never invoked', async () => {
  const { store, calls } = await mount();
  try {
    for (const kind of ['generateText', 'cancelGenerateText', 'testModelConnectivity']) {
      const entry = document.querySelector(`[data-gated-kind="${kind}"]`) as HTMLElement;
      expect(entry.textContent).toContain('unavailable');
      expect(entry.textContent).toContain('model-execution-gated');
    }
    expect(calls.some(c => c.operation === 'read' && String(c.kind).includes('generate'))).toBe(false);
    expect(calls.some(c => c.operation === 'read' && String(c.kind).includes('Connectivity'))).toBe(false);
  } finally { store.dispose(); }
});

it('S14 an unconnected panel names the connection reason instead of an unrecognized-entry fallback', async () => {
  const { store } = await mount({ gated: null, admission: { allowed: false, reason: 'not-connected' } });
  try {
    for (const kind of ['generateText', 'cancelGenerateText', 'testModelConnectivity']) {
      const entry = document.querySelector(`[data-gated-kind="${kind}"]`) as HTMLElement;
      expect(entry.textContent).toContain('not-connected');
      expect(entry.textContent).not.toContain('Unrecognized official entry');
    }
  } finally { store.dispose(); }
});

it('S14 a denied usage section fails closed while diagnostics still render', async () => {
  const { store } = await mount({ usageError: true, diagnosticsResult: usage.childProcessesNonEmpty });
  try {
    expect(screen.getByText(/insights-result-invalid/)).toBeDefined();
    expect(document.querySelector('[data-usage-empty="true"]')).toBeNull();
    expect(document.querySelectorAll('[data-process-pid]').length).toBe(2);
  } finally { store.dispose(); }
});

it('S14 an unknown future account state degrades without inventing a fact', async () => {
  const { store } = await mount({ account: unknown.accountUnknown });
  try {
    const line = document.querySelector('[data-account-state="future_state"]') as HTMLElement;
    expect(line.textContent).toContain('future_state');
    expect(line.textContent).toContain('future-reason');
    expect(screen.queryByText(/signed in/i)).toBeNull();
  } finally { store.dispose(); }
});

it('S14 session usage is read on demand and renders the scoped official aggregate or rejection', async () => {
  const loaded = { sessionUsage: () => Promise.resolve(usage.nonEmptySessionUsage) };
  render(React.createElement(SessionUsage, { conversation: loaded as any }));
  // Opening a session must not issue an extra official query: only the affordance renders.
  expect(document.querySelector('[data-session-usage="idle"]')).toBeTruthy();
  fireEvent.click(screen.getByText('Session usage'));
  await act(async () => {});
  expect(document.querySelector('[data-session-usage="loaded"]')!.textContent).toContain('4,200');
  cleanup();
  const failed = { sessionUsage: () => Promise.reject(Object.assign(new Error('rejected'), { code: 'runtime-rejected' })) };
  render(React.createElement(SessionUsage, { conversation: failed as any }));
  fireEvent.click(screen.getByText('Session usage'));
  await act(async () => {});
  expect(document.querySelector('[data-session-usage="error"]')!.textContent).toContain('runtime-rejected');
});
