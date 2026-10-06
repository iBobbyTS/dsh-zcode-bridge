// Official app-server only; isolated HOME/workspace; 0 model calls; no remote backend/server/GUI.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { BridgeHost, stopOwned } from '../packages/host/runtime.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { REMOTE_CARRIERS } from '../packages/host/remote.mjs';

const destination = resolve(process.argv[3] ?? 'tests/fixtures/remote-workspace');
const workspacePath = await realpath(await mkdtemp(join(tmpdir(), 'zcode-remote-ws-')));
const home = await mkdtemp(join(tmpdir(), 'zcode-remote-home-'));
const evidence = { provenance: { kind: 'official-runtime-capture', capturedAt: new Date().toISOString(), paidModelCalls: 0, isolation: 'dedicated tmp HOME + workspace', note: 'Outer IPC/HTTP names are deliberately sent as NDJSON requests to test absence ONLY. Notifications are not requested in their native transport. No outer server or remote backend is started.' }, probes: {} };
let child, exited, peer, conversation, host, sessionId;
const sanitize = value => JSON.parse(JSON.stringify(value).split(home).join('/fixture/remote-home').split(workspacePath).join('/fixture/remote-workspace').split(sessionId ?? 'never-real-id').join('remote-draft-session'));
async function probe(name, method, params = {}) {
  try { const result = await peer.request(method, params); evidence.probes[name] = { method, result: sanitize(result) }; return result; }
  catch (error) { evidence.probes[name] = { method, error: { code: error.code, protocolCode: error.protocolCode, message: String(error.message).split('\n')[0] } }; }
}
try {
  const installation = await inspectInstallation(process.argv[2] ?? '/Applications/ZCode.app');
  if (!installation.verified) throw Error('installation-unverified');
  Object.assign(evidence.provenance, { version: installation.version, build: installation.build, sha256: installation.sha256, stderrBytes: 0 });
  child = spawn(installation.launcher, [installation.cjs, 'app-server', '--stdio'], { cwd: workspacePath, env: { ...runtimeEnv(installation.providerConfig), HOME: home }, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise(resolve => child.once('close', resolve));
  child.stderr.on('data', b => { evidence.provenance.stderrBytes += b.length; });
  peer = new ProtocolPeer(child.stdout, child.stdin, { timeoutMs: 20000 });
  await probe('capabilities', 'runtime/capabilities');
  const workspace = { workspacePath, workspaceKey: workspacePath };
  await probe('localSessionList', 'session/list', { workspace, limit: 5 });
  for (const carrier of REMOTE_CARRIERS) await probe(carrier.name, carrier.method);
  // Probe the complete official v4 envelope with a deliberately unsupported type. This is NOT a
  // declared carrier; the rejected ACK proves schema rejection, not remote execution or method-not-found.
  await probe('v4RemoteTypeRejected', 'v4/command', { commandId: randomUUID(), clientId: 'remote-capture', sessionId: null, type: 'connectRemote', payload: {}, issuedAt: Date.now() });
  const created = await peer.request('v4/command', { commandId: randomUUID(), clientId: 'remote-capture', sessionId: null, type: 'createSession', payload: { workspaceId: workspacePath }, issuedAt: Date.now() });
  sessionId = created.result?.sessionId ?? created.ack?.result?.sessionId;
  if (!sessionId) throw Error('v4-draft-missing');
  evidence.provenance.draftWithoutInput = true;
  conversation = new V4Conversation(peer, { address: { runtime: 'zcode', authority: 'remote-capture', workspace: workspacePath, sessionId }, workspace, connectionId: 'remote-'+randomUUID(), clientId: 'remote-capture', clientMode: 'web-remote-replayable' });
  await conversation.connect({ forceSnapshot: true });
  const liveDeadline = Date.now()+8000;
  while (conversation.state.status !== 'live' && Date.now()<liveDeadline) await new Promise(resolve => setTimeout(resolve, 25));
  if (conversation.state.status !== 'live') throw Error('v4-local-projection-not-live');
  evidence.v4LocalProjection = { status: conversation.state.status, admission: conversation.admission, clientMode: 'web-remote-replayable', scope: 'local-only', remoteConnectionEstablished: false };
  await conversation.cancel(); conversation = undefined;
  // Real production BridgeHost consumes the SAME owned child, after releasing the capture peer.
  peer.close(); peer = undefined;
  host = new BridgeHost({ workspacePath, inspect: async () => installation, spawnProcess: () => child });
  await host.connect();
  evidence.productionOracle = sanitize(host.remoteState());
  if (!host.status.connected) throw Error('production-host-not-connected');
  if (REMOTE_CARRIERS.some(c => evidence.probes[c.name]?.error?.protocolCode !== -32601)) throw Error('unexpected-outer-carrier-reachability');
  if (evidence.probes.v4RemoteTypeRejected?.result?.status !== 'rejected' || evidence.probes.v4RemoteTypeRejected?.result?.reasonCode !== 'proto.invalidPayload') throw Error('unexpected-v4-remote-type');
  evidence.status = 'PASS';
} catch (error) { evidence.status = 'FAILED'; evidence.reason = error.code ?? error.message; }
finally {
  if (conversation) await conversation.cancel().catch(() => {});
  peer?.close();
  if (host) await host.dispose();
  else if (child) await stopOwned(child, exited);
  await rm(workspacePath, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
}
await mkdir(destination, { recursive: true });
await writeFile(join(destination, 'official.json'), JSON.stringify(evidence, null, 2)+'\n');
console.log(JSON.stringify({ status: evidence.status, reason: evidence.reason, paidModelCalls: 0, probes: Object.fromEntries(Object.entries(evidence.probes).map(([name, entry]) => [name, entry.error ? entry.error.protocolCode : 'OK'])), v4: evidence.v4LocalProjection }, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 1;
