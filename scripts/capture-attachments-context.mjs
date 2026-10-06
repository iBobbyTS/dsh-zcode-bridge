// Attachments-context real capture: official headless draft + attachment wire face only. Allowlist contains no
// model input; paidModelCalls stays 0. Writes docs-grade evidence for the attachments-context carrier table.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';

const directory = 'tests/fixtures/attachments-context';
const path = await mkdtemp(join(tmpdir(), 'zcode-attachments-capture-'));
const evidence = { provenance: { kind: 'official-runtime-capture', capturedAt: new Date().toISOString(), paidModelCalls: 0, sanitization: 'dedicated workspace/session ids aliased; stderr counted only' }, exchanges: [] };
let child, peer, exited, sessionId, installation, draft;
const raw = [];
const allowedMethods = new Set(['runtime/capabilities', 'v4/attachment/begin', 'v4/attachment/chunk', 'v4/attachment/commit', 'v4/attachment/abort', 'v4/attachment/read', 'v4/conversation/attachmentRead', 'v4/conversation/attachmentStat']);
const allowedCommands = new Set(['createSession', 'deleteSession', 'discardSharedContext']);

function sha(bytes) { return 'sha256:' + createHash('sha256').update(bytes).digest('hex'); }
/** Keep wire semantics but never persist full payload bytes in evidence. */
function sanitizeParams(params) {
  if (!params || typeof params !== 'object') return params;
  const copy = { ...params };
  if (typeof copy.dataBase64 === 'string') { copy.dataBase64 = `<base64:${Buffer.from(copy.dataBase64, 'base64').length} bytes>`; }
  return copy;
}
async function call(method, params) {
  if (!allowedMethods.has(method) && !(method === 'v4/command' && allowedCommands.has(params?.type))) throw new Error('capture-allowlist');
  const entry = { method, ...(method === 'v4/command' ? { type: params.type } : { params: sanitizeParams(params) }) };
  evidence.exchanges.push(entry);
  try { entry.result = await peer.request(method, params, { timeoutMs: 20000 }); return entry.result; }
  catch (error) { entry.error = { code: error.code ?? error.message, protocolCode: error.protocolCode }; return null; }
}
try {
  installation = await inspectInstallation(process.argv[2] ?? '/Applications/ZCode.app');
  Object.assign(evidence.provenance, { version: installation.version, build: installation.build, sha256: installation.sha256, verified: installation.verified });
  child = spawn(installation.launcher, [installation.cjs, 'app-server', '--stdio'], { cwd: path, env: runtimeEnv(installation.providerConfig), stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise(resolve => child.once('close', resolve));
  child.stderr.on('data', data => { evidence.provenance.stderrBytes = (evidence.provenance.stderrBytes ?? 0) + data.length; });
  child.stdout.on('data', data => raw.push(data.toString()));
  peer = new ProtocolPeer(child.stdout, child.stdin, { timeoutMs: 20000 });
  await call('runtime/capabilities', {});
  const created = await call('v4/command', { commandId: randomUUID(), clientId: 'attachments-capture', sessionId: null, type: 'createSession', payload: { workspaceId: path }, issuedAt: Date.now() });
  draft = created?.result?.sessionId; sessionId = draft;
  evidence.draftCreated = Boolean(draft);
  if (!draft) throw new Error('draft-not-created');
  const connectionId = 'attachments-capture-connection';

  // Normal transaction with a two-chunk file (real official chunk boundaries exercised).
  const fileBytes = Buffer.alloc(700 * 1024); for (let i = 0; i < fileBytes.length; i += 1) fileBytes[i] = i % 251;
  const common = { connectionId, sessionId: draft, uploadId: 'upload-' + randomUUID() };
  const chunkA = fileBytes.subarray(0, 384 * 1024), chunkB = fileBytes.subarray(384 * 1024);
  evidence.begin = await call('v4/attachment/begin', { ...common, fileName: 'archive.bin', mime: 'application/octet-stream', totalBytes: fileBytes.length, totalChunks: 2, checksum: sha(fileBytes) });
  evidence.chunkA = await call('v4/attachment/chunk', { ...common, chunkIndex: 0, dataBase64: chunkA.toString('base64') });
  evidence.duplicateChunkA = await call('v4/attachment/chunk', { ...common, chunkIndex: 0, dataBase64: chunkA.toString('base64') });
  evidence.chunkB = await call('v4/attachment/chunk', { ...common, chunkIndex: 1, dataBase64: chunkB.toString('base64') });
  evidence.commit = await call('v4/attachment/commit', { ...common });
  evidence.beginAgain = await call('v4/attachment/begin', { ...common, fileName: 'archive.bin', mime: 'application/octet-stream', totalBytes: fileBytes.length, totalChunks: 2, checksum: sha(fileBytes) });
  evidence.commitAgain = await call('v4/attachment/commit', { ...common });

  // Abort flow: commit after abort must be uploadNotFound.
  const abortCommon = { connectionId, sessionId: draft, uploadId: 'upload-' + randomUUID() };
  evidence.abortBegin = await call('v4/attachment/begin', { ...abortCommon, fileName: 'abort.txt', mime: 'text/plain', totalBytes: chunkA.length, totalChunks: 2, checksum: sha(chunkA) });
  await call('v4/attachment/chunk', { ...abortCommon, chunkIndex: 0, dataBase64: chunkA.toString('base64') });
  evidence.abort = await call('v4/attachment/abort', { ...abortCommon });
  evidence.commitAfterAbort = await call('v4/attachment/commit', { ...abortCommon });

  // Size / schema boundaries.
  evidence.zeroByteBadChunks = await call('v4/attachment/begin', { connectionId, sessionId: draft, uploadId: 'upload-' + randomUUID(), fileName: 'z.txt', mime: 'text/plain', totalBytes: 0, totalChunks: 1, checksum: sha(Buffer.alloc(0)) });
  evidence.chunkCountInsufficient = await call('v4/attachment/begin', { connectionId, sessionId: draft, uploadId: 'upload-' + randomUUID(), fileName: 'big.bin', mime: 'application/octet-stream', totalBytes: 2 * 1024 * 1024, totalChunks: 1, checksum: sha(Buffer.alloc(2 * 1024 * 1024)) });
  evidence.tooManyChunks = await call('v4/attachment/begin', { connectionId, sessionId: draft, uploadId: 'upload-' + randomUUID(), fileName: 'many.bin', mime: 'application/octet-stream', totalBytes: 1024, totalChunks: 65, checksum: sha(Buffer.alloc(1024)) });

  // Read/stat reachability: real gateway faults without an authorized user row (no model turn).
  const ref = evidence.commit?.ref;
  if (ref) {
    evidence.attachmentRead = await call('v4/attachment/read', { sessionId: draft, ref, offset: 0, limit: 512 * 1024 });
    evidence.attachmentReadTarget = await call('v4/attachment/read', { sessionId: draft, ref, target: { rowId: 0, entityId: 'capture-entity' }, attachmentIndex: 0, offset: 0, limit: 512 * 1024 });
    evidence.conversationAttachmentStat = await call('v4/conversation/attachmentStat', { sessionId: draft, ref, target: { rowId: 0, entityId: 'capture-entity' }, attachmentIndex: 0 });
    evidence.conversationAttachmentRead = await call('v4/conversation/attachmentRead', { sessionId: draft, ref, target: { rowId: 0, entityId: 'capture-entity' }, attachmentIndex: 0, offset: 0, limit: 512 * 1024 });
  }
  // Shared-context withdraw carrier: no pending import -> real official rejection.
  evidence.discardUnknownContext = await call('v4/command', { commandId: randomUUID(), clientId: 'attachments-capture', sessionId: draft, type: 'discardSharedContext', payload: { contextId: 'never-imported' }, issuedAt: Date.now() });
  evidence.rawErrors = raw.join('').split('\n').filter(line => line.includes('"error"')).map(line => {
    try { const error = JSON.parse(line).error; return { code: error.code, name: error.data?.name, message: (error.data?.stack ?? error.message ?? '').split('\n')[0] }; }
    catch { return { raw: line.slice(0, 160) }; }
  });
  evidence.status = 'PASS';
} catch (error) { evidence.status = 'NOT_RUN'; evidence.reason = error.code ?? error.message; }
finally {
  if (peer && !peer.closed && draft) await call('v4/command', { commandId: randomUUID(), clientId: 'attachments-capture', sessionId: draft, type: 'deleteSession', payload: {}, issuedAt: Date.now() });
  peer?.close(); if (child) await stopOwned(child, exited);
  await rm(path, { recursive: true, force: true });
}
let json = JSON.stringify(evidence, null, 2).split(path).join('/fixture/attachments-workspace');
if (sessionId) json = json.split(sessionId).join('fixture-attachments-draft');
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/official-attachment.json`, json + '\n');
console.log(JSON.stringify({ status: evidence.status, reason: evidence.reason, paidModelCalls: 0, exchanges: evidence.exchanges.map(entry => ({ method: entry.method, type: entry.type, result: entry.result, error: entry.error })), rawErrors: evidence.rawErrors }));
if (evidence.status !== 'PASS') process.exitCode = 1;
