import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { resolve } from 'node:path';
import { ProtocolPeer } from '../../packages/host/protocol.mjs';
import { V4Conversation } from '../../packages/host/conversation.mjs';

/**
 * Injected server boundary for S07. The producer is the real V4Conversation plus the vendored
 * official schemas; only the wire peer is replaced. Attachment begin/chunk/commit/abort follow the
 * official `AttachmentUploadRegistry` semantics (duplicate identical chunk, gap/conflict,
 * incomplete commit, uploadNotFound after abort) so host behavior is exercised without model calls.
 */
export function s07Runtime(name = 'success', { runnable = true, fixtureRoot = resolve('tests/fixtures/s07'), behavior = {}, sessionId = 'fixture-session', connectionId = 'fixture-s07', authority = 'fixture-s07' } = {}) {
  const fixture = JSON.parse(readFileSync(resolve(fixtureRoot, `${name}.json`), 'utf8'));
  const input = new PassThrough(), output = new PassThrough(), sent = [];
  const uploads = new Map(), committed = new Map();
  const peer = new ProtocolPeer(input, output, { timeoutMs: 200 });
  const conversation = new V4Conversation(peer, {
    address: { runtime: 'zcode', authority, workspace: '/fixture/workspace', sessionId },
    workspace: { workspacePath: '/fixture/workspace', workspaceKey: '/fixture/workspace' },
    clientId: 'fixture-s07', connectionId, runnable, managementAllowed: true,
  });
  let ordinal = 1;
  function response(request, result) { input.write(JSON.stringify({ id: request.id, result }) + '\n'); }
  function failure(request, message) { input.write(JSON.stringify({ id: request.id, error: { code: -32603, message } }) + '\n'); }
  const keyOf = params => `${params.connectionId}\0${params.sessionId}\0${params.uploadId}`;
  const metaOf = params => JSON.stringify({ fileName: params.fileName, mime: params.mime, totalBytes: params.totalBytes, totalChunks: params.totalChunks, checksum: params.checksum });

  output.on('data', data => {
    for (const line of data.toString().split('\n')) {
      if (!line.trim()) continue;
      const request = JSON.parse(line); sent.push(request);
      const { method, params } = request;
      try {
        if (method === 'v4/conversation/unsubscribe') { response(request, {}); continue; }
        if (method === 'v4/attachment/begin') {
          const key = keyOf(params), done = committed.get(key);
          if (done) { if (done.meta !== metaOf(params)) { failure(request, 'fault.attachment.beginConflict'); continue; } response(request, { uploadId: params.uploadId, state: 'committed', nextChunkIndex: done.nextChunkIndex, ref: done.ref }); continue; }
          const existing = uploads.get(key);
          if (existing) { if (existing.meta !== metaOf(params)) { failure(request, 'fault.attachment.beginConflict'); continue; } response(request, { uploadId: params.uploadId, state: 'staging', nextChunkIndex: existing.chunks.length }); continue; }
          uploads.set(key, { meta: metaOf(params), chunks: [], receivedBytes: 0 });
          response(request, { uploadId: params.uploadId, state: 'staging', nextChunkIndex: 0 }); continue;
        }
        if (method === 'v4/attachment/chunk') {
          const upload = uploads.get(keyOf(params));
          if (!upload) { failure(request, 'fault.attachment.uploadNotFound'); continue; }
          const bytes = Buffer.from(params.dataBase64, 'base64');
          if (params.chunkIndex < upload.chunks.length) { if (!upload.chunks[params.chunkIndex].equals(bytes)) { failure(request, 'fault.attachment.chunkConflict'); continue; } response(request, { uploadId: params.uploadId, nextChunkIndex: upload.chunks.length }); continue; }
          if (params.chunkIndex > upload.chunks.length) { failure(request, 'fault.attachment.chunkGap'); continue; }
          if (bytes.length === 0) { failure(request, 'fault.attachment.emptyChunk'); continue; }
          upload.chunks.push(bytes); upload.receivedBytes += bytes.length;
          response(request, { uploadId: params.uploadId, nextChunkIndex: upload.chunks.length }); continue;
        }
        if (method === 'v4/attachment/commit') {
          const key = keyOf(params), done = committed.get(key);
          if (done) { response(request, { ref: done.ref }); continue; }
          const upload = uploads.get(key);
          if (!upload) { failure(request, 'fault.attachment.uploadNotFound'); continue; }
          if (behavior.dropCommit) continue;
          if (behavior.failCommit) { failure(request, 'fault.attachment.checksumMismatch'); continue; }
          if (upload.chunks.length !== JSON.parse(upload.meta).totalChunks || upload.receivedBytes !== JSON.parse(upload.meta).totalBytes) { failure(request, 'fault.attachment.uploadIncomplete'); continue; }
          const ref = `zcode-artifact://fixture-session/tool-result-${params.uploadId}`;
          committed.set(key, { ref, nextChunkIndex: upload.chunks.length, meta: upload.meta }); uploads.delete(key);
          const reply = () => response(request, { ref });
          if (behavior.commitDelayMs) setTimeout(reply, behavior.commitDelayMs); else reply();
          continue;
        }
        if (method === 'v4/attachment/abort') { uploads.delete(keyOf(params)); response(request, {}); continue; }
        if (method === 'v4/attachment/read') { if (behavior.readError || !fixture.readResult) { failure(request, behavior.readError ?? 'fault.attachment.previewRefNotAuthorized'); continue; } response(request, fixture.readResult); continue; }
        if (method === 'v4/conversation/attachmentStat') { if (behavior.statError || !fixture.statResult) { failure(request, behavior.statError ?? 'fault.attachment.shareStatNotAuthorized'); continue; } response(request, fixture.statResult); continue; }
        if (method === 'v4/conversation/attachmentRead') { if (behavior.readError || !fixture.readResult) { failure(request, behavior.readError ?? 'fault.attachment.shareReadNotAuthorized'); continue; } response(request, fixture.readResult); continue; }
        if (method === 'v4/conversation/subscribe' || method === 'v4/conversation/resync') continue;
        // v4/command and anything else: the test answers explicitly through ack().
      } catch (error) { failure(request, error.code ?? error.message); }
    }
  });

  function ack(request = sent.at(-1), status = 'accepted', reasonCode) {
    response(request, { commandId: request.params.commandId, status, revisionAtDecision: conversation.state.snapshot?.revision ?? 0, ...(reasonCode ? { reasonCode } : {}) });
  }
  async function open() {
    // Keep the fixture's real wire shape but bind it to this producer's session identity.
    fixture.initial.topic = `conversation/${sessionId}`;
    fixture.initial.frame.topic = `conversation/${sessionId}`;
    fixture.initial.frame.payload.snapshot.sessionId = sessionId;
    const promise = conversation.connect();
    response(sent.at(-1), fixture.ack);
    input.write(JSON.stringify({ method: 'v4/conversation/frame', params: fixture.initial }) + '\n');
    await promise;
    if (conversation.state.status !== 'live') {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { off(); reject(new Error('projection-deadline')); }, 2000);
        const off = conversation.subscribe(state => {
          if (state.status === 'live') { clearTimeout(timeout); off(); resolve(); }
          else if (['closed', 'error'].includes(state.status)) { clearTimeout(timeout); off(); reject(new Error(state.error)); }
        });
      });
    }
  }
  function update(change) {
    const snapshot = structuredClone(conversation.state.snapshot);
    change(snapshot); snapshot.seq++; snapshot.revision++;
    const frame = structuredClone(fixture.initial);
    frame.deliveryKind = 'online'; frame.logicalFrameOrdinal = ++ordinal; frame.logicalFrameId = `s07-${ordinal}`;
    frame.frame.toSeq = snapshot.seq; frame.frame.payload.snapshot = snapshot;
    input.write(JSON.stringify({ method: 'v4/conversation/frame', params: frame }) + '\n');
  }
  return { fixture, conversation, peer, sent, open, ack, response, update, dispose: () => peer.close() };
}
