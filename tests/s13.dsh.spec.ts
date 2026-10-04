import { afterEach, expect, it } from 'vitest';
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { AutomationStore } from '../packages/client/automation.mjs';
import { ZCodeAutomationPanel } from '../packages/client/automation-view.jsx';

afterEach(cleanup);
const read = (name: string) => JSON.parse(readFileSync(`tests/fixtures/s13/${name}`, 'utf8'));
const restricted = read('restricted.json');
const carriers = [
  { name: 'automationList', method: 'automation/list', domain: 'automation', direction: 'cli-to-host-reverse', requestable: false },
  { name: 'automationDelete', method: 'automation/delete', domain: 'automation', direction: 'cli-to-host-reverse', requestable: false },
];
const offPeakCarriers = [{ name: 'offPeakList', method: 'offPeak/list', domain: 'offPeak', direction: 'cli-to-host-reverse', requestable: false }];
const honest = {
  admission: { allowed: false, reason: 'official-host-consumed-reverse-carrier' },
  management: { available: false, reason: 'official-host-consumed-reverse-carrier', carriers },
  offPeak: { available: false, reason: 'official-host-consumed-reverse-carrier', entitlement: restricted.offPeakEntitlement, carriers: offPeakCarriers },
  runFeedback: { available: false, reason: 'no-official-projection-carrier', execution: { state: 'gated', reason: 'model-execution-gated' } },
  account: restricted.account,
  reverse: { allowed: true, reason: 'official-host-consumed-reverse-carrier', records: [] },
};

type Options = { value?: any; error?: { code: string; message: string } };
function harness(options: Options = {}) {
  const calls: any[] = [];
  const rpc = { call: async (_channel: string, _endpoint: string, payload: any) => {
    calls.push(payload);
    if (options.error) return { ok: false, error: options.error };
    return { ok: true, value: options.value ?? honest };
  } };
  return { rpc, calls };
}
async function mount(options: Options = {}) {
  const h = harness(options); const store = new AutomationStore(h.rpc);
  render(React.createElement(ZCodeAutomationPanel, { sources: store }));
  await act(async () => { await store.refresh(); });
  return { ...h, store };
}

it('S13 automation management is unavailable with the reverse-carrier reason and never a request surface', async () => {
  const { store, calls } = await mount();
  try {
    expect(screen.getByLabelText('ZCode automations and off-peak')).toBeDefined();
    const line = document.querySelector('[data-automation-management-available="false"]') as HTMLElement;
    expect(line.textContent).toContain('unavailable');
    expect(line.getAttribute('data-automation-management-reason')).toBe('official-host-consumed-reverse-carrier');
    const carrier = document.querySelector('[data-automation-carrier="automation/list"]') as HTMLElement;
    expect(carrier.textContent).toContain('cli-to-host-reverse');
    expect(carrier.textContent).toContain('Requestable: false');
    // Only the state operation is requested; no management carrier is ever called.
    expect(calls.every(c => c.operation === 'state')).toBe(true);
    expect(screen.queryByText(/created/i)).toBeNull();
  } finally { store.dispose(); }
});

it('S13 off-peak is unavailable with UNKNOWN entitlement, not a guessed plan state', async () => {
  const { store } = await mount();
  try {
    const offPeak = document.querySelector('[data-offpeak-available="false"]') as HTMLElement;
    expect(offPeak.getAttribute('data-offpeak-reason')).toBe('official-host-consumed-reverse-carrier');
    const entitlement = document.querySelector('[data-offpeak-entitlement="unknown"]') as HTMLElement;
    expect(entitlement.textContent).toContain('UNKNOWN');
    expect(entitlement.textContent).toContain('off-peak-entitlement-is-host-service-only');
    expect(screen.queryByText(/eligible/i)).toBeNull();
  } finally { store.dispose(); }
});

it('S13 run feedback has no official projection and execution stays gated, never fabricated', async () => {
  const { store } = await mount();
  try {
    const feedback = document.querySelector('[data-runfeedback-available="false"]') as HTMLElement;
    expect(feedback.getAttribute('data-runfeedback-reason')).toBe('no-official-projection-carrier');
    const execution = document.querySelector('[data-runfeedback-execution="gated"]') as HTMLElement;
    expect(execution.textContent).toContain('model-execution-gated');
    expect(document.querySelector('[data-runfeedback="loaded"]')).toBeNull();
  } finally { store.dispose(); }
});

it('S13 account state stays UNKNOWN in the automation panel', async () => {
  const { store } = await mount();
  try {
    const account = document.querySelector('[data-automation-account-state="unknown"]') as HTMLElement;
    expect(account.textContent).toContain('official-account-carrier-not-exposed');
    expect(screen.queryByText(/signed in/i)).toBeNull();
  } finally { store.dispose(); }
});

it('S13 reverse automation callbacks render as refused observations, with an honest empty state', async () => {
  const empty = await mount();
  try {
    expect(document.querySelector('[data-reverse-empty="true"]')).toBeTruthy();
    expect(screen.getByText(/No official automation callback/)).toBeDefined();
  } finally { empty.store.dispose(); }
  const withRecords = await mount({ value: { ...honest, reverse: restricted.reverse } });
  try {
    const records = document.querySelectorAll('[data-reverse-record]');
    expect(records.length).toBe(2);
    expect(records[0].getAttribute('data-reverse-status')).toBe('rejected');
    expect(records[0].textContent).toContain('official-host-consumed-reverse-carrier');
    // The expired/unknown identity is shown as refused, never as a successful deletion.
    expect(records[1].textContent).toContain('s13-expired-automation');
    expect(screen.queryByText(/deleted/i)).toBeNull();
  } finally { withRecords.store.dispose(); }
});

it('S13 a denied automation projection fails closed without fabricated task rows', async () => {
  const { store } = await mount({ error: { code: 'automation-unavailable', message: 'host-down' } });
  try {
    expect(screen.getByText(/automation-unavailable/)).toBeDefined();
    // No section ever claims availability or a created task after a denied projection.
    expect(document.querySelector('[data-automation-management-available="true"]')).toBeNull();
    expect(document.querySelectorAll('[data-reverse-record]').length).toBe(0);
    expect(screen.queryByText(/created/i)).toBeNull();
  } finally { store.dispose(); }
});
