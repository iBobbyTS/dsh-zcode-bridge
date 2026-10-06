// Automation/off-peak reachability capture. 0 model calls.
// Probes the legacy automation/* and offPeak/* carriers plus the requestable off-peak tool policy
// against the real official app-server inside an isolated HOME/workspace (real user storage
// untouched). No automation or off-peak task is created: every management carrier is a Host-consumed
// reverse method the CLI dispatcher does not implement, so the probe only records the official
// rejection. No session/close is issued.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { AutomationClient, AUTOMATION_REVERSE_METHODS, AUTOMATION_CARRIERS } from '../packages/host/automation.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';

const destination = resolve(process.argv[3] ?? 'tests/fixtures/automation-offpeak');
const workspacePath = await realpath(await mkdtemp(join(tmpdir(), 'zcode-automation-ws-')));
const home = await mkdtemp(join(tmpdir(), 'zcode-automation-home-'));
const evidence = {
  provenance: {
    kind: 'official-runtime-capture',
    capturedAt: new Date().toISOString(),
    paidModelCalls: 0,
    isolation: 'dedicated tmp HOME + workspace; real user storage untouched',
    sanitization: 'tmp paths aliased; stderr counted only',
    note: 'automation/* and offPeak/* are reverse Host-consumed carriers; only the official -32601 is captured. No task is created; the requestable off-peak tool policy is probed with enabled:false.',
  },
  probes: {},
  errorFacts: [],
};
let child, peer, exited, conversation, automation;
const workspace = { workspacePath, workspaceKey: workspacePath };
let sessionAliases = [];

function sanitize(value) {
  let json = JSON.stringify(value, null, 2);
  json = json.split(home).join('/fixture/automation-home').split(workspacePath).join('/fixture/automation-workspace');
  for (const id of sessionAliases) json = json.split(id).join('/fixture/automation-session');
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

  evidence.probes.capabilities = await probe('capabilities', 'runtime/capabilities', {});

  // A dedicated v4 draft has no firstInput and cannot initiate model execution; it only proves the
  // management RPCs are absent even on a live conversation channel.
  const created = await peer.request('v4/command', { commandId: randomUUID(), clientId: 'automation-capture', sessionId: null, type: 'createSession', payload: { workspaceId: workspacePath }, issuedAt: Date.now() });
  const v4SessionId = created.result?.sessionId ?? created.ack?.result?.sessionId;
  if (!v4SessionId) throw Error('v4-create-session-missing');
  sessionAliases = [v4SessionId];
  evidence.provenance.parentCreated = true;
  conversation = new V4Conversation(peer, {
    address: { runtime: 'zcode', authority: 'automation-capture', workspace: workspacePath, sessionId: v4SessionId },
    workspace, connectionId: `automation-${randomUUID()}`, clientId: 'automation-capture', clientMode: 'web-remote-replayable',
  });
  await conversation.connect({ forceSnapshot: true });

  // Management carriers: the CLI app-server has no case for any of these (reverse Host-consumed).
  await probe('automationList', 'automation/list', {});
  await probe('automationCheckTaskBindingUnknown', 'automation/checkTaskBinding', { targetTaskId: 'automation-never-created' });
  await probe('automationUpdateUnknown', 'automation/update', { automationId: 'automation-never-created', title: 'automation probe' });
  await probe('automationDeleteUnknown', 'automation/delete', { automationId: 'automation-never-created' });
  await probe('automationCreate', 'automation/create', { cronExpr: '0 0 1 1 *', prompt: 'automation probe', title: 'automation probe', recurring: false });
  await probe('offPeakList', 'offPeak/list', {});
  await probe('offPeakCreate', 'offPeak/create', { title: 'automation probe', prompt: 'automation probe' });
  // Requestable but policy-only: the Host pushes the off-peak tool gate to the CLI. This is not a
  // management or feedback carrier; probed with enabled:false so nothing is enabled.
  await probe('updateOffPeakToolPolicy', 'workspace/updateOffPeakToolPolicy', { workspace, enabled: false });

  // Production path: the real AutomationClient over the same official peer. No task/run is created.
  automation = new AutomationClient(peer, { auth: 'unavailable' });
  evidence.productionOracle = sanitize({
    state: automation.state(),
    reverseMethods: AUTOMATION_REVERSE_METHODS,
    carriers: AUTOMATION_CARRIERS,
  });
  evidence.status = 'PASS';
} catch (error) {
  evidence.status = 'NOT_RUN';
  evidence.reason = error.code ?? error.message;
} finally {
  automation?.dispose();
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
console.log(JSON.stringify({ status: evidence.status, reason: evidence.reason, paidModelCalls: 0, probes: summarize, errorFacts: evidence.errorFacts.slice(0, 12) }, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 1;
