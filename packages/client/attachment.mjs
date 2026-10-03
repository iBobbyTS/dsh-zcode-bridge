/**
 * Browser-side counterpart of the official renderer attachment transaction
 * (`packages/ui/src/v4/attachmentUploadTransaction.ts`). Kept free of node builtins so the
 * DSH web client can bundle it; the host module drives the same wire methods for local owners.
 */
export const ATTACHMENT_UPLOAD_CHUNK_BYTES = 384 * 1024;

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

export function encodeBase64(bytes) {
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) binary += String.fromCharCode(...bytes.subarray(index, index + step));
  return btoa(binary);
}

export async function attachmentChecksum(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('fault.attachment.checksumUnavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
  const hex = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

export function attachmentChunkCount(byteLength) {
  return Math.ceil(byteLength / ATTACHMENT_UPLOAD_CHUNK_BYTES);
}

/**
 * Official media dispatch: `attachmentRead` (preview carrier) only serves image/video/PDF, while any
 * other MIME must use `conversationAttachmentRead`. Both kinds are strings, so callers must compare
 * the value instead of relying on truthiness (a `document` value is still truthy).
 */
export function attachmentMediaKind(mime) {
  const value = String(mime ?? '').split(';', 1)[0].trim().toLowerCase();
  if (value.startsWith('image/') || value.startsWith('video/') || value === 'application/pdf') return 'media';
  return 'document';
}

/** How a successfully read payload should be presented, derived from the returned mediaType. */
export function attachmentPreviewKind(mediaType) {
  const value = String(mediaType ?? '').split(';', 1)[0].trim().toLowerCase();
  if (value.startsWith('image/')) return 'image';
  if (value.startsWith('video/')) return 'video';
  if (value === 'application/pdf') return 'pdf';
  if (value.startsWith('text/') || value === 'application/json' || value === 'application/xml' || value.endsWith('+json') || value.endsWith('+xml')) return 'text';
  return 'binary';
}

/** Strict base64 -> bytes for official read payloads; null when the payload is not decodable. */
export function decodeBase64Bytes(value) {
  if (typeof value !== 'string') return null;
  let binary;
  try { binary = atob(value); } catch { return null; }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error('cancelled');
  error.name = 'AbortError';
  throw error;
}

export function newAttachmentUploadId() {
  const uuid = globalThis.crypto?.randomUUID?.() ?? [...globalThis.crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  return `upload-${uuid}`;
}

/**
 * Drives begin -> chunk* -> commit with the official 384 KiB chunking, whole-file checksum and
 * abort-on-failure. `port` is the scoped owner (host conversation or RPC remote); sessionId and
 * uploadId are owner-derived, never accepted from an untrusted caller.
 */
export async function uploadAttachmentViaPort(port, { sessionId, uploadId, fileName, mime, bytes }, { signal, onProgress } = {}) {
  if (!(bytes instanceof Uint8Array)) throw new Error('attachment-invalid');
  throwIfAborted(signal);
  const totalChunks = attachmentChunkCount(bytes.byteLength);
  const checksum = await attachmentChecksum(bytes);
  let began = false;
  try {
    throwIfAborted(signal);
    const begin = await port.begin({ sessionId, uploadId, fileName, mime, totalBytes: bytes.byteLength, totalChunks, checksum });
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
      const result = await port.chunk({ sessionId, uploadId, chunkIndex, dataBase64: encodeBase64(chunkBytes) });
      if (result.nextChunkIndex !== chunkIndex + 1) throw new Error('fault.attachment.invalidServerProgress');
      onProgress?.({ phase: 'uploading', uploadedBytes: Math.min((chunkIndex + 1) * ATTACHMENT_UPLOAD_CHUNK_BYTES, bytes.byteLength), totalBytes: bytes.byteLength });
    }
    throwIfAborted(signal);
    onProgress?.({ phase: 'committing', uploadedBytes: bytes.byteLength, totalBytes: bytes.byteLength });
    return { ref: (await port.commit({ sessionId, uploadId })).ref };
  } catch (error) {
    if (began) { try { await port.abort({ sessionId, uploadId }); } catch { /* best effort; surface the transaction error */ } }
    throw error;
  }
}
