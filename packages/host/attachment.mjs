import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

/**
 * Official renderer-side chunking constant (`packages/ui/src/v4/attachmentUploadTransaction.ts`):
 * 384 KiB is divisible by 3, so every non-final base64 chunk is padding-free and both the
 * renderer->host channel and host->CLI NDJSON envelopes stay within their 1 MiB budgets.
 * The wire schema separately caps decoded chunk bytes at PROTOCOL_V4_LIMITS.attachmentChunkMaxBytes.
 */
export const ATTACHMENT_UPLOAD_CHUNK_BYTES = 384 * 1024;

/** Same decoding contract the official schema/consumer use; null = not valid base64. */
export function decodedBase64ByteLength(value) {
  if (typeof value !== 'string') return null;
  if (value.length === 0) return 0;
  if (value.length % 4 !== 0) return null;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const contentLength = value.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    const code = value.charCodeAt(index);
    const valid =
      (code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) || code === 43 || code === 47;
    if (!valid) return null;
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) return null;
  }
  return (value.length / 4) * 3 - padding;
}

export function decodeBase64(value) {
  const decoded = decodedBase64ByteLength(value);
  if (decoded === null) throw new Error('proto.invalidBase64');
  const bytes = new Uint8Array(Buffer.from(value, 'base64'));
  if (bytes.byteLength !== decoded) throw new Error('proto.invalidBase64');
  return bytes;
}

export function encodeBase64(bytes) {
  return Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength).toString('base64');
}

export function attachmentChecksum(bytes) {
  return 'sha256:' + createHash('sha256').update(bytes).digest('hex');
}

export function attachmentChunkCount(byteLength) {
  return Math.ceil(byteLength / ATTACHMENT_UPLOAD_CHUNK_BYTES);
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error('cancelled');
  error.name = 'AbortError';
  throw error;
}

/**
 * Drives the official begin -> chunk* -> commit transaction, mirroring
 * `uploadAttachmentTransaction` (abort on any post-begin failure, official progress contract,
 * `startNow`-style idempotent `committed` begin). The caller supplies the wire port so the same
 * routine serves the local host adapter and regression fixtures; no second storage or path is
 * introduced and chunk bytes never exceed the official 384 KiB renderer budget.
 */
export async function uploadAttachmentTransaction(port, { sessionId, uploadId, fileName, mime, dataBase64 }, options = {}) {
  const { signal, onProgress } = options;
  throwIfAborted(signal);
  const decodedBytes = decodedBase64ByteLength(dataBase64);
  if (decodedBytes === null) throw new Error('proto.invalidBase64');
  const bytes = decodeBase64(dataBase64);
  if (bytes.byteLength !== decodedBytes) throw new Error('proto.invalidBase64');
  const totalChunks = attachmentChunkCount(bytes.byteLength);
  const checksum = attachmentChecksum(bytes);
  const common = { sessionId, uploadId };
  let began = false;
  try {
    throwIfAborted(signal);
    const begin = await port.begin({ ...common, fileName, mime, totalBytes: bytes.byteLength, totalChunks, checksum });
    began = true;
    if (begin.state === 'committed') {
      onProgress?.({ phase: 'committing', uploadedBytes: bytes.byteLength, totalBytes: bytes.byteLength });
      return { ref: begin.ref };
    }
    if (!Number.isSafeInteger(begin.nextChunkIndex) || begin.nextChunkIndex < 0 || begin.nextChunkIndex > totalChunks) throw new Error('fault.attachment.invalidServerProgress');
    onProgress?.({ phase: 'uploading', uploadedBytes: Math.min(begin.nextChunkIndex * ATTACHMENT_UPLOAD_CHUNK_BYTES, bytes.byteLength), totalBytes: bytes.byteLength });
    for (let chunkIndex = begin.nextChunkIndex; chunkIndex < totalChunks; chunkIndex += 1) {
      throwIfAborted(signal);
      const start = chunkIndex * ATTACHMENT_UPLOAD_CHUNK_BYTES;
      const chunkBytes = bytes.subarray(start, Math.min(start + ATTACHMENT_UPLOAD_CHUNK_BYTES, bytes.byteLength));
      const result = await port.chunk({ ...common, chunkIndex, dataBase64: encodeBase64(chunkBytes) });
      if (result.nextChunkIndex !== chunkIndex + 1) throw new Error('fault.attachment.invalidServerProgress');
      onProgress?.({ phase: 'uploading', uploadedBytes: Math.min((chunkIndex + 1) * ATTACHMENT_UPLOAD_CHUNK_BYTES, bytes.byteLength), totalBytes: bytes.byteLength });
    }
    throwIfAborted(signal);
    onProgress?.({ phase: 'committing', uploadedBytes: bytes.byteLength, totalBytes: bytes.byteLength });
    return { ref: (await port.commit(common)).ref };
  } catch (error) {
    if (began) { try { await port.abort(common); } catch { /* abort is best-effort; the surfaced error stays the transaction error */ } }
    throw error;
  }
}
