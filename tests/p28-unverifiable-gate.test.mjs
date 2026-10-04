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
test('four write-gate states: active, unverifiable, idle and own busy',()=>{
  for(const [name,args,expected] of [
    ['other running',{task:{...terminal,status:'running',updatedAt:now},observedAt:now},['active','official-gui-active-turn',false,false]],
    ['terminal unverifiable',{task:terminal,observedAt:now},['unverifiable','shared-terminal-task-liveness-unverifiable',false,true]],
    ['operator-confirmed terminal',{task:terminal,observedAt:now,confirmed:true},['idle','shared-terminal-task-operator-confirmed',true,false]],
    ['own busy',{owned:true},['active','own-turn-busy',false,false]],
  ]){const r=decideSharedWrite({...args,now});assert.deepEqual([r.decision,r.reason,r.allowed,r.requiresConfirmation],expected,name);assert.equal(r.readOnlyOpen,true);assert.equal(r.kickOtherOwner,false);}
  assert.equal(decideSharedWrite({task:terminal,observedAt:now,now}).blindSpot,BLIND_SPOT);
});
test('usage movement inside the bounded window blocks without a confirmation gate',async()=>{
  const f=fixture({samples:[usage,{...usage,modelRequestCount:3}]});const r=await f.gate.preflight(target);
  assert.deepEqual([r.decision,r.allowed,r.owner,r.reason,r.requiresConfirmation],['active',false,'other','official-session-usage-moved',false]);
  assert.deepEqual([r.activity.signal,r.activity.windowMs,r.activity.changed],['sessionUsage',DEFAULT_ACTIVITY_WINDOW_MS,['modelRequestCount']]);
});
test('stationary usage keeps the terminal session unverifiable instead of claiming idle',async()=>{
  const f=fixture({windowMs:8000});const r=await f.gate.preflight(target);
  assert.deepEqual([r.decision,r.allowed,r.requiresConfirmation,r.reason],['unverifiable',false,true,'shared-terminal-task-liveness-unverifiable']);
  assert.deepEqual(r.activity,{signal:'sessionUsage',windowMs:8000,changed:[]});
  assert.deepEqual(f.counts(),{reads:2,taskReads:2,waits:1});
});
test('task.updatedAt movement across the window is a positive activity signal',async()=>{
  const f=fixture({tasks:[terminal,{...terminal,updatedAt:2}]});const r=await f.gate.preflight(target);
  assert.deepEqual([r.decision,r.reason,r.allowed],['active','official-session-activity-moved',false]);
  assert.deepEqual(r.activity.changed,['updatedAt']);
});
test('a terminal task that turns running during the window is active',async()=>{
  const f=fixture({tasks:[terminal,{...terminal,status:'running',updatedAt:102000}]});const r=await f.gate.preflight(target);assert.equal(r.decision,'active');
});
test('malformed or foreign activity signal fails closed as unknown',async()=>{
  for(const bad of [null,{...usage,sessionId:'another'},{...usage,modelRequestCount:NaN}]){
    const f=fixture({samples:[usage,bad]});const r=await f.gate.preflight(target);assert.deepEqual([r.decision,r.allowed],['unknown',false],String(bad));
  }
  assert.throws(()=>usageActivity(null,sessionId),/activity-signal-invalid/);
});
test('our own lease and confirmed views short-circuit without sampling or waiting',async()=>{
  const owned=fixture({owned:()=>true});const ownResult=await owned.gate.preflight(target);
  assert.deepEqual([ownResult.decision,ownResult.owner,ownResult.allowed],['active','ours',false]);assert.deepEqual(owned.counts(),{reads:0,taskReads:0,waits:0});
  const confirmed=fixture({confirmed:()=>true});const confirmedResult=await confirmed.gate.preflight(target);
  assert.deepEqual([confirmedResult.decision,confirmedResult.allowed],['idle',true]);assert.deepEqual(confirmed.counts(),{reads:0,taskReads:1,waits:0});
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
