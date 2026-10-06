import { afterEach, expect, it } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { RemoteStore } from '../packages/client/remote.mjs';
import { ZCodeRemotePanel, remoteLocales } from '../packages/client/remote-view.jsx';
import { ZCodeDirectory } from '../packages/client/directory-view.jsx';
afterEach(cleanup);
const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/remote-workspace/${name}.json`, 'utf8'));
const empty = fixture('empty');
async function mount(value = empty.remote, locale = 'en') {
  const calls: any[] = [];
  const store = new RemoteStore({ call: async (...args: any[]) => { calls.push(args); return { ok: true, value }; } });
  const t = (key: string) => (remoteLocales as any)[locale][key];
  render(React.createElement(ZCodeRemotePanel, { sources: store, t }));
  await act(async () => { await store.refresh(); });
  return { store, calls };
}
it('Remote workspace shows genuine local scope and remote UNKNOWN, never a fake connected session or empty remote list', async () => {
  const { store, calls } = await mount();
  try {
    expect(screen.getByLabelText('ZCode remote workspaces and sessions')).toBeDefined();
    expect(document.querySelector('[data-remote-available="false"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-remote-inventory]').length).toBe(2);
    expect(document.querySelector('[data-remote-inventory="sessions"]')?.textContent).toContain('UNKNOWN');
    expect(document.querySelector('[data-local-scope]')?.textContent).toContain('/fixture/remote-workspace-workspace');
    expect(document.querySelector('[data-remote-connection="connected"]')).toBeNull();
    expect(screen.queryByText(/No remote sessions/i)).toBeNull();
    expect(calls.every(([, endpoint, payload]) => endpoint === 'remote' && Object.keys(payload).length === 1 && payload.operation === 'state')).toBe(true);
  } finally { store.dispose(); }
});
it('Remote workspace preserves SSH/WSL/Docker individually and explains the precise macOS-to-local-WSL boundary', async () => {
  const { store } = await mount();
  try {
    expect(document.querySelectorAll('[data-remote-target]').length).toBe(3);
    expect(document.querySelector('[data-remote-target="wsl"]')?.textContent).toContain('wsl-requires-windows-host');
    expect(screen.getByText(/Local WSL discovery and launch require a Windows Host/)).toBeDefined();
    expect(document.querySelector('[data-remote-target="ssh"]')?.textContent).toContain('remote-connection-carrier-not-exposed');
    expect(screen.queryByRole('button', { name: /Connect|SSH|WSL/ })).toBeNull();
  } finally { store.dispose(); }
});
it('Remote workspace disconnect fixture clears local identity and stays unavailable without fake rows', async () => {
  const { store } = await mount(fixture('restricted').remote);
  try { expect(document.querySelector('[data-local-scope]')).toBeNull(); expect(screen.getByRole('status').textContent).toContain('host-unreachable'); }
  finally { store.dispose(); }
});
it('Remote workspace unknown future transport is a visible parse failure and cannot claim availability', async () => {
  const { store } = await mount(fixture('unknown').remote);
  try { expect(screen.getByRole('alert').textContent).toContain('remote-projection-invalid'); expect(document.querySelectorAll('[data-remote-target]').length).toBe(0); expect(document.querySelector('[data-local-scope]')).toBeNull(); }
  finally { store.dispose(); }
});
it('Remote workspace refresh failure replaces loaded scope and exposes the rejection', async () => {
  let fail = false;
  const store = new RemoteStore({ call: async () => fail ? { ok: false, error: { code: 'host-down', message: 'Disconnected' } } : { ok: true, value: empty.remote } });
  render(React.createElement(ZCodeRemotePanel, { sources: store }));
  try {
    await act(async () => { await store.refresh(); }); expect(document.querySelector('[data-local-scope]')).toBeTruthy();
    fail = true; await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh status' })); });
    expect(screen.getByRole('alert').textContent).toContain('host-down'); expect(document.querySelector('[data-local-scope]')).toBeNull();
  } finally { store.dispose(); }
});
it('Remote workspace Chinese presentation keeps UNKNOWN and the unavailable reason visible', async () => {
  const { store } = await mount(empty.remote, 'zh');
  try { expect(screen.getByLabelText('ZCode 远程工作区与会话')).toBeDefined(); expect(screen.getByRole('status').textContent).toContain('远程管理不可用'); expect(document.querySelector('[data-remote-inventory="workspaces"]')?.textContent).toContain('UNKNOWN'); }
  finally { store.dispose(); }
});
it('Remote workspace sidebar reuses the existing runtime directory seam to select the remote panel', () => {
  let selected = '';
  const snapshot = { query: '', rows: [], catalog: { truncated: false }, page: 0, pageSize: 20, total: 0 };
  const availability = { state: 'restricted' };
  const sources = { directory: { getSnapshot: () => snapshot, subscribe: () => () => {} }, zcodeAvailability: { getSnapshot: () => availability, subscribe: () => () => {} } };
  render(React.createElement(ZCodeDirectory, { sources, onOpenRemote: () => { selected = 'zcode-remote'; } }));
  fireEvent.click(screen.getByRole('button', { name: 'Remote workspaces and sessions' }));
  expect(selected).toBe('zcode-remote');
});
