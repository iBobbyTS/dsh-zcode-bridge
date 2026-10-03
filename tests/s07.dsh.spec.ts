import { afterEach, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { s07Runtime } from './fixtures/s07-runtime.mjs';
import { ZCodeConversationView } from '../packages/client/conversation-view.jsx';
import { RemoteConversation } from '../packages/client/remote-conversation.mjs';

afterEach(cleanup);

async function mount(name = 'success', options = {}) {
  const f = s07Runtime(name, options); await f.open();
  render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));
  return f;
}
async function answer(f, status = 'accepted', reason) { await act(async () => { f.ack(f.sent.at(-1), status, reason); }); }
function pickFile(name, mime, bytes) {
  const input = screen.getByLabelText('Attachment file');
  Object.defineProperty(input, 'files', { value: [{ name, type: mime, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }], configurable: true });
  fireEvent.change(input);
}

describe('S07 official attachment producer → view', () => {
  it('uploads an image and a file through begin/chunk/commit, then sends them with the pending shared context', async () => {
    const f = await mount(); try {
      pickFile('pic.png', 'image/png', new Uint8Array([1, 2, 3, 4]));
      await act(async () => {});
      pickFile('notes.txt', 'text/plain', new Uint8Array([5, 6, 7, 8, 9]));
      await act(async () => {});
      expect(screen.getByTestId('zcode-attachment-pic.png')).toBeDefined();
      expect(screen.getByTestId('zcode-attachment-notes.txt')).toBeDefined();
      const chunkCall = f.sent.find(request => request.method === 'v4/attachment/chunk');
      expect(chunkCall.params.connectionId).toBe('fixture-s07');

      fireEvent.change(screen.getByLabelText('ZCode input'), { target: { value: 'look at these' } });
      fireEvent.click(screen.getByText('Submit input'));
      const command = f.sent.at(-1);
      expect(command.params.type).toBe('sendText');
      expect(command.params.payload.attachments).toHaveLength(2);
      expect(command.params.payload.attachments[0].ref).toMatch(/^zcode-artifact:\/\//);
      expect(command.params.payload.context_refs).toEqual([{ kind: 'shared_context_import', context_id: 'ctx-fixture-1' }]);
      await answer(f);
      expect(screen.getByTestId('zcode-input-result').textContent).toContain('Awaiting authoritative state');
      expect(screen.queryByTestId('zcode-attachment-pic.png')).toBeNull();
    } finally { f.dispose(); }
  });

  it('shows no usable attachment when the commit transaction fails', async () => {
    const f = await mount('success', { behavior: { failCommit: true } }); try {
      pickFile('bad.png', 'image/png', new Uint8Array([1, 2, 3]));
      await act(async () => {});
      expect(screen.queryByTestId('zcode-attachment-bad.png')).toBeNull();
      expect(screen.getByTestId('zcode-input-result').textContent).toContain('No attachment was added');
      expect(f.sent.some(request => request.method === 'v4/attachment/abort')).toBe(true);
    } finally { f.dispose(); }
  });

  it('renders the official shared-context identity, uses it, and withdraws only the pending import', async () => {
    const f = await mount(); try {
      expect(screen.getByTestId('zcode-shared-context-state').textContent).toContain('Shared plan');
      expect(screen.getByTestId('zcode-shared-context-state').textContent).toContain('pending');
      const discard = screen.getByTestId('zcode-discard-shared-context') as HTMLButtonElement;
      expect(discard.disabled).toBe(false);
      fireEvent.click(discard);
      expect(f.sent.at(-1).params.type).toBe('discardSharedContext');
      expect(f.sent.at(-1).params.payload).toEqual({ contextId: 'ctx-fixture-1' });
      await answer(f);
      expect(screen.getByTestId('zcode-input-result').textContent).toContain('Awaiting authoritative state');
    } finally { f.dispose(); }
  });

  it('disables withdraw for an already attached import and never fabricates deletion', async () => {
    const f = await mount('attached'); try {
      expect(screen.getByTestId('zcode-shared-context-state').textContent).toContain('attached');
      expect((screen.getByTestId('zcode-discard-shared-context') as HTMLButtonElement).disabled).toBe(true);
    } finally { f.dispose(); }
  });

  it('reads and stats sent-row attachments through the official carriers', async () => {
    const f = await mount(); try {
      const row = screen.getByTestId('zcode-row-3');
      fireEvent.click(within(row).getAllByText('Stat')[0]);
      await act(async () => {});
      expect(within(row).getByTestId('zcode-attachment-read-result').textContent).toContain('Official stat');
      fireEvent.click(within(row).getAllByText('Preview')[0]);
      await act(async () => {});
      expect(within(row).getByTestId('zcode-attachment-read-result').textContent).toContain('Official preview read');
    } finally { f.dispose(); }
  });

  it('keeps an unknown MIME attachment fail-safe and surfaces the official fault', async () => {
    const f = await mount('legacy'); try {
      const row = screen.getByTestId('zcode-row-3');
      expect(within(row).getByText(/application\/x-unknown-thing/)).toBeDefined();
      fireEvent.click(within(row).getAllByText('Stat')[2]);
      await act(async () => {});
      expect(within(row).getByTestId('zcode-attachment-read-result').textContent).toContain('no host path read was attempted');
    } finally { f.dispose(); }
  });

  it('keeps the verified resource carrier available while model sending stays auth-gated', async () => {
    const f = await mount('success', { runnable: false }); try {
      expect(screen.getByTestId('zcode-input-unavailable').textContent).toContain('auth-gated');
      expect((screen.getByText('Submit input') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByLabelText('Attachment file') as HTMLInputElement).disabled).toBe(false);
    } finally { f.dispose(); }
  });
});

describe('S07 CB8 review closures', () => {
  const IMAGE_REF = 'zcode-artifact://fixture-session/tool-result-image-1';
  const DOC_REF = 'zcode-artifact://fixture-session/tool-result-doc-1';

  it('routes a plain-file Read to the conversation carrier and a media Preview to the preview carrier', async () => {
    const f = await mount(); try {
      const image = within(screen.getByTestId(`zcode-attachment-ref-${IMAGE_REF}`));
      expect(image.getByText('Preview')).toBeDefined();
      fireEvent.click(image.getByText('Preview'));
      await act(async () => {});
      expect(f.sent.at(-1).method).toBe('v4/attachment/read');
      expect(f.sent.at(-1).params.ref).toBe(IMAGE_REF);

      const doc = within(screen.getByTestId(`zcode-attachment-ref-${DOC_REF}`));
      expect(doc.getByText('Read')).toBeDefined();
      expect(doc.queryByText('Preview')).toBeNull();
      fireEvent.click(doc.getByText('Read'));
      await act(async () => {});
      expect(f.sent.at(-1).method).toBe('v4/conversation/attachmentRead');
      expect(f.sent.at(-1).params.ref).toBe(DOC_REF);
    } finally { f.dispose(); }
  });

  it('renders the actual aggregated media content for a successful Preview', async () => {
    const whole = new TextEncoder().encode('S07 preview bytes');
    const head = Buffer.from(whole.subarray(0, 8)).toString('base64');
    const tail = Buffer.from(whole.subarray(8)).toString('base64');
    const f = await mount('success', { behavior: { readResults: [
      { dataBase64: head, mediaType: 'image/png', totalBytes: whole.length, nextOffset: 8 },
      { dataBase64: tail, mediaType: 'image/png', totalBytes: whole.length, nextOffset: null },
    ] } });
    try {
      const image = within(screen.getByTestId(`zcode-attachment-ref-${IMAGE_REF}`));
      fireEvent.click(image.getByText('Preview'));
      await act(async () => {});
      const reads = f.sent.filter(request => request.method === 'v4/attachment/read');
      expect(reads).toHaveLength(2);
      expect(reads[1].params.offset).toBe(8);
      const img = image.getByTestId('zcode-attachment-preview-image') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe(`data:image/png;base64,${Buffer.from(whole).toString('base64')}`);
    } finally { f.dispose(); }
  });

  it('renders decoded text content for a successful plain-file Read', async () => {
    const content = 'S07 text notes';
    const bytes = Buffer.from(content);
    const f = await mount('success', { behavior: { conversationReadResults: [
      { dataBase64: bytes.toString('base64'), mediaType: 'text/plain', totalBytes: bytes.length, nextOffset: null },
    ] } });
    try {
      const doc = within(screen.getByTestId(`zcode-attachment-ref-${DOC_REF}`));
      fireEvent.click(doc.getByText('Read'));
      await act(async () => {});
      expect(f.sent.at(-1).method).toBe('v4/conversation/attachmentRead');
      expect(doc.getByTestId('zcode-attachment-preview-text').textContent).toContain(content);
    } finally { f.dispose(); }
  });

  it('cancels during local reading and never starts the upload or shows an attachment', async () => {
    const f = await mount(); try {
      let release: (value: ArrayBuffer) => void = () => {};
      const pending = new Promise<ArrayBuffer>(resolve => { release = resolve; });
      const input = screen.getByLabelText('Attachment file');
      Object.defineProperty(input, 'files', { value: [{ name: 'reading-cancel.txt', type: 'text/plain', arrayBuffer: () => pending }], configurable: true });
      fireEvent.change(input);
      expect(screen.getByTestId('zcode-upload-progress').textContent).toContain('reading');
      fireEvent.click(screen.getByText('Cancel upload'));
      await act(async () => { release(new Uint8Array([1, 2, 3]).buffer); await Promise.resolve(); });
      expect(screen.queryByTestId('zcode-attachment-reading-cancel.txt')).toBeNull();
      expect(f.sent.some(request => request.method === 'v4/attachment/begin')).toBe(false);
      expect(f.sent.some(request => request.method === 'v4/attachment/commit')).toBe(false);
      expect(screen.getByTestId('zcode-input-result').textContent).toContain('cancelled');
    } finally { f.dispose(); }
  });

  it('keeps a Cancel during local reading effective through the production RemoteConversation pipeline', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
    const f = s07Runtime('success', { runnable: false });
    let remote: RemoteConversation | undefined;
    try {
      await f.open();
      const rpcCalls: string[] = [];
      const rpc = {
        call: async (_channel: string, _endpoint: string, p: any, signal?: AbortSignal) => {
          signal?.throwIfAborted(); rpcCalls.push(p.operation);
          let value: unknown;
          switch (p.operation) {
            case 'open': value = { handle: 'cb8-prod', state: f.conversation.state }; break;
            case 'state': value = f.conversation.state; break;
            case 'attachmentStart': value = await f.conversation.attachmentStart(p.attachment); break;
            case 'attachmentChunk': value = await f.conversation.attachmentChunk(p); break;
            case 'attachmentCommit': value = await f.conversation.attachmentCommit(p); break;
            case 'attachmentAbort': value = await f.conversation.attachmentAbort(p); break;
            case 'release': value = { released: true }; break;
            default: throw new Error(`unexpected ${p.operation}`);
          }
          signal?.throwIfAborted();
          return { ok: true, value };
        },
      };
      remote = new RemoteConversation(rpc as never, f.conversation.address);
      await remote.connect();
      render(React.createElement(ZCodeConversationView, { conversation: remote }));
      let release: (value: ArrayBuffer) => void = () => {};
      const pending = new Promise<ArrayBuffer>(resolve => { release = resolve; });
      const input = screen.getByLabelText('Attachment file');
      Object.defineProperty(input, 'files', { value: [{ name: 'web-cancel.txt', type: 'text/plain', arrayBuffer: () => pending }], configurable: true });
      fireEvent.change(input);
      expect(screen.getByTestId('zcode-upload-progress').textContent).toContain('reading');
      fireEvent.click(screen.getByText('Cancel upload'));
      await act(async () => { release(new Uint8Array([1, 2, 3]).buffer); await new Promise(resolve => setTimeout(resolve, 20)); });
      expect(screen.queryByTestId('zcode-attachment-web-cancel.txt')).toBeNull();
      expect(rpcCalls).not.toContain('attachmentStart');
      expect(rpcCalls).not.toContain('attachmentCommit');
      expect(rpcCalls).not.toContain('attachmentAbort');
    } finally {
      await remote?.cancel();
      f.dispose();
      if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  });
});
