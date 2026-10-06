import test from 'node:test';
import assert from 'node:assert/strict';
import { attachmentRuntime } from './fixtures/attachments-context-runtime.mjs';
import { ATTACHMENT_UPLOAD_CHUNK_BYTES, attachmentChunkCount, attachmentChecksum, decodedBase64ByteLength } from '../packages/host/attachment.mjs';

async function open(name = 'success', options = {}) { const f = attachmentRuntime(name, options); await f.open(); return f; }
const calls = (f, method) => f.sent.filter(request => request.method === method);
const bytesOf = n => { const bytes = new Uint8Array(n); for (let i = 0; i < n; i += 1) bytes[i] = i % 251; return bytes; };
const attachment = (ref, bytes = 4) => ({ ref, fileName: 'a.txt', mime: 'text/plain', bytes });

test('whole-file upload drives the official begin/chunk/commit transaction with 384 KiB slices', async () => {
  const f = await open(); try {
    const bytes = bytesOf(700 * 1024), progress = [];
    const { ref } = await f.conversation.uploadAttachment({ fileName: 'archive.bin', mime: 'application/octet-stream', bytes }, { onProgress: p => progress.push(p) });
    assert.match(ref, /^zcode-artifact:\/\/fixture-session\/tool-result-/);
    const begins = calls(f, 'v4/attachment/begin'), chunks = calls(f, 'v4/attachment/chunk'), commits = calls(f, 'v4/attachment/commit');
    assert.equal(begins.length, 1); assert.equal(chunks.length, 2); assert.equal(commits.length, 1);
    assert.equal(begins[0].params.totalBytes, bytes.length);
    assert.equal(begins[0].params.totalChunks, 2);
    assert.equal(begins[0].params.connectionId, 'fixture-attachments');
    assert.equal(Buffer.from(chunks[0].params.dataBase64, 'base64').length, ATTACHMENT_UPLOAD_CHUNK_BYTES);
    assert.equal(Buffer.from(chunks[1].params.dataBase64, 'base64').length, bytes.length - ATTACHMENT_UPLOAD_CHUNK_BYTES);
    assert.equal(progress.at(-1).phase, 'committing');
    // The committed ref is session-bound, so the official read carrier is reached with the sample payload.
    const read = await f.conversation.attachmentRead({ ref, offset: 0, limit: 1024 });
    assert.equal(read.mediaType, f.fixture.readResult.mediaType);
  } finally { f.dispose(); }
});

test('duplicate chunks are idempotent and conflicting duplicates follow official semantics', async () => {
  const f = await open(); try {
    const bytes = bytesOf(10), checksum = attachmentChecksum(bytes), b64 = Buffer.from(bytes).toString('base64');
    const start = await f.conversation.attachmentStart({ uploadId: 'upload-dup', fileName: 'd.txt', mime: 'text/plain', totalBytes: 10, totalChunks: 1, checksum });
    assert.equal(start.state, 'staging');
    const first = await f.conversation.attachmentChunk({ uploadId: 'upload-dup', chunkIndex: 0, dataBase64: b64 });
    const duplicate = await f.conversation.attachmentChunk({ uploadId: 'upload-dup', chunkIndex: 0, dataBase64: b64 });
    assert.equal(first.nextChunkIndex, 1); assert.equal(duplicate.nextChunkIndex, 1);
    const { ref } = await f.conversation.attachmentCommit({ uploadId: 'upload-dup' });
    assert.match(ref, /tool-result-upload-dup/);
    // Re-begin of a committed key is idempotent and returns the same ref (official semantics).
    const again = await f.conversation.attachmentStart({ uploadId: 'upload-dup', fileName: 'd.txt', mime: 'text/plain', totalBytes: 10, totalChunks: 1, checksum });
    assert.equal(again.state, 'committed'); assert.equal(again.ref, ref);
    // Re-commit is also idempotent and keeps the same session-bound ref.
    assert.equal((await f.conversation.attachmentCommit({ uploadId: 'upload-dup' })).ref, ref);
    // Abort after commit only withdraws the local ref; there is no runtime delete carrier.
    const withdrawn = await f.conversation.attachmentAbort({ uploadId: 'upload-dup' });
    assert.equal(withdrawn.committedRefWithdrawn, true);
    await assert.rejects(() => f.conversation.attachmentRead({ ref, offset: 0, limit: 16 }), error => error.code === 'attachment-ref-unbound');
    // A duplicate with different bytes is a real official conflict.
    const other = await f.conversation.attachmentStart({ uploadId: 'upload-conflict', fileName: 'c.txt', mime: 'text/plain', totalBytes: 10, totalChunks: 1, checksum });
    assert.equal(other.state, 'staging');
    await f.conversation.attachmentChunk({ uploadId: 'upload-conflict', chunkIndex: 0, dataBase64: b64 });
    await assert.rejects(() => f.conversation.attachmentChunk({ uploadId: 'upload-conflict', chunkIndex: 0, dataBase64: Buffer.from(bytesOf(10).fill(1)).toString('base64') }), error => error.code === 'runtime-rejected');
  } finally { f.dispose(); }
});

test('abort clears the staged upload, later commit is uploadNotFound, no usable attachment is shown', async () => {
  const f = await open(); try {
    const bytes = bytesOf(5), checksum = attachmentChecksum(bytes);
    const started = await f.conversation.attachmentStart({ uploadId: 'upload-abort', fileName: 'a.txt', mime: 'text/plain', totalBytes: 5, totalChunks: 1, checksum });
    assert.equal(started.state, 'staging');
    await f.conversation.attachmentChunk({ uploadId: 'upload-abort', chunkIndex: 0, dataBase64: Buffer.from(bytes).toString('base64') });
    const aborted = await f.conversation.attachmentAbort({ uploadId: 'upload-abort' });
    assert.equal(aborted.aborted, true); assert.equal(aborted.committedRefWithdrawn, false);
    await assert.rejects(() => f.conversation.attachmentCommit({ uploadId: 'upload-abort' }), error => error.code === 'attachment-untracked');
    await assert.rejects(() => f.conversation.attachmentRead({ ref: 'zcode-artifact://fixture-session/tool-result-upload-abort', offset: 0, limit: 16 }), error => error.code === 'attachment-ref-unbound');
  } finally { f.dispose(); }
});

test('size boundaries are enforced before any wire call; zero-byte zero-chunk is legal', async () => {
  const f = await open(); try {
    const before = f.sent.length, checksum = `sha256:${'0'.repeat(64)}`;
    await assert.rejects(() => f.conversation.attachmentStart({ uploadId: 'upload-big', fileName: 'big.bin', mime: 'application/octet-stream', totalBytes: 20 * 1024 * 1024 + 1, totalChunks: 64, checksum }), error => error.code === 'attachment-invalid');
    await assert.rejects(() => f.conversation.attachmentStart({ uploadId: 'upload-65', fileName: 'm.bin', mime: 'application/octet-stream', totalBytes: 1024, totalChunks: 65, checksum }), error => error.code === 'attachment-invalid');
    await assert.rejects(() => f.conversation.attachmentStart({ uploadId: 'upload-zero', fileName: 'z.txt', mime: 'text/plain', totalBytes: 0, totalChunks: 1, checksum }), error => error.code === 'attachment-invalid');
    assert.equal(f.sent.length, before, 'schema-invalid boundaries never reach the wire');
    const started = await f.conversation.attachmentStart({ uploadId: 'upload-empty', fileName: 'empty.txt', mime: 'text/plain', totalBytes: 0, totalChunks: 0, checksum: attachmentChecksum(Buffer.alloc(0)) });
    assert.equal(started.state, 'staging');
    const { ref } = await f.conversation.attachmentCommit({ uploadId: 'upload-empty' });
    assert.match(ref, /tool-result-upload-empty/);
  } finally { f.dispose(); }
});

test('an interrupted commit is deterministic, aborts the transaction and binds no ref', async () => {
  const f = await open('success', { behavior: { dropCommit: true } }); try {
    await assert.rejects(() => f.conversation.uploadAttachment({ fileName: 'c.txt', mime: 'text/plain', bytes: bytesOf(8) }), error => error.code === 'request-timeout');
    assert.ok(calls(f, 'v4/attachment/abort').length >= 1, 'the transaction aborts a staged upload after a failed commit');
    await assert.rejects(() => f.conversation.attachmentRead({ ref: 'zcode-artifact://fixture-session/tool-result-unknown', offset: 0, limit: 16 }), error => error.code === 'attachment-ref-unbound');
  } finally { f.dispose(); }
});

test('a reference committed in one session is rejected in another before any wire command', async () => {
  const a = await open('success', { sessionId: 'session-a', connectionId: 'conn-a', authority: 'auth-a' });
  const b = await open('success', { sessionId: 'session-b', connectionId: 'conn-b', authority: 'auth-b' });
  try {
    const { ref } = await a.conversation.uploadAttachment({ fileName: 'a.txt', mime: 'text/plain', bytes: bytesOf(4) });
    const own = a.conversation.submit({ type: 'sendText', payload: { text: 'with attachment', attachments: [attachment(ref)] } });
    a.ack(a.sent.at(-1));
    assert.equal((await own).ack.status, 'accepted');
    const before = b.sent.length;
    await assert.rejects(() => b.conversation.submit({ type: 'sendText', payload: { text: 'cross', attachments: [attachment(ref)] } }), error => error.code === 'attachment-ref-unbound');
    assert.equal(b.sent.length, before, 'cross-session reference never becomes a command');
    await assert.rejects(() => b.conversation.attachmentRead({ ref, offset: 0, limit: 16 }), error => error.code === 'attachment-ref-unbound');
  } finally { a.dispose(); b.dispose(); }
});

test('pending shared context can be used and withdrawn; non-pending or legacy identity is refused', async () => {
  const f = await open('success'); try {
    assert.deepEqual(f.conversation.state.snapshot.sharedContextImport, { contextId: 'ctx-fixture-1', title: 'Shared plan', shareUrl: 'https://zcode.example/cn/share/ABC123', status: 'pending' });
    const use = f.conversation.submit({ type: 'sendText', payload: { text: 'use context', context_refs: [{ kind: 'shared_context_import', context_id: 'ctx-fixture-1' }] } });
    f.ack(f.sent.at(-1));
    assert.equal((await use).ack.status, 'accepted');
    assert.deepEqual(f.sent.at(-1).params.payload.context_refs, [{ kind: 'shared_context_import', context_id: 'ctx-fixture-1' }]);
    const discard = f.conversation.submit({ type: 'discardSharedContext', payload: { contextId: 'ctx-fixture-1' } });
    f.ack(f.sent.at(-1));
    assert.equal((await discard).ack.status, 'accepted');
    assert.equal(f.sent.at(-1).params.type, 'discardSharedContext');
    await assert.rejects(() => f.conversation.submit({ type: 'discardSharedContext', payload: { contextId: 'other' } }), error => error.code === 'shared-context-unconfirmed');
    await assert.rejects(() => f.conversation.submit({ type: 'sendText', payload: { text: 'x', context_refs: [{ kind: 'shared_context_import', context_id: 'other' }] } }), error => error.code === 'shared-context-unconfirmed');
  } finally { f.dispose(); }
  for (const name of ['attached', 'discarded', 'legacy']) {
    const g = await open(name); try {
      const contextId = g.conversation.state.snapshot.sharedContextImport?.contextId ?? 'legacy';
      await assert.rejects(() => g.conversation.submit({ type: 'discardSharedContext', payload: { contextId } }), error => error.code === 'shared-context-unconfirmed');
      await assert.rejects(() => g.conversation.submit({ type: 'sendText', payload: { text: 'x', context_refs: [{ kind: 'shared_context_import', context_id: contextId }] } }), error => error.code === 'shared-context-unconfirmed');
    } finally { g.dispose(); }
  }
});

test('sent row attachments read/stat through the official carriers', async () => {
  const f = await open('success'); try {
    const row = f.conversation.state.snapshot.rows.window.find(entry => entry.kind === 'userInput' && entry.attachments?.length);
    const image = row.attachments.find(entry => entry.mime === 'image/png');
    const read = await f.conversation.attachmentRead({ ref: image.ref, target: { rowId: row.rowId, entityId: row.entityId }, attachmentIndex: 0, offset: 0, limit: 1024 });
    assert.equal(read.mediaType, 'image/png');
    const stat = await f.conversation.conversationAttachmentStat({ ref: row.attachments[1].ref, target: { rowId: row.rowId, entityId: row.entityId }, attachmentIndex: 1 });
    assert.equal(stat.totalBytes, 12);
    const shareRead = await f.conversation.conversationAttachmentRead({ ref: row.attachments[1].ref, target: { rowId: row.rowId, entityId: row.entityId }, attachmentIndex: 1, offset: 0, limit: 64 });
    assert.equal(shareRead.mediaType, f.fixture.readResult.mediaType);
  } finally { f.dispose(); }
});

test('unknown MIME and legacy shared-context shapes surface official faults without crashing', async () => {
  const f = await open('legacy'); try {
    const row = f.conversation.state.snapshot.rows.window.find(entry => entry.kind === 'userInput' && entry.attachments?.length);
    const unknown = row.attachments.find(entry => entry.mime === 'application/x-unknown-thing');
    assert.ok(unknown);
    await assert.rejects(() => f.conversation.conversationAttachmentStat({ ref: unknown.ref, target: { rowId: row.rowId, entityId: row.entityId }, attachmentIndex: 2 }), error => error.code === 'runtime-rejected');
    await assert.rejects(() => f.conversation.conversationAttachmentRead({ ref: unknown.ref, target: { rowId: row.rowId, entityId: row.entityId }, attachmentIndex: 2, offset: 0, limit: 16 }), error => error.code === 'runtime-rejected');
  } finally { f.dispose(); }
});

test('restricted runtime keeps the verified resource carriers but never sends', async () => {
  const f = await open('success', { runnable: false }); try {
    assert.equal(f.conversation.state.admission.allowed, false);
    assert.equal(f.conversation.state.admission.reason, 'runtime-restricted');
    assert.equal(f.conversation.state.attachmentAdmission.allowed, true);
    const { ref } = await f.conversation.uploadAttachment({ fileName: 'r.txt', mime: 'text/plain', bytes: bytesOf(3) });
    assert.match(ref, /tool-result/);
    await assert.rejects(() => f.conversation.submit({ type: 'sendText', payload: { text: 'nope', attachments: [attachment(ref, 3)] } }), error => error.code === 'runtime-restricted');
  } finally { f.dispose(); }
});

test('reads never accept a host path or another session ref', async () => {
  const f = await open('success'); try {
    for (const ref of ['/etc/passwd', 'file:///etc/passwd', 'zcode-artifact://other-session/tool-result-x']) {
      await assert.rejects(() => f.conversation.attachmentRead({ ref, offset: 0, limit: 16 }), error => error.code === 'attachment-ref-unbound');
      await assert.rejects(() => f.conversation.conversationAttachmentStat({ ref, target: { rowId: 3, entityId: 'entity-input-1' }, attachmentIndex: 0 }), error => error.code === 'attachment-ref-unbound');
    }
  } finally { f.dispose(); }
});

test('chunking/decoding helpers match the official renderer budget', () => {
  assert.equal(ATTACHMENT_UPLOAD_CHUNK_BYTES, 384 * 1024);
  assert.equal(attachmentChunkCount(0), 0);
  assert.equal(attachmentChunkCount(ATTACHMENT_UPLOAD_CHUNK_BYTES), 1);
  assert.equal(attachmentChunkCount(ATTACHMENT_UPLOAD_CHUNK_BYTES + 1), 2);
  assert.equal(decodedBase64ByteLength(''), 0);
  assert.equal(decodedBase64ByteLength('YQ=='), 1);
  assert.equal(decodedBase64ByteLength('abc'), null);
  assert.match(attachmentChecksum(Buffer.from('a')), /^sha256:[0-9a-f]{64}$/);
});
