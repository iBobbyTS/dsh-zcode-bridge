// S10 reachability capture: background task / subagent observation and cancel faces.
// 0 model calls. All sessions live under an isolated HOME/workspace; the real user
// storage is never touched because HOME is redirected before spawn. No background task or
// subagent instance is ever started here: only the real empty state and the official
// rejection of unknown identities are captured.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';

const destination = resolve(process.argv[3] ?? 'tests/fixtures/s10');
const workspacePath = await realpath(await mkdtemp(join(tmpdir(), 'zcode-s10-ws-')));
const home = await mkdtemp(join(tmpdir(), 'zcode-s10-home-'));
const evidence = {
  provenance: {
    kind: 'official-runtime-capture',
    capturedAt: new Date().toISOString(),
    paidModelCalls: 0,
    isolation: 'dedicated tmp HOME + workspace; real user storage untouched',
    sanitization: 'tmp paths aliased; stderr counted only',
    note: 'no real background task or subagent instance was started; empty state and unknown-id rejection only',
  },
  probes: {},
  errorFacts: [],
};
let child, peer, exited, conversation;
const workspace = { workspacePath, workspaceKey: workspacePath };
let sessionAliases = [];

function sanitize(value) {
  let json = JSON.stringify(value, null, 2);
  json = json.split(home).join('/fixture/s10-home').split(workspacePath).join('/fixture/s10-workspace');
  for (const id of sessionAliases) json = json.split(id).join('/fixture/s10-session');
  return JSON.parse(json);
}
async function probe(name, method, params) {
  try {
    const result = await peer.request(method, params, { timeoutMs: 20000 });
    evidence.probes[name] = { method, result: sanitize(result) };
    return result;
  } catch (error) {
    evidence.errorFacts.push({ name, method, code: error.code, protocolCode: error.protocolCode, name2: error.name });
    evidence.probes[name] = { method, error: { code: error.code, protocolCode: error.protocolCode, message: String(error.message).split('\n')[0] } };
    return undefined;
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

  // A persisted parent gives session/subagents a real store target. A bare draft is not written
  // to the session store, so the official non-model importedHistory create path is used: the
  // official code documents that history import does not execute a model. A v4 record gives the
  // v4 command face (cancelBackgroundWork) and a live conversation projection.
  const draft = await peer.request('session/create', { workspace, persistence: 'immediate', titleGenerationEnabled: false });
  const draftSessionId = draft.session.sessionId;
  const imported = await peer.request('session/create', {
    workspace,
    persistence: 'immediate',
    titleGenerationEnabled: false,
    importedHistory: { source: 'claudeCode', title: 'S10 synthetic reachability parent', messages: [{ role: 'user', content: 'S10 synthetic imported history; no model execution.' }] },
  });
  const persistedSessionId = imported.session.sessionId;
  const created = await peer.request('v4/command', { commandId: randomUUID(), clientId: 's10-capture', sessionId: null, type: 'createSession', payload: { workspaceId: workspacePath }, issuedAt: Date.now() });
  const v4SessionId = created.result?.sessionId ?? created.ack?.result?.sessionId;
  if (!v4SessionId) throw Error('v4-create-session-missing');
  sessionAliases = [draftSessionId, persistedSessionId, v4SessionId];
  evidence.provenance.parentCreated = true;

  conversation = new V4Conversation(peer, {
    address: { runtime: 'zcode', authority: 's10-capture', workspace: workspacePath, sessionId: v4SessionId },
    workspace, connectionId: `s10-${randomUUID()}`, clientId: 's10-capture', clientMode: 'web-remote-replayable',
  });
  await conversation.connect({ forceSnapshot: true });
  for (let i = 0; i < 500 && conversation.state.status !== 'live'; i++) await sleep(10);
  const snapshot = conversation.state.snapshot;
  evidence.probes.conversationProjection = {
    method: 'v4/conversation/subscribe',
    result: sanitize({
      status: conversation.state.status,
      backgroundWorks: snapshot?.backgroundWorks ?? null,
      subagents: snapshot?.subagents ?? null,
      activeWorks: snapshot?.control?.activeWorks ?? null,
      canStop: snapshot?.control?.canStop ?? null,
    }),
  };

  // 1. Real empty subagent list for a persisted parent (observation carrier reachable, no instances).
  await probe('subagentsEmpty', 'session/subagents', { sessionId: persistedSessionId });
  // 1b. The same carrier against a bare draft: the official session store has no such record.
  await probe('subagentsDraft', 'session/subagents', { sessionId: draftSessionId });
  // 2. Official rejection for an unknown parent.
  await probe('subagentsUnknownSession', 'session/subagents', { sessionId: 's10-never-created' });
  // 3. Official rejection for an unknown workId on the resident session (legacy cancel carrier).
  await probe('cancelUnknownTaskLegacy', 'session/cancelBackgroundTask', { sessionId: v4SessionId, taskId: 's10-never-created' });
  // 4. Unknown session on the legacy cancel carrier.
  await probe('cancelUnknownSessionLegacy', 'session/cancelBackgroundTask', { sessionId: 's10-never-created', taskId: 's10-never-created' });
  // 5. Official v4 output read for an unknown workId (observation carrier reachable).
  await probe('bashOutputUnknown', 'v4/conversation/backgroundBashOutput', { sessionId: v4SessionId, workId: 's10-never-created' });
  // 6. Official v4 cancel command for an unknown workId (real rejection, never a fake success).
  await probe('cancelUnknownWorkCommand', 'v4/command', { commandId: randomUUID(), clientId: 's10-capture', sessionId: v4SessionId, type: 'cancelBackgroundWork', payload: { workId: 's10-never-created' }, issuedAt: Date.now() });
  // 7. Unknown v4 session on the cancel command.
  await probe('cancelUnknownWorkSession', 'v4/command', { commandId: randomUUID(), clientId: 's10-capture', sessionId: 's10-never-created', type: 'cancelBackgroundWork', payload: { workId: 's10-never-created' }, issuedAt: Date.now() });

  evidence.status = 'PASS';
} catch (error) {
  evidence.status = 'NOT_RUN';
  evidence.reason = error.code ?? error.message;
} finally {
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
