// Catalog reachability capture: MCP / plugins / skills directory and management faces.
// 0 model calls. All plugin-storage writes happen under an isolated HOME/workspace;
// the real user storage is never touched because HOME is redirected before spawn.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { CatalogClient } from '../packages/host/catalog.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'zcode-catalog-ws-'));
const home = await mkdtemp(join(tmpdir(), 'zcode-catalog-home-'));
const localMarketplace = join(workspace, 'local-marketplace');
const localPlugin = join(localMarketplace, 'plugins', 'catalog-demo');
const evidence = {
  provenance: { kind: 'official-runtime-capture', capturedAt: new Date().toISOString(), paidModelCalls: 0, isolation: 'dedicated tmp HOME + workspace; real user storage untouched', sanitization: 'tmp paths aliased; stderr counted only' },
  read: {}, write: {}, errorFacts: [],
};
let child, peer, exited, catalog;

function sanitize(value) {
  let json = JSON.stringify(value, null, 2);
  json = json.split(workspace).join('/fixture/catalog-workspace').split(home).join('/fixture/catalog-home');
  return JSON.parse(json);
}
async function probe(method, params) {
  try {
    const result = await peer.request(method, params, { timeoutMs: 20000 });
    return { result: sanitize(result) };
  } catch (error) {
    evidence.errorFacts.push({ method, code: error.code, protocolCode: error.protocolCode, name: error.name });
    return { error: { code: error.code, protocolCode: error.protocolCode } };
  }
}
async function call(method, params) { return probe(method, params); }
// The product carrier is exercised for every directory/management call so the capture
// proves the actual bridge path, not only raw official wiring.
async function read(kind, params = {}) {
  try { return { result: sanitize(await catalog.read(kind, params)) }; }
  catch (error) { evidence.errorFacts.push({ kind, code: error.code, protocolCode: error.protocolCode }); return { error: { code: error.code, protocolCode: error.protocolCode } }; }
}
async function operate(action, params = {}, operationId) {
  try { return { result: sanitize(await catalog.operate(action, params, operationId ? { operationId } : {})) }; }
  catch (error) { evidence.errorFacts.push({ action, code: error.code, protocolCode: error.protocolCode }); return { error: { code: error.code, protocolCode: error.protocolCode } }; }
}

try {
  const installation = await inspectInstallation(process.argv[2] ?? '/Applications/ZCode.app');
  if (!installation.verified) throw Error('installation-unverified');
  Object.assign(evidence.provenance, { version: installation.version, build: installation.build, sha256: installation.sha256 });

  // Local official-format marketplace + plugin, so install/enable/configure have a real,
  // network-free source. Contents are synthetic test fixtures, not user data.
  await mkdir(join(localPlugin, '.zcode-plugin'), { recursive: true });
  await mkdir(join(localPlugin, 'skills', 'catalog-demo-skill'), { recursive: true });
  await writeFile(join(localPlugin, '.zcode-plugin', 'plugin.json'), JSON.stringify({ name: 'catalog-demo', version: '1.0.0', description: 'Catalog synthetic capture plugin', author: { name: 'bridge-catalog' }, license: 'MIT', skills: 'skills' }));
  await writeFile(join(localPlugin, 'skills', 'catalog-demo-skill', 'SKILL.md'), '# Catalog demo skill\n\nSynthetic reachability fixture.\n');
  await writeFile(join(localMarketplace, 'marketplace.json'), JSON.stringify({ name: 'catalog-local', description: 'Catalog synthetic local marketplace', plugins: [{ name: 'catalog-demo', source: './plugins/catalog-demo', description: 'Catalog synthetic capture plugin', version: '1.0.0' }] }));

  const env = { ...runtimeEnv(installation.providerConfig), HOME: home };
  child = spawn(installation.launcher, [installation.cjs, 'app-server', '--stdio'], { cwd: workspace, env, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { for (const line of data.toString().split('\n')) { try { const m = JSON.parse(line); if (m.error) evidence.errorFacts.push({ code: m.error.code, name: m.error.data?.name, message: (m.error.data?.stack ?? m.error.message ?? '').split('\n')[0] }); } catch { /* partial lines decoded by ProtocolPeer */ } } });
  exited = new Promise(resolve => child.once('close', resolve));
  evidence.provenance.stderrBytes = 0;
  child.stderr.on('data', b => { evidence.provenance.stderrBytes += b.length; });
  peer = new ProtocolPeer(child.stdout, child.stdin, { timeoutMs: 20000 });

  evidence.read.capabilities = await call('runtime/capabilities', {});
  catalog = new CatalogClient(peer, { workspace: { workspacePath: workspace, workspaceKey: workspace }, managementAllowed: true });
  evidence.catalogAdmission = catalog.admission;

  // ── read face ──
  evidence.read.mcpListStatus = await read('mcpList', { mode: 'status' });
  evidence.read.mcpListConnect = await read('mcpList', { mode: 'connect' });
  evidence.read.pluginsList = await read('pluginsList');
  evidence.read.pluginsListWorkspace = await read('pluginsList', { configScope: 'workspace' });
  evidence.read.pluginReference = await read('pluginReference');
  evidence.read.skillReference = await read('skillReference');
  evidence.read.pluginsOverview = await read('pluginsOverview');
  evidence.read.pluginValidateBare = await read('pluginValidate');
  evidence.read.pluginValidateMissing = await read('pluginValidate', { pluginName: 'catalog-missing', marketplace: 'catalog-local' });
  evidence.read.readUnknown = await read('unknownKind');

  // ── write face (isolated storage only) ──
  evidence.write.cancelUnknown = await operate('cancelOperation', { operationId: 'catalog-never-created' });
  evidence.write.marketplaceAddDryRun = await operate('marketplaceAdd', { source: localMarketplace, dryRun: true });
  evidence.write.marketplaceAdd = await operate('marketplaceAdd', { source: localMarketplace }, 'catalog-add');
  evidence.write.overviewAfterAdd = await read('pluginsOverview');
  evidence.write.install = await operate('install', { pluginName: 'catalog-demo', marketplace: 'catalog-local', scope: 'workspace' }, 'catalog-install');
  // Real directory re-read after install: one installed marketplace record, never optimistically invented.
  evidence.write.overviewAfterInstall = await read('pluginsOverview');
  evidence.write.pluginsListAfterInstall = await read('pluginsList');
  evidence.write.validateInstalled = await read('pluginValidate', { pluginName: 'catalog-demo', marketplace: 'catalog-local' });
  evidence.write.describe = await read('pluginDescribe', { pluginName: 'catalog-demo', marketplace: 'catalog-local' });
  evidence.write.configure = await operate('configure', { pluginId: 'catalog-demo@catalog-local', options: {}, scope: 'workspace' });
  evidence.write.resetConfig = await operate('resetConfig', { pluginId: 'catalog-demo@catalog-local', scope: 'workspace' });
  evidence.write.setDisabled = await operate('setEnabled', { pluginId: 'catalog-demo@catalog-local', enabled: false, scope: 'workspace' }, 'catalog-disable');
  evidence.write.setEnabled = await operate('setEnabled', { pluginId: 'catalog-demo@catalog-local', enabled: true, scope: 'workspace' }, 'catalog-enable');
  evidence.write.installFailure = await operate('install', { pluginName: 'catalog-missing-plugin', marketplace: 'catalog-local' }, 'catalog-install-fail');
  evidence.write.update = await operate('update', { pluginId: 'catalog-demo@catalog-local' });
  evidence.write.uninstall = await operate('uninstall', { pluginId: 'catalog-demo@catalog-local', pluginName: 'catalog-demo', marketplace: 'catalog-local', removeCache: true });
  evidence.write.marketplaceRemove = await operate('marketplaceRemove', { marketplace: 'catalog-local' });
  evidence.write.restoreBuiltin = await operate('restoreBuiltin', { pluginId: 'browser-use@zcode-plugins-official' });
  evidence.write.operateUnknown = await operate('unknownAction', {});
  evidence.operations = catalog.operations.map(record => ({ operation: record.operation, operationId: record.operationId, state: record.state, progress: record.progress, error: record.error }));

  evidence.status = 'PASS';
} catch (error) {
  evidence.status = 'NOT_RUN';
  evidence.reason = error.code ?? error.message;
} finally {
  catalog?.dispose();
  peer?.close();
  if (child) await stopOwned(child, exited);
  await rm(workspace, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
}

await mkdir('tests/fixtures/catalog-management', { recursive: true });
await writeFile('tests/fixtures/catalog-management/official.json', JSON.stringify(evidence, null, 2) + '\n');
const summarize = face => Object.fromEntries(Object.entries(face).map(([k, v]) => [k, v.error ? `ERR ${v.error.code}(${v.error.protocolCode ?? '-'})` : 'OK']));
console.log(JSON.stringify({ status: evidence.status, reason: evidence.reason, paidModelCalls: 0, read: summarize(evidence.read), write: summarize(evidence.write), errorFacts: evidence.errorFacts.slice(0, 20) }, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 1;
