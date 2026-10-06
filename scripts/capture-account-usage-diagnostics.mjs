// Account/usage/diagnostics reachability capture. 0 model calls.
// Usage, session usage and process diagnostics are read from the real official app-server inside an
// isolated HOME/workspace (real user storage untouched). Account has no app-server RPC: `account/status`
// is probed to record the official -32601. The model-executing carriers (workspace/generateText,
// provider/testModelConnectivity) are deliberately NOT invoked; only the non-model cancel carrier is
// probed to confirm the gated surface's wire shape. No session/close is issued.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { InsightsClient } from '../packages/host/insights.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';

const destination = resolve(process.argv[3] ?? 'tests/fixtures/account-usage-diagnostics');
const workspacePath = await realpath(await mkdtemp(join(tmpdir(), 'zcode-diagnostics-ws-')));
const home = await mkdtemp(join(tmpdir(), 'zcode-diagnostics-home-'));
const evidence = {
  provenance: {
    kind: 'official-runtime-capture',
    capturedAt: new Date().toISOString(),
    paidModelCalls: 0,
    isolation: 'dedicated tmp HOME + workspace; real user storage untouched',
    sanitization: 'tmp paths aliased; stderr counted only',
    note: 'account/status probed for the official -32601; usage/session-usage/child-processes read for real; model-executing generate/connectivity never invoked',
  },
  probes: {},
  errorFacts: [],
  resourceSamples: 0,
};
let child, peer, exited, conversation, insights;
const workspace = { workspacePath, workspaceKey: workspacePath };
let sessionAliases = [];

function sanitize(value) {
  let json = JSON.stringify(value, null, 2);
  json = json.split(home).join('/fixture/diagnostics-home').split(workspacePath).join('/fixture/diagnostics-workspace');
  for (const id of sessionAliases) json = json.split(id).join('/fixture/diagnostics-session');
  return JSON.parse(json);
}
async function probe(name, method, params) {
  try {
    const result = await peer.request(method, params, { timeoutMs: 20000 });
    evidence.probes[name] = { method, result: sanitize(result) };
    return result;
  } catch (error) {
    evidence.errorFacts.push({ name, method, code: error.code, protocolCode: error.protocolCode });
    evidence.probes[name] = { method, error: { code: error.code, protocolCode: error.protocolCode, message: String(error.message).split('\n')[0] } };
    return undefined;
  }
}

try {
  const installation = await inspectInstallation(process.argv[2] ?? '/Applications/ZCode.app');
  if (!installation.verified) throw Error('installation-unverified');
  Object.assign(evidence.provenance, { version: installation.version, build: installation.build, sha256: installation.sha256 });

  const env = { ...runtimeEnv(installation.providerConfig), HOME: home };
  child = spawn(installation.launcher, [installation.cjs, 'app-server', '--stdio'], { cwd: workspacePath, env, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise(resolve => child.once('close', resolve));
  evidence.provenance.stderrBytes = 0;
  child.stderr.on('data', b => { evidence.provenance.stderrBytes += b.length; });
  peer = new ProtocolPeer(child.stdout, child.stdin, { timeoutMs: 20000 });
  peer.onNotification(message => { if (message?.method === 'process/resourceSample') evidence.resourceSamples += 1; });

  evidence.probes.capabilities = await probe('capabilities', 'runtime/capabilities', {});

  // A dedicated v4 draft has no firstInput and cannot initiate model execution.
  const created = await peer.request('v4/command', { commandId: randomUUID(), clientId: 'diagnostics-capture', sessionId: null, type: 'createSession', payload: { workspaceId: workspacePath }, issuedAt: Date.now() });
  const v4SessionId = created.result?.sessionId ?? created.ack?.result?.sessionId;
  if (!v4SessionId) throw Error('v4-create-session-missing');
  sessionAliases = [v4SessionId];
  evidence.provenance.parentCreated = true;

  conversation = new V4Conversation(peer, {
    address: { runtime: 'zcode', authority: 'diagnostics-capture', workspace: workspacePath, sessionId: v4SessionId },
    workspace, connectionId: `diagnostics-${randomUUID()}`, clientId: 'diagnostics-capture', clientMode: 'web-remote-replayable',
  });
  await conversation.connect({ forceSnapshot: true });

  // Account has no app-server RPC. Record the official method-not-found; never guess a state.
  await probe('accountStatusAbsent', 'account/status', {});
  // Real workspace usage aggregate (official usage store; zero in the fresh isolated HOME).
  // v4/usage/stats is the live carrier; legacy usage/stats is @deprecated and retained only for old-host wire compat.
  await probe('usageStats30d', 'v4/usage/stats', { range: '30d' });
  await probe('usageStatsAll', 'v4/usage/stats', { range: 'all' });
  // Real scoped session usage for the isolated draft (zero here, never fabricated).
  await probe('sessionUsage', 'v4/conversation/usage', { sessionId: v4SessionId });
  // Real process/MCP diagnostics (pure in-memory list from the CLI).
  await probe('childProcesses', 'process/childProcesses', {});
  // The gated generate surface: only the non-model cancel carrier is probed. The cancel lookup for an
  // unknown operationId is a pure map miss; no generation or model request is started.
  await probe('cancelGenerateTextUnknown', 'workspace/cancelGenerateText', { operationId: 'diagnostics-never-created' });

  // Production carrier path: the same official peer, the real InsightsClient and scoped conversation.
  insights = new InsightsClient(peer, { auth: 'unavailable' });
  const production = {
    account: insights.account(),
    gated: insights.gated(),
    usageStats: await insights.read('usageStats', { range: '30d' }),
    childProcesses: await insights.read('childProcesses', {}),
    sessionUsage: await conversation.sessionUsage(),
    unknownRead: await insights.read('diagnostics-unverified-kind', {}).then(() => 'unexpected', error => error.code),
    resourceSample: insights.resourceSample,
  };
  evidence.productionOracle = sanitize(production);
  evidence.status = 'PASS';
} catch (error) {
  evidence.status = 'NOT_RUN';
  evidence.reason = error.code ?? error.message;
} finally {
  insights?.dispose();
  if (conversation) await conversation.cancel().catch(() => {});
  peer?.close();
  if (child) await stopOwned(child, exited);
  await rm(workspacePath, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
}

await mkdir(destination, { recursive: true });
await writeFile(join(destination, 'official.json'), JSON.stringify(evidence, null, 2) + '\n');
const summarize = {};
for (const [name, entry] of Object.entries(evidence.probes)) summarize[name] = entry.error ? `ERR ${entry.error.code}(${entry.error.protocolCode ?? '-'})` : 'OK';
console.log(JSON.stringify({ status: evidence.status, reason: evidence.reason, paidModelCalls: 0, probes: summarize, resourceSamples: evidence.resourceSamples, errorFacts: evidence.errorFacts.slice(0, 12) }, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 1;
