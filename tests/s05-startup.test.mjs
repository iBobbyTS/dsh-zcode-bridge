import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,renameSync,existsSync,chmodSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {createLauncherConfig,assertLandings,sandboxProfile,prepareLauncher,fault} from '../packages/host/launcher/config.mjs';
import {BridgeHost} from '../packages/host/runtime.mjs';
import {statusText} from '../packages/client/status.mjs';

// Same bounded source harness as S04. Configuration/landings/profile and lifecycle are real;
// only preparation for successful boot and the owned child are mocked. No real Host is started.
function fixture({prepare,overrides={}}={}) {
 const root=mkdtempSync('/private/tmp/s5-'),configs=[],spawns=[],signals=[];
 const options={mode:'route-b',scratchRoot:root,runId:'boot',artifactRoot:resolve('packages/host'),electronPath:join(root,'Electron.app/Contents/MacOS/Electron'),builtinConfig:join(root,'builtin.json'),desktopHome:join(root,'desktop'),...overrides};
 const configFace={fault,createLauncherConfig,sandboxProfile,prepareLauncher:prepare??(config=>{const landing=assertLandings(config);mkdirSync(config.runRoot,{recursive:true});configs.push(config);return {...config,landing}})};
 let source=readFileSync(new URL('../packages/host/launcher/index.mjs',import.meta.url),'utf8').replace("import { createLauncherConfig, prepareLauncher, sandboxProfile, fault } from './config.mjs';",'const {createLauncherConfig,prepareLauncher,sandboxProfile,fault}=configFace;');
 source=source.replaceAll('import.meta.url',JSON.stringify(new URL('../packages/host/launcher/index.mjs',import.meta.url).href)).replace("import.meta.resolve('zod')",JSON.stringify(import.meta.resolve('zod')));
 const require=createRequire(import.meta.url),mod={exports:{}};
 vm.runInThisContext('(function(require,module,exports,configFace,process){'+transformSync(source,{format:'cjs',target:'node22'}).code+'\n})')(require,mod,mod.exports,configFace,{platform:'darwin',kill(pid,signal){signals.push({pid,signal});throw Object.assign(Error('mock group reaped'),{code:'ESRCH'})}});
 const launcher=new mod.exports.HostLauncher(options,{spawnProcess(file,args,options){
  spawns.push({file,args,options});const child=new EventEmitter();child.pid=54321;
  child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.stdin.end=()=>setImmediate(()=>child.emit('close',0));
  setImmediate(()=>child.stdout.emit('data',JSON.stringify({type:'launcher-state',state:{phase:'ready',auth:'authenticated',landings:assertLandings(configs.at(-1)),mainPid:54321}})+'\n'));
  return child;
 }});
 return {root,configs,spawns,signals,launcher,close:async()=>{await launcher.dispose();rmSync(root,{recursive:true,force:true})}};
}

test('S05 Route-B boots ready/authenticated with both SHA documents moved away and no ledger option',async()=>{
 const f=fixture();let host;
 try {
  // Public-document fixtures only. Move both names away before invoking production startup.
  const artifacts={};
  for(const [key,name] of [['s01','AUTH-PHASE2-S01.md'],['plan','PLAN-PHASE2.md']]){
   const path=join(f.root,name);writeFileSync(path,'synthetic retired operator document');
   artifacts[key]={path,sha256:'0'.repeat(64)};renameSync(path,path+'.moved');assert.equal(existsSync(path),false);
  }
  host=new BridgeHost({authorityMode:'host-backed',launcher:f.launcher});
  const state=await host.connect();assert.equal(state.connected,true);assert.equal(state.auth,'authenticated');
  assert.equal(f.launcher.state.phase,'ready');assert.equal(f.launcher.state.landings.mode,'route-b');
  assert.equal(f.spawns.length,1);const spawn=f.spawns[0],c=f.configs[0];
  assert.equal(spawn.file,'/usr/bin/sandbox-exec');assert.equal(spawn.options.detached,true);
  assert.equal(spawn.options.env.HOME,homedir());assert.deepEqual(spawn.options.env,c.runtimeProcessEnvPatch);
  assert.equal(spawn.options.cwd,c.paths.workspace);assert.equal(c.routeBArtifacts,undefined);
  const sb=readFileSync(spawn.args[1],'utf8');assert.ok(sb.includes('(deny file-read* (require-all (subpath '+JSON.stringify(homedir())+')'));
  assert.ok(sb.includes('(deny mach-lookup (global-name "com.apple.securityd" "com.apple.securityd.xpc"))'));
  for(const a of Object.values(artifacts))assert.equal(sb.includes(a.path),false);
  // Old profiles may still supply missing/damaged document fields. They are inert configuration.
  const legacy=createLauncherConfig({...f.launcher.options,routeBArtifacts:artifacts});assert.equal(assertLandings(legacy).mode,'route-b');
 } finally {await host?.dispose();await f.close()}
 assert.deepEqual(f.signals,[{pid:-54321,signal:'SIGTERM'},{pid:-54321,signal:'SIGKILL'}]);
});

test('S05 Route-B retains exact HOME/environment/cwd and all outside-run landing guards',()=>{
 const root=mkdtempSync('/private/tmp/s5iso-');try{
  const c=createLauncherConfig({mode:'route-b',scratchRoot:root,runId:'iso',artifactRoot:resolve('packages/host'),electronPath:join(root,'Electron.app/Contents/MacOS/Electron'),builtinConfig:join(root,'builtin.json'),desktopHome:join(root,'desktop')});
  for(const [name,path] of Object.entries(c.paths)){
   const bad=structuredClone(c);bad.paths[name]=join(root,'escaped',name);
   assert.throws(()=>assertLandings(bad),/route-b-landing-mismatch/,'landing '+name);
  }
  for(const source of ['env','runtimeProcessEnvPatch']){
   for(const key of Object.keys(c[source])){const bad=structuredClone(c);bad[source][key]='unexpected';assert.throws(()=>assertLandings(bad),/route-b-env-mismatch/,source+'.'+key)}
   const bad=structuredClone(c);bad[source].NODE_OPTIONS='preload';assert.throws(()=>assertLandings(bad),/route-b-env-mismatch/);
  }
  for(const key of ['cwd','agentSpawnFallbackCwd']){const bad=structuredClone(c);bad[key]=root;assert.throws(()=>assertLandings(bad),/landing-cwd-mismatch/)}
  const sb=sandboxProfile(c,resolve('packages/host'),resolve('node_modules/zod'));
  const officialRoots=[join(homedir(),'.zcode/v2'),join(homedir(),'.zcode/cli'),join(c.routeB.desktopHome,'.zcode/v2')];
  assert.equal(sb.split('\n').find(line=>line.startsWith('(deny file-write* ')),`(deny file-write* (require-all (require-not (subpath ${[c.runRoot,...officialRoots].map(JSON.stringify).join(' ')})) (require-not (subpath "/dev"))))`);
  assert.ok(sb.includes(`(deny file-read* file-write* (subpath ${JSON.stringify(join(homedir(),'Library/Keychains'))} "/Library/Keychains"))`));
  assert.ok(sb.includes('(deny mach-lookup (global-name "com.apple.securityd" "com.apple.securityd.xpc"))'));
 }finally{rmSync(root,{recursive:true,force:true})}
});

for(const [code,overrides] of [
 ['launcher-config-required',{scratchRoot:17}],['launcher-mode-invalid',{mode:'invalid'}],
 ['route-b-desktop-home-invalid',{desktopHome:'relative'}],['route-b-shared-probe-denied',{sharedDatabaseRoot:'/outside'}],
 ['route-b-temp-socket-path-too-long',{runId:'x'.repeat(100)}],
])test('S05 configuration failure publishes '+code+' before spawn',async()=>{
 const f=fixture({overrides});try{const host=new BridgeHost({authorityMode:'host-backed',launcher:f.launcher});try{
  const state=await host.connect();assert.equal(state.connected,false);assert.equal(state.reason,code);assert.equal(f.spawns.length,0);
  assert.equal(f.launcher.state.landings.passed,false);
 }finally{await host.dispose()}}finally{await f.close()}
});

for(const code of ['helper-missing','provider-config-missing','runtime-missing','official-host-missing','official-host-subtree-mismatch'])test('S05 missing/incompatible installation fails explicitly before scratch creation: '+code,()=>{
 const root=mkdtempSync('/private/tmp/s5inst-');try{
  const options={mode:'route-b',scratchRoot:root,runId:'install',artifactRoot:join(root,'official-extracted'),electronPath:join(root,'electron'),builtinConfig:join(root,'builtin.json')};
  if(code!=='helper-missing'){writeFileSync(options.electronPath,'mock executable');chmodSync(options.electronPath,0o700)}
  if(!['helper-missing','provider-config-missing'].includes(code))writeFileSync(options.builtinConfig,'{}');
  if(['official-host-missing','official-host-subtree-mismatch'].includes(code)){
   mkdirSync(join(root,'bundled-resources/glm'),{recursive:true});writeFileSync(join(root,'bundled-resources/glm/zcode.cjs'),'mock unsupported runtime');
   if(code==='official-host-subtree-mismatch'){
    const identity=JSON.parse(readFileSync(new URL('../packages/host/launcher/official-host-identity.json',import.meta.url),'utf8'));
    const path=join(options.artifactRoot,identity.files[0].path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,'incompatible official subtree');
   }
  }
  const c=createLauncherConfig(options);assert.throws(()=>prepareLauncher(c),{code});assert.equal(existsSync(c.runRoot),false);
  assert.notEqual(statusText({reason:code}),'Unavailable: connection state is unconfirmed');
 }finally{rmSync(root,{recursive:true,force:true})}
});
