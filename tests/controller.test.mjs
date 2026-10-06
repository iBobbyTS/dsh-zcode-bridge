import {test} from 'node:test';import assert from 'node:assert/strict';import {StatusController} from '../packages/client/controller.mjs';
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
test('late read cannot overwrite connect; disconnect/dispose cancels and fences RPC results',async()=>{
 const requests=[];let reset;let unsubscribed=false;
 const c=new StatusController({call:(channel,endpoint,_payload,signal)=>new Promise(resolve=>requests.push({channel,endpoint,signal,resolve}))},{subscribe:f=>{reset=f;return ()=>unsubscribed=true}});
 try{
 c.start();const connecting=c.connect();requests[1].resolve({ok:true,value:{state:'restricted',reason:'official-auth-source-missing'}});await connecting;
 requests[0].resolve({ok:true,value:{state:'unavailable',reason:'old'}});await Promise.resolve();assert.equal(c.getSnapshot().status.state,'restricted');
 const read=c.read();reset();assert.equal(requests[2].signal.aborted,true);requests[2].resolve({ok:true,value:{state:'available'}});await read;assert.equal(c.getSnapshot().status.state,'unavailable');
 // The bump releases exactly one auto-connect attempt; dispose must cancel and fence it like any call.
 assert.equal(requests.length,4);assert.equal(requests[3].endpoint,'connect');
 }finally{c.dispose()}
 requests[3].resolve({ok:true,value:{state:'available',connected:true}});await settle();
 assert.equal(requests[3].signal.aborted,true);assert.equal(c.getSnapshot().status.state,'unavailable');assert.equal(unsubscribed,true);
 assert.equal(requests[0].channel,'/zcode-bridge');
 assert.equal(requests[0].endpoint,'status');
 assert.equal(requests[1].channel,'/zcode-bridge');
 assert.equal(requests[1].endpoint,'connect');
});
test('auto-connect runs one attempt per connection generation and never loops after failure',async()=>{
 const calls=[];let bump;
 const c=new StatusController({call:async(_channel,endpoint)=>{calls.push(endpoint);return {ok:true,value:endpoint==='status'?{state:'unavailable',reason:'not-connected',connected:false}:{state:'unavailable',reason:'launch-failed',connected:false}}}},{subscribe:f=>{bump=f;return ()=>{}}});
 try{
  c.start();await settle();
  assert.deepEqual(calls.slice(0,2),['status','connect']);
  assert.equal(c.getSnapshot().status.reason,'launch-failed');
  await settle();
  assert.equal(calls.filter(endpoint=>endpoint==='connect').length,1);
  bump();await settle();
  assert.equal(calls.filter(endpoint=>endpoint==='connect').length,2);
  await settle();
  assert.equal(calls.filter(endpoint=>endpoint==='connect').length,2);
 }finally{c.dispose()}
});
test('auto-connect is suppressed while the official runtime is already connected',async()=>{
 const calls=[];
 const c=new StatusController({call:async(_channel,endpoint)=>{calls.push(endpoint);return {ok:true,value:{state:'authenticated',reason:'live-http-authenticated-read-only',connected:true}}}},{subscribe:()=>()=>{}});
 try{
  c.start();await settle();
  assert.deepEqual(calls,['status']);
 }finally{c.dispose()}
});
