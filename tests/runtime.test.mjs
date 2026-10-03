import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BridgeHost} from '../packages/host/runtime.mjs';
import {BridgeError,inspectInstallation,runtimeEnv} from '../packages/host/installation.mjs';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {batchFaultChild,batchFaultInstallation} from './fixtures/batch-fault.mjs';
const installation={launcher:process.execPath,cjs:'fake',providerConfig:'fake',verified:true};
test('install missing, helper missing and unsupported platform remain distinguishable',async()=>{
 await assert.rejects(inspectInstallation('/missing-zcode.app'),{code:'installation-missing'});
 await assert.rejects(inspectInstallation('/missing',{platform:'linux'}),{code:'unsupported-platform'});
 for(const code of ['installation-missing','helper-missing']){const h=new BridgeHost({inspect:async()=>{throw new BridgeError(code)}});assert.equal((await h.connect()).reason,code);await h.dispose()}
 assert.equal(runtimeEnv('file').ELECTRON_RUN_AS_NODE,'1');assert.equal(Object.keys(runtimeEnv('file')).some(x=>/TOKEN|API_KEY|AUTH/.test(x)),false);
});
test('dispose during installation prevents child launch',async()=>{
 let resolve;const probe=new Promise(r=>resolve=r);let spawned=false;
 const h=new BridgeHost({workspacePath:tmpdir(),inspect:()=>probe,spawnProcess:()=>{spawned=true}});const connecting=h.connect();const closing=h.dispose();resolve(installation);await connecting;await closing;assert.equal(spawned,false);assert.equal(h.status.reason,'disposed');
});
test('failed spawn releases pending and has deterministic unavailable state',async()=>{
 const h=new BridgeHost({workspacePath:tmpdir(),inspect:async()=>installation,spawnProcess:()=>spawn('/nonexistent-s01-helper',[],{stdio:['pipe','pipe','pipe']})});
 assert.equal((await h.connect()).state,'unavailable');await h.dispose();
});
test('owned process EOF cleanup preserves an unrelated process',async()=>{
 const unrelated=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 const h=new BridgeHost({workspacePath:tmpdir(),inspect:async()=>installation,spawnProcess:()=>spawn(process.execPath,['-e',`let b='';process.stdin.on('data',c=>{b+=c;let n;while((n=b.indexOf('\\n'))>=0){const m=JSON.parse(b.slice(0,n));b=b.slice(n+1);process.stdout.write(JSON.stringify({id:m.id,result:m.method==='runtime/capabilities'?{independentPlanState:true}:{sessions:[]}})+'\\n')}});process.stdin.on('end',()=>process.exit(0));`],{stdio:['pipe','pipe','pipe']})});
 try{const [a,b]=await Promise.all([h.connect(),h.connect()]);assert.equal(a.pid,b.pid);assert.equal(a.state,'restricted');assert.equal(a.auth,'unavailable');await h.dispose();process.kill(unrelated.pid,0);assert.equal(h.status.connected,false)}finally{unrelated.kill();await h.dispose()}
});

test('metadata validates helper absence on a real filesystem fixture',async()=>{
 const root=await mkdtemp(join(tmpdir(),'s01-missing-helper-'));const app=join(root,'ZCode.app');
 try{await mkdir(join(app,'Contents'),{recursive:true});await writeFile(join(app,'Contents/Info.plist'),'<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>dev.zcode.app</string><key>CFBundleShortVersionString</key><string>3.14.4</string><key>CFBundleVersion</key><string>3.14.4.7912</string></dict></plist>');await assert.rejects(inspectInstallation(app),{code:'helper-missing'})}finally{await rm(root,{recursive:true,force:true})}
});

test('CB-1: same-batch valid response and bad frame preserve terminal state and await cleanup',async()=>{
 for(const failOn of ['session/list','runtime/capabilities']){
  const fixture=batchFaultChild(failOn),statuses=[];
  const host=new BridgeHost({workspacePath:tmpdir(),inspect:async()=>batchFaultInstallation,spawnProcess:()=>fixture.child,onStatus:status=>statuses.push(status)});
  let settled=false;
  const connecting=host.connect();connecting.then(()=>{settled=true});
  try{
   await fixture.eof;
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(host.status.connected,false);
   assert.equal(host.status.reason,'protocol-invalid');
   assert.equal(settled,false,'connect must wait for the owned child cleanup barrier');
   fixture.finishClose();
   const result=await connecting;
   assert.equal(result.connected,false);
   assert.equal(result.state,'unavailable');
   assert.equal(result.reason,'protocol-invalid');
   assert.equal(statuses.some(status=>status.connected),false);
   assert.equal(fixture.requests.some(request=>request.method==='session/close'),false);
  }finally{fixture.finishClose();await connecting;await host.dispose()}
 }
});
test('S03.A Host conversation scope stays restricted and owned disposal closes projection API',async()=>{
 const fixture=batchFaultChild('never'),host=new BridgeHost({workspacePath:tmpdir(),inspect:async()=>batchFaultInstallation,spawnProcess:()=>fixture.child});
 try{
  const status=await host.connect();assert.equal(status.connected,true);
  const address={runtime:'zcode',authority:status.sessionAuthority,workspace:status.workspacePath,sessionId:'scope'};
  assert.throws(()=>host.createConversation({...address,authority:'foreign'}),{code:'source-address-mismatch'});
  const conversation=host.createConversation(address);assert.equal(conversation.admission.allowed,false);
  await assert.rejects(conversation.submit({type:'sendText',payload:{text:'never'}}),{code:'runtime-restricted'});
  const disposing=host.dispose();fixture.finishClose();await disposing;assert.equal(conversation.state.status,'closed');assert.equal(conversation.admission.allowed,false);
 }finally{fixture.finishClose();await host.dispose()}
});
test('CA3-2 same-session Host instances occupy distinct server slots and reconnect replaces only their own slot',async()=>{
 const source=JSON.parse(await readFile(new URL('./fixtures/s03a/success.json',import.meta.url)));
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
 const slots=new Map(),requests=[];let serial=0,seq=0;
 const route=p=>JSON.stringify([p.connectionId,p.topic]);
 const notification=params=>({method:'v4/conversation/frame',params});
 const snapshot=slot=>{
  const wire=structuredClone(source.initial);wire.subscriptionId=wire.frame.subscriptionId=slot.id;wire.topic=wire.frame.topic=slot.topic;wire.logicalFrameId=slot.id+'-initial';
  wire.frame.toSeq=wire.frame.payload.snapshot.seq=seq;wire.frame.payload.snapshot.sessionId='same-session';return wire;
 };
 child.stdin.on('data',buffer=>{
  const request=JSON.parse(buffer);requests.push(request);let result,frame;
  if(request.method==='runtime/capabilities')result={independentPlanState:true};
  else if(request.method==='session/list')result={sessions:[]};
  else if(request.method==='v4/conversation/subscribe'){
   // Official publisher owns one replaceable slot per (connectionId, topic).
   const slot={id:'subscription-'+ ++serial,topic:request.params.topic,connectionId:request.params.connectionId,ordinal:1};slots.set(route(request.params),slot);
   result={ack:{...source.ack.ack,subscriptionId:slot.id}};frame=snapshot(slot);
  }else if(request.method==='v4/conversation/unsubscribe'){
   const key=route(request.params);if(slots.get(key)?.id===request.params.subscriptionId)slots.delete(key);result={};
  }else throw Error('Unexpected request '+request.method);
  child.stdout.write(JSON.stringify({id:request.id,result})+'\n'+(frame?JSON.stringify(notification(frame))+'\n':''));
 });
 child.stdin.once('finish',()=>{child.stdout.end();child.stderr.end();child.emit('close',0)});
 child.kill=()=>{throw Error('Fixture must exit through stdin EOF')};
 const broadcast=()=>{
  const fromSeq=seq++;
  for(const slot of slots.values()){
   const wire=structuredClone(source.online);wire.subscriptionId=wire.frame.subscriptionId=slot.id;wire.topic=wire.frame.topic=slot.topic;
   wire.logicalFrameOrdinal=++slot.ordinal;wire.logicalFrameId=slot.id+'-'+slot.ordinal;wire.frame.fromSeq=fromSeq;wire.frame.toSeq=seq;child.stdout.write(JSON.stringify(notification(wire))+'\n');
  }
 };
 const host=new BridgeHost({workspacePath:tmpdir(),inspect:async()=>batchFaultInstallation,spawnProcess:()=>child});
 try{
  const status=await host.connect();const address={runtime:'zcode',authority:status.sessionAuthority,workspace:status.workspacePath,sessionId:'same-session'};
  const left=host.createConversation(address),right=host.createConversation(address);
  await left.connect();await right.connect();assert.equal(slots.size,2,'the second instance must not replace the first instance');
  assert.notEqual(left.connectionId,right.connectionId);const leftConnection=left.connectionId,rightConnection=right.connectionId;
  broadcast();assert.equal(left.state.snapshot.seq,1);assert.equal(right.state.snapshot.seq,1);
  const previousLeft=left.state.subscriptionId,previousRight=right.state.subscriptionId;
  await left.connect();assert.equal(left.connectionId,leftConnection);assert.equal(right.connectionId,rightConnection);assert.equal(slots.size,2);
  assert.notEqual(left.state.subscriptionId,previousLeft);assert.equal(right.state.subscriptionId,previousRight);assert.equal([...slots.values()].some(x=>x.id===previousLeft),false);
  broadcast();assert.equal(left.state.snapshot.seq,2);assert.equal(right.state.snapshot.seq,2);
  await right.connect();assert.equal(right.connectionId,rightConnection);assert.equal(slots.size,2);broadcast();assert.equal(left.state.snapshot.seq,3);assert.equal(right.state.snapshot.seq,3);
  await left.cancel();assert.equal(slots.size,1);broadcast();assert.equal(right.state.snapshot.seq,4);await right.cancel();assert.equal(slots.size,0);
  assert.equal(requests.some(x=>x.method==='session/close'),false);
 }finally{await host.dispose()}
});
