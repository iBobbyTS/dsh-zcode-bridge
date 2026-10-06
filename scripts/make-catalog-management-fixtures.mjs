// Derives reusable catalog-management fixtures from the real capture. Real official frames stay verbatim;
// every injected case is listed in provenance and is never presented as a live success.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const official = JSON.parse(await readFile('tests/fixtures/catalog-management/official.json', 'utf8'));
const value = entry => entry?.result ?? null;
const out = 'tests/fixtures/catalog-management';
await mkdir(out, { recursive: true });
const write = (name, data) => writeFile(`${out}/${name}`, JSON.stringify(data, null, 2) + '\n');

// 1) Real directory projection (verbatim official results).
const directory = {
  provenance: { kind: 'real-capture-derived', source: 'official.json', capturedAt: official.provenance.capturedAt, paidModelCalls: 0 },
  admission: official.catalogAdmission,
  auth: 'unavailable',
  installationVerified: true,
  workspace: official.provenance.version ? '/fixture/catalog-workspace' : null,
  mcpList: value(official.read.mcpListStatus),
  pluginsList: value(official.read.pluginsList),
  pluginReference: value(official.read.pluginReference),
  skillsReference: value(official.read.skillReference),
  pluginsOverview: value(official.read.pluginsOverview),
  // Real re-read after a real isolated install: contains the installed marketplace record.
  pluginsOverviewInstalled: value(official.write.overviewAfterInstall) ?? value(official.read.pluginsOverview),
  pluginsListInstalled: value(official.write.pluginsListAfterInstall) ?? value(official.read.pluginsList),
  validateBare: value(official.read.pluginValidateBare),
};
await write('directory.json', directory);

// 2) Real management results, including a real official install failure carried as diagnostics.
const operations = {
  provenance: { kind: 'real-capture-derived', source: 'official.json', injected: ['failure-result-marked-as-official-diagnostics'] },
  cancelUnknown: value(official.write.cancelUnknown),
  installFailure: value(official.write.installFailure),
  install: value(official.write.install),
  setDisabled: value(official.write.setDisabled),
  configure: value(official.write.configure),
  uninstall: value(official.write.uninstall),
  marketplaceAdd: value(official.write.marketplaceAdd),
  restoreBuiltin: value(official.write.restoreBuiltin),
  describe: value(official.write.describe),
  operations: official.operations,
};
await write('operations.json', operations);

// 3) Restricted/entitlement presentation: official MCP failure kinds and an official denial result.
//    Injected from the official schema enums (not captured because no MCP is configured in the capture).
const entitlement = {
  provenance: { kind: 'injected-from-official-schema', injected: ['mcp statuses', 'marketplace refusal diagnostics'], note: 'no live MCP was configured during capture' },
  mcpList: {
    statuses: {
      'account-gated': { status: 'failed', transport: 'stdio', toolCount: 0, updatedAt: '2026-01-01T00:00:00.000Z', failureKind: 'not_authenticated', error: 'official runtime reports no authentication' },
      'plan-gated': { status: 'failed', transport: 'http', toolCount: 0, updatedAt: '2026-01-01T00:00:00.000Z', failureKind: 'coding_plan_required' },
      'oauth-pending': { status: 'connecting', transport: 'http', toolCount: 0, updatedAt: '2026-01-01T00:00:00.000Z', authorization: { type: 'oauth_authorization_code', authorizationUrl: 'https://example.invalid/oauth', startedAt: '2026-01-01T00:00:00.000Z' } },
    },
  },
  denial: { installedPlugins: [], dependencyClosure: [], diagnostics: [{ code: 'plugin_marketplace_unavailable', message: 'Official marketplace requires an authenticated account', severity: 'error', pluginId: 'demo@zcode-plugins-official' }] },
  admission: { reads: { allowed: true, reason: null }, writes: { allowed: false, reason: 'management-unverified' } },
};
await write('entitlement.json', entitlement);

// 4) Unknown entry fail-safe: unrecognized MCP status and unrecognized operation/read kinds.
const unknown = {
  provenance: { kind: 'injected-from-official-schema', injected: ['unknown status kind', 'unknown catalog kind/action errors'] },
  mcpList: { statuses: { 'future-mcp': { status: 'future_state', transport: 'stdio', toolCount: 0, updatedAt: '2026-01-01T00:00:00.000Z' } } },
  readError: { code: 'catalog-read-unknown' },
  operationError: { code: 'catalog-operation-unknown' },
};
await write('unknown.json', unknown);

// 5) Operation progress correlation: refreshing attaches; settled/unknown operation is dropped.
const progress = {
  provenance: { kind: 'injected-from-official-schema', injected: ['progress notifications'], note: 'plugins/operationProgress official schema is {operationId,state:"refreshing"}' },
  refreshing: { operationId: 'catalog-op-1', state: 'refreshing' },
  late: { operationId: 'catalog-op-1', state: 'refreshing' },
  unknownOperation: { operationId: 'catalog-never-created', state: 'refreshing' },
  invalid: { operationId: 'catalog-op-1', state: 'downloading' },
};
await write('progress.json', progress);

console.log(JSON.stringify({ directory: Object.keys(directory).length, operations: Object.keys(operations).length, entitlement: Object.keys(entitlement).length, unknown: Object.keys(unknown).length, progress: Object.keys(progress).length }));
