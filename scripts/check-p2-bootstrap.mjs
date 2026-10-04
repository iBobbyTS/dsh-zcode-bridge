// LIVE Electron fault injection. Native dialog calls are trapped and counted in the fixture,
// so a regression itself cannot disturb the user. Production bootstrap is copied unchanged
// except for that observation hook; every error still passes through its real handlers.
import { spawn } from 'node:child_process';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { createLauncherConfig,prepareLauncher,sandboxProfile } from '../packages/host/launcher/config.mjs';
import assert from 'node:assert/strict';
const scratch=resolve('../.agent-work/tmp/host-reuse-probe'),output=resolve('docs/probes/checks/host-launcher-s02/bootstrap');mkdirSync(output,{recursive:true});
const options={scratchRoot:scratch,artifactRoot:join(scratch,'official-extracted'),electronPath:join(scratch,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),builtinConfig:'/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json'};
const rows=[];
for(const [name,code] of [['zod-module-missing',"import './host-bus.mjs';"],['uncaught',"setImmediate(()=>{throw Object.assign(new Error('synthetic'),{code:'S02_SYNTHETIC_CRASH'})});"],['rejection',"Promise.reject(Object.assign(new Error('synthetic'),{code:'S02_SYNTHETIC_REJECTION'}));"]]){
  const config=prepareLauncher(createLauncherConfig(options));
  const bootstrap=readFileSync('packages/host/launcher/bootstrap.cjs','utf8').replace("let windowEvents=0", "let dialogCalls=0;require('electron').dialog.showErrorBox=()=>{dialogCalls++};\nlet windowEvents=0").replace('headless:{windowEvents','headless:{dialogCalls,windowEvents');
  writeFileSync(join(config.runRoot,'bootstrap.cjs'),bootstrap);writeFileSync(join(config.runRoot,'main.mjs'),code);
  if(name==='zod-module-missing')writeFileSync(join(config.runRoot,'host-bus.mjs'),readFileSync('packages/host/launcher/host-bus.mjs'));
  const profile=join(config.runRoot,'crash.sb');writeFileSync(profile,sandboxProfile(config,config.runRoot,resolve('node_modules/zod')));
  const child=spawn('/usr/bin/sandbox-exec',['-f',profile,config.electronPath,join(config.runRoot,'bootstrap.cjs'),join(config.runRoot,'launcher.json')],{cwd:config.cwd,env:config.env,stdio:['ignore','pipe','pipe'],detached:true});let text='';child.stdout.on('data',b=>text+=b.toString());child.stderr.on('data',()=>{});
  let timer;const exit=await Promise.race([new Promise(r=>child.once('close',(exitCode,signal)=>r({exitCode,signal}))),new Promise(r=>timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL')}catch{}r({exitCode:null,timeout:true})},10000))]);clearTimeout(timer);
  const state=text.split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).find(m=>m?.type==='launcher-state')?.state;
  try{process.kill(-child.pid,'SIGKILL')}catch(e){if(e.code!=='ESRCH')throw e}
  const row={name,...exit,state,modelRequests:0};rows.push(row);
  assert.equal(exit.exitCode,2);assert.equal(state.bootstrapFailure,true);assert.deepEqual(state.headless,{dialogCalls:0,windowEvents:0,windows:0,webContents:0});if(name==='zod-module-missing')assert.equal(state.reason,'ERR_MODULE_NOT_FOUND');
}
writeFileSync(join(output,'results.json'),JSON.stringify({pass:true,oracle:'LIVE-Electron-bootstrap-fault-injection',rows},null,2));console.log(JSON.stringify({pass:true,cases:rows.length}));
