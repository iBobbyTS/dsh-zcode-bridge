import React, {useEffect,useRef,useState,useId} from 'react';

// One request per view, fenced on owner/admission changes. A page is a transient
// official read, never a second store. All failures clear the previous read.
function useOfficialRead(controller,allowed){
  const [value,setValue]=useState(null),[error,setError]=useState(null),[busy,setBusy]=useState(false);
  const generation=useRef(0),flight=useRef(null);
  useEffect(()=>{setValue(null);setError(null);setBusy(false);return ()=>{generation.current++;flight.current?.abort();flight.current=null}},[controller,allowed]);
  const run=async task=>{
    if(!allowed||flight.current)return;
    const stamp=generation.current,abort=new AbortController();flight.current=abort;setValue(null);setError(null);setBusy(true);
    try{const result=await task(abort.signal);if(stamp===generation.current&&!abort.signal.aborted)setValue(result)}
    catch(e){if(stamp===generation.current&&!abort.signal.aborted)setError(e.code??e.message)}
    finally{if(stamp===generation.current){flight.current=null;setBusy(false)}}
  };
  return {value,error,busy,run,clear:()=>setValue(null)};
}
function ReadStatus({read}){return <>{read.busy&&<p role="status">Reading official workflow…</p>}{read.error&&<p role="alert">{read.error}</p>}{read.value?.ok===false&&<p role="alert">{read.value.reason} · {read.value.detail??''}</p>}</>}
const style={overflowWrap:'anywhere',minWidth:0};
const text=value=>typeof value==='string'?value:value===null?'null':typeof value==='object'?'Structured value':String(value);
function ValueTable({items}){
  if(!items?.length)return <p>No published data in this page.</p>;
  const keys=[...new Set(items.flatMap(v=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v):['value']))].slice(0,12);
  return <div style={{overflowX:'auto'}}><table><thead><tr>{keys.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{items.map((v,i)=><tr key={i}>{keys.map(k=><td key={k}>{text(k==='value'?v:v?.[k])}</td>)}</tr>)}</tbody></table>{keys.length===12&&<p>Showing up to 12 columns.</p>}</div>;
}

/** Official bounded graph only; never analyze saved scripts or infer missing edges. */
export function ZCodeWorkflowGraph({display}){
  const marker=useId().replace(/:/g,'');
  if(display?.kind!=='create_workflow')return <p>Graph unavailable · official projection absent.</p>;
  const graph=display.causalityGraph;
  // Official graph is phases+participants+handoffs. Phase edges and participant handoffs
  // are separate official sources and are never merged, dropped or inferred from each other.
  const frame=graph?.phases??graph?.participants??[];
  const phaseEdges=graph?.phaseEdges??[];
  const handoffs=graph?.handoffs??[];
  // Handoffs connect participants. When phases are the node frame, place the official
  // participant cards as layout endpoints so those official edges stay visible.
  const endpoints=handoffs.length&&graph?.phases?graph.participants??[]:[];
  const layout=[...frame,...endpoints.filter(p=>!frame.some(n=>n.id===p.id))];
  const byId=new Map(layout.map(n=>[n.id,n]));
  const label=node=>node.name??graph?.lanes?.find(l=>l.id===node.lane)?.name??node.id;
  const positions=new Map(layout.map((n,i)=>[n.id,{x:20,y:20+i*90}]));
  return <div data-testid="zcode-workflow-graph" style={style}>
    <p>Official workflow graph · {display.ok?'checked':'diagnostics present'}</p>
    {display.diagnostics?.map((d,i)=><p role="alert" key={i}>Line {d.line}:{d.column} · {d.code} · {d.message}</p>)}
    {!graph&&<p>Graph unavailable · no official graph in this projection.</p>}
    {graph&&<>
      {(!!phaseEdges.length||!!handoffs.length)&&<p data-testid="zcode-workflow-graph-legend">Legend: solid arrow · phase transition{phaseEdges.length?' (dotted = loop back)':''}{handoffs.length?' · purple dashed arrow · participant handoff':''}.</p>}
      <svg role="img" aria-label="Official workflow causality graph" viewBox={`0 0 720 ${Math.max(150,layout.length*90+20)}`} style={{width:'100%',maxWidth:900}}>
        <defs>
          <marker id={`${marker}-phase`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="currentColor"/></marker>
          <marker id={`${marker}-handoff`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#7c3aed"/></marker>
        </defs>
        {phaseEdges.map((e,i)=>{const a=positions.get(e.from),b=positions.get(e.to);return a&&b?<path key={`phase-${i}`} data-edge="phase" d={`M${a.x+320},${a.y+25} H${380+(i%8)*30} V${b.y+25} H${b.x+320}`} stroke="currentColor" fill="none" strokeDasharray={e.back?'4 3':undefined} markerEnd={`url(#${marker}-phase)`}/>:null})}
        {handoffs.map((e,i)=>{const a=positions.get(e.from),b=positions.get(e.to);return a&&b?<path key={`handoff-${i}`} data-edge="handoff" d={`M${a.x+320},${a.y+25} H${420+(i%8)*30} V${b.y+25} H${b.x+320}`} stroke="#7c3aed" fill="none" strokeDasharray="6 3" markerEnd={`url(#${marker}-handoff)`}/>:null})}
        {layout.map(n=>{const p=positions.get(n.id);return <g key={n.id}><rect x={p.x} y={p.y} width="320" height="50" rx="6" fill="#f1f5f9" stroke="#64748b"/><text x={p.x+8} y={p.y+30} fill="#0f172a" fontSize="16">{label(n).slice(0,32)}</text></g>})}
      </svg>
      {frame.map(n=><p key={n.id}>{label(n)}{n.alongside?.length?` · alongside ${n.alongside.map(id=>label(byId.get(id)??{id})).join(', ')}`:''}{graph.participants?.filter(p=>p.phase===n.id).map(p=>` · ${label(p)}${p.many?' (many)':p.member?` (${p.member.index+1}/${p.member.of})`:''}`)}</p>)}
      {!!phaseEdges.length&&<ul data-testid="zcode-workflow-phase-edges">{phaseEdges.map((e,i)=><li key={i}>phase · {label(byId.get(e.from)??{id:e.from})} → {label(byId.get(e.to)??{id:e.to})}{e.back?' · loop back':''}</li>)}</ul>}
      {!!handoffs.length&&<ul data-testid="zcode-workflow-handoffs">{handoffs.map((e,i)=><li key={i}>handoff · {label(byId.get(e.from)??{id:e.from})} → {label(byId.get(e.to)??{id:e.to})}{e.back?' · loop back':''}{e.types?.length?` · ${e.types.join(', ')}`:''}</li>)}</ul>}
      {!!graph.exits?.length&&<p>Engine return after: {graph.exits.map(id=>label(byId.get(id)??{id})).join(', ')}. Engine return is separate from published artifacts.</p>}
    </>}
    {(graph?.truncated||display.truncated)&&<p role="status">Official graph truncated · incomplete projection.</p>}
  </div>;
}

function SavedWorkflow({entry,controller,reads,writes,onClose}){
  const read=useOfficialRead(controller,reads),change=useOfficialRead(controller,writes);
  const [description,setDescription]=useState('');
  const [confirmDelete,setConfirmDelete]=useState(false);
  const params={name:entry.name,scope:entry.scope};
  const open=()=>read.run(signal=>controller.workflowManage('get',params,{signal}));
  return <section style={style} data-testid="zcode-workflow-saved">
    <h4>{entry.name} · {entry.scope}</h4><button onClick={onClose}>Close definition</button>
    <button disabled={!reads||read.busy} onClick={()=>void open()}>Open official definition</button><ReadStatus read={read}/>
    {read.value?.ok===true&&<>
      <p>{read.value.meta.description}</p><p>{read.value.meta.whenToUse}</p>
      <dl>{Object.entries(read.value.meta.args??{}).map(([name,arg])=><React.Fragment key={name}><dt>{name}</dt><dd>{arg.type} · {arg.description??''}{arg.required?' · required':''}</dd></React.Fragment>)}</dl>
      <details><summary>Saved script</summary><pre style={{whiteSpace:'pre-wrap'}}>{read.value.script}</pre></details>
      <p>Saved graph unavailable · graph is supplied by an official launch/tool projection.</p>
      <label>Description <input value={description} onChange={e=>setDescription(e.target.value)} style={{maxWidth:'100%'}}/></label>
      <button disabled={!writes||change.busy||!description.trim()} onClick={()=>void change.run(async signal=>{
        const result=await controller.workflowManage('updateMeta',{...params,meta:{...read.value.meta,description}},{signal});
        if(result.ok)void open();return result;
      })}>Save metadata</button>
    </>}
    <button disabled title="runtime-restricted">Run · gated</button>
    {entry.scope==='global'&&<button disabled={!writes||change.busy} onClick={()=>void change.run(signal=>controller.workflowManage('move',{name:entry.name},{signal}))}>Move global to project</button>}
    <label><input type="checkbox" checked={confirmDelete} onChange={e=>setConfirmDelete(e.target.checked)}/>Confirm deletion of {entry.scope}/{entry.name}</label>
    <button disabled={!writes||change.busy||!confirmDelete} onClick={()=>void change.run(signal=>controller.workflowManage('delete',params,{signal}))}>Delete definition</button>
    <ReadStatus read={change}/>{change.value?.ok===true&&<p>Official management acknowledged. Refresh the directory to read its current state.</p>}
  </section>;
}

function Artifact({artifact,runId,controller,allowed}){
  const read=useOfficialRead(controller,allowed),[version,setVersion]=useState(artifact.version),[offset,setOffset]=useState(0),[cursor,setCursor]=useState(undefined);
  const content=['file','markdown'].includes(artifact.kind);
  const open=()=>read.run(signal=>controller.workflowRead(content?'runArtifactRead':'runArtifactData',content?{runId,artifactId:artifact.id,version,offset,limit:64*1024}:{runId,artifactId:artifact.id,afterSequence:cursor,limit:100},{signal}));
  let preview=null;
  if(content&&read.value&&typeof read.value.dataBase64==='string'){
    // Text only, escaped by React; no HTML/script/data-URI execution. Non-text remains metadata.
    preview=/^(text\/|application\/json$)/.test(read.value.mediaType)?new TextDecoder().decode(Uint8Array.from(atob(read.value.dataBase64),c=>c.charCodeAt(0))):null;
  }
  return <article data-testid="zcode-workflow-artifact" style={style}>
    <h5>{artifact.title??artifact.id} · {artifact.kind} · {artifact.primary?'primary delivery':'published artifact'}</h5>
    <p>{artifact.description} · {artifact.itemCount??'unknown'} data items{artifact.sourcePath?` · workspace source ${artifact.sourcePath}`:''}</p>
    {content&&<label>Version <select value={version} disabled={read.busy} onChange={e=>{read.clear();setVersion(Number(e.target.value));setOffset(0)}}>{artifact.versions.map(v=><option key={v.version} value={v.version}>{v.version} · {v.bytes??'unknown'} bytes</option>)}</select></label>}
    <button disabled={!allowed||read.busy} onClick={()=>void open()}>Read {content?'content chunk':'published data page'}</button><ReadStatus read={read}/>
    {content&&read.value&&<><p>{read.value.mediaType} · {read.value.totalBytes} bytes · chunk from {offset}{read.value.nextOffset!==null?' · partial':' · end of content'}</p>{preview!==null?<pre style={{whiteSpace:'pre-wrap'}}>{preview}</pre>:<p>Binary content read · preview unavailable for this media type.</p>}{read.value.nextOffset!==null&&<button onClick={()=>{setOffset(read.value.nextOffset);read.clear()}}>Select next chunk</button>}</>}
    {!content&&read.value&&<><ValueTable items={read.value.items.map(i=>i.item)}/><p>{read.value.hasMore?'Partial data page · more available':'End of data page'}</p>{read.value.hasMore&&read.value.items.length>0&&<button onClick={()=>{setCursor(read.value.items.at(-1).sequence);read.clear()}}>Select next data page</button>}</>}
    {artifact.sourcePath&&<p>Open in workspace · unavailable (workspace navigation carrier unverified).</p>}
  </article>;
}

function RunDetail({run,display,controller,allowed,cancelAllowed}){
  const artifacts=useOfficialRead(controller,allowed),workspace=useOfficialRead(controller,allowed),events=useOfficialRead(controller,allowed),node=useOfficialRead(controller,allowed),cancel=useOfficialRead(controller,cancelAllowed);
  const [cursor,setCursor]=useState(undefined);
  return <section data-testid="zcode-workflow-run" style={style}>
    <h4>{run.label??run.runId} · {run.status}</h4>
    <p>Run {run.runId} · {run.stopReason??run.failureCode??run.error??'no reported failure'}{run.resumedFrom?` · resumed from ${run.resumedFrom}`:''}{run.supersededBy?` · superseded by ${run.supersededBy}`:''}</p>
    {run.failureMessage&&<p role="alert">{run.failureMessage}</p>}
    <p>Resume: {run.resumable===true?'officially resumable · execution gated':'not confirmed resumable'} · run settings gated (may start a successor run).</p>
    <button disabled>Resume · gated</button><button disabled>Amend run settings · gated</button>
    <button disabled={!cancelAllowed||cancel.busy||!['pending','running'].includes(run.status)} onClick={()=>void cancel.run(signal=>controller.submitWorkflowCommand({type:'cancelBackgroundWork',payload:{workId:run.runId}},{signal}))}>Cancel official run</button>
    <ReadStatus read={cancel}/>{cancel.value&&<p role="status">Cancel {cancel.value.state} · {cancel.value.ack?.reasonCode??''}. ACK does not fabricate a settled run.</p>}
    <p>Model: {run.subagentModel??'session default / unreported'} · concurrency: {run.concurrency?.limit??'unreported'} · current phase: {run.currentPhase??'unreported'}</p>
    {run.phaseNames?.map((name,i)=><p key={name}>{name}{run.phaseAlongside?.[i]?.length?` · alongside ${run.phaseAlongside[i].map(j=>run.phaseNames[j]).join(', ')}`:''}</p>)}
    {run.actors?.map(a=><p key={`${a.siteId}:${a.ordinal}`}>Actor {a.name??a.siteId} #{a.ordinal} · {a.status} · born in {a.phaseName??'unreported phase'} · session {a.sessionId??'unreported'}</p>)}
    {run.nodes?.map(n=><p key={`${n.siteId}:${n.ordinal}`}>Node {n.siteId} #{n.ordinal} · {n.phase} · {n.outcome??'no outcome'} · born in {n.phaseName??'unreported phase'} · turns {n.turn??'unknown'} / tools {n.toolCalls??'unknown'}</p>)}
    {run.resultPreview&&<p>Engine return preview (separate from published artifacts): {run.resultPreview}</p>}
    {run.truncated&&<p role="status">Run projection truncated · partial actors/nodes/artifacts/stages.</p>}
    <ZCodeWorkflowGraph display={display}/>
    <button disabled={!allowed||artifacts.busy} onClick={()=>void artifacts.run(signal=>controller.workflowRead('runArtifacts',{runId:run.runId},{signal}))}>Read published artifacts</button><ReadStatus read={artifacts}/>
    {artifacts.value&&<>{artifacts.value.artifacts.length===0&&<p>No published artifacts.</p>}{artifacts.value.artifacts.map(a=><Artifact key={`${run.runId}:${a.id}:${a.version}`} artifact={a} runId={run.runId} controller={controller} allowed={allowed}/>)}</>}
    <button disabled={!allowed||workspace.busy} onClick={()=>void workspace.run(signal=>controller.workflowRead('runWorkspace',{runId:run.runId},{signal}))}>Read run workspace</button><ReadStatus read={workspace}/>
    {workspace.value&&<>{workspace.value.nodes.length===0&&<p>No workspace nodes.</p>}{workspace.value.truncated&&<p>Workspace list truncated.</p>}{workspace.value.nodes.map(n=><p key={`${n.siteId}:${n.ordinal}`}>{n.op??n.kind} · {n.siteId} #{n.ordinal} · {n.status}{n.inputTruncated?' · partial input':''}<button disabled={node.busy||!allowed} onClick={()=>void node.run(signal=>controller.workflowRead('runNodeResult',{runId:run.runId,siteId:n.siteId,ordinal:n.ordinal},{signal}))}>Read node result</button></p>)}</>}
    <ReadStatus read={node}/>{node.value&&<><p>Node {node.value.status} · {node.value.totalBytes} bytes · {node.value.truncated?'truncated':'complete'} · {node.value.error?.message??''}</p>{typeof node.value.result==='string'?<pre style={{whiteSpace:'pre-wrap'}}>{node.value.result}</pre>:<ValueTable items={Array.isArray(node.value.result)?node.value.result:node.value.result===undefined?[]:[node.value.result]}/>}</>}
    <button disabled={!allowed||events.busy} onClick={()=>void events.run(signal=>controller.workflowRead('runEvents',{runId:run.runId,afterSequence:cursor,limit:100},{signal}))}>Read event page</button><ReadStatus read={events}/>
    {events.value&&<>{events.value.events.map(e=><p key={e.sequence}>#{e.sequence} · {e.type}{e.truncated?' · truncated':''} · {['run-started','run-settled','node-queued','node-settled','phase-entered','report','artifact-published'].includes(e.type)?'official journal event':'unknown event type · detail unavailable'}</p>)}<p>{events.value.hasMore?'Partial event page':'End of event page'}</p>{events.value.hasMore&&events.value.events.length>0&&<button onClick={()=>{setCursor(events.value.events.at(-1).sequence);events.clear()}}>Select next event page</button>}</>}
  </section>;
}

export function ZCodeWorkflowPanel({state,controller}){
  const reads=state.workflowAdmission?.reads?.allowed===true,writes=state.workflowAdmission?.writes?.allowed===true;
  const history=useOfficialRead(controller,reads);
  const [scope,setScope]=useState('project'),[entry,setEntry]=useState(null),[selectedRun,setSelectedRun]=useState(null);
  const live=state.snapshot?.workflowRuns?.runs??[],runs=new Map((history.value?.runs??[]).map(r=>[r.runId,r]));
  for(const run of live)runs.set(run.runId,{...runs.get(run.runId),...run});
  const run=runs.get(selectedRun);
  const launch=state.snapshot?.rows?.window?.find(r=>r.workflowLaunch?.runId===selectedRun)?.workflowLaunch;
  const tool=run?.toolCallId?state.snapshot?.rows?.window?.find(r=>r.kind==='toolCall'&&r.toolCallId===run.toolCallId):null;
  return <details data-testid="zcode-workflow-panel" style={{...style,padding:'8px 16px',borderBottom:'1px solid #d1d5db'}}>
    <summary>Workflows · official definitions, graph and published artifacts</summary>
    <p data-testid="zcode-workflow-gate">Save definition: unavailable · SaveWorkflow tool carrier required. Run / resume / amend: gated · runtime-restricted · entitlement unknown.</p>
    <button disabled>Save new definition · unavailable</button>
    <label>Definition scope <select value={scope} onChange={e=>{setScope(e.target.value);setEntry(null)}}><option value="project">Project</option><option value="global">Global</option></select></label>
    <Directory key={scope} controller={controller} scope={scope} reads={reads} onOpen={setEntry}/>
    {entry&&<SavedWorkflow key={`${entry.scope}:${entry.name}`} entry={entry} controller={controller} reads={reads} writes={writes} onClose={()=>setEntry(null)}/>}
    <button disabled={!reads||history.busy} onClick={()=>void history.run(signal=>controller.workflowRead('runs',{limit:64},{signal}))}>Read session run history</button><p>Session history: at most 64 entries · completeness unreported.</p><ReadStatus read={history}/>
    {runs.size===0&&<p data-testid="zcode-workflow-empty">No workflow run observed. No progress or artifacts have been generated by this view.</p>}
    {[...runs.values()].map(r=><p key={r.runId}><button onClick={()=>setSelectedRun(r.runId)}>{r.label??r.runId} · {r.status}</button></p>)}
    {run&&<RunDetail key={run.runId} run={run} display={launch?.display??tool?.display??tool?.output?.display} controller={controller} allowed={reads} cancelAllowed={state.workAdmission?.allowed===true}/>}
    {state.snapshot?.rows?.window?.filter(r=>r.kind==='toolCall'&&(r.display?.kind==='create_workflow'||r.output?.display?.kind==='create_workflow')&&!live.some(v=>v.toolCallId===r.toolCallId)).map(r=><ZCodeWorkflowGraph key={r.rowId} display={r.display?.kind==='create_workflow'?r.display:r.output.display}/>)}
  </details>;
}
function Directory({controller,scope,reads,onOpen}){
  const directory=useOfficialRead(controller,reads),history=useOfficialRead(controller,reads);
  return <section>
    <button disabled={!reads||directory.busy} onClick={()=>void directory.run(signal=>controller.workflowManage('list',{scope},{signal}))}>List {scope} workflows</button><ReadStatus read={directory}/>
    {directory.value&&<>{directory.value.workflows.length===0&&<p>No saved {scope} workflow.</p>}{directory.value.invalid.map(v=><p role="alert" key={v.path}>Invalid definition · {v.path} · {v.reason}</p>)}{directory.value.workflows.map(w=><p key={`${w.scope}:${w.name}`}><button onClick={()=>onOpen(w)}>{w.name} · {w.scope}</button> · {w.description}</p>)}</>}
    <button disabled={!reads||history.busy} onClick={()=>void history.run(signal=>controller.workflowManage('runs',{scope,limit:50},{signal}))}>Read {scope} saved-workflow history</button><ReadStatus read={history}/>
    {history.value&&<>{history.value.runs.length===0&&<p>No saved-workflow history.</p>}{history.value.truncated&&<p>History truncated · more runs exist.</p>}{history.value.runs.map(r=><p key={r.runId}>{r.name??r.runId} · {r.status} · project {r.cwd??'unreported'} · session {r.parentSessionId??'unreported'} · published artifacts {r.artifacts?.map(a=>`${a.title??a.id} (${a.kind} v${a.version})`).join(', ')??'unreported'} · open details in its owning session</p>)}</>}
  </section>;
}
