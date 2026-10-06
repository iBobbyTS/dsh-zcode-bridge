import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commandWorld,message,queueItem,tick} from './helpers/lifecycle-commands.mjs';
import {row} from './helpers/zcode-runtime-fixture.mjs';
const entries=['prompt','queue-edit','steer','stop','disconnect'];
const states=['idle','turn-running','queue-paused','transport-lost'];
// Read-path partner to lifecycle-commands-interleave's frozen write oracle.
// ACK-only admission never invents a user message; rows/phase are authoritative.
const readOracle={
  prompt:{idle:'user/message','turn-running':'user/message','queue-paused':'inbox','transport-lost':'prefix'},
  'queue-edit':{idle:'none','turn-running':'none','queue-paused':'inbox','transport-lost':'prefix'},
  steer:{idle:'steering','turn-running':'steering','queue-paused':'inbox','transport-lost':'prefix'},
  stop:{idle:'none','turn-running':'aborted','queue-paused':'inbox','transport-lost':'prefix'},
  disconnect:{idle:'none','turn-running':'prefix','queue-paused':'inbox','transport-lost':'prefix'},
};
function publish(w,edit){const snapshot=structuredClone(w.peer.snapshot);snapshot.seq++;snapshot.revision++;edit(snapshot);w.peer.publish(snapshot)}
function running(snapshot){snapshot.control.phase='running';snapshot.control.canStop=true;snapshot.control.activeWorks=[{kind:'primaryTurn',foregroundExecutionId:'read-work',startedAt:0}];snapshot.rows.window=[row('turnHeader',1,{state:'running',origin:'userInput',startedAt:0}),row('userInput',2,{origin:'realUser',text:'running'}),row('assistantText',3,{text:'visible prefix',state:'streaming',model:'model_a'})]}
for(const entry of entries)for(const state of states)test(`read oracle: ${entry} / ${state}`,async()=>{
  const w=await commandWorld(state==='transport-lost'?'turn-running':state),expected=readOracle[entry][state];
  try{
    if(state==='turn-running'||state==='transport-lost'){publish(w,running);await w.drain()}
    const start=w.events.length;
    if(state==='transport-lost'||entry==='disconnect')w.peer.disconnect();
    else if(entry==='stop'&&state==='turn-running')publish(w,s=>{s.control.phase='completedInterrupted';s.control.canStop=false;s.control.activeWorks=[]});
    else if(state==='queue-paused')publish(w,s=>{if(entry==='queue-edit')s.queue.items[0].text='edited';s.rows.window=[]});
    else if(entry==='prompt'||entry==='steer')publish(w,s=>{running(s);s.rows.window[1].rowId=10;s.rows.window[1].entityId='read-input';s.rows.window[1].createdAtSeq=10;if(entry==='steer')s.rows.window[1].guided=true});
    await w.drain();
    const events=w.events.slice(start);
    if(expected==='user/message'||expected==='steering')assert.ok(events.some(event=>event.type==='user/message'));
    if(expected==='steering')assert.ok(events.some(event=>event.type==='agent/inbox/spliced'&&event.data.target==='next-step'&&event.data.removedCount===1));
    if(expected==='aborted')assert.ok(events.some(event=>event.type==='turn/end'&&event.data.reason.kind==='aborted'));
    if(expected==='prefix')assert.ok(events.some(event=>event.type==='assistant/message'&&event.data.interrupted));
    if(expected==='inbox'){assert.equal(w.agent.inbox.nextTurn.length,1);assert.equal(events.some(event=>event.type==='user/message'),false);if(entry==='queue-edit')assert.equal(w.agent.inbox.nextTurn[0].content[0].text,'edited')}
    if(expected==='none')assert.equal(events.some(event=>['assistant/message','user/message','turn/end'].includes(event.type)),false);
    assert.deepEqual(w.events.map(event=>event.seq),w.events.map((_,index)=>index));assert.equal(w.agent.conversation.state.observerErrors,0);
  }finally{await w.close()}
});

test('terminal rejected sendText remains pending and is not rendered as dispatched input',async()=>{
  const w=await commandWorld(),request=w.peer.request.bind(w.peer);
  try{
    w.peer.request=async(method,params,options)=>params?.type==='sendText'?options.onResult({commandId:params.commandId,status:'rejected',reasonCode:'test.rejected',revisionAtDecision:0}):request(method,params,options);
    w.agent.followup(message('rejected'));await w.drain();const input=w.agent.inputs.get('rejected');
    publish(w,s=>{running(s);s.rows.window[0].sourceCommandId=input.commandId;s.rows.window[1].sourceCommandId=input.commandId});await w.drain();
    assert.equal(w.events.some(event=>event.type==='user/message'),false);assert.equal(w.agent.inbox.nextTurn[0].id,'rejected');
  }finally{await w.close()}
});
