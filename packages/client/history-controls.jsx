import React, { useState } from 'react';
import { historyTarget, historyAllowed, historyTargetCurrent, historyResultText } from './history-controls.mjs';

function FilePreview({ preview }) {
  return <div data-testid="zcode-rewind-preview">
    <p>{preview.canApply ? 'ZCode can apply the safe file changes below.' : 'ZCode cannot apply this rewind.'}</p>
    <ul>{preview.safeFiles.map(f => <li key={f.path}>{f.action}: {f.path} ({f.operationCount} operations)</li>)}
      {preview.unsafeFiles.map(f => <li key={f.path}>Unsafe: {f.path} — {f.reason}{f.message ? `: ${f.message}` : ''}</li>)}
      {preview.ignoredFiles.map(f => <li key={f.path}>Ignored: {f.path} — {f.reason}</li>)}</ul>
  </div>;
}
function HistoryRow({ state, row, controller, onOpenBranch }) {
  const [editor, setEditor] = useState(null), [text, setText] = useState(''), [mode, setMode] = useState('preserve');
  const [query, setQuery] = useState(null), [record, setRecord] = useState(null), [error, setError] = useState(null), [pending, setPending] = useState(false);
  const token = historyTarget(state, row);
  const allowed = type => !pending && historyAllowed(state, row, type);
  async function run(command) {
    setPending(true); setError(null);
    try { setRecord(await controller.submitHistoryCommand(command)); }
    catch (e) { setError(e.code ?? e.message); }
    finally { setPending(false); }
  }
  async function read(kind) {
    setPending(true); setError(null); setQuery(null);
    try { setQuery(await controller.historyQuery({ kind, ...token })); }
    catch (e) { setError(e.code ?? e.message); }
    finally { setPending(false); }
  }
  const shownRecord = state.commands?.find(r => r.commandId === record?.commandId) ?? record;
  const preview = query?.kind === 'fileRewindPreview' ? query.result : null;
  return <div data-testid={`zcode-history-${row.rowId}`}>
    <p>{row.kind === 'userInput' ? row.text : row.kind === 'assistantText' ? row.text.slice(0, 120) : `Files for turn ${row.turnId}`}</p>
    {row.kind === 'assistantText' && <>
      <button disabled={!allowed('forkAssistant')} onClick={() => run({ type: 'forkAssistant', payload: { target: token.target }, ...token })}>Fork conversation here (preserve files)</button>
      <button disabled={!allowed('retryTurn')} onClick={() => run({ type: 'retryTurn', payload: { target: token.target }, ...token })}>Retry turn: execute again</button>
      <p>Retry executes the original input with a new command ID. Previous tool side effects may happen again.</p>
      <button disabled={!allowed('setAssistantFeedback')} onClick={() => run({ type: 'setAssistantFeedback', payload: { target: token.target, feedback: 'like' }, ...token })}>Like response</button>
      <button disabled={!allowed('setAssistantFeedback')} onClick={() => run({ type: 'setAssistantFeedback', payload: { target: token.target, feedback: 'dislike' }, ...token })}>Dislike response</button>
      <button disabled={!allowed('setAssistantFeedback')} onClick={() => run({ type: 'setAssistantFeedback', payload: { target: token.target, feedback: null }, ...token })}>Clear feedback</button>
    </>}
    {row.kind === 'userInput' && <>
      <button disabled={!allowed('editUserQuery')} onClick={() => { setEditor(token); setText(row.text); setMode('preserve'); setQuery(null); }}>Edit input</button>
      {editor && <div>
        <label>Edited input <textarea aria-label="Edited input" value={text} onChange={e => setText(e.target.value)} /></label>
        <label>Workspace mode <select aria-label="Workspace mode" value={mode} onChange={e => { setMode(e.target.value); setQuery(null); }}>
          <option value="preserve">Only change conversation branch; preserve files</option>
          <option value="rewind">Change conversation branch and rewind files</option>
        </select></label>
        <p>Editing cuts the active conversation branch and executes the edited input with a new command ID. Existing attachments are retained.</p>
        <button disabled={!allowed('editUserQuery') || !historyTargetCurrent(state, editor) || !text.trim()} onClick={() => run({ type: 'editUserQuery', payload: { target: editor.target, newText: text, workspaceMode: mode }, ...editor })}>Execute edited input</button>
        {!historyTargetCurrent(state, editor) && <p role="alert">History changed; reopen the editor before executing.</p>}
      </div>}
    </>}
    {row.kind === 'turnHeader' && <>
      <button disabled={pending || state.status !== 'live' || !token} onClick={() => read('fileChanges')}>File changes</button>
      <button disabled={!allowed('applyFileRewind')} onClick={() => read('fileRewindPreview')}>Preview file rewind</button>
      <p>File rewind restores workspace files through ZCode; conversation history is preserved. For editing with file rewind, inspect this turn before choosing the combined mode.</p>
      {query?.kind === 'fileChanges' && <div data-testid="zcode-file-changes">
        <p>{query.result.files} files, +{query.result.additions} / −{query.result.deletions}; {query.result.state ?? 'state not reported'}</p>
        {query.result.items.map(file => <div key={file.path}><p>{file.path}: +{file.additions} / −{file.deletions}</p>{file.patches.map((patch, index) => <pre key={index}>{patch.lines.join('\n')}</pre>)}</div>)}
      </div>}
      {preview && <><FilePreview preview={preview} />
        <button disabled={!allowed('applyFileRewind') || !preview.canApply || !historyTargetCurrent(state, query)} onClick={() => run({ type: 'applyFileRewind', payload: { target: query.target }, baseRevision: query.baseRevision, baseLogEpoch: query.baseLogEpoch })}>Apply file rewind (preserve conversation)</button>
        {!historyTargetCurrent(state, query) && <p role="alert">Preview expired; request a new preview.</p>}
      </>}
    </>}
    {shownRecord && <div role="status">{historyResultText(shownRecord)}
      {shownRecord.ack?.result?.preview && <FilePreview preview={shownRecord.ack.result.preview} />}
      {shownRecord.branchAddress && <p>{shownRecord.branchAddress.authority} · {shownRecord.branchAddress.workspace} · {shownRecord.branchAddress.sessionId}
        {onOpenBranch && <button onClick={async () => { try { await onOpenBranch(shownRecord.branchAddress); } catch (e) { setError(e.code ?? e.message); } }}>Open ZCode branch</button>}
      </p>}
      {['outcome-unknown', 'accepted-awaiting-terminal'].includes(shownRecord.state) && <button disabled={pending} onClick={async () => { setPending(true); try { setRecord(await controller.queryCommand(record.commandId)); } catch (e) { setError(e.code ?? e.message); } finally { setPending(false); } }}>Query original command</button>}
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
/** History actions keep branch and workspace state separate and use the same scoped owner. */
export function ZCodeHistoryControls({ state, controller, onOpenBranch }) {
  const [selection, setSelection] = useState('');
  const [result, setResult] = useState(null), [error, setError] = useState(null), [pending, setPending] = useState(false);
  const snapshot = state.snapshot, admission = state.admission;
  const shownResult = state.commands?.find(r => r.commandId === result?.commandId) ?? result;
  const rows = snapshot?.rows?.window ?? [];
  const queued = snapshot?.inputRouting?.mode !== 'startNow';
  async function submit(command) {
    setPending(true); setError(null);
    try { setResult(await controller.submitHistoryCommand(command)); }
    catch (e) { setError(e.code ?? e.message); }
    finally { setPending(false); }
  }
  return <section data-testid="zcode-history-controls" aria-label="ZCode history actions" style={{ maxHeight: '45%', overflow: 'auto', flexShrink: 1, minHeight: 0, padding: '8px 14px', overflowWrap: 'anywhere' }}>
    <details><summary>History, branches and workspace files</summary>
      {!admission?.allowed && <p>Model execution is auth-gated. Historical resource operations still require confirmed rows and official admission.</p>}
      <label>Selected text for side session <textarea aria-label="Selected text for side session" value={selection} onChange={e => setSelection(e.target.value)} /></label>
      <button disabled={pending || state.status !== 'live' || !state.managementAdmission?.allowed || (!!selection.trim() && !admission?.allowed)} onClick={() => submit({ type: 'createSelectionSideSession', payload: selection.trim() ? { firstInput: { text: selection } } : {} })}>Create selection side session (preserve files)</button>
      <p>The official side-session carrier creates an empty child. Selected text can be sent as its first input when model execution is authorized.</p>
      <button disabled={pending || !historyAllowed(state, null, 'compact')} onClick={() => submit({ type: 'compact', payload: {} })}>{queued ? 'Queue context compaction' : 'Compact context'}</button>
      <p>Compaction uses ZCode admission and its FIFO queue during busy/held work; an active or queued compaction is rejected. History text is preserved.</p>
      {snapshot?.availability?.compact?.allowed === false && <p>{snapshot.availability.compact.reasonCode}</p>}
      {rows.filter(row => row.entityId && (row.kind === 'assistantText' || row.kind === 'userInput' || (row.kind === 'turnHeader' && row.fileChanges))).map(row => <HistoryRow key={`${snapshot.logEpoch}:${row.rowId}:${row.entityId}`} state={state} row={row} controller={controller} onOpenBranch={onOpenBranch} />)}
      {shownResult && <div role="status">{historyResultText(shownResult)}{['outcome-unknown', 'accepted-awaiting-terminal'].includes(shownResult.state) && <button disabled={pending} onClick={async () => { setPending(true); try { setResult(await controller.queryCommand(shownResult.commandId)); } catch (e) { setError(e.code ?? e.message); } finally { setPending(false); } }}>Query original command</button>}{shownResult.branchAddress && <p>{shownResult.branchAddress.authority} · {shownResult.branchAddress.workspace} · {shownResult.branchAddress.sessionId}{onOpenBranch && <button onClick={async () => { try { await onOpenBranch(shownResult.branchAddress); } catch (e) { setError(e.code ?? e.message); } }}>Open ZCode branch</button>}</p>}</div>}
      {error && <p role="alert">{error}</p>}
    </details>
  </section>;
}
