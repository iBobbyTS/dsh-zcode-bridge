import {test} from 'node:test';import assert from 'node:assert/strict';import {StatusController} from '../packages/client/controller.mjs';
test('late read cannot overwrite connect; disconnect/dispose cancels and fences RPC results',async()=>{
 const requests=[];let reset;let unsubscribed=false;
 const c=new StatusController({call:(_channel,endpoint,_payload,signal)=>new Promise(resolve=>requests.push({endpoint,signal,resolve}))},{subscribe:f=>{reset=f;return ()=>unsubscribed=true}});
 c.start();const connecting=c.connect();requests[1].resolve({ok:true,value:{state:'restricted',reason:'official-auth-source-missing'}});await connecting;
 requests[0].resolve({ok:true,value:{state:'unavailable',reason:'old'}});await Promise.resolve();assert.equal(c.getSnapshot().status.state,'restricted');
 const read=c.read();reset();assert.equal(requests[2].signal.aborted,true);requests[2].resolve({ok:true,value:{state:'available'}});await read;assert.equal(c.getSnapshot().status.state,'unavailable');
 const late=c.connect();c.dispose();requests[3].resolve({ok:true,value:{state:'available'}});await late;assert.equal(unsubscribed,true);assert.equal(requests[3].signal.aborted,true);assert.equal(c.getSnapshot().status.state,'unavailable');
});
