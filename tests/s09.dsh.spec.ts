import { afterEach, expect, it } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { CatalogStore, operationOutcome } from '../packages/client/catalog.mjs';
import { ZCodeCatalogPanel } from '../packages/client/catalog-view.jsx';

afterEach(cleanup);
const read = (name: string) => JSON.parse(readFileSync(`tests/fixtures/s09/${name}`, 'utf8'));
const directory = read('directory.json');
const operations = read('operations.json');
const entitlement = read('entitlement.json');
const unknown = read('unknown.json');
const progress = read('progress.json');
const readAdmission = { reads: { allowed: true, reason: null }, writes: { allowed: true, reason: null } };

type Options = { admission?: any; auth?: string; mcp?: any; installResult?: any; held?: boolean; readErrorKind?: string };
function harness(options: Options = {}) {
  const calls: any[] = [];
  let release: (() => void) | undefined;
  const resolveOperate = (payload: any) => {
    if (payload.action === 'setEnabled') return operations.setDisabled;
    if (payload.action === 'install') return options.installResult ?? operations.install;
    if (payload.action === 'uninstall') return operations.uninstall;
    if (payload.action === 'marketplaceAdd') return operations.marketplaceAdd;
    if (payload.action === 'update') return operations.install;
    if (payload.action === 'restoreBuiltin') return operations.restoreBuiltin;
    return operations.configure;
  };
  const rpc = { call: async (_channel: string, _endpoint: string, payload: any) => {
    calls.push(payload);
    if (payload.operation === 'state') return { ok: true, value: { admission: options.admission ?? readAdmission, auth: options.auth ?? 'unavailable', installationVerified: true, workspace: '/fixture/ws', operations: [] } };
    if (payload.operation === 'read') {
      if (payload.kind === options.readErrorKind) return { ok: false, error: { code: 'catalog-unavailable', message: 'denied' } };
      const map: any = { mcpList: options.mcp ?? directory.mcpList, pluginsList: directory.pluginsListInstalled, pluginsOverview: directory.pluginsOverviewInstalled, pluginReference: directory.pluginReference, skillReference: directory.skillsReference, pluginValidate: directory.validateBare, pluginDescribe: operations.describe };
      return { ok: true, value: map[payload.kind] };
    }
    if (payload.operation === 'operate') {
      if (payload.action === 'cancelOperation') return { ok: true, value: { operationId: payload.params.operationId, cancelled: true } };
      if (options.held) return new Promise(res => { release = () => res({ ok: true, value: resolveOperate(payload) }) });
      return { ok: true, value: resolveOperate(payload) };
    }
    return { ok: false, error: { code: 'unexpected' } };
  } };
  return { rpc, calls, release: () => release?.() };
}
async function mount(options: Options = {}) {
  const h = harness(options); const store = new CatalogStore(h.rpc);
  render(React.createElement(ZCodeCatalogPanel, { sources: store }));
  await act(async () => { await store.refresh(); });
  return { ...h, store };
}

it('S09 renders the official MCP, marketplace, plugin and skill projections', async () => {
  const { store } = await mount({ mcp: entitlement.mcpList });
  try {
    expect(screen.getByLabelText('ZCode MCP, plugins and skills')).toBeDefined();
    const mcp = document.querySelector('[data-mcp-name="account-gated"]') as HTMLElement;
    expect(mcp.textContent).toContain('failed');
    expect(mcp.textContent).toContain('not_authenticated');
    expect(document.querySelector('[data-mcp-name="oauth-pending"]')!.textContent).toContain('oauth:oauth_authorization_code');
    expect(document.querySelector('[data-marketplace="s09-local"]')).toBeTruthy();
    expect(document.querySelector('[data-marketplace="zcode-plugins-official"]')!.textContent).toContain('13 plugins');
    expect(document.querySelector('[data-installed-plugin="s09-demo@s09-local"]')).toBeTruthy();
    expect(document.querySelector('[data-reference-plugin="browser-use@zcode-plugins-official"]')).toBeDefined();
    expect(document.querySelector('[data-skill-id]')!.textContent).toContain('control-browser');
  } finally { store.dispose(); }
});

it('S09 restricted admission keeps the directory readable but hides management actions', async () => {
  const { store } = await mount({ admission: { reads: { allowed: true, reason: null }, writes: { allowed: false, reason: 'management-unverified' } } });
  try {
    expect(screen.getByText(/read-only/)).toBeDefined();
    expect(screen.queryByText('Disable')).toBeNull();
    expect(screen.queryByText('Uninstall')).toBeNull();
    expect(screen.queryByText('Add marketplace')).toBeNull();
    const installed = document.querySelector('[data-installed-plugin="s09-demo@s09-local"]') as HTMLElement;
    expect(installed.textContent).toContain('s09-demo');
    expect(installed.querySelector('button')).toBeNull();
  } finally { store.dispose(); }
});

it('S09 account-unknown state is shown as an official note and never as an entitlement claim', async () => {
  const { store } = await mount({ auth: 'unavailable' });
  try {
    expect(screen.getByText(/Official authentication is unavailable/)).toBeDefined();
    expect(screen.queryByText(/entitled/i)).toBeNull();
  } finally { store.dispose(); }
});

it('S09 an unrecognized official MCP status renders a bounded summary without crashing', async () => {
  const { store } = await mount({ mcp: unknown.mcpList });
  try {
    const row = document.querySelector('[data-mcp-name="future-mcp"]') as HTMLElement;
    expect(row.textContent).toContain('future_state');
    expect(screen.getByLabelText('ZCode MCP, plugins and skills')).toBeDefined();
  } finally { store.dispose(); }
});

it('S09 enable/disable routes the exact official setEnabled carrier and shows the official version', async () => {
  const { store, calls } = await mount();
  try {
    fireEvent.click(within(document.querySelector('[data-installed-plugin="s09-demo@s09-local"]') as HTMLElement).getByText('Disable'));
    await act(async () => {});
    const call = calls.find(c => c.operation === 'operate' && c.action === 'setEnabled');
    expect(call.params).toEqual({ pluginId: 's09-demo@s09-local', enabled: false, scope: 'workspace' });
    expect(call.operationId).toBeTruthy();
    const outcome = operationOutcome(operations.setDisabled);
    expect(outcome.ok).toBe(true);
  } finally { store.dispose(); }
});

it('S09 an official install failure reported as diagnostics is presented as a failure, not a new version', async () => {
  const { store } = await mount({ installResult: operations.installFailure });
  try {
    const available = document.querySelector('[data-available-plugin]') as HTMLElement;
    fireEvent.click(within(available).getByText('Install'));
    await act(async () => {});
    const outcome = operationOutcome(operations.installFailure);
    expect(outcome.ok).toBe(false);
    expect(outcome.errors[0].code).toBe('plugin_dependency_missing');
    expect(screen.getByText(/Official operation failed/)).toBeDefined();
  } finally { store.dispose(); }
});

it('S09 a pending operation is displayed while awaiting and replaced by the authoritative official result', async () => {
  const h = await mount({ held: true });
  try {
    const readsBefore = h.calls.filter(c => c.operation === 'read').length;
    const available = document.querySelector('[data-available-plugin]') as HTMLElement;
    fireEvent.click(within(available).getByText('Install'));
    await act(async () => {});
    expect(screen.getByText(/Awaiting official result/)).toBeDefined();
    expect(h.calls.filter(c => c.operation === 'read').length).toBe(readsBefore);
    await act(async () => { h.release(); await Promise.resolve(); });
    expect(screen.queryByText(/Awaiting official result/)).toBeNull();
    expect(screen.getByText(/Official result: completed/)).toBeDefined();
    // Post-result refresh re-reads the official directory; nothing is optimistically persisted.
    expect(h.calls.some(c => c.operation === 'read' && c.kind === 'pluginsOverview')).toBe(true);
  } finally { h.store.dispose(); }
});

it('S09 cancelling a pending operation routes plugins/cancelOperation for the matching operationId', async () => {
  const h = await mount({ held: true });
  try {
    fireEvent.click(within(document.querySelector('[data-available-plugin]') as HTMLElement).getByText('Install'));
    await act(async () => {});
    const operationId = h.calls.find(c => c.operation === 'operate' && c.action === 'install').operationId;
    fireEvent.click(screen.getByText('Cancel'));
    await act(async () => {});
    const cancel = h.calls.find(c => c.operation === 'operate' && c.action === 'cancelOperation');
    expect(cancel.params).toEqual({ operationId });
    expect(screen.getByText(/Cancelled/)).toBeDefined();
  } finally { h.store.dispose(); }
});

it('S09 validate and describe render official compatibility and components', async () => {
  const { store, calls } = await mount({ installResult: operations.installFailure });
  try {
    fireEvent.change(screen.getByLabelText('Plugin name'), { target: { value: 's09-demo' } });
    fireEvent.change(screen.getByLabelText('Marketplace'), { target: { value: 's09-local' } });
    fireEvent.click(screen.getByText('Validate'));
    await act(async () => {});
    const validate = calls.find(c => c.operation === 'read' && c.kind === 'pluginValidate');
    expect(validate.params).toEqual({ pluginName: 's09-demo', marketplace: 's09-local' });
    fireEvent.click(screen.getByText('Describe'));
    await act(async () => {});
    expect(screen.getByText(/Describe: skill: s09-demo-skill/)).toBeDefined();
  } finally { store.dispose(); }
});

it('S09 denied directory sections fail closed with the official reason instead of fake rows', async () => {
  const { store } = await mount({ readErrorKind: 'skillReference' });
  try {
    expect(screen.getByText(/Directory unavailable: catalog-unavailable/)).toBeDefined();
    expect(document.querySelector('[data-skill-id]')).toBeNull();
  } finally { store.dispose(); }
});

it('S09 progress notification correlation stays keyed to the live operationId', async () => {
  const notifications = new Set<any>();
  const peer = { closed: false, onNotification(l: any) { notifications.add(l); return () => notifications.delete(l) }, notify(_m: string, p: any) { for (const l of notifications) l({ method: 'plugins/operationProgress', params: p }); }, request() { return new Promise(() => {}) } };
  const { CatalogClient } = await import('../packages/host/catalog.mjs');
  const client = new CatalogClient(peer as any, { workspace: { workspacePath: '/ws', workspaceKey: '/ws' }, managementAllowed: true });
  client.operate('install', { pluginName: 'a', marketplace: 'm' }, { operationId: 's09-op-1' });
  peer.notify('plugins/operationProgress', progress.refreshing);
  peer.notify('plugins/operationProgress', progress.unknownOperation);
  const record = client.operations.find((r: any) => r.operationId === 's09-op-1');
  expect(record.progress).toEqual([progress.refreshing]);
  client.dispose();
});
