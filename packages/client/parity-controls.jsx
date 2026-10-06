import React,{useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import { ParityController } from './parity.mjs';
import {HookReviewPanel} from './hook-review.jsx';
import { ZCodeCatalogPanel,catalogLocales } from './catalog-view.jsx';
import { ZCodeInsightsPanel,insightsLocales } from './insights-view.jsx';
import { ZCodeWorkflowPanel } from './workflow-view.jsx';
import { inputSubmission,heldConfirmation,confirmHeld,commandResultText } from './input-controls.mjs';

export const parityLocales={en:{title:'Zcode Bridge',connection:'Connection',version:'Official version',sync:'Sync official task directory in the background',syncNote:'Startup sync and refresh before opening a session always run.',diagnostics:'Diagnostics',runtime:'Default runtime: zcode (fixed for new sessions)',catalog:'Task catalog',insights:'Account, usage and diagnostics',automation:'Automations',workflows:'Workflows',workspace:'Workspace presentations',preferences:'Interaction preferences',refresh:'Refresh official state',unknown:'Unknown',...Object.fromEntries(Object.entries(catalogLocales.en).map(([k,v])=>['catalog.'+k,v])),...Object.fromEntries(Object.entries(insightsLocales.en).map(([k,v])=>['insights.'+k,v]))},zh:{title:'Zcode Bridge',connection:'连接状态',version:'官方版本',sync:'后台同步官方任务目录',syncNote:'启动同步和打开会话前刷新始终执行。',diagnostics:'诊断信息',runtime:'默认 runtime：zcode（新会话固定默认值）',catalog:'任务目录',insights:'账号、用量与诊断',automation:'自动化',workflows:'工作流',workspace:'工作区呈现',preferences:'交互偏好',refresh:'刷新官方状态',unknown:'未知',...Object.fromEntries(Object.entries(catalogLocales.zh).map(([k,v])=>['catalog.'+k,v])),...Object.fromEntries(Object.entries(insightsLocales.zh).map(([k,v])=>['insights.'+k,v]))}};
const fallback=key=>parityLocales.en[key]??key;
const style={padding:12,overflowWrap:'anywhere',minWidth:0};
function Facts({value}){return value===null||value===undefined?null:<pre style={{whiteSpace:'pre-wrap',maxHeight:280,overflow:'auto'}}>{JSON.stringify(value,null,2)}</pre>}
// All view writes are explicit. No automatic replay on error; stale data is cleared on retry.
export function useParityRead(controller){
  const [state,setState]=useState({busy:false,value:null,error:null}),owner=useRef(0),flight=useRef(null);
  useEffect(()=>{const reset=()=>{owner.current++;flight.current?.abort();flight.current=null;setState({busy:false,value:null,error:null})};setState({busy:false,value:null,error:null});const off=controller.subscribe?.(reset);return ()=>{off?.();owner.current++;flight.current?.abort();flight.current=null}},[controller]);
  const run=async task=>{if(flight.current)return;const token=owner.current,abort=new AbortController();flight.current=abort;setState({busy:true,value:null,error:null});try{const value=await task(abort.signal);if(token===owner.current&&!abort.signal.aborted)setState({busy:false,value,error:null});return value}catch(error){if(token===owner.current&&!abort.signal.aborted)setState({busy:false,value:null,error:error.code??error.message})}finally{if(token===owner.current)flight.current=null}};
  return {...state,run};
}
function Result({read}){return <>{read.busy&&<p role="status">Awaiting official result</p>}{read.error&&<p role="alert">{read.error} · retry reads to get current official state; writes are never retried automatically.</p>}{read.value?.ack&&<p role="status">{commandResultText(read.value)}</p>}</>}
export function BridgeSettingsPanel({rpc,status,t=fallback,onDiagnostics}){
  const owner=useMemo(()=>({rpc}),[rpc]),read=useParityRead(owner);
  const request=async patch=>{const response=await rpc.call('/zcode-bridge','bridgeSettings',patch??{},new AbortController().signal);if(!response.ok)throw Object.assign(new Error(response.error.code),{code:response.error.code});return response.value};
  useEffect(()=>{void read.run(()=>request())},[owner]);
  return <section data-zcode-settings="" style={style}><h3>{t('title')}</h3>
    <p>{t('connection')}: {status?.state??read.value?.connection??t('unknown')}</p><p>{t('version')}: {status?.installation?.version??read.value?.version??t('unknown')}</p>
    <label><input type="checkbox" aria-label={t('sync')} checked={read.value?.catalogSync??true} disabled={read.busy||!read.value} onChange={event=>void read.run(()=>request({catalogSync:event.target.checked}))}/>{t('sync')}</label>
    <p>{t('syncNote')}</p><p role="note">{t('runtime')}</p><button type="button" onClick={onDiagnostics}>{t('diagnostics')}</button>
    <button type="button" disabled={read.busy} onClick={()=>void read.run(()=>request())}>{t('refresh')}</button><Result read={read}/>
  </section>;
}
export function DiagnosticsExtras({controller,sessionId,snapshot}){
  const read=useParityRead(controller);
  const [provider,setProvider]=useState(''),[model,setModel]=useState('');
  const selection=snapshot?.config?.modelSelection;
  useEffect(()=>{if(selection){setProvider(selection.providerId);setModel(selection.modelId)}},[selection?.providerId,selection?.modelId]);
  return <section style={style} data-zcode-diagnostics=""><button disabled={read.busy} onClick={()=>void read.run(()=>controller.insights.refresh())}>Refresh usage and processes</button>
    {sessionId&&<button disabled={read.busy} onClick={()=>void read.run(()=>controller.rpc.call('/zcode-bridge','runtime',{operation:'usage',sessionId},new AbortController().signal).then(response=>{if(!response.ok)throw Object.assign(new Error(response.error.code),{code:response.error.code});return response.value}))}>Read session usage</button>}
    <h4>Provider connectivity</h4><label>Provider <input aria-label="Connectivity provider" value={provider} onChange={e=>setProvider(e.target.value)}/></label><label>Model <input aria-label="Connectivity model" value={model} onChange={e=>setModel(e.target.value)}/></label>
    <p>Testing connectivity executes a model request using the official account.</p><button disabled={read.busy||!provider.trim()||!model.trim()} onClick={()=>void read.run(signal=>controller.call('insights','operate','testModelConnectivity',{selection:{providerId:provider.trim(),modelId:model.trim()}},{signal}))}>Test model connectivity</button><Result read={read}/><Facts value={read.value}/>
  </section>;
}
export function AutomationPanel({controller}){
  const read=useParityRead(controller),change=useParityRead(controller);
  const [title,setTitle]=useState(''),[cron,setCron]=useState('0 9 * * *'),[prompt,setPrompt]=useState(''),[selected,setSelected]=useState(''),[model,setModel]=useState(''),[binding,setBinding]=useState('');
  const refresh=()=>read.run(async signal=>{const results=await Promise.allSettled([controller.call('automation','read','list',{}, {signal}),controller.call('automation','read','offPeakList',{}, {signal})]);return Object.fromEntries(results.map((result,i)=>[i?'offPeak':'cron',result.status==='fulfilled'?result.value:{error:result.reason.code??result.reason.message}]))});
  useEffect(()=>{void refresh()},[controller]);
  const operate=(kind,params)=>change.run(signal=>controller.call('automation','operate',kind,params,{signal}));
  return <section data-zcode-automation="" style={style}><h3>Automations · cron and off-peak</h3><button disabled={read.busy} onClick={()=>void refresh()}>Refresh automations</button><Result read={read}/><Facts value={read.value}/>
    <p>Off-peak entitlement is unconfirmed until the official service returns a result. Scheduling and run state belong to the official Host.</p>
    <label>Title <input aria-label="Automation title" value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Cron schedule <input aria-label="Cron schedule" value={cron} onChange={e=>setCron(e.target.value)}/></label><label>Prompt <textarea aria-label="Automation prompt" value={prompt} onChange={e=>setPrompt(e.target.value)}/></label>
    <button disabled={change.busy||!title.trim()||!prompt.trim()||!cron.trim()} onClick={()=>void operate('create',{title,cronExpr:cron,prompt})}>Create cron automation</button>
    <label>Existing automation <select aria-label="Existing automation" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select official automation</option>{read.value?.cron?.automations?.map(a=><option key={a.automationId} value={a.automationId}>{a.title}</option>)}</select></label>
    <button disabled={change.busy||!selected||!prompt.trim()} onClick={()=>void operate('update',{automationId:selected,title,cronExpr:cron,prompt})}>Update automation</button>
    <label>Official task ID <input aria-label="Automation task binding" value={binding} onChange={e=>setBinding(e.target.value)}/></label><button disabled={change.busy||!binding.trim()} onClick={()=>void change.run(signal=>controller.call('automation','read','checkTaskBinding',{targetTaskId:binding.trim()},{signal}))}>Check task binding</button>
    <label>Off-peak provider/model <input aria-label="Off-peak model" value={model} onChange={e=>setModel(e.target.value)}/></label>
    <button disabled={change.busy||!title.trim()||!prompt.trim()||!model.includes('/')} onClick={()=>void operate('offPeakCreate',{title,prompt,model,permissionMode:'build'})}>Create off-peak task</button><Result read={change}/><Facts value={change.value}/>
  </section>;
}
export function PreferencesPanel({controller}){
  const read=useParityRead(controller);
  useEffect(()=>{void read.run(signal=>controller.call('preferences','read',undefined,{}, {signal}))},[controller]);
  const preferences=read.value?.preferences??read.value;
  return <section data-zcode-preferences="" style={style}><h3>Official interaction preferences</h3><p>Official app settings propagate to active workspaces. Unreported values remain unknown.</p>
    {['askUserQuestionAutoResolutionEnabled','modelIoFullRetentionEnabled'].map((key,i)=><div key={key}>{i?'Full model I/O retention':'AskUserQuestion automatic resolution'}: {typeof preferences?.[key]==='boolean'?String(preferences[key]):'unknown'} <button disabled={read.busy} onClick={()=>void read.run(signal=>controller.call('preferences','update',undefined,{[key]:true},{signal}))}>Enable</button><button disabled={read.busy} onClick={()=>void read.run(signal=>controller.call('preferences','update',undefined,{[key]:false},{signal}))}>Disable</button></div>)}
    <button disabled={read.busy} onClick={()=>void read.run(signal=>controller.call('preferences','read',undefined,{}, {signal}))}>Refresh preferences</button><Result read={read}/>
  </section>;
}
export function FeedbackPanel({controller,snapshot}){
  const read=useParityRead(controller),rows=snapshot?.rows?.window?.filter(row=>row.kind==='assistantText')??[];
  return <section style={style} data-zcode-feedback=""><h4>Message feedback</h4>{!rows.length&&<p>No official assistant message projected.</p>}{rows.map(row=><div key={`${row.rowId}:${row.entityId}`}><p>{row.text}</p><span>Official feedback: {row.feedback??'unreported'}</span>{[['like','Like'],['dislike','Dislike'],[null,'Clear feedback']].map(([feedback,label])=><button key={label} disabled={read.busy} onClick={()=>void read.run(()=>controller.command('setAssistantFeedback',{target:{rowId:row.rowId,entityId:row.entityId},feedback},snapshot))}>{label}</button>)}</div>)}<Result read={read}/></section>;
}
export function AttachmentPanel({controller,snapshot}){
  const read=useParityRead(controller),[attachments,setAttachments]=useState([]),[text,setText]=useState(''),[held,setHeld]=useState(null),[progress,setProgress]=useState(null),upload=useRef(null),owner=useRef(controller),sendClaim=useRef(null);
  useEffect(()=>{owner.current=controller;setAttachments([]);setHeld(null);return ()=>{owner.current=null;upload.current?.abort()}},[controller]);
  const send=async(disposition,signal)=>{
    const confirmation=held,command=confirmation?confirmHeld(snapshot,confirmation,disposition):inputSubmission(snapshot,text,{attachments});
    if(!confirmation&&snapshot.inputRouting.mode==='choice'){setHeld(heldConfirmation(snapshot,command));return}
    const claim={};sendClaim.current=claim;
    try{
      const result=await controller.command(command.type,command.payload,snapshot,{signal,...(confirmation?{heldQueue:{logEpoch:confirmation.logEpoch,items:confirmation.items}}:{})});
      if(owner.current===controller&&!signal.aborted&&['accepted','duplicate'].includes(result.ack?.status)){setText('');setAttachments([]);setHeld(null)}return result;
    }finally{if(sendClaim.current===claim)sendClaim.current=null}
  };
  const selectFiles=async event=>{const files=[...event.target.files];event.target.value='';const current=controller,abort=new AbortController();upload.current=abort;
    try{await read.run(async()=>{for(const file of files){const ref=await controller.upload(file,{signal:abort.signal,onProgress:p=>{if(owner.current===current&&!abort.signal.aborted)setProgress(p)}});if(owner.current===current&&!abort.signal.aborted)setAttachments(items=>[...items,ref])}return {uploaded:true}})}finally{if(owner.current===current)setProgress(null);upload.current=null}
  };
  const projected=(snapshot?.rows?.window??[]).flatMap(row=>(row.attachments??[]).map((attachment,attachmentIndex)=>({attachment,row,attachmentIndex})));
  return <section data-zcode-attachments="" style={style}><h4>Attachments</h4><label>Files <input type="file" multiple aria-label="ZCode attachment files" disabled={read.busy||!!held} onChange={event=>void selectFiles(event)}/></label>{progress&&<p role="status">{progress.phase} · {progress.uploadedBytes}/{progress.totalBytes}<button onClick={()=>upload.current?.abort()}>Cancel upload</button></p>}
    <ul>{attachments.map(a=><li key={a.ref}>{a.fileName} · {a.bytes} bytes · committed</li>)}</ul><label>Text for attachment input <textarea aria-label="Attachment input text" value={text} onChange={e=>setText(e.target.value)} disabled={!!held}/></label><button disabled={read.busy||!!held||(!attachments.length&&!text.trim())} onClick={()=>void read.run(signal=>send(undefined,signal))}>Send attachment input</button>
    {held&&<div role="dialog" aria-label="Attachment input queue disposition"><p>Confirmed paused queue: {held.items.map(i=>i.queueItemId+' / '+i.sourceCommandId).join(', ')}</p><button disabled={read.busy} onClick={()=>void read.run(signal=>send('keepQueueAndSend',signal))}>Keep queue and send</button><button disabled={read.busy} onClick={()=>void read.run(signal=>send('clearQueueAndSend',signal))}>Clear confirmed queue and send</button><button disabled={read.busy} onClick={()=>{if(!sendClaim.current)setHeld(null)}}>Cancel confirmation</button>{read.busy&&<p role="status">Sending confirmed input; cancellation is unavailable after claim.</p>}</div>}
    {projected.map(({attachment,row,attachmentIndex})=>{const params={ref:attachment.ref,target:{rowId:row.rowId,entityId:row.entityId},attachmentIndex};return <div key={`${row.rowId}:${attachmentIndex}`}>{attachment.fileName??attachment.ref} <button disabled={read.busy} onClick={()=>void read.run(()=>controller.call('attachment','preview',undefined,params))}>Preview source</button><button disabled={read.busy} onClick={()=>void read.run(()=>controller.call('attachment','stat',undefined,params))}>Read attachment metadata</button><button disabled={read.busy} onClick={()=>void read.run(()=>controller.call('attachment','conversationRead',undefined,{...params,offset:0,limit:65536}))}>Read text chunk</button><button disabled={read.busy} onClick={()=>void read.run(()=>controller.call('attachment','read',undefined,{...params,offset:0,limit:65536}))}>Read preview chunk</button></div>})}
    <Result read={read}/><Facts value={read.value}/>
  </section>;
}
export function QueuePreferencesPanel({controller,snapshot}){
  const read=useParityRead(controller),items=snapshot?.queue?.items??[];
  const submit=(kind,params)=>read.run(()=>controller.command(kind,params,snapshot));
  return <section style={style} data-zcode-queue-preferences=""><h4>Official queue preferences</h4>
    <label>Collaboration mode <select aria-label="ZCode collaboration mode" disabled={read.busy} value={snapshot.config.mode} onChange={e=>void submit('switchCollaborationMode',{mode:e.target.value})}>{!['build','edit','plan','yolo'].includes(snapshot.config.mode)&&<option value={snapshot.config.mode} disabled>{snapshot.config.mode??'Unknown'}</option>}{['build','edit','plan','yolo'].map(mode=><option key={mode} value={mode}>{mode}</option>)}</select></label>
    <button disabled={read.busy} onClick={()=>void submit('setAutoDrain',{autoDrain:!snapshot.queue.autoDrain})}>{snapshot.queue.autoDrain?'Pause auto drain':'Resume auto drain'}</button>
    <label>Follow-up mode <select aria-label="ZCode follow-up mode" disabled={read.busy} value={snapshot.config.followupMode??''} onChange={e=>void submit('setFollowupMode',{mode:e.target.value})}><option value="" disabled>Unknown</option><option value="queue">Queue</option><option value="guide">Guide</option></select></label>
    {items.map((item,index)=><div key={item.queueItemId}>{item.text}<button disabled={read.busy||index===0||item.dispatch.state!=='queued'} onClick={()=>void submit('reorderQueueItem',{queueItemId:item.queueItemId,beforeQueueItemId:items[index-1].queueItemId})}>Move up</button><button disabled={read.busy||index===items.length-1||item.dispatch.state!=='queued'} onClick={()=>void submit('reorderQueueItem',{queueItemId:item.queueItemId,beforeQueueItemId:items[index+2]?.queueItemId??null})}>Move down</button></div>)}
    <p>Official goal: {snapshot.goal?.objective??'none'} · {snapshot.goal?.status??'unreported'}</p><button disabled={read.busy||snapshot.availability?.pauseGoal?.allowed!==true} onClick={()=>void submit('pauseGoal',{})}>Pause goal</button><button disabled={read.busy||snapshot.availability?.resumeGoal?.allowed!==true} onClick={()=>void submit('resumeGoal',{})}>Resume goal</button><Result read={read}/>
  </section>;
}
export function HistoryResourcesPanel({controller,snapshot}){
  const read=useParityRead(controller),plans=useParityRead(controller);
  const headers=snapshot.rows.window.filter(row=>row.kind==='turnHeader');
  // Results belong to this exact projection, even if it is replaced while a read is in flight.
  const stamp=`${snapshot.logEpoch}:${snapshot.revision}`;
  const query=(kind,row)=>read.run(async signal=>({stamp,kind,value:await controller.call('history','read',kind,{target:{rowId:row.rowId,entityId:row.entityId}},{snapshot,signal})}));
  const data=read.value?.stamp===stamp?read.value.value.result:null;
  return <section style={style} data-zcode-history-resources=""><h4>Official plans and file history</h4>
    <button disabled={plans.busy} onClick={()=>void plans.run(async signal=>({stamp,value:await controller.call('history','read','plans',{}, {signal})}))}>Read official plans</button><Result read={plans}/>
    {plans.value?.stamp===stamp&&<><p>{plans.value.value.plans.length} official plans</p>{plans.value.value.plans.map(row=><article key={row.rowId}><h5>{row.toolName} · row {row.rowId}</h5><pre>{row.output?.text??row.inputText}</pre></article>)}</>}
    {headers.map(row=><div key={row.rowId}>Turn {row.turnId} · {row.state} <button disabled={read.busy} onClick={()=>void query('fileChanges',row)}>Read file changes · {row.rowId}</button>{row.actions?.canRewindFiles===true&&<button disabled={read.busy} onClick={()=>void query('fileRewindPreview',row)}>Preview file rewind · {row.rowId}</button>}</div>)}<Result read={read}/>
    {data&&read.value.kind==='fileChanges'&&<><p>{data.files} files · +{data.additions} / −{data.deletions} · {data.state}</p>{data.items.map(item=><article key={item.path}><h5>{item.path} · +{item.additions} / −{item.deletions}</h5>{item.patches.map((patch,index)=><pre key={index}>{patch.lines.join('\n')}</pre>)}</article>)}</>}
    {data&&read.value.kind==='fileRewindPreview'&&<><p>Official rewind preview · {data.canApply?'safe to apply':'cannot apply'}</p>{[['safeFiles','Safe files'],['unsafeFiles','Unsafe files'],['ignoredFiles','Ignored files']].map(([key,label])=><div key={key}><h5>{label}</h5><ul>{data[key].map(item=><li key={item.path}>{item.path} · {item.reason??item.action??'ignored'}</li>)}</ul></div>)}</>}
  </section>;
}
export function SessionParityPanel({rpc,sessionId,controls,connectionGeneration}){
  const controller=useMemo(()=>new ParityController(rpc,{sessionId,connectionGeneration}),[rpc,sessionId,connectionGeneration]);
  useEffect(()=>()=>controller.dispose(),[controller]);
  useSyncExternalStore(controls.subscribe,controls.getSnapshot,controls.getSnapshot);
  const info=controls.infos.get(sessionId),read=useParityRead(controller);
  useEffect(()=>{if(info?.runtime==='zcode'&&info.officialAddress?.sessionId)void read.run(()=>controller.call('snapshot','read'))},[controller,info?.runtime,info?.officialAddress?.sessionId]);
  if(info?.runtime!=='zcode')return null;
  const state=read.value,snapshot=state?.snapshot;
  return <>{info.officialAddress?.sessionId&&<HookReviewPanel controller={controller}/>}<details data-zcode-session-parity="" style={{maxHeight:420,overflow:'auto'}}><summary>Zcode Bridge · workflows, feedback and attachments</summary><button disabled={read.busy} onClick={()=>void read.run(()=>controller.call('snapshot','read'))}>Refresh session capabilities</button><Result read={read}/>
    {state&&<><ZCodeWorkflowPanel state={state} controller={controller}/><DiagnosticsExtras controller={controller} sessionId={sessionId} snapshot={snapshot}/><FeedbackPanel controller={controller} snapshot={snapshot}/><QueuePreferencesPanel controller={controller} snapshot={snapshot}/><HistoryResourcesPanel controller={controller} snapshot={snapshot}/><AttachmentPanel controller={controller} snapshot={snapshot}/></>}
    {!info.officialAddress?.sessionId&&<p>The first text input creates the official session. Session-bound resources are available after its official projection arrives.</p>}
  </details></>;
}
export function WorkspacePresentationPanel({controller}){
  const read=useParityRead(controller);
  const refresh=()=>read.run(signal=>controller.call('workspace','read',undefined,{}, {signal}));
  useEffect(()=>{void refresh()},[controller]);
  return <section data-zcode-workspace-presentations="" style={style}><h3>Official workspace presentations</h3>
    <p>Mode and slash commands are read from each official workspace. No connection or configuration write is performed.</p>
    <button disabled={read.busy} onClick={()=>void refresh()}>Refresh workspace presentations</button><Result read={read}/>
    {read.value?.presentations.map(entry=><article key={entry.workspace}><h4>{entry.workspace}</h4>
      {entry.error?<p role="alert">{entry.error.code} · refresh to read current official availability.</p>:<><p>Mode: {entry.presentation.mode}</p>
        <ul>{entry.presentation.slashCommands.map(command=><li key={command.name}>/{command.name} · {command.description}{command.inputHint?` · ${command.inputHint}`:''}{command.source?` · ${command.source}`:''}</li>)}</ul>
        {!entry.presentation.slashCommands.length&&<p>No official slash command listed.</p>}</>}
    </article>)}
  </section>;
}
export function BridgeParityPage({controller:statusController,rpc,controls,connectionGeneration,t=fallback,view,settingsOnly=false,StatusComponent}){
  const {status}=useSyncExternalStore(statusController.subscribe,statusController.getSnapshot,statusController.getSnapshot);
  const controller=useMemo(()=>new ParityController(rpc,{connectionGeneration}),[rpc,connectionGeneration]);
  useEffect(()=>()=>controller.dispose(),[controller]);
  const [tab,setTab]=useState(settingsOnly?'settings':'catalog');
  if(view==='summary')return t('title');
  return <div style={{...style,overflow:'auto'}}><BridgeSettingsPanel rpc={rpc} status={status} t={t} onDiagnostics={()=>setTab('insights')}/>{StatusComponent&&!settingsOnly&&<details open={status?.failSafe?.incompatible||['newer-unverified','identity-mismatch'].includes(status?.compatibility?.state)}><summary>{t('connection')}</summary><StatusComponent controller={statusController}/></details>}
    {(!settingsOnly||tab!=='settings')&&<><nav aria-label="Zcode Bridge panels">{['catalog','insights','automation','workflows','workspace','preferences'].map(key=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>setTab(key)}>{t(key)}</button>)}</nav>
      {tab==='catalog'&&<ZCodeCatalogPanel sources={controller.catalog} t={key=>t('catalog.'+key)}/>}
      {tab==='insights'&&<><ZCodeInsightsPanel sources={controller.insights} t={key=>t('insights.'+key)}/><DiagnosticsExtras controller={controller}/></>}
      {tab==='automation'&&<AutomationPanel controller={controller}/>}
      {tab==='workflows'&&<><ZCodeWorkflowPanel controller={controller} state={{workflowAdmission:{reads:{allowed:true},writes:{allowed:true}}}}/><p>Open a ZCode session for run, resume, amendment and cancellation controls.</p></>}
      {tab==='workspace'&&<WorkspacePresentationPanel controller={controller}/>}
      {tab==='preferences'&&<PreferencesPanel controller={controller}/>}
    </>}
  </div>;
}
export function installParityPanels(ctx,statusController,controls,StatusComponent){
  ctx.effect(()=>ctx.locale.register('zcodeBridgeParity',parityLocales),'zcode-bridge: parity locale');
  const injected=()=>({controller:statusController,rpc:ctx.connection.rpc,controls,connectionGeneration:ctx.connection.generation,StatusComponent});
  ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',id:'zcode-bridge-status',key:'@dsh-zcode/bridge',locale:'zcodeBridgeParity',inject:injected},BridgeParityPage));
  ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'zcode-bridge',order:60,label:'Zcode Bridge',locale:'zcodeBridgeParity',inject:()=>({...injected(),settingsOnly:true})},BridgeParityPage));
  ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'zcode-parity',order:22,registrant:'zcode-parity',inject:sessionId=>({...injected(),sessionId})},SessionParityPanel));
}
