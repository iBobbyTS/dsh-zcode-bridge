import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {RuntimeControls} from './runtime.mjs';
const empty={runtime:'native',locked:true};
export function RuntimeHero({controls,create}){
  const state=useSyncExternalStore(controls.subscribe,controls.getSnapshot,controls.getSnapshot);const [error,setError]=useState(null);
  return <div data-zcode-runtime-hero="" role="group" aria-label="New session runtime">
    <label>Runtime <select aria-label="New session runtime" value={state.runtime} onChange={event=>controls.stage(event.target.value)}><option value="zcode">ZCode</option><option value="native">DSH native</option></select></label>{' '}
    <button type="button" onClick={()=>{setError(null);void create().catch(error=>setError(error.code??error.message))}}>新建会话</button>
    {error&&<span role="alert">{error}</span>}
  </div>;
}
export function RuntimeModelSeat({controls,sessionId,nativeEntry,nativeProps,locked,...standard}){
  useSyncExternalStore(controls.subscribe,controls.getSnapshot,controls.getSnapshot);
  const info=controls.infos.get(sessionId);const [error,setError]=useState(null);const [provider,setProvider]=useState('');const [model,setModel]=useState('');const [effort,setEffort]=useState('');
  useEffect(()=>{setError(null);void controls.info(sessionId).catch(error=>setError(error.code));const timer=setInterval(()=>{void controls.info(sessionId).catch(()=>{})},2000);return ()=>clearInterval(timer)},[controls,sessionId]);
  useEffect(()=>{setProvider(info?.selection?.providerId??'');setModel(info?.selection?.modelId??'');setEffort(info?.selection?.options?.reasoningLevel??'')},[sessionId,info?.selection?.providerId,info?.selection?.modelId,info?.selection?.options?.reasoningLevel]);
  if(!info)return <span role="status">Runtime… {error}</span>;
  if(info.runtime==='native')return <><span data-zcode-runtime-locked="native">DSH native · locked</span>{nativeEntry&&React.createElement(nativeEntry.component,{...standard,sessionId,locked,...nativeProps})}</>;
  return <div data-zcode-runtime-locked="zcode" role="group" aria-label="ZCode model and effort">
    <span>ZCode · locked</span><span role="note">官方 GUI 可能正在运行本会话</span>
    <label>Provider <input aria-label="ZCode provider" value={provider} onChange={event=>setProvider(event.target.value)} disabled={locked}/></label>
    <label>Model <input aria-label="ZCode model" value={model} onChange={event=>setModel(event.target.value)} disabled={locked}/></label>
    <label>Effort <input aria-label="ZCode effort" value={effort} onChange={event=>setEffort(event.target.value)} disabled={locked}/></label>
    <button type="button" disabled={locked||!provider.trim()||!model.trim()} onClick={()=>{setError(null);void controls.select(sessionId,{providerId:provider.trim(),modelId:model.trim(),...(effort.trim()?{options:{reasoningLevel:effort.trim()}}:{})}).catch(error=>setError(error.code??error.message))}}>应用</button>
    {(error??info.error)&&<span role="alert">{error??info.error}</span>}
  </div>;
}
export function installRuntimeControls(ctx){
  const controls=new RuntimeControls(ctx.connection.rpc,{connectionGeneration:ctx.connection.generation});
  const restore=controls.install(ctx.sessions);ctx.effect(()=>()=>{restore();controls.dispose()},'zcode-bridge: runtime controls');
  ctx.slots.inject('conversation.hero.agentPreset',()=>ctx.slots.register({name:'conversation.hero.agentPreset',priority:-1,inject:()=>({controls,create:async()=>{const id=await ctx.sessions.create();ctx.uiWorkspace.openSession(id)}})},RuntimeHero));
  ctx.slots.inject('conversation.input.model',()=>ctx.slots.register({name:'conversation.input.model',priority:-1,registrant:'zcode-runtime-model',inject:sessionId=>{
    const nativeEntry=ctx.slots.entries('conversation.input.model').find(entry=>entry.component!==RuntimeModelSeat);
    return {controls,nativeEntry,nativeProps:nativeEntry?{...nativeEntry.inject?.(sessionId),t:ctx.locale.bind(nativeEntry.locale??'common')}:null};
  }},RuntimeModelSeat));
  return controls;
}
