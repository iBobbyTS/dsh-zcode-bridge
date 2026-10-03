import React, { useState, useEffect, useSyncExternalStore } from 'react';

/**
 * Controller wrapping a V4Conversation instance for reactive React rendering and actions.
 */
export class ConversationController {
  #conversation;
  #state;
  #listeners = new Set();
  #unsub = null;
  #disposed = false;

  constructor(conversation) {
    this.#conversation = conversation;
    this.#state = conversation?.state ?? {
      status: 'idle',
      snapshot: null,
      subscriptionId: null,
      logEpoch: null,
      error: null,
      gap: null,
      commands: [],
      admission: { allowed: false, reason: 'uninitialized' },
    };
    if (conversation?.subscribe) {
      this.#unsub = conversation.subscribe(state => {
        if (this.#disposed) return;
        this.#state = state;
        for (const listener of this.#listeners) {
          try { listener(); } catch {}
        }
      });
    }
  }

  getSnapshot = () => this.#state;

  subscribe = (listener) => {
    if (this.#disposed) return () => {};
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  get conversation() {
    return this.#conversation;
  }

  get disposed() {
    return this.#disposed;
  }

  async connect(options) {
    if (this.#disposed) return;
    return this.#conversation?.connect?.(options);
  }

  async resync(options) {
    if (this.#disposed) return;
    return this.#conversation?.resync?.(options);
  }

  async stop() {
    if (this.#disposed) throw new Error('Controller is disposed');
    const activeWork = this.#state.snapshot?.control?.activeWorks?.[0];
    const foregroundExecutionId = activeWork?.foregroundExecutionId;
    if (!foregroundExecutionId) throw new Error('No active execution to stop');
    return this.#conversation?.submit?.({
      type: 'stop',
      payload: { expectedForegroundExecutionId: foregroundExecutionId },
    });
  }

  async resolveInteraction(interactionId, answer) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation?.submit?.({
      type: 'resolveInteraction',
      payload: { interactionId, answer },
    });
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#unsub?.();
    this.#unsub = null;
    this.#listeners.clear();
  }
}

/**
 * Status banner showing session status, epoch/seq/rev chips, and profile.
 * ZCode-specific metadata is rendered in dedicated nodes (R08).
 */
export function ZCodeStatusBanner({ state }) {
  const status = state?.status ?? 'idle';
  const snapshot = state?.snapshot;
  const epoch = state?.logEpoch ?? snapshot?.logEpoch ?? '—';
  const seq = snapshot?.seq ?? '—';
  const revision = snapshot?.revision ?? '—';
  const profile = state?.profile ?? 'replayable';
  const subId = state?.subscriptionId ?? '—';

  return (
    <div
      data-testid="zcode-status-banner"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderBottom: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
        background: 'var(--dsw-alias-bg-secondary, #f9fafb)',
        fontSize: '12px',
        color: 'var(--dsw-alias-text-primary, #111827)',
      }}
    >
      <span
        data-testid="zcode-status-badge"
        data-status={status}
        style={{
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '4px',
          background:
            status === 'live' ? 'rgba(16, 185, 129, 0.15)' :
            status === 'connecting' || status === 'resyncing' ? 'rgba(245, 158, 11, 0.15)' :
            status === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(156, 163, 175, 0.15)',
          color:
            status === 'live' ? '#065f46' :
            status === 'connecting' || status === 'resyncing' ? '#92400e' :
            status === 'error' ? '#991b1b' : '#374151',
        }}
      >
        Status: {status}
      </span>

      <span
        data-testid="zcode-epoch"
        style={{
          background: 'var(--dsw-alias-bg-tertiary, #f3f4f6)',
          padding: '2px 6px',
          borderRadius: '4px',
          border: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
          fontFamily: 'monospace',
        }}
      >
        Epoch: {epoch}
      </span>

      <span
        data-testid="zcode-seq"
        style={{
          background: 'var(--dsw-alias-bg-tertiary, #f3f4f6)',
          padding: '2px 6px',
          borderRadius: '4px',
          border: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
          fontFamily: 'monospace',
        }}
      >
        Seq: {String(seq)}
      </span>

      <span
        data-testid="zcode-revision"
        style={{
          background: 'var(--dsw-alias-bg-tertiary, #f3f4f6)',
          padding: '2px 6px',
          borderRadius: '4px',
          border: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
          fontFamily: 'monospace',
        }}
      >
        Rev: {String(revision)}
      </span>

      <span
        data-testid="zcode-profile"
        style={{
          background: 'var(--dsw-alias-bg-tertiary, #f3f4f6)',
          padding: '2px 6px',
          borderRadius: '4px',
          border: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
        }}
      >
        Profile: {profile}
      </span>

      <span
        data-testid="zcode-sub-id"
        style={{
          background: 'var(--dsw-alias-bg-tertiary, #f3f4f6)',
          padding: '2px 6px',
          borderRadius: '4px',
          border: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
          fontFamily: 'monospace',
          maxWidth: '180px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={subId}
      >
        Sub: {subId}
      </span>

      <span
        data-testid="zcode-auth-note"
        style={{
          marginLeft: 'auto',
          color: 'var(--dsw-alias-text-secondary, #6b7280)',
          fontStyle: 'italic',
        }}
      >
        Runtime: restricted (official auth-gated)
      </span>
    </div>
  );
}

/**
 * Disconnection, recovery, and deterministic error alerts.
 */
export function ZCodeAlerts({ state, onReconnect }) {
  const isResyncing = state?.status === 'resyncing';
  const gap = state?.gap;
  const isError = state?.status === 'error' || Boolean(state?.error);
  const errorText = state?.error ? (state.error?.message ?? state.error?.code ?? String(state.error)) : null;

  if (!isResyncing && !gap && !isError) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 14px' }}>
      {isResyncing && (
        <div
          role="alert"
          data-testid="zcode-resyncing-alert"
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#b45309',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠️</span>
          <span>Resyncing session state with official runtime (base epoch: {state?.logEpoch ?? '—'})...</span>
        </div>
      )}

      {gap && (
        <div
          role="alert"
          data-testid="zcode-gap-alert"
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#b91c1c',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚡</span>
          <span>Sequence gap detected: expected sequence {gap.fromSeq ?? gap.expected}, received {gap.toSeq ?? gap.received}. Recovery in progress.</span>
        </div>
      )}

      {isError && (
        <div
          role="alert"
          data-testid="zcode-error-alert"
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#b91c1c',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>❌</span>
            <span>Deterministic session error: {errorText}</span>
          </div>
          {onReconnect && (
            <button
              type="button"
              data-testid="zcode-reconnect-button"
              onClick={onReconnect}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid #b91c1c',
                background: '#ffffff',
                color: '#b91c1c',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Control bar with Stop button targeting current execution (B04).
 */
export function ZCodeControlBar({ state, onStop }) {
  const activeWork = state?.snapshot?.control?.activeWorks?.[0];
  const foregroundExecutionId = activeWork?.foregroundExecutionId;
  const canStopRuntime = Boolean(state?.snapshot?.control?.canStop && foregroundExecutionId);
  const admissionAllowed = Boolean(state?.admission?.allowed);
  const canStop = canStopRuntime && admissionAllowed;

  let disabledReason = null;
  if (!admissionAllowed) {
    disabledReason = 'Cannot stop: runtime restricted (official auth-gated)';
  } else if (!foregroundExecutionId) {
    disabledReason = 'No active execution to stop';
  } else if (!canStopRuntime) {
    disabledReason = 'Stop not available';
  }

  return (
    <div
      data-testid="zcode-control-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 14px',
        borderBottom: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
        background: 'var(--dsw-alias-bg-primary, #ffffff)',
      }}
    >
      <button
        type="button"
        data-testid="zcode-stop-button"
        disabled={!canStop}
        onClick={canStop ? onStop : undefined}
        style={{
          padding: '6px 14px',
          borderRadius: '6px',
          border: canStop ? '1px solid #ef4444' : '1px solid #d1d5db',
          background: canStop ? '#ef4444' : '#f3f4f6',
          color: canStop ? '#ffffff' : '#9ca3af',
          fontWeight: 600,
          fontSize: '13px',
          cursor: canStop ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>⏹</span>
        <span>Stop Execution</span>
      </button>

      {!canStop && disabledReason && (
        <span
          data-testid="zcode-stop-disabled-reason"
          style={{
            fontSize: '12px',
            color: 'var(--dsw-alias-text-secondary, #6b7280)',
          }}
        >
          ({disabledReason})
        </span>
      )}
    </div>
  );
}

/**
 * Basic permission / ask-user pending interactions.
 * Displays official runtime result upon resolution without false success.
 */
export function ZCodePendingInteractions({ state, onResolve }) {
  const interactions = state?.snapshot?.pendingInteractions ?? [];
  const [freeTextInputs, setFreeTextInputs] = useState({});
  const [results, setResults] = useState({});
  const [submitting, setSubmitting] = useState({});

  if (!interactions.length && Object.keys(results).length === 0) return null;

  const handleResolve = async (interactionId, answer) => {
    setSubmitting(prev => ({ ...prev, [interactionId]: true }));
    try {
      const record = await onResolve(interactionId, answer);
      const reasonCode = record?.ack?.reasonCode ?? record?.error ?? record?.state;
      const status = record?.ack?.status ?? record?.state ?? 'resolved';
      setResults(prev => ({
        ...prev,
        [interactionId]: { status, reasonCode: reasonCode || status },
      }));
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [interactionId]: { status: 'error', reasonCode: err.code ?? err.message ?? 'failed' },
      }));
    } finally {
      setSubmitting(prev => ({ ...prev, [interactionId]: false }));
    }
  };

  return (
    <div
      data-testid="zcode-pending-interactions"
      style={{
        margin: '12px 14px',
        padding: '14px',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-secondary, #f9fafb)',
        border: '1px solid var(--dsw-alias-border-strong, #d1d5db)',
      }}
    >
      <div
        data-testid="zcode-interaction-label"
        style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#d97706',
          marginBottom: '8px',
        }}
      >
        Fixture-driven pending interaction (live runtime is auth-gated)
      </div>

      {interactions.map(interaction => {
        const id = interaction.interactionId;
        const kind = interaction.kind;
        const payload = interaction.payload;
        const result = results[id];
        const isBusy = submitting[id];

        return (
          <div
            key={id}
            data-testid={`zcode-interaction-${id}`}
            data-interaction-kind={kind}
            style={{
              padding: '12px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
              marginBottom: '8px',
            }}
          >
            {kind === 'permission' && (
              <div data-testid="zcode-permission-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px' }}>🛡️</span>
                  <strong>Permission Request:</strong>
                  <span
                    data-testid="zcode-permission-tool"
                    style={{
                      fontFamily: 'monospace',
                      background: '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {payload?.toolName ?? 'Tool'}
                  </span>
                </div>
                <p data-testid="zcode-permission-summary" style={{ margin: '0 0 10px 0', fontSize: '13px' }}>
                  {payload?.summary ?? ''}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(payload?.options ?? [
                    { optionId: 'allowOnce', label: 'Allow Once' },
                    { optionId: 'deny', label: 'Deny' },
                  ]).map(opt => (
                    <button
                      key={opt.optionId}
                      type="button"
                      data-testid={`zcode-permission-btn-${opt.optionId}`}
                      disabled={isBusy || Boolean(result)}
                      onClick={() => handleResolve(id, { optionId: opt.optionId })}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        background: opt.optionId === 'deny' ? '#fef2f2' : '#f0fdf4',
                        color: opt.optionId === 'deny' ? '#991b1b' : '#166534',
                        fontWeight: 500,
                        fontSize: '12px',
                        cursor: isBusy || result ? 'default' : 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {kind === 'userInput' && (
              <div data-testid="zcode-user-input-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px' }}>❓</span>
                  <strong>User Input Requested:</strong>
                </div>
                <p data-testid="zcode-user-input-prompt" style={{ margin: '0 0 10px 0', fontSize: '13px' }}>
                  {payload?.prompt ?? ''}
                </p>
                {payload?.options && payload.options.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {payload.options.map(opt => (
                      <button
                        key={opt.optionId}
                        type="button"
                        data-testid={`zcode-user-input-btn-${opt.optionId}`}
                        disabled={isBusy || Boolean(result)}
                        onClick={() => handleResolve(id, { optionId: opt.optionId })}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          background: '#f9fafb',
                          fontSize: '12px',
                          cursor: isBusy || result ? 'default' : 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                {payload?.freeText && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      data-testid="zcode-user-input-text"
                      disabled={isBusy || Boolean(result)}
                      value={freeTextInputs[id] ?? ''}
                      onChange={e => setFreeTextInputs({ ...freeTextInputs, [id]: e.target.value })}
                      placeholder="Type your response..."
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        fontSize: '13px',
                      }}
                    />
                    <button
                      type="button"
                      data-testid="zcode-user-input-submit"
                      disabled={isBusy || Boolean(result)}
                      onClick={() => handleResolve(id, { freeText: freeTextInputs[id] ?? '' })}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '4px',
                        border: '1px solid #2563eb',
                        background: '#2563eb',
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: isBusy || result ? 'default' : 'pointer',
                      }}
                    >
                      {isBusy ? 'Submitting…' : 'Submit'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {result && (
              <div
                role="status"
                data-testid={`zcode-interaction-result-${id}`}
                style={{
                  marginTop: '8px',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  background: '#f3f4f6',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#374151',
                }}
              >
                Official result: {result.reasonCode} ({result.status})
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Command Ledger showing tracked commands separated into ACK, execution, and terminal states.
 */
export function ZCodeCommandLedger({ state }) {
  const commands = state?.commands ?? [];
  if (!commands.length) return null;

  return (
    <div
      data-testid="zcode-command-ledger"
      style={{
        margin: '12px 14px',
        padding: '12px',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-secondary, #f9fafb)',
        border: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
        fontSize: '12px',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--dsw-alias-text-secondary, #6b7280)' }}>
        Command Ledger (ACK / Execution / Terminal separation)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {commands.map(cmd => {
          const status = cmd.state ?? cmd.status ?? 'unknown';
          const isExecuting = ['running', 'waiting'].includes(status);
          const isTerminal = ['completed', 'failed', 'interrupted', 'rejected', 'stale', 'noop'].includes(status);

          const badgeBg =
            isTerminal ? (status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)') :
            isExecuting ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)';
          const badgeColor =
            isTerminal ? (status === 'completed' ? '#065f46' : '#991b1b') :
            isExecuting ? '#1e40af' : '#92400e';

          return (
            <div
              key={cmd.commandId}
              data-testid={`zcode-command-${cmd.commandId}`}
              data-command-status={status}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                borderRadius: '4px',
                background: '#ffffff',
                border: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
                fontFamily: 'monospace',
              }}
            >
              <span data-testid="zcode-cmd-id" style={{ color: '#4b5563' }}>
                {cmd.commandId.slice(0, 8)}…
              </span>
              <span data-testid="zcode-cmd-type" style={{ fontWeight: 600 }}>
                {cmd.type}
              </span>
              <span
                data-testid="zcode-cmd-status"
                style={{
                  padding: '1px 6px',
                  borderRadius: '3px',
                  background: badgeBg,
                  color: badgeColor,
                  fontWeight: 600,
                }}
              >
                {status}
              </span>
              {cmd.ack?.reasonCode && (
                <span data-testid="zcode-cmd-reason" style={{ color: '#b91c1c' }}>
                  [{cmd.ack.reasonCode}]
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Message / turn rows rendering.
 * R08 invariant: Reasoning nodes are rendered in dedicated collapsible/styled nodes, never flattened into assistant text.
 */
export function ZCodeRowsList({ state }) {
  const rows = state?.snapshot?.rows?.window ?? [];
  if (!rows.length) {
    return (
      <div
        data-testid="zcode-rows-container"
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: 'var(--dsw-alias-text-secondary, #6b7280)',
          fontSize: '13px',
        }}
      >
        No messages in session history
      </div>
    );
  }

  return (
    <div
      data-testid="zcode-rows-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '14px',
      }}
    >
      {rows.map(row => {
        const rowId = row.rowId;
        const kind = row.kind;

        if (kind === 'turnHeader') {
          return (
            <div
              key={rowId}
              data-testid={`zcode-row-${rowId}`}
              data-row-kind={kind}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 0',
                borderBottom: '1px dashed var(--dsw-alias-border-subtle, #e5e7eb)',
                color: 'var(--dsw-alias-text-secondary, #6b7280)',
                fontSize: '11px',
              }}
            >
              <div data-testid="zcode-turn-header" style={{ fontWeight: 600 }}>
                Turn #{row.turnId} · State: {row.state ?? 'running'}
              </div>
            </div>
          );
        }

        if (kind === 'userInput') {
          return (
            <div
              key={rowId}
              data-testid={`zcode-row-${rowId}`}
              data-row-kind={kind}
              style={{
                alignSelf: 'flex-end',
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: '12px 12px 2px 12px',
                background: 'var(--dsw-alias-accent, #2563eb)',
                color: '#ffffff',
                fontSize: '14px',
                lineHeight: 1.5,
              }}
            >
              <div data-testid="zcode-user-input-row">{row.text}</div>
            </div>
          );
        }

        if (kind === 'reasoning') {
          return (
            <div
              key={rowId}
              data-testid={`zcode-row-${rowId}`}
              data-row-kind={kind}
              style={{
                alignSelf: 'flex-start',
                width: '100%',
                maxWidth: '90%',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                padding: '10px 12px',
                fontSize: '13px',
              }}
            >
              <div
                data-testid="zcode-reasoning-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  color: '#4f46e5',
                  marginBottom: '6px',
                  fontSize: '12px',
                }}
              >
                <span>🧠</span>
                <span data-testid="zcode-reasoning-header">
                  Model Reasoning ({row.state ?? 'complete'}){row.durationMs ? ` · ${row.durationMs}ms` : ''}
                </span>
              </div>
              <div
                data-testid="zcode-reasoning-text"
                style={{
                  color: '#374151',
                  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {row.text}
              </div>
            </div>
          );
        }

        if (kind === 'toolCall') {
          return (
            <div
              key={rowId}
              data-testid={`zcode-row-${rowId}`}
              data-row-kind={kind}
              style={{
                alignSelf: 'flex-start',
                width: '100%',
                maxWidth: '90%',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid var(--dsw-alias-border-subtle, #e5e7eb)',
                padding: '10px 12px',
                fontSize: '13px',
              }}
            >
              <div
                data-testid="zcode-tool-call-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔧</span>
                  <span data-testid="zcode-tool-name" style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                    {row.toolName}
                  </span>
                </div>
                <span
                  data-testid="zcode-tool-status"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: row.status === 'success' ? '#dcfce7' : row.status === 'error' ? '#fee2e2' : '#fef3c7',
                    color: row.status === 'success' ? '#166534' : row.status === 'error' ? '#991b1b' : '#92400e',
                  }}
                >
                  {row.status}
                </span>
              </div>
              {row.inputText && (
                <pre
                  data-testid="zcode-tool-input"
                  style={{
                    background: '#f8fafc',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    margin: '4px 0',
                    overflowX: 'auto',
                  }}
                >
                  {row.inputText}
                </pre>
              )}
              {row.output && (
                <pre
                  data-testid="zcode-tool-output"
                  style={{
                    background: '#f1f5f9',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    margin: '4px 0',
                    overflowX: 'auto',
                  }}
                >
                  {typeof row.output === 'string' ? row.output : JSON.stringify(row.output, null, 2)}
                </pre>
              )}
              {row.error && (
                <div
                  data-testid="zcode-tool-error"
                  style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}
                >
                  Error: {row.error.message ?? row.error.code}
                </div>
              )}
            </div>
          );
        }

        if (kind === 'assistantText') {
          return (
            <div
              key={rowId}
              data-testid={`zcode-row-${rowId}`}
              data-row-kind={kind}
              style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: '12px 12px 12px 2px',
                background: 'var(--dsw-alias-bg-secondary, #f3f4f6)',
                color: 'var(--dsw-alias-text-primary, #111827)',
                fontSize: '14px',
                lineHeight: 1.5,
              }}
            >
              <div data-testid="zcode-assistant-text-row" style={{ whiteSpace: 'pre-wrap' }}>
                {row.text}
              </div>
            </div>
          );
        }

        return (
          <div
            key={rowId}
            data-testid={`zcode-row-${rowId}`}
            data-row-kind={kind}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              background: '#f9fafb',
              fontSize: '12px',
              color: '#6b7280',
            }}
          >
            [{kind}] {JSON.stringify(row)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Main ZCode Conversation view component.
 * Integrates status banner, alerts, stop bar, pending interactions, command ledger, and message rows.
 */
export function ZCodeConversationView({ conversation, controller, reference }) {
  const [internal, setInternal] = useState(() => {
    if (controller || !conversation) return { conversation: null, controller: null };
    return { conversation, controller: new ConversationController(conversation) };
  });

  let activeInternalController = internal.controller;
  if (!controller) {
    if (internal.conversation !== conversation) {
      internal.controller?.dispose();
      activeInternalController = conversation ? new ConversationController(conversation) : null;
      setInternal({ conversation, controller: activeInternalController });
    }
  } else if (internal.controller) {
    internal.controller.dispose();
    activeInternalController = null;
    setInternal({ conversation: null, controller: null });
  }

  useEffect(() => {
    return () => {
      activeInternalController?.dispose();
    };
  }, [activeInternalController]);

  const activeController = controller ?? activeInternalController;

  const state = activeController
    ? useSyncExternalStore(activeController.subscribe, activeController.getSnapshot, activeController.getSnapshot)
    : { status: 'idle', snapshot: null, commands: [], admission: { allowed: false, reason: 'no-conversation' } };

  const handleReconnect = () => {
    activeController?.connect();
  };

  const handleStop = () => {
    activeController?.stop().catch(err => {
      console.warn('ZCode stop execution failed:', err);
    });
  };

  const handleResolve = (interactionId, answer) => {
    return activeController?.resolveInteraction(interactionId, answer);
  };

  const sessionIdentity = conversation?.address
    ? `${conversation.address.runtime || 'zcode'}:${conversation.address.authority}:${conversation.address.workspace}:${conversation.address.sessionId}`
    : reference?.address
      ? `${reference.address.runtime || 'zcode'}:${reference.address.authority}:${reference.address.workspace}:${reference.address.sessionId}`
      : (activeController?.conversation?.address
        ? `${activeController.conversation.address.runtime || 'zcode'}:${activeController.conversation.address.authority}:${activeController.conversation.address.workspace}:${activeController.conversation.address.sessionId}`
        : null);

  return (
    <div
      data-testid="zcode-conversation-view"
      data-status={state?.status ?? 'idle'}
      data-runtime="zcode"
      data-session-id={activeController?.conversation?.address?.sessionId ?? conversation?.address?.sessionId ?? ''}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '300px',
        background: 'var(--dsw-alias-bg-primary, #ffffff)',
        color: 'var(--dsw-alias-text-primary, #111827)',
        fontFamily: 'var(--dsw-font-sans, system-ui, -apple-system, sans-serif)',
      }}
    >
      <ZCodeStatusBanner state={state} onReconnect={handleReconnect} />
      <ZCodeAlerts state={state} onReconnect={handleReconnect} />
      <ZCodeControlBar state={state} onStop={handleStop} />
      <ZCodePendingInteractions key={sessionIdentity ?? 'default'} state={state} onResolve={handleResolve} />
      <ZCodeCommandLedger state={state} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ZCodeRowsList state={state} />
      </div>
    </div>
  );
}
