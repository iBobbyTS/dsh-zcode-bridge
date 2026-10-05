import {test} from 'node:test';import assert from 'node:assert/strict';
import React,{createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {RuntimeLifecycleDock} from '../packages/client/runtime-controls.mjs';
import {RuntimeControls} from '../packages/client/runtime.mjs';
import {world,catalogRow,directory,tick} from './helpers/s03-runtime.mjs';
const require=createRequire(import.meta.url);

test('S04 receipt-class presentation has distinct accessible states and no delete/remove UI',()=>{
 const state={status:'live',confirmed:true,reason:null,control:{phase:'running',canStop:true,activeWorks:[{}]},queue:{items:[],autoDrain:true},receipts:['accepted','queued','rejected','outcome-unknown'].map(receiptClass=>({receiptClass,commandId:receiptClass,reason:receiptClass==='rejected'?'official-busy':null}))};
 const controls={subscribe:()=>()=>{},getSnapshot:()=>state,infos:new Map([['mirror',{runtime:'zcode',lifecycle:state}]]),watch:()=>()=>{}};
 const html=renderToStaticMarkup(createElement(RuntimeLifecycleDock,{controls,sessionId:'mirror'}));
 for(const name of ['accepted','queued','rejected','outcome-unknown'])assert.ok(html.includes(`data-zcode-receipt="${name}"`));
 for(const text of ['官方已受理','官方已排队','官方未受理','结果未知（不自动重发）','official-busy'])assert.ok(html.includes(text));
 assert.equal(/delete|remove|删除|移除/.test(html),false);assert.ok(html.includes('role="alert"'));
});

test('S04 headless composer: real control path edits/promotes official queue and stops current work; disconnect disables controls without losing queue',async()=>{
 const {JSDOM}=require('jsdom'),{createRoot}=require('react-dom/client'),{Simulate}=require('react-dom/test-utils');
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const w=await world({catalog:async()=>directory([catalogRow('one')])});w.peer.registerSession('one');
 let controls,root;
 try{
  await w.runtime.start();const id=[...w.store.records.keys()][0];await w.runtime.open(id);await tick();
  const s=w.peer.snapshots.get('one');s.seq++;s.control.canStop=true;s.control.activeWorks=[{kind:'primaryTurn',startedAt:0,foregroundExecutionId:'ui-run'}];s.availability.queueEdit={allowed:true};s.availability.sendQueuedNow={allowed:true};s.queue.items=[{sourceCommandId:'external',queueItemId:'official-q',clientId:'gui',kind:'sendText',text:'Queue text',attachments:[],delivery:{requested:'guide',admitted:'queue'},order:{admissionSeq:1},steer:{state:'fellBack',reasonCode:'busy'},dispatch:{state:'queued'},admittedAt:0}];w.peer.publish(s);
  controls=new RuntimeControls({call:async(_channel,_method,payload)=>({ok:true,value:await w.runtime.handle(payload)})});await controls.info(id);
  root=createRoot(document.getElementById('root'));await React.act(async()=>{root.render(createElement(RuntimeLifecycleDock,{controls,sessionId:id}));await tick()});
  assert.ok(document.body.textContent.includes('Queue text'));assert.ok(document.body.textContent.includes('fellBack'));assert.equal(document.querySelector('[aria-label="Stop ZCode"]').disabled,false);
  const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
  await React.act(async()=>button('编辑').click());await React.act(async()=>Simulate.change(document.querySelector('[aria-label="Official queue text"]'),{target:{value:'Edited via UI'}}));await React.act(async()=>{Simulate.submit(document.querySelector('form'));await tick()});
  assert.deepEqual(w.peer.calls.find(call=>call.params?.type==='editQueueItem').params.payload,{queueItemId:'official-q',newText:'Edited via UI'});
  // An ACK does not authorize an optimistic local queue edit.
  assert.ok(document.body.textContent.includes('Queue text'));
  await React.act(async()=>{button('立即发送').click();await tick()});await React.act(async()=>{document.querySelector('[aria-label="Stop ZCode"]').click();await tick()});
  assert.equal(w.peer.calls.find(call=>call.params?.type==='sendQueuedNow').params.payload.queueItemId,'official-q');assert.equal(w.peer.calls.find(call=>call.params?.type==='stop').params.payload.expectedForegroundExecutionId,'ui-run');
  await React.act(async()=>{w.peer.disconnect();await controls.info(id)});assert.ok(document.body.textContent.includes('execution-disconnected'));assert.ok(document.body.textContent.includes('Queue text'));assert.equal(document.querySelector('[aria-label="Stop ZCode"]').disabled,true);assert.equal(button('立即发送').disabled,true);
  assert.equal(w.peer.calls.filter(call=>['sendText','createSession','deleteSession','deleteQueueItem'].includes(call.params?.type)).length,0);
 }finally{if(root)await React.act(async()=>root.unmount());controls?.dispose();await w.runtime.dispose();dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT}
});

test('S04 mounted observation is generation fenced and cancels future polls on unmount',async()=>{
 const pending=Promise.withResolvers(),calls=[];const controls=new RuntimeControls({call:async(_channel,_method,payload)=>{calls.push(payload.operation);if(payload.operation==='observe')return pending.promise;return {ok:true,value:{runtime:'zcode',lifecycle:{status:'live'}}}}});
 try{await controls.info('one');const off=controls.watch('one',5);await tick();assert.equal(calls.at(-1),'observe');off();pending.resolve({ok:true,value:{runtime:'zcode',lifecycle:{status:'stale'}}});await tick();assert.equal(controls.infos.get('one').lifecycle.status,'live');assert.equal(calls.filter(call=>call==='observe').length,1)}finally{controls.dispose()}
});
