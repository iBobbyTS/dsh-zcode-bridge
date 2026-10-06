import test from 'node:test';
import assert from 'node:assert/strict';
import {createMinimalTurn,MINIMAL_PROMPT,MINIMAL_TURN_CALLS,MINIMAL_TURN_MODE} from '../packages/host/launcher/minimal-turn.mjs';
import {LIVE_HTTP_READ_CALLS,LIVE_HTTP_SEND_CALLS,LIVE_HTTP_ALLOWED_CALLS,compareObservation} from '../packages/host/launcher/observation.mjs';
import {BridgeHost} from '../packages/host/runtime.mjs';
import {handleOwnTurn,handleTaskUsage} from '../packages/host/index.mjs';

const usage={totalTokens:10,inputTokens:6,outputTokens:4,totalSessions:2,totalTurns:2,toolCallCount:1,requestCount:7};
function harness({created={taskId:'task-1',traceId:'trace-1'},fail=null}={}){
  const calls=[],events=[];
  const turn=createMinimalTurn({
    call:async(svc,method,args)=>{const name=svc+'.'+method;calls.push([name,args]);events.push('call:'+name);if(fail===name)throw Object.assign(new Error('boom'),{code:'live-http-write-failed'});return method==='createTask'?created:undefined;},
    usage:async()=>{events.push('usage');return {...usage}},
    readTasks:async()=>{events.push('tasks');return [{taskId:'old',workspacePath:'/w'}]},
    workspacePath:'/private/tmp/scratch/workspace',
    recordClaim:()=>events.push('claim'),
    now:()=>1234,
  });
  return {turn,calls,events};
}
test('Minimal turn usage minimal turn creates exactly one new session and sends one minimal prompt',async()=>{
  const {turn,calls,events}=harness();
  const result=await turn.run();
  assert.deepEqual(calls[0],['zcode-task.createTask',[{workspacePath:'/private/tmp/scratch/workspace',mode:MINIMAL_TURN_MODE,deferPersistenceUntilFirstPrompt:true}]]);
  assert.deepEqual(calls[1],['zcode-task.sendPrompt',[{taskId:'task-1',content:MINIMAL_PROMPT,clientMode:'desktop-continuous',toolDenylist:['CronCreate','OffPeakCreate'],traceId:'trace-1'}]]);
  assert.equal(calls.length,2);
  assert.equal(result.taskId,'task-1');assert.equal(result.prompt,MINIMAL_PROMPT);assert.equal(result.at,1234);
  assert.deepEqual(result.usageBefore,usage);assert.deepEqual(result.tasksBefore,[{taskId:'old',workspacePath:'/w'}]);
  // Claim precedes every side effect, including the usage/task reads and both official write calls.
  assert.deepEqual(events,['claim','usage','tasks','call:zcode-task.createTask','call:zcode-task.sendPrompt']);
});
test('Minimal turn usage minimal turn is one-shot: a second run is rejected before any side effect',async()=>{
  const {turn,calls,events}=harness();
  await turn.run();const before=calls.length;const claimEvents=events.length;
  await assert.rejects(()=>turn.run(),e=>e.code==='minimal-turn-already-claimed');
  assert.equal(calls.length,before);assert.equal(events.length,claimEvents);
});
test('Minimal turn usage minimal turn refuses a session creation without a task id and never sends a prompt',async()=>{
  const {turn,calls}=harness({created:{}});
  await assert.rejects(()=>turn.run(),e=>e.code==='minimal-turn-create-invalid');
  assert.deepEqual(calls.map(c=>c[0]),['zcode-task.createTask']);
});
test('Minimal turn usage minimal turn surfaces an official write failure and never retries',async()=>{
  const {turn,calls}=harness({fail:'zcode-task.sendPrompt'});
  await assert.rejects(()=>turn.run(),e=>e.code==='live-http-write-failed');
  assert.deepEqual(calls.map(c=>c[0]),['zcode-task.createTask','zcode-task.sendPrompt']);
  await assert.rejects(()=>turn.run(),e=>e.code==='minimal-turn-already-claimed');
  assert.equal(calls.length,2);
});
test('Minimal turn usage write calls stay outside the official host read-only whitelist',()=>{
  for(const name of LIVE_HTTP_SEND_CALLS)assert.ok(!LIVE_HTTP_READ_CALLS.includes(name));
  for(const name of MINIMAL_TURN_CALLS)assert.ok(LIVE_HTTP_SEND_CALLS.includes(name));
  assert.deepEqual([...LIVE_HTTP_ALLOWED_CALLS],[...LIVE_HTTP_READ_CALLS,...LIVE_HTTP_SEND_CALLS]);
  const base={tasks:[],usage:{...usage},rpc:['zcode-task.listTasks']};
  const after={tasks:[],usage:{...usage},rpc:['zcode-task.listTasks','zcode-task.sendPrompt']};
  assert.equal(compareObservation(base,after).whitelistUnchanged,false);
});
test('Minimal turn usage host-backed dispatch injects the bridge-owned address and rejects a disconnected host',async()=>{
  const launcher={state:{},subscribe:()=>()=>{},start:async()=>({phase:'ready',auth:'authenticated',mainPid:1}),read:async(op)=>{assert.equal(op,'sendMinimalTask');return {taskId:'t9',workspacePath:'/scratch/workspace',prompt:MINIMAL_PROMPT,usageBefore:usage,tasksBefore:[],calls:[...MINIMAL_TURN_CALLS]}},dispose:async()=>{}};
  const host=new BridgeHost({authorityMode:'host-backed',launcher});
  try{await host.connect();const result=await host.runMinimalTurn();assert.deepEqual(result.address,{runtime:'zcode',authority:host.status.sessionAuthority,workspace:'/scratch/workspace',sessionId:'t9'})}finally{await host.dispose()}
  const disconnected=new BridgeHost({authorityMode:'host-backed',launcher});
  await assert.rejects(()=>disconnected.runMinimalTurn(),e=>e.code==='source-unavailable');
});
test('Minimal turn usage endpoint accepts no caller runtime command and maps official failures',async()=>{
  const value={taskId:'t1',workspacePath:'/w',address:{runtime:'zcode',authority:'a',workspace:'/w',sessionId:'t1'}};
  const host={runMinimalTurn:async()=>value};
  assert.deepEqual(await handleOwnTurn(host,{}),{ok:true,value});
  for(const payload of [{address:{}},{sessionId:'x'},[],'x',{taskId:'y'}])assert.equal((await handleOwnTurn(host,payload)).error.code,'invalid-payload');
  const failing={runMinimalTurn:async()=>{throw Object.assign(new Error('no'),{code:'live-http-read-unavailable'})}};
  assert.equal((await handleOwnTurn(failing,{})).error.code,'live-http-read-unavailable');
});
test('Minimal turn usage per-session usage readback is address-checked and rejects caller runtime commands',async()=>{
  const launcher={state:{},subscribe:()=>()=>{},start:async()=>({phase:'ready',auth:'authenticated',mainPid:1}),read:async(op,{address})=>{assert.equal(op,'taskUsage');return {address,usage:{modelRequestCount:2,totalTokens:42},at:1}},dispose:async()=>{}};
  const host=new BridgeHost({authorityMode:'host-backed',launcher});
  try{
    await host.connect();
    const address={runtime:'zcode',authority:host.status.sessionAuthority,workspace:'/scratch/workspace',sessionId:'t9'};
    assert.equal((await host.taskUsage(address)).usage.totalTokens,42);
    await assert.rejects(()=>host.taskUsage({...address,authority:'other'}),e=>e.code==='source-address-mismatch');
    await assert.rejects(()=>host.taskUsage({...address,workspace:''}),e=>e.code==='source-address-mismatch');
    const handler={taskUsage:async()=>({address,usage:{modelRequestCount:2,totalTokens:42},at:1})};
    assert.equal((await handleTaskUsage(handler,{address})).ok,true);
    for(const payload of [{},{address:null},[],'x',{address,extra:1}])assert.equal((await handleTaskUsage(handler,payload)).error.code,'invalid-payload');
  }finally{await host.dispose()}
});
