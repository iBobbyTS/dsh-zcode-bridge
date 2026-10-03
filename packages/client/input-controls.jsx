import React, { useEffect, useRef, useState } from 'react';
import { inputSubmission, heldConfirmation, confirmHeld, optimisticQueue, commandResultText, executionSelection } from './input-controls.mjs';

/** Official command controls. Drafts and previews are local; accepted state comes from V4. */
export function ZCodeInputControls({ state, controller }) {
  const snapshot = state?.snapshot;
  const latest = useRef(state); latest.current = state;
  const owner = useRef(controller); owner.current = controller;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [text, setText] = useState('');
  const [goal, setGoal] = useState(false);
  const [delivery, setDelivery] = useState('');
  const [held, setHeld] = useState(null);
  const [operation, setOperation] = useState(null);
  const flight = useRef(null);
  const [result, setResult] = useState('');
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');
  const [modelDraft, setModelDraft] = useState(null);
  const allowed = state?.status === 'live' && state?.admission?.allowed === true;
  const available = name => allowed && snapshot?.availability?.[name]?.allowed === true;
  const disabled = !allowed || Boolean(operation);
  const execution = executionSelection(snapshot);
  const items = optimisticQueue(snapshot?.queue?.items ?? [], operation?.logEpoch === snapshot?.logEpoch ? operation : null);
  const model = modelDraft ?? { provider: snapshot?.config?.provider ?? '', model: snapshot?.config?.model ?? '', thought: snapshot?.config?.thought ?? '' };

  async function run(command, { preview, clearInput = false } = {}) {
    if (flight.current || !latest.current?.admission?.allowed || latest.current?.status !== 'live') return;
    const token = { controller }; flight.current = token;
    const epoch = latest.current.snapshot.logEpoch;
    const submittedText = text;
    setOperation({ ...command, ...preview, logEpoch: epoch }); setResult('');
    try {
      const record = await controller.submitInputCommand(command);
      if (!alive.current || owner.current !== token.controller || latest.current.snapshot?.logEpoch !== epoch) return;
      setResult(commandResultText(record));
      if (['accepted', 'duplicate'].includes(record?.ack?.status)) {
        if (clearInput) { setText(current => current === submittedText ? '' : current); setHeld(null); }
        if (command.type === 'editQueueItem') setEditing(null);
        if (command.type === 'switchModelConfig') setModelDraft(null);
      }
    } catch (error) {
      if (alive.current && owner.current === token.controller && latest.current.snapshot?.logEpoch === epoch) setResult(`${error.code ?? error.message}. Local preview cleared; no runtime undo was requested.`);
    } finally {
      if (flight.current === token) { flight.current = null; if (alive.current) setOperation(null); }
    }
  }

  async function workspace(kind, preferences) {
    if (flight.current) return;
    const token = { controller }; flight.current = token;
    const epoch = latest.current.snapshot?.logEpoch;
    setOperation({ type: 'workspaceConfig' }); setResult('');
    try {
      const response = await controller.workspaceConfiguration(kind, preferences);
      if (!alive.current || owner.current !== token.controller || latest.current.snapshot?.logEpoch !== epoch) return;
      const message = kind === 'presentation' ? `Workspace presentation: mode ${response.mode}; slash commands ${response.slashCommands.map(command => command.name).join(', ')}.`
        : kind === 'interaction' ? `Auto-resolution ${response.askUserQuestionAutoResolutionEnabled ? 'enabled' : 'disabled'}; snoozed interactions ${response.snoozedInteractionCount}.`
          : `Full model I/O retention ${response.fullRetentionEnabled ? 'enabled' : 'disabled'}; updated sessions ${response.updatedSessionCount}.`;
      setResult(`Last official workspace response: ${message} Preference reads remain unavailable; another endpoint may change this value.`);
    } catch (error) {
      if (alive.current && owner.current === token.controller && latest.current.snapshot?.logEpoch === epoch) setResult(`${error.code ?? error.message}. Workspace operation outcome may be unknown; no automatic retry or runtime undo was requested.`);
    } finally {
      if (flight.current === token) { flight.current = null; if (alive.current) setOperation(null); }
    }
  }

  function send() {
    try {
      const current = latest.current.snapshot;
      const command = inputSubmission(current, text, { goal, delivery: delivery || undefined });
      if (current.inputRouting.mode === 'choice' && ['sendText', 'sendGoalCommand'].includes(command.type)) { setHeld(heldConfirmation(current, command)); return; }
      void run(command, { clearInput: true });
    } catch (error) { setResult(error.message); }
  }
  function disposeHeld(disposition) {
    try { void run(confirmHeld(latest.current.snapshot, held, disposition), { clearInput: true }); }
    catch (error) { setResult(`${error.message}. Queue changed; cancel and review it again.`); }
  }
  function queueCommand(type, item, payload = {}) {
    const current = latest.current.snapshot;
    void run({ type, payload: { queueItemId: item.queueItemId, ...payload }, baseRevision: current.revision }, { preview: { sourceCommandId: item.sourceCommandId } });
  }

  return <section data-testid="zcode-input-controls" style={{ padding: '12px', borderTop: '1px solid var(--dsw-alias-border-subtle, #ddd)', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55%', minHeight: '180px', flexShrink: 0, overflow: 'hidden', overflowWrap: 'anywhere' }}>
    <div data-testid="zcode-queue-and-config" style={{ minHeight: 0, overflowY: 'auto', flex: '1 1 auto' }}>
    {!allowed && <p data-testid="zcode-input-unavailable">Input and configuration unavailable: {state?.admission?.reason ?? 'projection-unconfirmed'} (official auth-gated).</p>}
    <div data-testid="zcode-current-model">Current execution model: {execution.currentModel ?? 'not projected'}. Current execution mode: not projected.</div>
    <div data-testid="zcode-next-selection">Next execution selection: {execution.nextSelection ? `${execution.nextSelection.providerId}/${execution.nextSelection.modelId} (${execution.nextSelection.options?.reasoningLevel ?? 'runtime default'})` : 'unbound'}; mode: {snapshot?.config?.mode ?? 'unknown'}. Queued inputs retain their admitted selection.</div>
    <details><summary>Session and workspace configuration</summary>
    <fieldset disabled={disabled}>
      <legend>Session selection for subsequent execution</legend>
      <label>Provider <input aria-label="Provider" value={model.provider} onChange={event => setModelDraft({ ...model, provider: event.target.value })} /></label>
      <label>Model <input aria-label="Model" value={model.model} onChange={event => setModelDraft({ ...model, model: event.target.value })} /></label>
      <label>Thinking <input aria-label="Thinking" value={model.thought} onChange={event => setModelDraft({ ...model, thought: event.target.value })} /></label>
      <span>Official thought levels: {snapshot?.config?.thoughtLevels?.join(', ') || 'none projected'}</span>
      <button disabled={!available('switchModelConfig') || !model.provider.trim() || !model.model.trim()} onClick={() => void run({ type: 'switchModelConfig', payload: model })}>Apply model selection</button>
      <label>Collaboration mode <select aria-label="Collaboration mode" value={snapshot?.config?.mode ?? ''} onChange={event => void run({ type: 'switchCollaborationMode', payload: { mode: event.target.value } })}>
        <option value="" disabled>Unknown</option>{['build', 'edit', 'plan', 'yolo'].map(mode => <option key={mode} value={mode}>{mode}</option>)}
      </select></label>
      <label>Follow-up <select aria-label="Follow-up" disabled={!available('setFollowupMode')} value={snapshot?.config?.followupMode ?? ''} onChange={event => void run({ type: 'setFollowupMode', payload: { mode: event.target.value } })}>
        <option value="" disabled>Unknown</option><option value="queue">Queue</option><option value="guide">Guide</option>
      </select></label>
    </fieldset>
    <div data-testid="zcode-workspace-preferences-unavailable">Workspace preference current values unavailable: authoritative preference read has not been verified. Model catalog unavailable: target Host ModelSelectionView is not exposed by this connection.</div>
    <button disabled={Boolean(operation) || state?.status !== 'live' || !state?.managementAdmission?.allowed} onClick={() => void workspace('presentation')}>Read workspace presentation</button>
    <div>Workspace AskUserQuestion auto-resolution: unknown <button disabled={disabled} onClick={() => void workspace('interaction', { askUserQuestionAutoResolutionEnabled: true })}>Enable auto-resolution</button><button disabled={disabled} onClick={() => void workspace('interaction', { askUserQuestionAutoResolutionEnabled: false })}>Disable auto-resolution</button></div>
    <div>Workspace model I/O retention: unknown <button disabled={disabled} onClick={() => void workspace('modelIo', { fullRetentionEnabled: true })}>Enable model I/O retention</button><button disabled={disabled} onClick={() => void workspace('modelIo', { fullRetentionEnabled: false })}>Disable model I/O retention</button></div>
    </details>
    <div data-testid="zcode-queue-state">Queue: {snapshot?.queue?.autoDrain ? 'auto drain' : 'paused'} {snapshot?.queue?.pauseReason ?? ''}</div>
    <button disabled={disabled || !snapshot} onClick={() => void run({ type: 'setAutoDrain', payload: { autoDrain: !snapshot.queue.autoDrain } })}>{snapshot?.queue?.autoDrain ? 'Pause queue' : 'Resume queue'}</button>
    <ol data-testid="zcode-queue-list">{items.map((item, index) => <li key={`${item.queueItemId}:${item.sourceCommandId}`} data-testid={`zcode-queue-${item.queueItemId}`}>
      <span>{item.text || item.kind} — {item.delivery.requested} → {item.delivery.admitted}; {item.steer.state} {item.delivery.fallbackReasonCode ?? item.steer.reasonCode ?? ''}; {item.dispatch.state}</span>
      <small> Input {item.queueItemId}; command {item.sourceCommandId}; {item.modelSelection ? `${item.modelSelection.providerId}/${item.modelSelection.modelId}` : 'legacy selection unknown'}; {item.mode ?? 'legacy mode unknown'}</small>
      <button disabled={disabled || !available('queueEdit') || item.dispatch.state !== 'queued' || item.kind === 'compact'} onClick={() => { setEditing({ queueItemId: item.queueItemId, sourceCommandId: item.sourceCommandId, logEpoch: snapshot.logEpoch }); setEditText(item.text); }}>Edit</button>
      <button disabled={disabled || !available('queueEdit') || item.dispatch.state !== 'queued' || index === 0} onClick={() => queueCommand('reorderQueueItem', item, { beforeQueueItemId: items[index - 1].queueItemId })}>Move up</button>
      <button disabled={disabled || !available('queueEdit') || item.dispatch.state !== 'queued' || index === items.length - 1} onClick={() => queueCommand('reorderQueueItem', item, { beforeQueueItemId: items[index + 2]?.queueItemId ?? null })}>Move down</button>
      <button disabled={disabled || !available('queueEdit') || item.dispatch.state !== 'queued'} onClick={() => queueCommand('deleteQueueItem', item)}>Delete</button>
      <button disabled={disabled || !available('sendQueuedNow') || item.dispatch.state !== 'queued'} onClick={() => queueCommand('sendQueuedNow', item)}>Send now</button>
    </li>)}</ol>
    {editing && <div><label>Edit queued text <textarea aria-label="Edit queued text" value={editText} onChange={event => setEditText(event.target.value)} /></label>
      <button disabled={disabled || !available('queueEdit')} onClick={() => {
        const item = snapshot.queue.items.find(item => item.queueItemId === editing.queueItemId && item.sourceCommandId === editing.sourceCommandId);
        if (!item || snapshot.logEpoch !== editing.logEpoch) { setResult('queue-item-unconfirmed'); return; }
        queueCommand('editQueueItem', item, { newText: editText });
      }}>Save queued text</button><button onClick={() => setEditing(null)}>Cancel edit</button></div>}
    <div data-testid="zcode-goal-state">Goal: {snapshot?.goal?.objective ?? 'none'} ({snapshot?.goal?.status ?? 'none'})</div>
    <button disabled={disabled || !available('pauseGoal')} onClick={() => void run({ type: 'pauseGoal', payload: {} })}>Pause goal</button>
    <button disabled={disabled || !available('resumeGoal')} onClick={() => void run({ type: 'resumeGoal', payload: {} })}>Resume goal</button>
    </div>
    <div style={{ flexShrink: 0, display: 'grid', gap: '4px' }}>
    <label>Input <textarea aria-label="ZCode input" disabled={disabled || Boolean(held)} value={text} onChange={event => setText(event.target.value)} /></label>
    <label><input type="checkbox" aria-label="Goal command" checked={goal} disabled={disabled || Boolean(held)} onChange={event => setGoal(event.target.checked)} />Goal command (official /goal syntax)</label>
    <label>Delivery <select aria-label="Delivery" disabled={disabled || goal || Boolean(held)} value={delivery} onChange={event => setDelivery(event.target.value)}>
      <option value="">Official routing ({snapshot?.inputRouting?.mode ?? 'unknown'})</option><option value="queue">Queue</option><option value="guide">Guide</option><option value="startNow">Start now (preempts current turn)</option>
    </select></label>
    <button disabled={disabled || Boolean(held) || !text.trim() || !snapshot?.config?.modelSelection || snapshot?.inputRouting?.mode === 'reject'} onClick={send}>Submit input</button>
    {held && <div role="dialog" aria-label="Paused queue disposition" data-testid="zcode-held-confirmation">
      <p>Paused queue confirmation: {held.items.length} inputs.</p><ul style={{ maxHeight: '80px', overflowY: 'auto' }}>{held.items.map(item => <li key={item.queueItemId}>{item.queueItemId} / {item.sourceCommandId}</li>)}</ul>
      <button disabled={disabled} onClick={() => disposeHeld('clearQueueAndSend')}>Clear confirmed queue and send</button>
      <button disabled={disabled} onClick={() => disposeHeld('keepQueueAndSend')}>Keep confirmed queue and send</button>
      <button disabled={Boolean(operation)} onClick={() => setHeld(null)}>Cancel confirmation</button>
    </div>}
    {result && <p role="status" data-testid="zcode-input-result">{result}</p>}
    </div>
  </section>;
}
