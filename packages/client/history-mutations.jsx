import React,{useEffect,useRef,useState} from 'react';
import {historyTarget,historyAllowed,historyTargetCurrent,historyResultText,historyEditSubmittable} from './history-controls.mjs';
import {canDiscardSharedContext,sharedContextState} from './input-controls.mjs';

// Migrated history-mutation dock for ZCode sessions with no official remote surface: edit input,
// retry turn, file rewind (preview separate from apply), discard shared context and selection side
// session. The official projection owns availability and CAS; the card never retargets a captured
// row, freezes the baseline at read time, and re-reads the snapshot after every command.
function RewindPreview({preview}){
  return <div data-zcode-history-preview="">
    <p>{preview.canApply?'ZCode can apply the safe file changes below.':'ZCode cannot apply this rewind.'}</p>
    <ul>{preview.safeFiles.map(file=><li key={file.path}>{file.action}: {file.path} ({file.operationCount} operations)</li>)}
      {preview.unsafeFiles.map(file=><li key={file.path}>Unsafe: {file.path} — {file.reason}{file.message?`: ${file.message}`:''}</li>)}
      {preview.ignoredFiles.map(file=><li key={file.path}>Ignored: {file.path} — {file.reason}</li>)}</ul>
  </div>;
}

export function HistoryMutationsCard({controller,pollMs=1500}){
  const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(null),[result,setResult]=useState(null);
  const [editor,setEditor]=useState(null),[text,setText]=useState(''),[mode,setMode]=useState('preserve');
  const [preview,setPreview]=useState(null),[selection,setSelection]=useState('');
  const owner=useRef(null),flight=useRef(null);
  async function refresh(token=owner.current){
    if(!token||token!==owner.current||flight.current)return;
    const abort=new AbortController();flight.current=abort;
    try{const value=await controller.call('snapshot','read',undefined,{}, {signal:abort.signal});if(token===owner.current){setState(value);return value}}
    catch(err){if(token===owner.current&&!abort.signal.aborted)setError(err.code??err.message)}
    finally{if(flight.current===abort)flight.current=null}
  }
  useEffect(()=>{
    const reset=()=>{flight.current?.abort();flight.current=null;owner.current={};setState(null);setBusy(false);setError(null);setResult(null);setPreview(null);setEditor(null);void refresh(owner.current)};
    reset();const off=controller.subscribe(reset),timer=pollMs>0?setInterval(()=>void refresh(),pollMs):null;
    return ()=>{off();clearInterval(timer);owner.current=null;flight.current?.abort();flight.current=null};
  },[controller,pollMs]);
  const snapshot=state?.snapshot,ready=state?.status==='live'&&!busy;
  async function run(task){
    if(!ready)return undefined;
    const token=owner.current;setBusy(true);setError(null);
    try{const value=await task();if(token===owner.current){setResult(value);await refresh(token)}return value}
    catch(err){if(token===owner.current)setError(err.code??err.message);return undefined}
    finally{if(token===owner.current)setBusy(false)}
  }
  // `frozen` is either a row-target token (`baseRevision`/`baseLogEpoch`) or the projection
  // snapshot itself (`revision`/`logEpoch`). Reading only one shape silently dropped the CAS
  // baseline for side-session/discard, which the ingress then rejected as stale.
  const command=(type,payload,frozen)=>run(()=>controller.command(type,payload,{
    revision:frozen.baseRevision??frozen.revision,
    logEpoch:frozen.baseLogEpoch??frozen.logEpoch,
  }));
  // Preview uses its own frozen token and never silently adopts the newest revision.
  const readHistory=(kind,row)=>run(async()=>{
    const frozen=historyTarget(state,row);
    const value=await controller.call('history','read',kind,{target:frozen.target},{snapshot:{revision:frozen.baseRevision,logEpoch:frozen.baseLogEpoch}});
    if(kind==='fileRewindPreview')setPreview(value);
    return value;
  });
  const shown=snapshot?.commands?.find(record=>record.commandId===result?.commandId)??result;
  const rows=(snapshot?.rows?.window??[]).filter(row=>row.entityId&&(row.kind==='assistantText'||row.kind==='userInput'||(row.kind==='turnHeader'&&row.fileChanges)));
  const context=sharedContextState(snapshot);
  return <section data-zcode-history-mutations="" style={{padding:12,overflowWrap:'anywhere'}}>
    <h4>History, branches and workspace files</h4>
    {!state?.admission?.allowed&&<p>Model execution is auth-gated; historical resource operations still require confirmed rows and official admission.</p>}
    <label>Selected text for side session <textarea aria-label="Selected text for side session" data-zcode-history-side-text="" value={selection} onChange={event=>setSelection(event.target.value)}/></label>
    <button type="button" data-zcode-history-side="" disabled={!ready||!state?.managementAdmission?.allowed||(!!selection.trim()&&!state?.admission?.allowed)}
      onClick={()=>void command('createSelectionSideSession',selection.trim()?{firstInput:{text:selection}}:{},snapshot)}>Create selection side session (preserve files)</button>
    {context&&<div data-zcode-history-shared-context="">
      <p>Shared context import: {context.title??'untitled'} ({context.status??'unknown'})</p>
      <button type="button" data-zcode-history-discard="" disabled={!ready||!canDiscardSharedContext(snapshot)} onClick={()=>void command('discardSharedContext',{contextId:context.contextId},snapshot)}>Withdraw shared context</button>
    </div>}
    {rows.map(row=><HistoryRow key={`${snapshot.logEpoch}:${row.rowId}:${row.entityId}`} state={state} row={row} busy={busy}
      editor={editor} setEditor={setEditor} text={text} setText={setText} mode={mode} setMode={setMode} preview={preview} setPreview={setPreview}
      command={command} readHistory={readHistory}/>)}
    {shown?.kind==='fileChanges'&&<div data-zcode-history-file-changes="">
      <p>{shown.result.files} files, +{shown.result.additions} / −{shown.result.deletions}; {shown.result.state??'state not reported'}</p>
    </div>}
    {shown&&shown.commandId&&<div role="status" data-zcode-history-result="">{historyResultText(shown)}
      {shown.ack?.result?.preview&&<RewindPreview preview={shown.ack.result.preview}/>}
      {shown.branchAddress&&<p>{shown.branchAddress.authority} · {shown.branchAddress.workspace} · {shown.branchAddress.sessionId}</p>}
    </div>}
    {error&&<p role="alert" data-zcode-history-error="">{error}</p>}
  </section>;
}

function HistoryRow({state,row,busy,editor,setEditor,text,setText,mode,setMode,preview,setPreview,command,readHistory}){
  const token=historyTarget(state,row);
  const allowed=type=>!busy&&historyAllowed(state,row,type);
  return <div data-zcode-history-row={row.rowId}>
    <p>{row.kind==='userInput'?row.text:row.kind==='assistantText'?String(row.text??'').slice(0,120):`Files for turn ${row.turnId}`}</p>
    {row.kind==='assistantText'&&<button type="button" data-zcode-history-retry="" disabled={!allowed('retryTurn')} onClick={()=>void command('retryTurn',{target:token.target},token)}>Retry turn: execute again</button>}
    {row.kind==='userInput'&&<>
      <button type="button" data-zcode-history-edit="" disabled={!allowed('editUserQuery')} onClick={()=>{setEditor(token);setText(row.text??'');setMode('preserve');setPreview(null)}}>Edit input</button>
      {editor&&editor.target.rowId===token.target.rowId&&<div>
        <label>Edited input <textarea aria-label="Edited input" data-zcode-history-edit-text="" value={text} onChange={event=>setText(event.target.value)}/></label>
        <label>Workspace mode <select aria-label="Workspace mode" data-zcode-history-mode="" value={mode} onChange={event=>setMode(event.target.value)}>
          <option value="preserve">Only change conversation branch; preserve files</option>
          <option value="rewind">Change conversation branch and rewind files</option>
        </select></label>
        <button type="button" data-zcode-history-edit-submit="" disabled={!allowed('editUserQuery')||!historyTargetCurrent(state,editor)||!historyEditSubmittable(row,text)}
          onClick={()=>void command('editUserQuery',{target:editor.target,newText:text,workspaceMode:mode},editor)}>Execute edited input</button>
        {!historyTargetCurrent(state,editor)&&<p role="alert">History changed; reopen the editor before executing.</p>}
      </div>}
    </>}
    {row.kind==='turnHeader'&&<>
      <button type="button" data-zcode-history-file-changes="" disabled={!token||busy} onClick={()=>void readHistory('fileChanges',row)}>File changes</button>
      <button type="button" data-zcode-history-preview="" disabled={!allowed('applyFileRewind')} onClick={()=>void readHistory('fileRewindPreview',row)}>Preview file rewind</button>
      {preview && <div>
        <RewindPreview preview={preview.result}/>
        <button type="button" data-zcode-history-apply="" disabled={!allowed('applyFileRewind')||!preview.result.canApply||!historyTargetCurrent(state,preview)}
          onClick={()=>void command('applyFileRewind',{target:preview.target},{baseRevision:preview.baseRevision,baseLogEpoch:preview.baseLogEpoch})}>Apply file rewind (preserve conversation)</button>
        {!historyTargetCurrent(state,preview)&&<p role="alert">Preview expired; request a new preview.</p>}
      </div>}
    </>}
  </div>;
}
