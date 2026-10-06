import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';import {homedir} from 'node:os';import {join} from 'node:path';import {createHash,randomBytes} from 'node:crypto';import {createLauncherConfig,assertLandings,sandboxProfile,fault} from '../packages/host/launcher/config.mjs';import {EventEmitter} from 'node:events';import {createRequire} from 'node:module';import vm from 'node:vm';import {transformSync} from 'esbuild';
const require=createRequire(import.meta.url),tick=()=>new Promise(resolve=>setImmediate(resolve));
// Run the actual lifecycle owner with REAL configuration/landing/socket validation and profile
// generation. Only artifact preparation and process spawn are mocked; no protected Host is launched.
function launcherFixture({ready=true}={}){
 const root=mkdtempSync('/private/tmp/launcher-recovery-'),configs=[],children=[];
 const configFace={fault,createLauncherConfig,sandboxProfile,prepareLauncher(config){
  const landing=assertLandings(config);assert.equal(landing.mode,'live-http');
  assert.ok(Buffer.byteLength(join(config.paths.temp,'znr-00000000-0000-0000-0000-000000000000.sock'))<=103);
  assert.equal(configs.some(old=>old.runRoot===config.runRoot),false,'each recovery needs a fresh run');
  mkdirSync(config.runRoot,{recursive:true});configs.push(config);return {...config,landing};
 }};
 let source=readFileSync(new URL('../packages/host/launcher/index.mjs',import.meta.url),'utf8').replace(/import \{ createLauncherConfig, prepareLauncher, sandboxProfile, fault \} from '\.\/config.mjs';/, 'const {createLauncherConfig,prepareLauncher,sandboxProfile,fault}=configFace;');
 source=source.replaceAll('import.meta.url',JSON.stringify(new URL('../packages/host/launcher/index.mjs',import.meta.url).href)).replace("import.meta.resolve('zod')",JSON.stringify(import.meta.resolve('zod')));
 const mod={exports:{}};vm.runInThisContext('(function(require,module,exports,configFace,process){'+transformSync(source,{format:'cjs',target:'node22'}).code+'\n})')(require,mod,mod.exports,configFace,{platform:'darwin',kill(){throw Object.assign(Error('already reaped'),{code:'ESRCH'})}});
 const launcher=new mod.exports.HostLauncher({scratchRoot:'/private/tmp/dshw/ls',runId:'t-'+randomBytes(4).toString('hex'),mode:'live-http',artifactRoot:new URL('../packages/host',import.meta.url).pathname,electronPath:join(root,'Electron.app/Contents/MacOS/Electron'),builtinConfig:join(root,'builtin.json'),desktopHome:join(root,'desktop')},{spawnProcess(file,args,options){assert.equal(file,'/usr/bin/sandbox-exec');assert.equal(options.env.HOME,homedir());assert.deepEqual(options.env,configs.at(-1).runtimeProcessEnvPatch);const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.stdin.end=()=>{if(!child.exited){child.exited=true;child.emit('close',0)}};children.push(child);setImmediate(()=>child.stdout.emit('data',JSON.stringify({type:'launcher-state',state:ready?{phase:'ready',auth:'authenticated',landings:{mode:'live-http'}}:{phase:'failed',reason:'mock-bootstrap-failure'}})+'\n'));return child}});
 return {launcher,configs,children,close:async()=>{await launcher.dispose();for(const config of configs)rmSync(config.runRoot,{recursive:true,force:true});rmSync(root,{recursive:true,force:true})},tick};
}

test('Production launcher can restart after an authenticated ready process exits, with fresh isolated run and unchanged spawn boundary',async()=>{
 const f=launcherFixture();try{const initial=await f.launcher.start();assert.equal(initial.phase,'ready',initial.reason);f.children[0].exited=true;f.children[0].emit('close',2);await f.tick();assert.equal(f.launcher.state.phase,'failed');const next=await f.launcher.start();assert.equal(next.phase,'ready',next.reason);assert.equal(f.children.length,2);assert.notEqual(f.configs[0].runRoot,f.configs[1].runRoot);assert.notEqual(f.configs[0].executionNonce,f.configs[1].executionNonce)}finally{await f.close()}
});

test('Prior bootstrap failure keeps the existing live-http retry guard; disposal never restarts',async()=>{
 const f=launcherFixture({ready:false});try{assert.equal((await f.launcher.start()).phase,'failed');f.children[0].exited=true;f.children[0].emit('close',2);await f.tick();assert.equal((await f.launcher.start()).reason,'live-http-retry-disabled');assert.equal(f.children.length,1);await f.launcher.dispose();await assert.rejects(f.launcher.start(),{code:'disposed'})}finally{await f.close()}
});

test('Recovery IDs fit the REAL validator at the production root and exactly at the socket budget',async()=>{
 const f=launcherFixture();try{
  const {recoveryRunId}=await import('../packages/host/launcher/index.mjs');
  const socket='znr-00000000-0000-0000-0000-000000000000.sock';
  assert.throws(()=>createLauncherConfig({...f.launcher.options,runId:'recovery-00000000-0000-0000-0000-000000000000'}),{code:'live-http-temp-socket-path-too-long'});
  const runId=recoveryRunId('/private/tmp/dshw/ls');const config=createLauncherConfig({...f.launcher.options,runId});assert.equal(assertLandings(config).mode,'live-http');assert.equal(Buffer.byteLength(join(config.paths.temp,socket)),92);
  const rootLength=103-(Buffer.byteLength(join('/','runs','x','tmp',socket))-1)-4;
  const tightRoot='/private/tmp/'+'x'.repeat(rootLength-Buffer.byteLength('/private/tmp/'));
  const tightId=recoveryRunId(tightRoot);assert.equal(tightId.length,4);const tight=createLauncherConfig({...f.launcher.options,scratchRoot:tightRoot,runId:tightId});assert.equal(assertLandings(tight).mode,'live-http');assert.equal(Buffer.byteLength(join(tight.paths.temp,socket)),103);
  assert.throws(()=>recoveryRunId(tightRoot+'xxxx'),{code:'live-http-temp-socket-path-too-long'});
 }finally{await f.close()}
});
