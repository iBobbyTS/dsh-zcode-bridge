import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { s06Runtime } from './fixtures/s06-runtime.mjs';
import { ZCodeConversationView } from '../packages/client/conversation-view.jsx';
import { renderSessionArea } from '../../dsh/packages/client/ui-session/src/client/session-provider.tsx';
afterEach(cleanup);

async function mount(name = 'busy', options = {}) {
  const f = s06Runtime(name, options); await f.open();
  render(React.createElement(ZCodeConversationView, { conversation: f.conversation }));
  return f;
}
function row(id = 'input-a') { return within(screen.getByTestId(`zcode-queue-${id}`)); }
async function answer(f, status = 'accepted', reason?) { await act(async () => { f.ack(f.sent.at(-1), status, reason); }); }
function order() { return [...screen.getByTestId('zcode-queue-list').children].map(element => element.getAttribute('data-testid')); }

describe('S06 actual producer → command → V4 → view', () => {
  it.each(['queue', 'guide', 'startNow'])('submits %s without conflating configured followup mode', async delivery => {
    const f = await mount(); try {
      fireEvent.change(screen.getByLabelText('ZCode input'), { target: { value: `Input ${delivery}` } });
      fireEvent.change(screen.getByLabelText('Delivery'), { target: { value: delivery } });
      fireEvent.click(screen.getByText('Submit input'));
      expect(f.sent.at(-1).params.payload.requestedDelivery).toBe(delivery);
      expect(f.sent.at(-1).params.payload.modelSelection.modelId).toBe('model-old');
      await answer(f);
      expect(screen.getByLabelText('ZCode input').value).toBe('');
      expect(screen.getByTestId('zcode-input-result').textContent).toContain('Awaiting authoritative state');
      expect(f.conversation.state.snapshot.config.followupMode).toBe('queue');
    } finally { f.dispose(); }
  });
  it('reorders two distinct inputs, rolls back rejected UI only, then follows authoritative order', async () => {
    const f = await mount(); try {
      fireEvent.click(row('input-b').getByText('Move up'));
      expect(order()).toEqual(['zcode-queue-input-b', 'zcode-queue-input-a']);
      await answer(f, 'stale', 'proto.staleRevision');
      expect(order()).toEqual(['zcode-queue-input-a', 'zcode-queue-input-b']);
      expect(screen.getByTestId('zcode-input-result').textContent).toContain('does not undo an accepted command');
      fireEvent.click(row('input-b').getByText('Move up'));
      await act(async () => { f.update(s => s.queue.items.reverse()); f.ack(f.sent.at(-1)); });
      expect(order()).toEqual(['zcode-queue-input-b', 'zcode-queue-input-a']);
    } finally { f.dispose(); }
  });
  it('edits, deletes and sends now by official identity; ACK alone never fabricates queue changes', async () => {
    const f = await mount(); try {
      fireEvent.click(row().getByText('Edit'));
      fireEvent.change(screen.getByLabelText('Edit queued text'), { target: { value: 'ALPHA edited' } });
      fireEvent.click(screen.getByText('Save queued text'));
      expect(row().getByText(/ALPHA edited/)).toBeDefined();
      expect(f.sent.at(-1).params.type).toBe('editQueueItem');
      await answer(f);
      expect(row().getByText(/ALPHA: first/)).toBeDefined();
      fireEvent.click(row().getByText('Delete'));
      expect(screen.queryByTestId('zcode-queue-input-a')).toBeNull();
      await answer(f, 'failed', 'fixture.denied');
      expect(screen.getByTestId('zcode-queue-input-a')).toBeDefined();
      fireEvent.click(row().getByText('Send now'));
      expect(f.sent.at(-1).params.type).toBe('sendQueuedNow');
      expect(f.sent.at(-1).params.payload).toEqual({ queueItemId: 'input-a' });
      await answer(f);
      expect(screen.getByTestId('zcode-queue-input-a')).toBeDefined();
    } finally { f.dispose(); }
  });
  it('paused confirmation freezes IDs; another client insertion blocks both old dispositions', async () => {
    const f = await mount('held'); try {
      fireEvent.change(screen.getByLabelText('ZCode input'), { target: { value: 'Held new input' } });
      fireEvent.click(screen.getByText('Submit input'));
      expect(screen.getByRole('dialog').textContent).toContain('input-a / command-input-a');
      const count = f.sent.length;
      await act(async () => { f.update(s => s.queue.items.push({ ...structuredClone(s.queue.items[0]), queueItemId: 'new-client-input', sourceCommandId: 'new-client-command', text: 'New item from another client' })); });
      for (const button of ['Clear confirmed queue and send', 'Keep confirmed queue and send']) {
        fireEvent.click(screen.getByText(button));
        expect(f.sent.length).toBe(count);
        expect(screen.getByTestId('zcode-input-result').textContent).toContain('confirmation-stale');
      }
      expect(screen.getByTestId('zcode-queue-new-client-input')).toBeDefined();
      fireEvent.click(screen.getByText('Cancel confirmation'));
      fireEvent.click(screen.getByText('Submit input'));
      fireEvent.click(screen.getByText('Keep confirmed queue and send'));
      expect(f.sent.at(-1).params.payload.expectedHeldQueueItemIds).toEqual(['input-a', 'input-b', 'new-client-input']);
      await answer(f);
    } finally { f.dispose(); }
  });
  it('clear confirmation and pause/resume use formal carriers while S05 pending remains snapshot-owned', async () => {
    const f = await mount('held'); try {
      fireEvent.change(screen.getByLabelText('ZCode input'), { target: { value: 'Replace held' } });
      fireEvent.click(screen.getByText('Submit input')); fireEvent.click(screen.getByText('Clear confirmed queue and send'));
      expect(f.sent.at(-1).params.payload.heldQueueDisposition).toBe('clearQueueAndSend');
      await answer(f);
      fireEvent.click(screen.getByText('Resume queue'));
      expect(f.sent.at(-1).params).toMatchObject({ type: 'setAutoDrain', payload: { autoDrain: true } });
      await act(async () => { f.update(s => { s.queue.autoDrain = true; }); f.ack(f.sent.at(-1)); });
      fireEvent.click(screen.getByText('Pause queue'));
      expect(f.sent.at(-1).params.payload.autoDrain).toBe(false); await answer(f);
      expect(f.conversation.state.snapshot.pendingInteractions).toEqual([]);
    } finally { f.dispose(); }
  });
  it('keeps current response distinct from official next model/mode; config failure retains draft', async () => {
    const f = await mount(); try {
      fireEvent.click(screen.getByText('Session and workspace configuration'));
      fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'model-next' } });
      fireEvent.change(screen.getByLabelText('Thinking'), { target: { value: 'low' } });
      fireEvent.click(screen.getByText('Apply model selection')); await answer(f, 'failed', 'provider.notInRegistry');
      expect(screen.getByLabelText('Model').value).toBe('model-next');
      expect(screen.getByTestId('zcode-next-selection').textContent).toContain('model-old');
      fireEvent.click(screen.getByText('Apply model selection'));
      await act(async () => { f.update(s => { s.config.model = 'model-next'; s.config.thought = 'low'; s.config.modelSelection.modelId = 'model-next'; }); f.ack(f.sent.at(-1)); });
      expect(screen.getByTestId('zcode-current-model').textContent).toContain('model-old');
      expect(screen.getByTestId('zcode-next-selection').textContent).toContain('model-next');
      expect(row().getByText(/model-old; build/)).toBeDefined();
      fireEvent.change(screen.getByLabelText('Collaboration mode'), { target: { value: 'edit' } });
      expect(f.sent.at(-1).params.type).toBe('switchCollaborationMode'); await answer(f);
      expect(screen.getByLabelText('Collaboration mode').value).toBe('build');
    } finally { f.dispose(); }
  });
  it('followup and goal commands use official payloads; Guide fallback is visible', async () => {
    const f = await mount('guided'); try {
      fireEvent.click(screen.getByText('Session and workspace configuration'));
      expect(row('input-b').getByText(/guide.attachmentsUnsupported/)).toBeDefined();
      fireEvent.change(screen.getByLabelText('Follow-up'), { target: { value: 'guide' } });
      expect(f.sent.at(-1).params).toMatchObject({ type: 'setFollowupMode', payload: { mode: 'guide' } }); await answer(f);
      fireEvent.click(screen.getByLabelText('Goal command'));
      fireEvent.change(screen.getByLabelText('ZCode input'), { target: { value: '/goal replace release' } });
      fireEvent.click(screen.getByText('Submit input'));
      expect(f.sent.at(-1).params.type).toBe('sendGoalCommand'); expect(f.sent.at(-1).params.payload.requestedDelivery).toBeUndefined(); await answer(f);
      expect(f.sent.at(-1).params.payload.text).toBe('release');
      expect(screen.getByLabelText('ZCode input').value).toBe('');
      fireEvent.click(screen.getByText('Pause goal')); expect(f.sent.at(-1).params.type).toBe('pauseGoal'); await answer(f);
      fireEvent.click(screen.getByText('Resume goal')); expect(f.sent.at(-1).params.type).toBe('resumeGoal'); await answer(f);
    } finally { f.dispose(); }
  });
  it('lost ACK clears only local preview, remains queryable and never resubmits', async () => {
    const f = await mount(); try {
      fireEvent.click(row().getByText('Delete'));
      await waitFor(() => expect(screen.getByTestId('zcode-input-result').textContent).toContain('outcome-unknown'));
      expect(screen.getByTestId('zcode-queue-input-a')).toBeDefined();
      expect(f.sent.filter(request => request.params?.type === 'deleteQueueItem')).toHaveLength(1);
    } finally { f.dispose(); }
  });
  it('auth-gated mount via the DSH consumer seat disables all S06 execution and preference writes', async () => {
    const f = s06Runtime('busy', { runnable: false }); try {
      await f.open();
      const reference = { runtime: 'zcode', address: f.conversation.address, renderSessionArea: () => React.createElement(ZCodeConversationView, { conversation: f.conversation }) };
      render(renderSessionArea({ key: undefined }, { session: reference, children: React.createElement('div', {}, 'native settings'), empty: () => 'empty' }));
      expect(screen.queryByText('native settings')).toBeNull();
      expect(screen.getByTestId('zcode-input-unavailable').textContent).toContain('auth-gated');
      expect(screen.getByText('Submit input').disabled).toBe(true);
      expect(row().getByText('Delete').disabled).toBe(true);
      expect(screen.getByText('Apply model selection').disabled).toBe(true);
      expect(screen.getByTestId('zcode-workspace-preferences-unavailable').textContent).toContain('not been verified');
    } finally { f.dispose(); }
  });
});

it('S06 workspace presentation and explicit preference writes consume scoped official responses with no local default', async () => {
  const f = await mount(); try {
    fireEvent.click(screen.getByText('Session and workspace configuration'));
    fireEvent.click(screen.getByText('Read workspace presentation'));
    expect(f.sent.at(-1).method).toBe('workspace/readPresentation');
    await act(async () => { f.response(f.sent.at(-1), { workspace: f.conversation.workspace, mode: 'build', slashCommands: [] }); });
    expect(screen.getByTestId('zcode-input-result').textContent).toContain('Workspace presentation: mode build');
    fireEvent.click(screen.getByText('Disable auto-resolution'));
    expect(f.sent.at(-1).params.preferences).toEqual({ askUserQuestionAutoResolutionEnabled: false });
    await act(async () => { f.response(f.sent.at(-1), { workspace: f.conversation.workspace, askUserQuestionAutoResolutionEnabled: false, snoozedInteractionCount: 1 }); });
    expect(screen.getByTestId('zcode-input-result').textContent).toContain('snoozed interactions 1');
    fireEvent.click(screen.getByText('Enable model I/O retention'));
    expect(f.sent.at(-1).params.preferences).toEqual({ fullRetentionEnabled: true });
    await act(async () => { f.response(f.sent.at(-1), { workspace: f.conversation.workspace, fullRetentionEnabled: true, updatedSessionCount: 0 }); });
    expect(screen.getByTestId('zcode-input-result').textContent).toContain('another endpoint may change');
    expect(screen.getByText(/Workspace model I\/O retention: unknown/)).toBeDefined();
  } finally { f.dispose(); }
});
