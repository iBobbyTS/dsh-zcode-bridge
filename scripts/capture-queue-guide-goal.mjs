// Dedicated draft and owned headless child only. This allowlist contains no model input.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';
const directory = 'tests/fixtures/queue-guide-goal';
const path = await mkdtemp(join(tmpdir(), 'zcode-queue-guide-'));
const workspace = { workspacePath: path, workspaceKey: path };
let child, peer, exited, conversation, sessionId, installation;
const evidence = { provenance: { kind: 'official-runtime-capture', capturedAt: new Date().toISOString(), paidModelCalls: 0, sanitization: 'dedicated workspace/session ids aliased; stderr counted only' }, exchanges: [], producer: [] };
const allowed = new Set(['runtime/capabilities', 'v4/command', 'workspace/readPresentation', 'workspace/updateInteractionPreferences', 'workspace/updateModelIoPreferences']);
const commands = new Set(['createSession', 'deleteSession']);
async function request(method, params) {
  if (!allowed.has(method) || (method === 'v4/command' && !commands.has(params.type))) throw Error('capture-allowlist');
  const entry = { method, params }; evidence.exchanges.push(entry);
  try { entry.result = await peer.request(method, params); return entry.result; }
  catch (error) { entry.error = { code: error.code ?? error.message, protocolCode: error.protocolCode }; return null; }
}
async function live() {
  if (conversation.state.status === 'live') return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { off(); reject(Error('projection-deadline')); }, 5000);
    const off = conversation.subscribe(state => {
      if (state.status === 'live') { clearTimeout(timeout); off(); resolve(); }
      else if (['closed', 'error'].includes(state.status)) { clearTimeout(timeout); off(); reject(Error(state.error)); }
    });
  });
}
try {
  installation = await inspectInstallation(process.argv[2] ?? '/Applications/ZCode.app');
  if (!installation.verified) throw Error('installation-unverified');
  Object.assign(evidence.provenance, { version: installation.version, build: installation.build, sha256: installation.sha256, stderrBytes: 0 });
  child = spawn(installation.launcher, [installation.cjs, 'app-server', '--stdio'], { cwd: path, env: runtimeEnv(installation.providerConfig), stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise(resolve => child.once('close', resolve));
  child.stderr.on('data', data => { evidence.provenance.stderrBytes += data.length; });
  peer = new ProtocolPeer(child.stdout, child.stdin, { timeoutMs: 15000 });
  await request('runtime/capabilities', {});
  await request('workspace/readPresentation', { workspace });
  for (const enabled of [false, true]) {
    await request('workspace/updateInteractionPreferences', { workspace, preferences: { askUserQuestionAutoResolutionEnabled: enabled } });
    await request('workspace/updateModelIoPreferences', { workspace, preferences: { fullRetentionEnabled: enabled } });
  }
  const created = await request('v4/command', { commandId: randomUUID(), clientId: 'queue-guide-capture', sessionId: null, type: 'createSession', payload: { workspaceId: path }, issuedAt: Date.now() });
  sessionId = created?.result?.sessionId;
  if (!sessionId) throw Error('draft-not-created');
  conversation = new V4Conversation(peer, { address: { runtime: 'zcode', authority: 'official-queue-guide-capture', workspace: path, sessionId }, workspace, clientId: 'queue-guide-capture', connectionId: 'queue-guide-capture', runnable: true, managementAllowed: true });
  await conversation.connect(); await live();
  evidence.initialConfig = conversation.state.snapshot.config;
  evidence.workspaceProducer = [];
  for (const [kind, preferences] of [['presentation', undefined], ['interaction', { askUserQuestionAutoResolutionEnabled: false }], ['modelIo', { fullRetentionEnabled: false }]]) {
    evidence.workspaceProducer.push({ kind, preferences, response: await conversation.workspaceConfiguration(kind, preferences) });
  }
  const config = evidence.initialConfig;
  for (const command of [
    { type: 'setFollowupMode', payload: { mode: 'guide' } },
    { type: 'switchCollaborationMode', payload: { mode: 'edit' } },
    { type: 'switchCollaborationMode', payload: { mode: 'build' } },
    { type: 'switchModelConfig', payload: { provider: config.provider, model: config.model, thought: config.thought } },
  ]) {
    const record = await conversation.submit(command);
    const query = await conversation.queryCommand(record.commandId);
    if (!['accepted', 'noop'].includes(record.ack?.status) || query.state !== record.state) throw Error('config-command-not-confirmed');
    await conversation.resync({ forceSnapshot: true }); await live();
    evidence.producer.push({ command, record, query, authoritativeConfig: conversation.state.snapshot.config });
    const current = conversation.state.snapshot.config;
    if (command.type === 'setFollowupMode' && current.followupMode !== 'guide') throw Error('followup-projection-mismatch');
    if (command.type === 'switchCollaborationMode' && current.mode !== command.payload.mode) throw Error('mode-projection-mismatch');
  }
  evidence.status = 'PASS';
} catch (error) { evidence.status = 'NOT_RUN'; evidence.reason = error.code ?? error.message; }
finally {
  await conversation?.cancel();
  if (sessionId && !peer.closed) await request('v4/command', { commandId: randomUUID(), clientId: 'queue-guide-capture', sessionId, type: 'deleteSession', payload: {}, issuedAt: Date.now() });
  peer?.close(); if (child) await stopOwned(child, exited);
  await rm(path, { recursive: true, force: true });
}
let json = JSON.stringify(evidence, null, 2).split(path).join('/fixture/queue-guide-workspace');
if (sessionId) json = json.split(sessionId).join('fixture-queue-guide-draft');
await mkdir(directory, { recursive: true }); await writeFile(`${directory}/official-config.json`, json + '\n');
console.log(JSON.stringify({ status: evidence.status, reason: evidence.reason, commands: evidence.producer.map(x => ({ type: x.command.type, state: x.record.state, ack: x.record.ack })), exchanges: evidence.exchanges.map(x => ({ method: x.method, status: x.result?.status, error: x.error })), paidModelCalls: 0 }));
if (evidence.status !== 'PASS') process.exitCode = 1;
