import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { s07Runtime } from './fixtures/s07-runtime.mjs';
import { ZCodeConversationView } from '../packages/client/conversation-view.jsx';

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
