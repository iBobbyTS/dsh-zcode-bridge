import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { ZCodeInputControls } from './input-controls.jsx';
import { attachmentMediaKind, attachmentPreviewKind, decodeBase64Bytes, encodeBase64 } from './attachment.mjs';

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

  async snoozeInteractionAutoResolution(interactionId) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation?.submit?.({
      type: 'snoozeInteractionAutoResolution',
      payload: { interactionId },
    });
  }

  async queryCommand(commandId, options) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation?.queryCommand?.(commandId, options);
  }

  async submitInputCommand(command) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation.submit(command);
  }
  async workspaceConfiguration(kind, preferences) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation.workspaceConfiguration(kind, preferences);
  }

  /** Attachment resource calls are session-scoped on the owner; no path or session is accepted from the view. */
  async uploadAttachment(input, options) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation.uploadAttachment(input, options);
  }

  async attachmentRead(params, signal) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation.attachmentRead(params, signal);
  }

  async conversationAttachmentStat(params, signal) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation.conversationAttachmentStat(params, signal);
  }

  async conversationAttachmentRead(params, signal) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation.conversationAttachmentRead(params, signal);
  }

  /** Withdraw the pending official shared-context import; never deletes or rewrites the origin session. */
  async discardSharedContext(contextId) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation.submit({ type: 'discardSharedContext', payload: { contextId } });
  }

  async respondWorkspaceHookReview(target, reviewItemIds) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation?.submit?.({
      type: 'respondWorkspaceHookReview',
      payload: {
        ...target,
        decision: { action: 'trust_selected', reviewItemIds },
      },
    });
  }

  async toggleWorkspaceHookReviewItem(target, reviewItemId, enabled) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation?.submit?.({
      type: 'toggleWorkspaceHookReviewItem',
      payload: {
        ...target,
        reviewItemId,
        enabled,
      },
    });
  }

  async revokeWorkspaceHookTrust(payload) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation?.submit?.({
      type: 'revokeWorkspaceHookTrust',
      payload,
    });
  }

  async requestWorkspaceHookReview(payload) {
    if (this.#disposed) throw new Error('Controller is disposed');
    return this.#conversation?.submit?.({
      type: 'requestWorkspaceHookReview',
      payload,
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

export function buildElicitationContent(questions, drafts) {
  const answers = {};
  const content = { answers };

  questions.forEach((q, idx) => {
    const draft = drafts?.[idx] ?? { selectedValues: [], customAnswer: '' };
    const custom = draft.customAnswer ? draft.customAnswer.trim() : '';
    const vals = [...(draft.selectedValues ?? []), ...(custom ? [custom] : [])];
    if (vals.length > 0) {
      answers[q.question] = vals.join(', ');
      content[`answer_${idx}`] = q.multiSelect ? vals : vals[0];
    }
  });

  if (questions.length === 1) {
    const draft = drafts?.[0] ?? { selectedValues: [], customAnswer: '' };
    const custom = draft.customAnswer ? draft.customAnswer.trim() : '';
    const vals = [...(draft.selectedValues ?? []), ...(custom ? [custom] : [])];
    if (vals.length > 0) {
      content.answer = questions[0].multiSelect ? vals : vals[0];
    }
  }

  return content;
}

/**
 * User interactions card family:
 * - Multi-question questionnaire (options, freeText, accept/decline/cancel, auto-resolution countdown & snooze)
 * - Implementation plan review (plan markdown, plan checklist items, goal status, approve/reject)
 * - Workspace hook security review (warning banner, hook items, enabled toggle, trust, revoke, soft admission)
 * - Fail-safe unknown interaction card
 * - Authoritative official result echo
 */
function isSameAutoRes(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.state === b.state &&
    a.startedAt === b.startedAt &&
    a.visibleAt === b.visibleAt &&
    a.deadlineAt === b.deadlineAt &&
    a.snoozedAt === b.snoozedAt
  );
}

export function ZCodePendingInteractions({
  state,
  onResolve,
  onSnooze,
  onHookTrust,
  onHookToggle,
  onHookRevoke,
  onHookRequestReview,
  onQueryCommand,
}) {
  const interactions = state?.snapshot?.pendingInteractions ?? [];
  const hookAdmission = state?.snapshot?.workspaceHookAdmission;
  const [freeTextInputs, setFreeTextInputs] = useState({});
  const [results, setResults] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [questionnaireState, setQuestionnaireState] = useState({});
  const [planFeedback, setPlanFeedback] = useState({});
  const [snoozedInteractions, setSnoozedInteractions] = useState({});
  const [snoozeWarnings, setSnoozeWarnings] = useState({});

  const snoozeIntentsRef = useRef(new Set());
  const inFlightSnoozeRef = useRef(new Set());
  const sentSnoozeRef = useRef(new Set());
  const snoozeCommandsRef = useRef(new Map());
  const snoozeBaseSeqRef = useRef(new Map());
  const snoozeBaseRevRef = useRef(new Map());
  const snoozeBaseAutoResRef = useRef(new Map());

  const sendSnooze = useCallback((interactionId) => {
    inFlightSnoozeRef.current.add(interactionId);
    sentSnoozeRef.current.add(interactionId);
    setSnoozedInteractions(prev => ({ ...prev, [interactionId]: true }));
    setSnoozeWarnings(prev => {
      if (!prev[interactionId]) return prev;
      const next = { ...prev };
      delete next[interactionId];
      return next;
    });
    const currentInteraction = interactions.find(item => item.interactionId === interactionId);
    snoozeBaseSeqRef.current.set(interactionId, state?.snapshot?.seq);
    snoozeBaseRevRef.current.set(interactionId, state?.snapshot?.revision);
    snoozeBaseAutoResRef.current.set(interactionId, currentInteraction?.autoResolution);
    try {
      const maybePromise = onSnooze?.(interactionId);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise
          .then(record => {
            inFlightSnoozeRef.current.delete(interactionId);
            const isRejected = record?.ack?.status === 'rejected' || record?.state === 'rejected';
            const isOutcomeUnknown = record?.state === 'outcome-unknown';
            if (isRejected) {
              sentSnoozeRef.current.delete(interactionId);
              snoozeIntentsRef.current.delete(interactionId);
              setSnoozedInteractions(prev => ({ ...prev, [interactionId]: false }));
              const reason = record?.ack?.reasonCode ?? record?.error ?? 'rejected';
              setSnoozeWarnings(prev => ({
                ...prev,
                [interactionId]: `Warning: Auto-resolution snooze rejected (${reason})`,
              }));
            } else if (isOutcomeUnknown) {
              // 1. outcome-unknown 的 snooze 结果不虚标"已延期"（撤销本地乐观标记）
              setSnoozedInteractions(prev => ({ ...prev, [interactionId]: false }));
              // 2. 显示"结果未确认"态（含同 commandId 可对账提示），不盲重发（B04）
              const cmdId = record?.commandId;
              if (cmdId) {
                snoozeCommandsRef.current.set(interactionId, cmdId);
              }
              const cmdHint = cmdId ? ` (commandId: ${cmdId}, 可用同 commandId 对账 / reconcile with same commandId)` : '';
              setSnoozeWarnings(prev => ({
                ...prev,
                [interactionId]: `Warning: Auto-resolution snooze outcome unconfirmed (结果未确认)${cmdHint}`,
              }));
            } else if (record?.state === 'failed' || record?.state === 'not-sent') {
              sentSnoozeRef.current.delete(interactionId);
              snoozeIntentsRef.current.delete(interactionId);
              setSnoozedInteractions(prev => ({ ...prev, [interactionId]: false }));
              const reason = record?.ack?.reasonCode ?? record?.error ?? record?.state ?? 'failed';
              setSnoozeWarnings(prev => ({
                ...prev,
                [interactionId]: `Warning: Auto-resolution snooze failed (${reason})`,
              }));
            }
          })
          .catch(err => {
            inFlightSnoozeRef.current.delete(interactionId);
            setSnoozedInteractions(prev => ({ ...prev, [interactionId]: false }));
            const isOutcomeUnknown = err?.state === 'outcome-unknown' || err?.code === 'timeout' || err?.code === 'request-timeout';
            if (isOutcomeUnknown) {
              const cmdId = err?.commandId;
              if (cmdId) {
                snoozeCommandsRef.current.set(interactionId, cmdId);
              }
              const cmdHint = cmdId ? ` (commandId: ${cmdId}, 可用同 commandId 对账 / reconcile with same commandId)` : '';
              setSnoozeWarnings(prev => ({
                ...prev,
                [interactionId]: `Warning: Auto-resolution snooze outcome unconfirmed (结果未确认)${cmdHint}`,
              }));
            } else {
              sentSnoozeRef.current.delete(interactionId);
              snoozeIntentsRef.current.delete(interactionId);
              setSnoozeWarnings(prev => ({
                ...prev,
                [interactionId]: `Warning: Auto-resolution snooze failed (${err.code ?? err.message ?? 'error'})`,
              }));
            }
          });
      } else {
        inFlightSnoozeRef.current.delete(interactionId);
      }
    } catch (err) {
      inFlightSnoozeRef.current.delete(interactionId);
      setSnoozedInteractions(prev => ({ ...prev, [interactionId]: false }));
      const isOutcomeUnknown = err?.state === 'outcome-unknown' || err?.code === 'timeout' || err?.code === 'request-timeout';
      if (isOutcomeUnknown) {
        const cmdId = err?.commandId;
        if (cmdId) {
          snoozeCommandsRef.current.set(interactionId, cmdId);
        }
        const cmdHint = cmdId ? ` (commandId: ${cmdId}, 可用同 commandId 对账 / reconcile with same commandId)` : '';
        setSnoozeWarnings(prev => ({
          ...prev,
          [interactionId]: `Warning: Auto-resolution snooze outcome unconfirmed (结果未确认)${cmdHint}`,
        }));
      } else {
        sentSnoozeRef.current.delete(interactionId);
        snoozeIntentsRef.current.delete(interactionId);
        setSnoozeWarnings(prev => ({
          ...prev,
          [interactionId]: `Warning: Auto-resolution snooze failed (${err.code ?? err.message ?? 'error'})`,
        }));
      }
    }
  }, [interactions, state?.snapshot, onSnooze]);

  const triggerSnooze = useCallback((interactionId) => {
    snoozeIntentsRef.current.add(interactionId);
    const interaction = interactions.find(item => item.interactionId === interactionId);
    const autoRes = interaction?.autoResolution;

    // 无 autoResolution 的排队项不发 snooze（保留首次操作意图，待官方计时就绪再提交，不标记已延期不阻断后续输入）
    if (!autoRes) {
      return;
    }
    if (autoRes.state === 'snoozed') {
      return;
    }
    if (inFlightSnoozeRef.current.has(interactionId) || sentSnoozeRef.current.has(interactionId)) {
      return;
    }
    sendSnooze(interactionId);
  }, [interactions, sendSnooze]);

  useEffect(() => {
    // 1. 排队项就绪或有未发送意图：当官方 autoResolution 到达时补发一次 snooze
    for (const item of interactions) {
      const id = item.interactionId;
      if (
        item.autoResolution &&
        item.autoResolution.state !== 'snoozed' &&
        snoozeIntentsRef.current.has(id) &&
        !inFlightSnoozeRef.current.has(id) &&
        !sentSnoozeRef.current.has(id)
      ) {
        sendSnooze(id);
      }
    }
    // 2. 权威同步：当没有在飞的 snooze 请求时，后续官方 autoResolution.state 具有最终权威，本地值不得覆盖
    for (const item of interactions) {
      const id = item.interactionId;
      const officialState = item.autoResolution?.state;
      if (officialState && !inFlightSnoozeRef.current.has(id)) {
        if (officialState === 'snoozed') {
          setSnoozedInteractions(prev => (prev[id] === true ? prev : { ...prev, [id]: true }));
          setSnoozeWarnings(prev => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } else if (
          officialState === 'hiddenGrace' ||
          officialState === 'visibleCountdown' ||
          officialState === 'expired' ||
          officialState === 'resolved'
        ) {
          const baseSeq = snoozeBaseSeqRef.current.get(id);
          const baseRev = snoozeBaseRevRef.current.get(id);
          const baseAutoRes = snoozeBaseAutoResRef.current.get(id);
          const currentSeq = state?.snapshot?.seq;
          const currentRev = state?.snapshot?.revision;
          const hasNewOfficialSnapshot = Boolean(
            baseAutoRes === undefined ||
            (baseSeq !== undefined && currentSeq !== undefined && currentSeq > baseSeq) ||
            (baseRev !== undefined && currentRev !== undefined && currentRev > baseRev) ||
            (baseAutoRes && !isSameAutoRes(item.autoResolution, baseAutoRes))
          );
          if (hasNewOfficialSnapshot || officialState === 'expired' || officialState === 'resolved') {
            setSnoozedInteractions(prev => (prev[id] ? { ...prev, [id]: false } : prev));
          }
        }
      }
    }
    // 3. 对账状态监听：若 state.commands 中关联的 snooze commandId 状态已对账更新
    for (const item of interactions) {
      const id = item.interactionId;
      const cmdId = snoozeCommandsRef.current.get(id);
      if (cmdId && state?.commands) {
        const cmd = state.commands.find(c => c.commandId === cmdId);
        if (cmd && cmd.state !== 'outcome-unknown' && cmd.state !== 'sent-unconfirmed') {
          if (cmd.ack?.status === 'failed' || cmd.state === 'failed') {
            sentSnoozeRef.current.delete(id);
            snoozeIntentsRef.current.delete(id);
            snoozeCommandsRef.current.delete(id);
            setSnoozedInteractions(prev => ({ ...prev, [id]: false }));
            const reason = cmd.ack?.reasonCode ?? cmd.error ?? cmd.state ?? 'failed';
            setSnoozeWarnings(prev => ({
              ...prev,
              [id]: `Warning: Auto-resolution snooze failed (${reason})`,
            }));
          } else if (cmd.ack?.status === 'rejected' || cmd.state === 'rejected') {
            sentSnoozeRef.current.delete(id);
            snoozeIntentsRef.current.delete(id);
            snoozeCommandsRef.current.delete(id);
            setSnoozedInteractions(prev => ({ ...prev, [id]: false }));
            const reason = cmd.ack?.reasonCode ?? cmd.error ?? 'rejected';
            setSnoozeWarnings(prev => ({
              ...prev,
              [id]: `Warning: Auto-resolution snooze rejected (${reason})`,
            }));
          } else if (['accepted', 'accepted-awaiting-terminal', 'noop'].includes(cmd.ack?.status ?? cmd.state)) {
            snoozeCommandsRef.current.delete(id);
            setSnoozeWarnings(prev => {
              if (!prev[id]) return prev;
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }
        }
      }
    }
  }, [interactions, state?.snapshot, state?.commands, sendSnooze]);

  const hasInteractions = interactions.length > 0;
  const hasAdmission = Boolean(hookAdmission && hookAdmission.pendingCount > 0);
  const hasResults = Object.keys(results).length > 0;

  if (!hasInteractions && !hasAdmission && !hasResults) return null;

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

  const handleHookTrust = async (interaction, reviewItemIds) => {
    const id = interaction.interactionId;
    setSubmitting(prev => ({ ...prev, [id]: true }));
    try {
      const target = {
        sessionId: interaction.payload.sessionId,
        taskId: interaction.payload.taskId,
        runId: interaction.payload.runId,
        ...(interaction.payload.remoteSessionId ? { remoteSessionId: interaction.payload.remoteSessionId } : {}),
        workspaceIdentity: interaction.payload.workspaceIdentity,
        bundleDigest: interaction.payload.bundleDigest,
        reviewFlowId: interaction.payload.reviewFlowId,
        generation: interaction.payload.generation,
        interactionId: interaction.payload.interactionId,
      };
      const record = await onHookTrust?.(target, reviewItemIds);
      const reasonCode = record?.ack?.reasonCode ?? record?.error ?? record?.state;
      const status = record?.ack?.status ?? record?.state ?? 'resolved';
      setResults(prev => ({
        ...prev,
        [id]: { status, reasonCode: reasonCode || status },
      }));
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [id]: { status: 'error', reasonCode: err.code ?? err.message ?? 'failed' },
      }));
    } finally {
      setSubmitting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleHookToggle = async (interaction, reviewItemId, enabled) => {
    const id = interaction.interactionId;
    setSubmitting(prev => ({ ...prev, [id]: true }));
    try {
      const target = {
        sessionId: interaction.payload.sessionId,
        taskId: interaction.payload.taskId,
        runId: interaction.payload.runId,
        ...(interaction.payload.remoteSessionId ? { remoteSessionId: interaction.payload.remoteSessionId } : {}),
        workspaceIdentity: interaction.payload.workspaceIdentity,
        bundleDigest: interaction.payload.bundleDigest,
        reviewFlowId: interaction.payload.reviewFlowId,
        generation: interaction.payload.generation,
        interactionId: interaction.payload.interactionId,
      };
      const record = await onHookToggle?.(target, reviewItemId, enabled);
      const isRejected = record?.ack?.status === 'rejected' || record?.state === 'rejected';
      if (isRejected) {
        const reasonCode = record?.ack?.reasonCode ?? record?.error ?? record?.state;
        const status = record?.ack?.status ?? record?.state ?? 'rejected';
        setResults(prev => ({
          ...prev,
          [id]: { status, reasonCode: reasonCode || status },
        }));
      }
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [id]: { status: 'error', reasonCode: err.code ?? err.message ?? 'failed' },
      }));
    } finally {
      setSubmitting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleHookRevoke = async (interaction, reviewItemIds) => {
    const id = interaction.interactionId;
    setSubmitting(prev => ({ ...prev, [id]: true }));
    try {
      const payload = {
        sessionId: interaction.payload.sessionId,
        taskId: interaction.payload.taskId,
        runId: interaction.payload.runId,
        ...(interaction.payload.remoteSessionId ? { remoteSessionId: interaction.payload.remoteSessionId } : {}),
        workspaceIdentity: interaction.payload.workspaceIdentity,
        bundleDigest: interaction.payload.bundleDigest,
        reviewFlowId: interaction.payload.reviewFlowId,
        generation: interaction.payload.generation,
        interactionId: interaction.payload.interactionId,
        reviewItemIds,
      };
      await onHookRevoke?.(payload);
    } catch (err) {
      console.warn('Failed to revoke hook trust:', err);
    } finally {
      setSubmitting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleHookRequestReview = async () => {
    if (!hookAdmission || !hookAdmission.workspaceIdentity) return;
    const admissionKey = 'hook-admission';
    setSubmitting(prev => ({ ...prev, [admissionKey]: true }));
    try {
      const payload = {
        sessionId: state?.snapshot?.sessionId ?? '',
        workspaceIdentity: hookAdmission.workspaceIdentity,
        bundleDigest: hookAdmission.bundleDigest,
      };
      const record = await onHookRequestReview?.(payload);
      const reasonCode = record?.ack?.reasonCode ?? record?.error ?? record?.state;
      const status = record?.ack?.status ?? record?.state ?? 'resolved';
      setResults(prev => ({
        ...prev,
        [admissionKey]: { status, reasonCode: reasonCode || status },
      }));
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [admissionKey]: { status: 'error', reasonCode: err.code ?? err.message ?? 'failed' },
      }));
    } finally {
      setSubmitting(prev => ({ ...prev, [admissionKey]: false }));
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

      {/* Soft admission banner when workspace hooks require security review */}
      {hasAdmission && (
        <div
          data-testid="zcode-hook-admission-banner"
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#92400e',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🛡️</span>
            <span>
              Workspace hooks require security review ({hookAdmission.pendingCount} pending)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              data-testid="zcode-hook-request-review-btn"
              disabled={Boolean(submitting['hook-admission']) || !hookAdmission.workspaceIdentity}
              onClick={handleHookRequestReview}
              title={!hookAdmission.workspaceIdentity ? 'Workspace identity unavailable per R16 restricted mode' : undefined}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid #d97706',
                background: !hookAdmission.workspaceIdentity ? '#f3f4f6' : '#ffffff',
                color: !hookAdmission.workspaceIdentity ? '#9ca3af' : '#b45309',
                fontWeight: 600,
                fontSize: '12px',
                cursor: (submitting['hook-admission'] || !hookAdmission.workspaceIdentity) ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting['hook-admission'] ? 'Requesting…' : 'Request Review'}
            </button>
            {!hookAdmission.workspaceIdentity && (
              <span
                data-testid="zcode-hook-request-review-disabled-hint"
                style={{ fontSize: '11px', color: '#6b7280' }}
              >
                (Workspace identity unavailable per R16)
              </span>
            )}
          </div>
        </div>
      )}

      {results['hook-admission'] && (
        <div
          role="status"
          data-testid="zcode-interaction-result-hook-admission"
          style={{
            marginBottom: '10px',
            padding: '6px 10px',
            borderRadius: '4px',
            background: '#f3f4f6',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#374151',
          }}
        >
          Official result: {results['hook-admission'].reasonCode} ({results['hook-admission'].status})
        </div>
      )}

      {interactions.map(interaction => {
        const id = interaction.interactionId;
        const kind = interaction.kind;
        const payload = interaction.payload ?? {};
        const result = results[id];
        const isBusy = submitting[id];
        const autoRes = interaction.autoResolution;
        const isOfficialSnoozed = autoRes?.state === 'snoozed';
        const baseSeq = snoozeBaseSeqRef.current.get(id);
        const baseRev = snoozeBaseRevRef.current.get(id);
        const baseAutoRes = snoozeBaseAutoResRef.current.get(id);
        const currentSeq = state?.snapshot?.seq;
        const currentRev = state?.snapshot?.revision;
        const hasNewOfficialSnapshot = Boolean(
          baseAutoRes === undefined ||
          (baseSeq !== undefined && currentSeq !== undefined && currentSeq > baseSeq) ||
          (baseRev !== undefined && currentRev !== undefined && currentRev > baseRev) ||
          (baseAutoRes && !isSameAutoRes(autoRes, baseAutoRes))
        );
        const isOfficialCountdown = autoRes?.state === 'hiddenGrace' || autoRes?.state === 'visibleCountdown';
        const isOptimisticSnoozed =
          snoozedInteractions[id] === true &&
          autoRes?.state !== 'expired' &&
          autoRes?.state !== 'resolved' &&
          (!hasNewOfficialSnapshot || !isOfficialCountdown);
        const isSnoozed = isOfficialSnoozed || isOptimisticSnoozed;

        // Detect Plan Review
        const isPlanReview =
          kind === 'userInput' &&
          (payload.schema?.interaction === 'plan_approval' ||
            payload.toolName?.toLowerCase() === 'exitplanmode' ||
            Boolean(payload.schema?.plan || payload.input?.plan));

        // Detect Multi-Question Questionnaire
        const isQuestionnaire = kind === 'userInput' && Array.isArray(payload.questions) && payload.questions.length > 0;

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
            {/* Auto-Resolution Status Chip */}
            {autoRes && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {isSnoozed ? (
                    <span
                      data-testid="zcode-auto-resolution-snoozed"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        color: '#4b5563',
                        fontSize: '11px',
                        fontWeight: 500,
                      }}
                    >
                      ⏸️ Auto-resolution snoozed
                    </span>
                  ) : (
                    <span
                      data-testid="zcode-auto-resolution-countdown"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#b91c1c',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      ⏳ Auto-resolving countdown active
                    </span>
                  )}
                  {snoozeWarnings[id] && (snoozeWarnings[id].includes('unconfirmed') || snoozeWarnings[id].includes('未确认')) && (
                    <span
                      data-testid="zcode-auto-resolution-unconfirmed"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        color: '#b45309',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      ❓ Auto-resolution snooze unconfirmed (结果未确认)
                    </span>
                  )}
                </div>
                {snoozeWarnings[id] && (
                  <div
                    data-testid={`zcode-snooze-warning-${id}`}
                    style={{
                      marginTop: '4px',
                      color: '#b45309',
                      fontSize: '11px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>⚠️ {snoozeWarnings[id]}</span>
                    {(snoozeWarnings[id].includes('unconfirmed') || snoozeWarnings[id].includes('未确认')) && (
                      <span data-testid={`zcode-snooze-unconfirmed-${id}`} style={{ display: 'none' }} />
                    )}
                    {(snoozeWarnings[id].includes('unconfirmed') || snoozeWarnings[id].includes('未确认')) && (
                      <span data-testid="zcode-snooze-unconfirmed" style={{ display: 'none' }} />
                    )}
                    {(snoozeWarnings[id].includes('unconfirmed') || snoozeWarnings[id].includes('未确认')) && snoozeCommandsRef.current.get(id) && onQueryCommand && (
                      <button
                        type="button"
                        data-testid={`zcode-snooze-reconcile-btn-${id}`}
                        onClick={() => {
                          const cmdId = snoozeCommandsRef.current.get(id);
                          if (cmdId) {
                            void onQueryCommand(cmdId);
                          }
                        }}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid #d97706',
                          background: '#ffffff',
                          color: '#b45309',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reconcile (对账)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 1. Plan Review Card */}
            {isPlanReview && (
              <div data-testid="zcode-plan-review-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '15px' }}>📋</span>
                  <strong>Implementation Plan Review</strong>
                  <span
                    style={{
                      fontSize: '11px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    ExitPlanMode
                  </span>
                </div>

                <p data-testid="zcode-plan-prompt" style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#374151' }}>
                  {payload.prompt ?? 'Review this implementation plan.'}
                </p>

                {/* Plan Content */}
                <div
                  data-testid="zcode-plan-content"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    marginBottom: '10px',
                    color: '#1e293b',
                  }}
                >
                  {payload.schema?.plan ??
                    payload.input?.plan ??
                    state?.snapshot?.plan?.items?.map(it => `${it.content} [${it.status}]`).join('\n') ??
                    'No plan text available'}
                </div>

                {/* Snapshot Plan Items Checklist */}
                {state?.snapshot?.plan?.items && state.snapshot.plan.items.length > 0 && (
                  <div
                    data-testid="zcode-plan-items"
                    style={{
                      marginBottom: '10px',
                      padding: '8px 10px',
                      borderRadius: '4px',
                      background: '#f9fafb',
                      border: '1px solid #f3f4f6',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>
                      Plan Checklist Items ({state.snapshot.plan.items.length}):
                    </div>
                    {state.snapshot.plan.items.map(item => (
                      <div
                        key={item.id}
                        data-testid={`zcode-plan-item-${item.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '3px 0',
                          fontSize: '12px',
                        }}
                      >
                        <span>{item.content}</span>
                        <span
                          data-testid={`zcode-plan-item-status-${item.id}`}
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '3px',
                            background:
                              item.status === 'completed'
                                ? '#dcfce7'
                                : item.status === 'inProgress'
                                  ? '#dbeafe'
                                  : '#f3f4f6',
                            color:
                              item.status === 'completed'
                                ? '#15803d'
                                : item.status === 'inProgress'
                                  ? '#1d4ed8'
                                  : '#6b7280',
                          }}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Snapshot Goal State */}
                {state?.snapshot?.goal && (
                  <div
                    data-testid="zcode-goal-info"
                    style={{
                      marginBottom: '10px',
                      padding: '8px 10px',
                      borderRadius: '4px',
                      background: '#fefce8',
                      border: '1px solid #fef08a',
                      fontSize: '12px',
                    }}
                  >
                    <strong>Goal Target:</strong> {state.snapshot.goal.summaryTitle ? `${state.snapshot.goal.summaryTitle}: ` : ''}{state.snapshot.goal.objective}{' '}
                    <span style={{ color: '#854d0e', fontWeight: 600 }}>({state.snapshot.goal.status})</span>
                  </div>
                )}

                {/* Rejection Feedback Input */}
                <div style={{ marginBottom: '10px' }}>
                  <textarea
                    data-testid="zcode-plan-feedback-input"
                    disabled={isBusy || Boolean(result)}
                    value={planFeedback[id] ?? ''}
                    onChange={e => {
                      triggerSnooze(id);
                      setPlanFeedback({ ...planFeedback, [id]: e.target.value });
                    }}
                    placeholder="Provide revision instructions or feedback if rejecting..."
                    rows={2}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      fontSize: '12px',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Plan Approval Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    data-testid="zcode-plan-approve-btn"
                    disabled={isBusy || Boolean(result)}
                    onClick={() => {
                      triggerSnooze(id);
                      const promptText = payload.prompt ?? 'Review this implementation plan.';
                      void handleResolve(id, {
                        action: 'accept',
                        content: {
                          answers: { [promptText]: 'approve' },
                          answer_0: 'approve',
                          answer: 'approve',
                        },
                      });
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '4px',
                      border: '1px solid #16a34a',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: isBusy || result ? 'default' : 'pointer',
                    }}
                  >
                    Approve Plan
                  </button>

                  <button
                    type="button"
                    data-testid="zcode-plan-reject-btn"
                    disabled={isBusy || Boolean(result)}
                    onClick={() => {
                      triggerSnooze(id);
                      const promptText = payload.prompt ?? 'Review this implementation plan.';
                      const fb = (planFeedback[id] ?? '').trim();
                      void handleResolve(id, fb ? {
                        action: 'accept',
                        content: {
                          answers: { [promptText]: fb },
                          answer_0: fb,
                          answer: fb,
                        },
                      } : {
                        action: 'decline',
                      });
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '4px',
                      border: '1px solid #dc2626',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: isBusy || result ? 'default' : 'pointer',
                    }}
                  >
                    Reject Plan
                  </button>
                </div>
              </div>
            )}

            {/* 2. Multi-Question Questionnaire Card */}
            {!isPlanReview && isQuestionnaire && (() => {
              const questions = payload.questions;
              const qState = questionnaireState[id] ?? {
                activeIndex: payload.currentQuestionIndex ?? 0,
                drafts: Object.fromEntries(
                  questions.map((q, idx) => {
                    const rawDraft = payload.answerDrafts?.[`answer_${idx}`] ?? payload.answerDrafts?.[String(idx)] ?? [];
                    const draftValues = Array.isArray(rawDraft) ? rawDraft : rawDraft != null ? [String(rawDraft)] : [];
                    const optionValues = new Set((q.options ?? []).map(opt => (typeof opt === 'object' && opt !== null ? opt.value : opt)));
                    const selectedValues = draftValues.filter(v => optionValues.has(v));
                    const customAnswer = draftValues.filter(v => !optionValues.has(v)).join(', ');
                    return [idx, { selectedValues, customAnswer }];
                  })
                ),
              };
              const activeIndex = Math.min(Math.max(qState.activeIndex, 0), questions.length - 1);
              const currentQ = questions[activeIndex];
              const currentDraft = qState.drafts[activeIndex] ?? { selectedValues: [], customAnswer: '' };

              const updateQDraft = updater => {
                triggerSnooze(id);
                setQuestionnaireState(prev => {
                  const curr = prev[id] ?? qState;
                  const nextDrafts = {
                    ...curr.drafts,
                    [activeIndex]: updater(curr.drafts[activeIndex] ?? { selectedValues: [], customAnswer: '' }),
                  };
                  return { ...prev, [id]: { ...curr, drafts: nextDrafts } };
                });
              };

              const setQuestionIndex = newIndex => {
                triggerSnooze(id);
                setQuestionnaireState(prev => {
                  const curr = prev[id] ?? qState;
                  return { ...prev, [id]: { ...curr, activeIndex: newIndex } };
                });
              };

              return (
                <div data-testid="zcode-questionnaire-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px' }}>📝</span>
                      <strong>{payload.prompt || 'Questionnaire'}</strong>
                    </div>
                    <span
                      data-testid="zcode-q-counter"
                      style={{
                        fontSize: '11px',
                        background: '#f3f4f6',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        fontWeight: 500,
                      }}
                    >
                      Question {activeIndex + 1} of {questions.length}
                    </span>
                  </div>

                  {/* Question Tab navigation */}
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {questions.map((q, idx) => {
                      const isCurrent = idx === activeIndex;
                      const hasAns =
                        (qState.drafts[idx]?.selectedValues?.length ?? 0) > 0 ||
                        Boolean(qState.drafts[idx]?.customAnswer?.trim());
                      return (
                        <button
                          key={idx}
                          type="button"
                          data-testid={`zcode-q-tab-${idx}`}
                          onClick={() => setQuestionIndex(idx)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: isCurrent ? '1px solid #2563eb' : '1px solid #e5e7eb',
                            background: isCurrent ? '#eff6ff' : '#ffffff',
                            color: isCurrent ? '#1d4ed8' : '#4b5563',
                            fontSize: '11px',
                            fontWeight: isCurrent ? 600 : 400,
                            cursor: 'pointer',
                          }}
                        >
                          {q.header || `Q${idx + 1}`} {hasAns ? '✓' : ''}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Question Body */}
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      marginBottom: '10px',
                    }}
                  >
                    <p
                      data-testid="zcode-question-text"
                      style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 500 }}
                    >
                      {currentQ.question}
                    </p>

                    {/* Options list */}
                    {currentQ.options && currentQ.options.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                        {currentQ.options.map(opt => {
                          const isSelected = currentDraft.selectedValues.includes(opt.value);
                          return (
                            <label
                              key={opt.value}
                              data-testid={`zcode-option-label-${opt.value}`}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                border: isSelected ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                                background: isSelected ? '#eff6ff' : '#ffffff',
                                cursor: isBusy || result ? 'default' : 'pointer',
                              }}
                            >
                              <input
                                type={currentQ.multiSelect ? 'checkbox' : 'radio'}
                                name={`question-${id}-${activeIndex}`}
                                data-testid={`zcode-option-${opt.value}`}
                                disabled={isBusy || Boolean(result)}
                                checked={isSelected}
                                onChange={() => {
                                  if (currentQ.multiSelect) {
                                    updateQDraft(d => {
                                      const cur = d.selectedValues ?? [];
                                      const next = cur.includes(opt.value)
                                        ? cur.filter(v => v !== opt.value)
                                        : [...cur, opt.value];
                                      return { ...d, selectedValues: next };
                                    });
                                  } else {
                                    updateQDraft(d => ({ ...d, selectedValues: [opt.value] }));
                                  }
                                }}
                                style={{ marginTop: '2px' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 400 }}>
                                  {opt.label || opt.value}
                                </div>
                                {opt.description && (
                                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                    {opt.description}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Free text custom answer */}
                    {payload.freeText && (
                      <div>
                        <input
                          type={payload.sensitive ? 'password' : 'text'}
                          data-testid="zcode-q-custom-input"
                          disabled={isBusy || Boolean(result)}
                          value={currentDraft.customAnswer ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            updateQDraft(d => ({ ...d, customAnswer: val }));
                          }}
                          placeholder="Type custom response or add notes..."
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            border: '1px solid #d1d5db',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Questionnaire Nav & Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        data-testid="zcode-q-prev-btn"
                        disabled={activeIndex === 0 || isBusy || Boolean(result)}
                        onClick={() => setQuestionIndex(activeIndex - 1)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          background: '#ffffff',
                          fontSize: '12px',
                          cursor: activeIndex === 0 || isBusy || result ? 'default' : 'pointer',
                        }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        data-testid="zcode-q-next-btn"
                        disabled={activeIndex === questions.length - 1 || isBusy || Boolean(result)}
                        onClick={() => setQuestionIndex(activeIndex + 1)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          background: '#ffffff',
                          fontSize: '12px',
                          cursor: activeIndex === questions.length - 1 || isBusy || result ? 'default' : 'pointer',
                        }}
                      >
                        Next
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {/* Decline */}
                      <button
                        type="button"
                        data-testid="zcode-questionnaire-decline"
                        disabled={isBusy || Boolean(result)}
                        onClick={() => {
                          triggerSnooze(id);
                          const content = buildElicitationContent(questions, qState.drafts);
                          const hasAnswers = Object.keys(content.answers).length > 0;
                          void handleResolve(id, {
                            action: 'decline',
                            ...(hasAnswers ? { content } : {}),
                          });
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          border: '1px solid #f87171',
                          background: '#fef2f2',
                          color: '#dc2626',
                          fontSize: '12px',
                          cursor: isBusy || result ? 'default' : 'pointer',
                        }}
                      >
                        Decline
                      </button>

                      {/* Cancel */}
                      <button
                        type="button"
                        data-testid="zcode-questionnaire-cancel"
                        disabled={isBusy || Boolean(result)}
                        onClick={() => {
                          triggerSnooze(id);
                          void handleResolve(id, { action: 'cancel' });
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          background: '#ffffff',
                          color: '#4b5563',
                          fontSize: '12px',
                          cursor: isBusy || result ? 'default' : 'pointer',
                        }}
                      >
                        Cancel
                      </button>

                      {/* Submit (Accept) */}
                      <button
                        type="button"
                        data-testid="zcode-questionnaire-submit"
                        disabled={isBusy || Boolean(result)}
                        onClick={() => {
                          triggerSnooze(id);
                          const content = buildElicitationContent(questions, qState.drafts);
                          void handleResolve(id, { action: 'accept', content });
                        }}
                        style={{
                          padding: '4px 14px',
                          borderRadius: '4px',
                          border: '1px solid #2563eb',
                          background: '#2563eb',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: isBusy || result ? 'default' : 'pointer',
                        }}
                      >
                        Submit Answers
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 3. Workspace Hook Security Review Card */}
            {!isPlanReview && !isQuestionnaire && kind === 'workspaceHookReview' && (
              <div data-testid="zcode-hook-review-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '15px' }}>🛡️</span>
                  <strong>Workspace Hook Security Review</strong>
                </div>

                {/* Warning Banner */}
                <div
                  data-testid="zcode-hook-warning"
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    fontSize: '12px',
                    fontWeight: 500,
                    marginBottom: '8px',
                  }}
                >
                  ⚠️ Workspace hooks execute shell commands in this workspace
                </div>

                {/* Workspace identity & Summary chips */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span
                    data-testid="zcode-hook-workspace-label"
                    style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}
                  >
                    {payload.workspaceLabel || payload.workspaceIdentity}
                  </span>
                  <span
                    data-testid="zcode-hook-count"
                    style={{ fontSize: '11px', background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px' }}
                  >
                    Hooks: {payload.summary?.hookCount ?? payload.items?.length ?? 0}
                  </span>
                  <span
                    data-testid="zcode-event-count"
                    style={{ fontSize: '11px', background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px' }}
                  >
                    Events: {payload.summary?.eventCount ?? 0}
                  </span>
                  <span
                    data-testid="zcode-pending-count"
                    style={{ fontSize: '11px', background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: '4px' }}
                  >
                    Pending: {payload.summary?.pendingCount ?? 0}
                  </span>
                </div>

                {/* Source files */}
                {payload.sourceFiles && payload.sourceFiles.length > 0 && (
                  <div
                    data-testid="zcode-hook-source-files"
                    style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}
                  >
                    Source files: {payload.sourceFiles.map(f => f.displayPath || f.path).join(', ')}
                  </div>
                )}

                {/* Items list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                  {(payload.items ?? []).map(item => {
                    const itemId = item.reviewItemId;
                    const isTrusted = item.trustState === 'trusted_persistent';
                    const isPending = ['pending_trust', 'revoked', 'stale_digest'].includes(item.trustState);

                    return (
                      <div
                        key={itemId}
                        data-testid={`zcode-hook-item-${itemId}`}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '4px',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              data-testid={`zcode-hook-toggle-${itemId}`}
                              disabled={isBusy || Boolean(result)}
                              checked={item.configuredEnabled}
                              onChange={() => handleHookToggle(interaction, itemId, !item.configuredEnabled)}
                            />
                            <strong>{item.displayName}</strong>
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>
                              ({item.event} · {item.executionMode})
                            </span>
                          </div>

                          <span
                            data-testid={`zcode-hook-trust-state-${itemId}`}
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '3px',
                              background: isTrusted ? '#dcfce7' : isPending ? '#fef3c7' : '#fee2e2',
                              color: isTrusted ? '#15803d' : isPending ? '#92400e' : '#b91c1c',
                            }}
                          >
                            {item.trustState}
                          </span>
                        </div>

                        <div style={{ marginBottom: '6px' }}>
                          <code
                            data-testid={`zcode-hook-command-${itemId}`}
                            style={{
                              fontFamily: 'monospace',
                              background: '#ffffff',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              border: '1px solid #e5e7eb',
                              fontSize: '11px',
                              color: '#1f2937',
                              display: 'inline-block',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.displayCommand}
                          </code>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {isPending && (
                            <button
                              type="button"
                              data-testid={`zcode-hook-trust-btn-${itemId}`}
                              disabled={isBusy || Boolean(result)}
                              onClick={() => handleHookTrust(interaction, [itemId])}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '3px',
                                border: '1px solid #16a34a',
                                background: '#f0fdf4',
                                color: '#16a34a',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: isBusy || result ? 'default' : 'pointer',
                              }}
                            >
                              Trust Hook
                            </button>
                          )}
                          {isTrusted && (
                            <button
                              type="button"
                              data-testid={`zcode-hook-revoke-btn-${itemId}`}
                              disabled={isBusy || Boolean(result)}
                              onClick={() => handleHookRevoke(interaction, [itemId])}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '3px',
                                border: '1px solid #dc2626',
                                background: '#fef2f2',
                                color: '#dc2626',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: isBusy || result ? 'default' : 'pointer',
                              }}
                            >
                              Revoke Trust
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bulk actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    data-testid="zcode-hook-trust-all-btn"
                    disabled={isBusy || Boolean(result)}
                    onClick={() => {
                      const pendingIds = (payload.items ?? [])
                        .filter(i => ['pending_trust', 'revoked', 'stale_digest'].includes(i.trustState))
                        .map(i => i.reviewItemId);
                      void handleHookTrust(interaction, pendingIds.length > 0 ? pendingIds : (payload.items ?? []).map(i => i.reviewItemId));
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '4px',
                      border: '1px solid #16a34a',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: isBusy || result ? 'default' : 'pointer',
                    }}
                  >
                    Trust All Pending
                  </button>
                </div>
              </div>
            )}

            {/* 4. Legacy Simple User Input Card */}
            {!isPlanReview && !isQuestionnaire && kind === 'userInput' && (
              <div data-testid="zcode-user-input-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px' }}>❓</span>
                  <strong>User Input Requested:</strong>
                </div>
                <p data-testid="zcode-user-input-prompt" style={{ margin: '0 0 10px 0', fontSize: '13px' }}>
                  {payload.prompt ?? ''}
                </p>
                {payload.options && payload.options.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {payload.options.map(opt => (
                      <button
                        key={opt.optionId}
                        type="button"
                        data-testid={`zcode-user-input-btn-${opt.optionId}`}
                        disabled={isBusy || Boolean(result)}
                        onClick={() => {
                          triggerSnooze(id);
                          void handleResolve(id, { optionId: opt.optionId });
                        }}
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
                {payload.freeText && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type={payload.sensitive ? 'password' : 'text'}
                      data-testid="zcode-user-input-text"
                      disabled={isBusy || Boolean(result)}
                      value={freeTextInputs[id] ?? ''}
                      onChange={e => {
                        triggerSnooze(id);
                        setFreeTextInputs({ ...freeTextInputs, [id]: e.target.value });
                      }}
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
                      onClick={() => {
                        triggerSnooze(id);
                        void handleResolve(id, { freeText: freeTextInputs[id] ?? '' });
                      }}
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

            {/* 5. Permission Card */}
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
                    {payload.toolName ?? 'Tool'}
                  </span>
                </div>
                <p data-testid="zcode-permission-summary" style={{ margin: '0 0 10px 0', fontSize: '13px' }}>
                  {payload.summary ?? ''}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(payload.options ?? [
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

            {/* 6. Unknown Interaction Kind Fail-safe */}
            {kind !== 'permission' && kind !== 'userInput' && kind !== 'workspaceHookReview' && (
              <div data-testid="zcode-unknown-interaction-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px' }}>⚠️</span>
                  <strong data-testid="zcode-unknown-kind">Unknown Interaction Type: {kind}</strong>
                </div>
                <p
                  data-testid="zcode-unknown-warning"
                  style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#b45309' }}
                >
                  Unknown interaction type: cannot automatically resolve without authoritative schema.
                </p>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>
                  ID: <span data-testid="zcode-unknown-id">{id}</span> · Created: {interaction.createdAt}
                </div>
                <pre
                  data-testid="zcode-unknown-payload"
                  style={{
                    background: '#f3f4f6',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    maxHeight: '120px',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </div>
            )}

            {/* Official Result Display (never falsifies success) */}
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
const ATTACHMENT_PREVIEW_READ_BYTES = 512 * 1024;
const ATTACHMENT_PREVIEW_MAX_FRAGMENTS = 64;

function decodePreviewText(bytes) {
  try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); }
  catch { return null; }
}

function hexPreview(bytes, max = 32) {
  return [...bytes.subarray(0, max)].map(value => value.toString(16).padStart(2, '0')).join(' ');
}

/** Read every official chunk of a payload (image/video/PDF preview or share read) and aggregate it. */
async function readAttachmentContent(controller, { isMedia, ref, target, attachmentIndex }) {
  const chunks = [];
  let aggregated = 0;
  let meta = null;
  let offset = 0;
  for (let fragment = 0; fragment < ATTACHMENT_PREVIEW_MAX_FRAGMENTS; fragment += 1) {
    const read = isMedia
      ? await controller.attachmentRead({ ref, target, attachmentIndex, offset, limit: ATTACHMENT_PREVIEW_READ_BYTES })
      : await controller.conversationAttachmentRead({ ref, target, attachmentIndex, offset, limit: ATTACHMENT_PREVIEW_READ_BYTES });
    meta = read;
    const bytes = decodeBase64Bytes(read.dataBase64);
    if (!bytes) throw new Error('fault.attachment.invalidBase64');
    chunks.push(bytes); aggregated += bytes.byteLength;
    const next = read.nextOffset ?? null;
    if (next === null || next <= offset || aggregated >= (read.totalBytes ?? aggregated)) break;
    offset = next;
  }
  const combined = new Uint8Array(aggregated);
  let cursor = 0;
  for (const chunk of chunks) { combined.set(chunk, cursor); cursor += chunk.byteLength; }
  return { meta, combined };
}

/** Sent-attachment preview/read/stat through the official session-scoped carriers; never a path read. */
function ZCodeRowAttachment({ attachment, controller, target, index }) {
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!attachment || typeof attachment.ref !== 'string' || !attachment.ref) {
    return <div data-testid="zcode-attachment-unknown">Attachment reference unavailable in this projection.</div>;
  }
  const isMedia = attachmentMediaKind(attachment.mime) === 'media';
  async function run(action) {
    if (busy || !controller) return;
    setBusy(true); setResult(''); setPreview(null);
    try {
      if (action === 'stat') {
        const stat = await controller.conversationAttachmentStat({ ref: attachment.ref, target, attachmentIndex: index });
        setResult(`Official stat: ${stat.mediaType}, ${stat.totalBytes} bytes${stat.mtimeMs !== undefined ? `, mtime ${stat.mtimeMs}` : ''}.`);
      } else {
        const { meta, combined } = await readAttachmentContent(controller, { isMedia, ref: attachment.ref, target, attachmentIndex: index });
        const kind = attachmentPreviewKind(meta.mediaType);
        const nextOffset = meta.nextOffset === null || meta.nextOffset === undefined ? 'end' : meta.nextOffset;
        setResult(isMedia
          ? `Official preview read: ${meta.mediaType}, ${meta.totalBytes} bytes; next offset ${nextOffset}.`
          : `Official attachment read: ${meta.mediaType}, ${meta.totalBytes} bytes; next offset ${nextOffset}.`);
        if (kind === 'image' || kind === 'video' || kind === 'pdf') {
          setPreview({ kind, mediaType: meta.mediaType, totalBytes: meta.totalBytes, url: `data:${meta.mediaType};base64,${encodeBase64(combined)}` });
        } else if (kind === 'text') {
          setPreview({ kind, mediaType: meta.mediaType, totalBytes: meta.totalBytes, text: decodePreviewText(combined) });
        } else {
          setPreview({ kind: 'binary', mediaType: meta.mediaType, totalBytes: meta.totalBytes, readBytes: combined.byteLength, hex: hexPreview(combined) });
        }
      }
    } catch (error) {
      setResult(`${error.code ?? error.message}. The official session carrier decides authorization; no host path read was attempted.`);
    } finally { setBusy(false); }
  }
  return <div data-testid={`zcode-attachment-ref-${attachment.ref}`} style={{ marginTop: 4, fontSize: 12 }}>
    <span>{attachment.fileName ?? 'attachment'} ({attachment.mime ?? 'unknown type'}, {attachment.bytes ?? 'unknown'} bytes)</span>
    <button disabled={busy || !controller} onClick={() => void run('stat')}>Stat</button>
    <button disabled={busy || !controller} onClick={() => void run(isMedia ? 'preview' : 'read')}>{isMedia ? 'Preview' : 'Read'}</button>
    {result && <small data-testid="zcode-attachment-read-result">{result}</small>}
    {preview?.kind === 'image' && <img data-testid="zcode-attachment-preview-image" alt={attachment.fileName ?? 'attachment preview'} src={preview.url} style={{ display: 'block', maxWidth: '100%', maxHeight: 240, marginTop: 4 }} />}
    {preview?.kind === 'video' && <video data-testid="zcode-attachment-preview-video" controls src={preview.url} style={{ display: 'block', maxWidth: '100%', maxHeight: 240, marginTop: 4 }} />}
    {preview?.kind === 'pdf' && <object data-testid="zcode-attachment-preview-pdf" data={preview.url} type="application/pdf" style={{ display: 'block', width: '100%', height: 240, marginTop: 4 }}>{attachment.fileName ?? 'attachment'} preview</object>}
    {preview?.kind === 'text' && <pre data-testid="zcode-attachment-preview-text" style={{ whiteSpace: 'pre-wrap', marginTop: 4, maxHeight: 200, overflow: 'auto' }}>{preview.text}</pre>}
    {preview?.kind === 'binary' && <small data-testid="zcode-attachment-preview-binary">Binary content {preview.mediaType}, {preview.totalBytes} bytes ({preview.readBytes} read). First bytes: {preview.hex || 'none'}</small>}
  </div>;
}

export function ZCodeRowsList({ state, controller }) {
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
              {Array.isArray(row.attachments) && row.attachments.length > 0 && (
                <div data-testid="zcode-user-input-attachments">
                  {row.attachments.map((attachment, index) => (
                    <ZCodeRowAttachment
                      key={`${attachment?.ref ?? 'unknown'}:${index}`}
                      attachment={attachment}
                      controller={controller}
                      target={{ rowId: row.rowId, entityId: row.entityId }}
                      index={index}
                    />
                  ))}
                </div>
              )}
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

  const handleSnooze = (interactionId) => {
    return activeController?.snoozeInteractionAutoResolution(interactionId);
  };

  const handleQueryCommand = (commandId, options) => {
    return activeController?.queryCommand(commandId, options);
  };

  const handleHookTrust = (target, reviewItemIds) => {
    return activeController?.respondWorkspaceHookReview(target, reviewItemIds);
  };

  const handleHookToggle = (target, reviewItemId, enabled) => {
    return activeController?.toggleWorkspaceHookReviewItem(target, reviewItemId, enabled);
  };

  const handleHookRevoke = (payload) => {
    return activeController?.revokeWorkspaceHookTrust(payload);
  };

  const handleHookRequestReview = (payload) => {
    return activeController?.requestWorkspaceHookReview(payload);
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
      <ZCodePendingInteractions
        key={sessionIdentity ?? 'default'}
        state={state}
        onResolve={handleResolve}
        onSnooze={handleSnooze}
        onHookTrust={handleHookTrust}
        onHookToggle={handleHookToggle}
        onHookRevoke={handleHookRevoke}
        onHookRequestReview={handleHookRequestReview}
        onQueryCommand={handleQueryCommand}
      />
      <ZCodeCommandLedger state={state} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ZCodeRowsList state={state} controller={activeController} />
      </div>
      <ZCodeInputControls key={sessionIdentity ?? 'default'} state={state} controller={activeController} />
    </div>
  );
}
