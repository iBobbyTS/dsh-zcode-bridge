// Dedicated empty drafts only. Valid compact/edit/retry inputs are prohibited: they can execute a model.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';
const path = await mkdtemp(join(tmpdir(), 'zcode-s08-'));
const evidence = { provenance: { kind: 'official-runtime-capture', capturedAt: new Date().toISOString(), paidModelCalls: 0, sanitization: 'owned workspace/session IDs aliased; stderr counted only' }, exchanges: [], gated: ['valid compact (ensureModelReady + background model)', 'successful edit/retry execution', 'stable assistant fork and checkpoint file apply (requires model-produced history)'] };
let child, peer, exited, conversation; const sessions = [];
const allowedMethods=new Set(['runtime/capabilities','v4/command','v4/conversation/fileChanges','v4/conversation/fileRewindPreview']);
const errorFacts=[];
async function call(method, params) {
  if(!allowedMethods.has(method))throw Error('capture-allowlist');
  const entry = { method, params }; evidence.exchanges.push(entry);
  try { entry.result = await peer.request(method, params); return entry.result; }
  catch (e) { entry.error = { code: e.code, protocolCode: e.protocolCode }; return null; }
}
function command(sessionId, type, payload, base = {}) {
  const allowed = ['createSession', 'deleteSession', 'createSelectionSideSession', 'forkAssistant', 'applyFileRewind', 'editUserQuery', 'retryTurn', 'compact'];
  if (!allowed.includes(type) || (type === 'createSelectionSideSession' && payload.firstInput) || (type === 'compact' && sessionId !== 'never-created-s08')) throw Error('capture-allowlist');
  if (['forkAssistant', 'applyFileRewind', 'editUserQuery', 'retryTurn'].includes(type) && (conversation.state.snapshot.rows.window.length !== 0 || payload.target.rowId !== 999999)) throw Error('model-history-prohibited');
  return call('v4/command', { commandId: randomUUID(), clientId: 's08-capture', sessionId, type, payload, issuedAt: Date.now(), ...base });
}
try {
  const installation = await inspectInstallation(process.argv[2] ?? '/Applications/ZCode.app');
  if (!installation.verified) throw Error('installation-unverified');
  Object.assign(evidence.provenance, { version: installation.version, build: installation.build, sha256: installation.sha256, stderrBytes: 0 });
  child = spawn(installation.launcher, [installation.cjs, 'app-server', '--stdio'], { cwd: path, env: runtimeEnv(installation.providerConfig), stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { for(const line of data.toString().split('\n')) { try { const m=JSON.parse(line); if(m.error)errorFacts.push({code:m.error.code,name:m.error.data?.name,message:(m.error.data?.stack??m.error.message??'').split('\n')[0]}); } catch { /* Partial lines are decoded by the actual ProtocolPeer. */ } } });
  exited = new Promise(resolve => child.once('close', resolve)); child.stderr.on('data', b => { evidence.provenance.stderrBytes += b.length; });
  peer = new ProtocolPeer(child.stdout, child.stdin, { timeoutMs: 15000 });
  await call('runtime/capabilities', {});
  const created = await command(null, 'createSession', { workspaceId: path });
  const sessionId = created?.result?.sessionId; if (!sessionId) throw Error('draft-not-created'); sessions.push(sessionId);
  conversation = new V4Conversation(peer, { address: { runtime: 'zcode', authority: 's08-capture', workspace: path, sessionId }, workspace: { workspacePath: path, workspaceKey: path }, connectionId: 's08-capture', clientId: 's08-capture' });
  await conversation.connect();
  if (conversation.state.status !== 'live') await new Promise((resolve, reject) => { const timeout = setTimeout(() => { off(); reject(Error('projection-deadline')); }, 5000); const off = conversation.subscribe(s => { if (s.status === 'live') { clearTimeout(timeout); off(); resolve(); } }); });
  if (conversation.state.snapshot.rows.window.length !== 0) throw Error('draft-not-empty');
  evidence.emptySnapshot = conversation.state.snapshot;
  const base = { baseRevision: conversation.state.snapshot.revision, baseLogEpoch: conversation.state.snapshot.logEpoch }, target = { rowId: 999999, entityId: 'never-created-row' };
  const side = await command(sessionId, 'createSelectionSideSession', {}, { baseRevision: base.baseRevision });
  if (side?.result?.sessionId) sessions.push(side.result.sessionId);
  for (const type of ['forkAssistant', 'applyFileRewind', 'editUserQuery', 'retryTurn']) await command(sessionId, type, { target, ...(type === 'editUserQuery' ? { newText: 'unreachable input', workspaceMode: 'preserve' } : {}) }, base);
  for (const method of ['v4/conversation/fileChanges', 'v4/conversation/fileRewindPreview']) {
    await call(method, { sessionId, target, ...base });
    await call(method, { sessionId, target, ...base, baseLogEpoch: 'stale-epoch' });
  }
  // Unknown owned test identifier is rejected before handler/model readiness; no valid compact submitted.
  await command('never-created-s08', 'compact', {});
  evidence.status = 'PASS';
} catch (e) { evidence.status = 'NOT_RUN'; evidence.reason = e.code ?? e.message; }
finally {
  await conversation?.cancel();
  for (const id of sessions.reverse()) if (peer && !peer.closed) await command(id, 'deleteSession', {});
  peer?.close(); if (child) await stopOwned(child, exited); await rm(path, { recursive: true, force: true });
}
evidence.errorFacts=errorFacts;
let json = JSON.stringify(evidence, null, 2).split(path).join('/fixture/s08-workspace');
for (let i = 0; i < sessions.length; i++) json = json.split(sessions[i]).join(`fixture-s08-session-${i}`);
await mkdir('tests/fixtures/s08', { recursive: true }); await writeFile('tests/fixtures/s08/official.json', json + '\n');
const sanitized=JSON.parse(json);
console.log(JSON.stringify({ status: evidence.status, reason: evidence.reason, paidModelCalls: 0, errorFacts:sanitized.errorFacts, exchanges: sanitized.exchanges.map(e => ({ method: e.method, type: e.params.type, result: e.result, error: e.error })) }));
if (evidence.status !== 'PASS') process.exitCode = 1;
