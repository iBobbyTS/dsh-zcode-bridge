import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BridgeHost} from '../packages/host/runtime.mjs';
import {BridgeError,inspectInstallation,runtimeEnv} from '../packages/host/installation.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
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
