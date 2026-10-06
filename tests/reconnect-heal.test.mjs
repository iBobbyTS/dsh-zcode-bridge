// Session migration: native DSH retains transcript subscriptions. Runtime controls invalidate only
// their own advisory receipts at a connection generation boundary and reject late projections.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {RuntimeControls} from '../packages/client/runtime.mjs';
test('generation bump fences late runtime identity/model replies',async()=>{
 let reset,resolve;const controls=new RuntimeControls({call:()=>new Promise(done=>resolve=done)},{connectionGeneration:{subscribe:listener=>{reset=listener;return ()=>{}}}});
 try{const pending=controls.info('A');reset();resolve({ok:true,value:{runtime:'zcode',selection:{modelId:'stale'}}});await pending;assert.equal(controls.infos.has('A'),false);assert.equal(controls.snapshot.runtime,'zcode')}finally{controls.dispose()}
});
test('default zcode creation pre-registers exact identity, native routes unchanged, teardown restores create',async()=>{
 const calls=[];const original=async options=>{calls.push({native:options});return options?.sessionId??'native-new'};const sessions={create:original,list:{getSnapshot:()=>({byId:{existing:{}}})}};
 const controls=new RuntimeControls({call:async(channel,endpoint,payload)=>{calls.push(payload);return {ok:true,value:payload.operation==='create'?{sessionId:'zcode-new'}:{runtime:payload.sessionId==='existing'?'native':'zcode',locked:true}}}});
 const restore=controls.install(sessions);
 try{assert.equal(await sessions.create(),'zcode-new');assert.equal(calls[0].operation,'create');assert.deepEqual(calls[1],{native:{sessionId:'zcode-new'}});controls.stage('native');assert.equal(await sessions.create(),'native-new');assert.equal(await sessions.create({sessionId:'existing'}),'existing')}
 finally{restore();controls.dispose();assert.equal(sessions.create,original)}
});
