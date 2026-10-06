import test from 'node:test';
import assert from 'node:assert/strict';
import { attachmentMediaKind, attachmentPreviewKind, decodeBase64Bytes, encodeBase64 } from '../packages/client/attachment.mjs';

test('Attachment preview media dispatch distinguishes media from plain documents (never truthiness)', () => {
  assert.equal(attachmentMediaKind('image/png'), 'media');
  assert.equal(attachmentMediaKind('image/svg+xml; charset=utf-8'), 'media');
  assert.equal(attachmentMediaKind('video/mp4'), 'media');
  assert.equal(attachmentMediaKind('application/pdf'), 'media');
  assert.equal(attachmentMediaKind('text/plain'), 'document');
  assert.equal(attachmentMediaKind('application/x-unknown-thing'), 'document');
  assert.equal(attachmentMediaKind(undefined), 'document');
  // Regression guard: the removed bug treated both category strings as truthy and always previewed.
  assert.notEqual(attachmentMediaKind('text/plain'), attachmentMediaKind('image/png'));
});

test('Attachment preview preview presentation kind follows the returned official mediaType', () => {
  assert.equal(attachmentPreviewKind('image/png'), 'image');
  assert.equal(attachmentPreviewKind('video/webm'), 'video');
  assert.equal(attachmentPreviewKind('application/pdf'), 'pdf');
  assert.equal(attachmentPreviewKind('text/plain; charset=utf-8'), 'text');
  assert.equal(attachmentPreviewKind('application/json'), 'text');
  assert.equal(attachmentPreviewKind('application/octet-stream'), 'binary');
});

test('Attachment preview base64 payload decode round-trips and fails closed on invalid input', () => {
  const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 83, 48, 55]);
  const decoded = decodeBase64Bytes(encodeBase64(bytes));
  assert.deepEqual([...decoded], [...bytes]);
  assert.equal(decodeBase64Bytes('not base64!'), null);
  assert.equal(decodeBase64Bytes(undefined), null);
});
