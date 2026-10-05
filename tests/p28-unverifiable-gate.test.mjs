import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {decideSharedWrite,SharedWriteGate,usageActivity,BLIND_SPOT,DEFAULT_ACTIVITY_WINDOW_MS,MIN_ACTIVITY_WINDOW_MS,MAX_ACTIVITY_WINDOW_MS} from '../packages/host/launcher/write-gate.mjs';
import {createLauncherConfig} from '../packages/host/launcher/config.mjs';

const now=1000000,sessionId='target',target={sessionId};
const usage={sessionId,totalTokens:20,inputTokens:10,outputTokens:10,reasoningTokens:0,cacheCreationTokens:0,cacheReadTokens:0,modelRequestCount:2,modelErrorCount:0};
const terminal={taskId:sessionId,status:'completed',updatedAt:1};
function fixture({samples=[usage,usage],tasks=[terminal,terminal],owned=()=>false,confirmed=()=>false,windowMs=DEFAULT_ACTIVITY_WINDOW_MS}={}){
  let clock=100000,reads=0,taskReads=0,waits=0;
  const gate=new SharedWriteGate({readTask:async()=>tasks[Math.min(taskReads++,tasks.length-1)],readActivity:samples?async()=>samples[Math.min(reads++,samples.length-1)]:undefined,clock:()=>clock,isOwned:owned,isConfirmed:confirmed,windowMs,wait:async ms=>{waits++;clock+=ms}});
  return {gate,counts:()=>({reads,taskReads,waits})};
}
test('D4-a active and terminal tasks allow sending; own activity and confirmation never claim an official receipt',()=>{
  for(const [name,args,expected] of [
    ['other running',{task:{...terminal,status:'running',updatedAt:now},observedAt:now},['active','official-gui-active-turn',true,false]],
    ['terminal unverifiable',{task:terminal,observedAt:now},['unverifiable','shared-terminal-task-liveness-unverifiable',true,false]],
    ['operator confirmation is unnecessary',{task:terminal,observedAt:now,confirmed:true},['unverifiable','shared-terminal-task-liveness-unverifiable',true,false]],
    ['own busy',{task:terminal,observedAt:now,owned:true},['active','own-turn-busy',true,false]],
  ]){const r=decideSharedWrite({...args,now});assert.deepEqual([r.decision,r.reason,r.allowed,r.requiresConfirmation],expected,name);assert.equal(r.readOnlyOpen,true);assert.equal(r.kickOtherOwner,false);assert.equal(r.concurrencyWarning,'official-gui-may-be-running-session');assert.equal(r.receipt,undefined);}
  assert.equal(decideSharedWrite({task:terminal,observedAt:now,now}).blindSpot,BLIND_SPOT);
});
test('usage movement does not add a local admission lock or sampling delay',async()=>{
  const f=fixture({samples:[usage,{...usage,modelRequestCount:3}]});const r=await f.gate.preflight(target);
  assert.deepEqual([r.decision,r.allowed,r.requiresConfirmation],['unverifiable',true,false]);
  assert.deepEqual(f.counts(),{reads:0,taskReads:1,waits:0});
});
test('stationary usage cannot prove idle and is not required before sending',async()=>{
  const f=fixture({windowMs:8000});const r=await f.gate.preflight(target);
  assert.deepEqual([r.decision,r.allowed,r.requiresConfirmation],['unverifiable',true,false]);
  assert.equal(r.activity,undefined);assert.deepEqual(f.counts(),{reads:0,taskReads:1,waits:0});
});
test('official task metadata is refreshed on each proposed event with no local sampling window',async()=>{
  const f=fixture({tasks:[terminal,{...terminal,status:'running',updatedAt:100000}]});
  assert.equal((await f.gate.preflight(target)).decision,'unverifiable');const r=await f.gate.preflight(target);
  assert.deepEqual([r.decision,r.reason,r.allowed],['active','official-gui-active-turn',true]);
  assert.deepEqual(f.counts(),{reads:0,taskReads:2,waits:0});
});
test('unknown or old liveness does not block a confirmed official task',async()=>{
  for(const task of [{...terminal,status:'running'},{...terminal,status:undefined},{...terminal,updatedAt:NaN}]){
    const f=fixture({tasks:[task]});assert.equal((await f.gate.preflight(target)).allowed,true);
  }
});
test('usage readback still validates foreign and malformed counters; admission does not sample it',async()=>{
  for(const bad of [null,{...usage,sessionId:'another'},{...usage,modelRequestCount:NaN}]){
    assert.throws(()=>usageActivity(bad,sessionId),/activity-signal-invalid/);
    const f=fixture({samples:[usage,bad]});assert.equal((await f.gate.preflight(target)).allowed,true);assert.equal(f.counts().reads,0);
  }
});
test('own lease and operator confirmation cannot bypass official task identity/availability guards',async()=>{
  for(const opts of [{owned:()=>true},{confirmed:()=>true}]){
    for(const task of [null,{...terminal,deleted:true},{...terminal,taskId:'other'}]){
      const f=fixture({...opts,tasks:[task]});const r=await f.gate.preflight(target);
      assert.equal(r.allowed,false);assert.equal(r.requiresConfirmation,false);assert.deepEqual(f.counts(),{reads:0,taskReads:1,waits:0});
    }
  }
  const f=fixture({tasks:[{...terminal,workspacePath:'/official'}]});
  assert.equal((await f.gate.preflight({...target,workspace:'/other'})).reason,'official-task-address-mismatch');
  const broken=new SharedWriteGate({isOwned:()=>true,readTask:async()=>{throw Error('unavailable')}});
  assert.equal((await broken.preflight(target)).reason,'shared-task-signal-unavailable');
});
test('the activity window is configurable, bounded and deliberately shorter than 30 seconds',()=>{
  assert.equal(DEFAULT_ACTIVITY_WINDOW_MS,5000);assert.ok(MAX_ACTIVITY_WINDOW_MS<30000);
  for(const windowMs of [MIN_ACTIVITY_WINDOW_MS,MAX_ACTIVITY_WINDOW_MS])assert.equal(new SharedWriteGate({windowMs}).windowMs,windowMs);
  for(const windowMs of [0,MIN_ACTIVITY_WINDOW_MS-1,MAX_ACTIVITY_WINDOW_MS+1,30000,NaN])assert.throws(()=>new SharedWriteGate({windowMs}),/activity-window-invalid/);
  assert.equal(new SharedWriteGate({}).windowMs,DEFAULT_ACTIVITY_WINDOW_MS);
});
test('launcher config carries and validates the activity window',()=>{
  const root=mkdtempSync('/private/tmp/p28-');
  try{
    const options={scratchRoot:root,runId:'p28',artifactRoot:'/read-only/artifact',electronPath:'/read-only/electron',builtinConfig:'/read-only/builtin.json'};
    assert.equal(createLauncherConfig(options).activityWindowMs,DEFAULT_ACTIVITY_WINDOW_MS);
    assert.equal(createLauncherConfig({...options,activityWindowMs:8000}).activityWindowMs,8000);
    for(const activityWindowMs of [1000,MAX_ACTIVITY_WINDOW_MS+1,30000,NaN])assert.throws(()=>createLauncherConfig({...options,activityWindowMs}),/activity-window-invalid/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
