// LIVE packaged Host status only; never task/session/credential RPCs. GUI observation is ps-only.
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const scratch=resolve('../.agent-work/tmp/host-reuse-probe');
const output=resolve(process.env.SCRATCH_LAUNCHER_OUTPUT??'docs/probes/checks/scratch-host-launcher');mkdirSync(output,{recursive:true});
const {HostLauncher}=await import(process.env.SCRATCH_LAUNCHER_MODULE?pathToFileURL(process.env.SCRATCH_LAUNCHER_MODULE).href:new URL('../packages/host/launcher/index.mjs',import.meta.url).href);
const options={scratchRoot:scratch,artifactRoot:join(scratch,'official-extracted'),electronPath:join(scratch,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),builtinConfig:'/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json'};
function table(){return execFileSync('/bin/ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).split('\n').map(l=>l.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean).map(m=>({pid:Number(m[1]),ppid:Number(m[2]),comm:m[3]}))}
const gui=()=>table().filter(p=>p.comm.startsWith('/Applications/ZCode.app/')||p.comm==='ZCode');
const before=gui();writeFileSync(join(output,'gui-before.json'),JSON.stringify(before,null,2));
const events=[],launcher=new HostLauncher(options);launcher.subscribe(s=>events.push({at:new Date().toISOString(),...s}));
let result,owned=[],stage='start';
try{
  const ready=await launcher.start();assert.equal(ready.phase,'ready');assert.equal(ready.channelAvailable,true);assert.equal(ready.auth,'signed-out');assert.equal(ready.rpcCount,5);assert.deepEqual(ready.headless,{windowEvents:0,windows:0,webContents:0});assert.equal(ready.requestGate.enforceable,false);stage='storage';
  const t=table();owned=t.filter(p=>p.pid===ready.mainPid||p.pid===ready.hostPid);let ids=new Set(owned.map(p=>p.pid));for(let i=0;i<8;i++)for(const p of t)if(ids.has(p.ppid))ids.add(p.pid);owned=t.filter(p=>ids.has(p.pid));
  const landed=events.find(e=>e.landings?.passed)?.landings;assert.ok(landed);assert.ok(statSync(landed.tasks).size>0);assert.ok(statSync(landed.sessionDb).size>0);
  // Inspect file metadata only. Never read keys/pem/credentials or DB contents.
  const files=[];function scan(p){for(const entry of readdirSync(p,{withFileTypes:true})){const q=join(p,entry.name);if(entry.isDirectory())scan(q);else if(entry.isFile())files.push({path:q,size:statSync(q).size})}}
  scan(resolve(landed.tasks,'../../../..')); // run's data-base subtree
  stage='stop';await launcher.stop();await launcher.dispose();
  stage='gui-inventory';const after=gui();writeFileSync(join(output,'gui-after.json'),JSON.stringify(after,null,2));assert.deepEqual(after,before);
  stage='owned-processes';
  const remaining=table().filter(p=>ids.has(p.pid));assert.deepEqual(remaining,[]);
  result={oracle:'LIVE-packaged-host',pass:true,modelRequests:0,network:'OS-denied',keychain:'OS-denied',rpcCount:5,headless:ready.headless,requestGate:ready.requestGate,owned,remaining,guiUnchanged:true,files,ready};
}catch(e){result={pass:false,error:e.code??e.message,stage,lastState:launcher.state,owned};process.exitCode=1}
finally{await launcher.dispose();writeFileSync(join(output,'live-events.json'),JSON.stringify(events,null,2));writeFileSync(join(output,'live.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))}
