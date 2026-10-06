import React,{useEffect,useRef,useState} from 'react';
import {classifyUserInputRoute,USER_INPUT_PLUGIN,userInputQuestions,buildElicitationContent,flatDraftContent} from '../host/user-input.mjs';

// Plugin questionnaire card for the ZCode userInput variants the official composer cannot honour:
// sensitive (masked, no draft), freeText=false (no free-text row) and autoResolution (first action
// snoozes the official timer). Drafts live only in component memory and are never persisted or
// restored. Answers go back through the official resolveInteraction command; the official
// interaction state is the only settlement authority.
const fault=code=>Object.assign(new Error(code),{code});
function accepted(result){if(!['accepted','duplicate'].includes(result?.ack?.status))throw fault(result?.ack?.reasonCode??result?.state??'user-input-unconfirmed');return result}

function Questionnaire({interaction,disabled,onFirstAction,onSubmit}){
  const questions=userInputQuestions(interaction);
  const [drafts,setDrafts]=useState(()=>questions.map(()=>({selectedValues:[],customAnswer:''})));
  const update=(index,patch)=>{onFirstAction();setDrafts(current=>current.map((draft,position)=>position===index?{...draft,...patch}:draft))};
  const complete=drafts.every(draft=>draft.selectedValues.length>0||draft.customAnswer.trim().length>0);
  return <>{questions.map((question,index)=>{
    const draft=drafts[index];
    return <fieldset key={index} data-zcode-user-input-question={index}>
      <legend>{question.header?`${question.header} · `:''}{question.question}</legend>
      {(question.options??[]).map(option=>{
        const selected=draft.selectedValues.includes(option.label);
        return <button type="button" key={option.label} aria-pressed={selected} data-zcode-user-input-option={`${index}:${option.label}`}
          onClick={()=>update(index,{selectedValues:question.multiSelect?(selected?draft.selectedValues.filter(value=>value!==option.label):[...draft.selectedValues,option.label]):[option.label]})}>{option.label}</button>;
      })}
      {interaction.payload?.freeText!==false&&<label>Other <input
        data-zcode-user-input-custom={index}
        {...(interaction.payload?.sensitive===true?{type:'password'}:{})}
        autoComplete={interaction.payload?.sensitive===true?'new-password':'off'}
        value={draft.customAnswer} onChange={event=>update(index,{customAnswer:event.target.value})}/></label>}
    </fieldset>;
  })}<button type="button" data-zcode-user-input-submit disabled={disabled||!complete} onClick={()=>onSubmit({content:buildElicitationContent(questions,drafts)})}>Submit answer</button></>;
}

function FlatPrompt({interaction,disabled,onFirstAction,onSubmit}){
  const options=interaction.payload?.options??[],masked=interaction.payload?.sensitive===true,allowText=interaction.payload?.freeText!==false;
  const [selected,setSelected]=useState(''),[text,setText]=useState('');
  const complete=Boolean(selected)||text.trim().length>0;
  return <>
    {options.map(option=><button type="button" key={option.optionId} disabled={disabled} aria-pressed={selected===option.optionId} data-zcode-user-input-option={option.optionId} onClick={()=>{onFirstAction();setSelected(option.optionId)}}>{option.label}</button>)}
    {allowText&&<label>Answer <input data-zcode-user-input-custom="0" {...(masked?{type:'password'}:{})} autoComplete={masked?'new-password':'off'} value={text} onChange={event=>{onFirstAction();setText(event.target.value)}}/></label>}
    <button type="button" data-zcode-user-input-submit disabled={disabled||!complete} onClick={()=>{const option=options.find(candidate=>candidate.optionId===selected);const freeText=allowText&&text.trim()?text.trim():undefined;onSubmit(option?{optionId:option.optionId,...(freeText?{freeText}:{})}:flatDraftContent(interaction,{freeText:text}))}}>Submit answer</button>
  </>;
}

/** Render only the plugin-routed userInput interactions. `controller` is the session-bound
 * ParityController; snapshots and ACKs are the official settlement authority (no local success). */
export function UserInputCard({controller,pollMs=1500}){
  const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(null),[notice,setNotice]=useState(null);
  const owner=useRef(null),flight=useRef(null),acting=useRef(false),snoozed=useRef(new Set());
  async function refresh(token=owner.current){
    if(!token||token!==owner.current||flight.current)return;
    const abort=new AbortController();flight.current=abort;
    try{const value=await controller.call('snapshot','read',undefined,{}, {signal:abort.signal});if(token===owner.current){setState(value);return value}}
    catch(err){if(token===owner.current&&!abort.signal.aborted)setError(err.code??err.message)}
    finally{if(flight.current===abort)flight.current=null}
  }
  useEffect(()=>{
    const reset=()=>{flight.current?.abort();flight.current=null;owner.current={};acting.current=false;setState(null);setBusy(false);setError(null);setNotice(null);void refresh(owner.current)};
    reset();const off=controller.subscribe(reset),timer=pollMs>0?setInterval(()=>void refresh(),pollMs):null;
    return ()=>{off();clearInterval(timer);owner.current=null;flight.current?.abort();flight.current=null};
  },[controller,pollMs]);
  const snapshot=state?.snapshot,ready=state?.admission?.allowed&&state?.managementAdmission?.allowed&&!busy;
  const interactions=(snapshot?.pendingInteractions??[]).filter(item=>item.kind==='userInput'&&classifyUserInputRoute(item)===USER_INPUT_PLUGIN);
  /** First-operation hook: a timed variant is snoozed before the answer is even complete, so the
   * interaction cannot expire while the user is still typing. Idempotent per interaction. */
  async function firstAction(interaction){
    if(!interaction.autoResolution||interaction.autoResolution.state==='snoozed'||snoozed.current.has(interaction.interactionId))return;
    snoozed.current.add(interaction.interactionId);
    try{accepted(await controller.command('snoozeInteractionAutoResolution',{interactionId:interaction.interactionId},snapshot))}
    catch(err){snoozed.current.delete(interaction.interactionId);setError(err.code??err.message)}
  }
  async function answer(interaction,answer){
    if(!ready||acting.current)return;
    const token=owner.current,base=snapshot;acting.current=true;setBusy(true);setError(null);setNotice(null);
    try{
      // If the first-operation hook did not run (programmatic submit), snooze now and re-read the
      // official state before submitting so the answer is never sent to an already-settled call.
      if(interaction.autoResolution&&interaction.autoResolution.state!=='snoozed'&&!snoozed.current.has(interaction.interactionId)){
        accepted(await controller.command('snoozeInteractionAutoResolution',{interactionId:interaction.interactionId},base));
        const current=await controller.call('snapshot','read',undefined,{});
        if(token!==owner.current)return;
        if(!current.snapshot?.pendingInteractions.some(item=>item.interactionId===interaction.interactionId)){setNotice('The official interaction is already settled; the answer was not resubmitted.');return}
        accepted(await controller.command('resolveInteraction',{interactionId:interaction.interactionId,answer},current.snapshot));
      }else accepted(await controller.command('resolveInteraction',{interactionId:interaction.interactionId,answer},base));
      if(token===owner.current)setNotice('Answer accepted by ZCode; waiting for the official interaction state.');
    }catch(err){if(token===owner.current)setError(err.code??err.message)}
    finally{if(token===owner.current){acting.current=false;setBusy(false);void refresh(token)}}
  }
  return <section data-zcode-user-input="" style={{padding:12,overflowWrap:'anywhere'}}>
    {interactions.map(interaction=><article key={interaction.interactionId} data-zcode-user-input-card={interaction.interactionId}>
      <h4>{interaction.payload?.toolName??'ZCode user input'}</h4>
      <p data-zcode-user-input-prompt="">{interaction.payload?.prompt}</p>
      {interaction.payload?.sensitive===true&&<p role="note" data-zcode-user-input-masked="">Sensitive input: masked and never drafted or stored.</p>}
      {interaction.autoResolution&&interaction.autoResolution.state!=='snoozed'&&<p role="note" data-zcode-user-input-timed="">Auto-resolution is armed; your first action snoozes it.</p>}
      {userInputQuestions(interaction).length
        ? <Questionnaire interaction={interaction} disabled={!ready} onFirstAction={()=>void firstAction(interaction)} onSubmit={payload=>void answer(interaction,payload)}/>
        : <FlatPrompt interaction={interaction} disabled={!ready} onFirstAction={()=>void firstAction(interaction)} onSubmit={payload=>void answer(interaction,payload)}/>}
    </article>)}
    {busy&&<p role="status">Awaiting official result</p>}{notice&&<p role="status" data-zcode-user-input-notice="">{notice}</p>}{error&&<p role="alert" data-zcode-user-input-error="">{error}</p>}
  </section>;
}
