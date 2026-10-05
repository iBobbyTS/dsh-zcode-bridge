import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {EventEmitter} from 'node:events';import {createRequire} from 'node:module';import vm from 'node:vm';import {transformSync} from 'esbuild';
const require=createRequire(import.meta.url),tick=()=>new Promise(resolve=>setImmediate(resolve));
// Run the actual lifecycle owner in memory with configuration/profile preparation and spawn
// mocked. No protected Host/Electron or real HOME is used by this test.
function launcherFixture({ready=true}={}){
 const root=mkdtempSync(join(tmpdir(),'s04-launcher-')),configs=[],children=[];
 const configFace={fault:code=>Object.assign(Error(code),{code}),createLauncherConfig(options){return {runId:options.runId,runRoot:join(root,options.runId),mode:'route-b',executionNonce:'fixture-nonce-'+configs.length,env:{HOME:'/fixture/isolated-home'},cwd:root,paths:{workspace:root},landing:{mode:'route-b'}}},prepareLauncher(config){assert.equal(configs.some(old=>old.runRoot===config.runRoot),false,'each recovery needs a fresh run');mkdirSync(config.runRoot);configs.push(config);return config},sandboxProfile:()=>'(fixture sandbox profile)'};
 let source=readFileSync(new URL('../packages/host/launcher/index.mjs',import.meta.url),'utf8').replace(/import \{ createLauncherConfig, prepareLauncher, sandboxProfile, fault \} from '\.\/config.mjs';/, 'const {createLauncherConfig,prepareLauncher,sandboxProfile,fault}=configFace;');
 source=source.replaceAll('import.meta.url',JSON.stringify(new URL('../packages/host/launcher/index.mjs',import.meta.url).href)).replace("import.meta.resolve('zod')",JSON.stringify(import.meta.resolve('zod')));
 const mod={exports:{}};vm.runInThisContext('(function(require,module,exports,configFace,process){'+transformSync(source,{format:'cjs',target:'node22'}).code+'\n})')(require,mod,mod.exports,configFace,{platform:'darwin',kill(){throw Object.assign(Error('already reaped'),{code:'ESRCH'})}});
 const launcher=new mod.exports.HostLauncher({runId:'initial'},{spawnProcess(file,args,options){assert.equal(file,'/usr/bin/sandbox-exec');assert.equal(options.env.HOME,'/fixture/isolated-home');const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.stdin.end=()=>{if(!child.exited){child.exited=true;child.emit('close',0)}};children.push(child);setImmediate(()=>child.stdout.emit('data',JSON.stringify({type:'launcher-state',state:ready?{phase:'ready',auth:'authenticated',landings:{mode:'route-b'}}:{phase:'failed',reason:'mock-bootstrap-failure'}})+'\n'));return child}});
 return {launcher,configs,children,close:async()=>{await launcher.dispose();rmSync(root,{recursive:true,force:true})},tick};
}

test('S04 B05 production launcher can restart after an authenticated ready process exits, with fresh isolated run and unchanged spawn boundary',async()=>{
 const f=launcherFixture();try{assert.equal((await f.launcher.start()).phase,'ready');f.children[0].exited=true;f.children[0].emit('close',2);await f.tick();assert.equal(f.launcher.state.phase,'failed');const next=await f.launcher.start();assert.equal(next.phase,'ready');assert.equal(f.children.length,2);assert.notEqual(f.configs[0].runRoot,f.configs[1].runRoot);assert.notEqual(f.configs[0].executionNonce,f.configs[1].executionNonce)}finally{await f.close()}
});

test('S04 prior bootstrap failure keeps the existing Route-B retry guard; disposal never restarts',async()=>{
 const f=launcherFixture({ready:false});try{assert.equal((await f.launcher.start()).phase,'failed');f.children[0].exited=true;f.children[0].emit('close',2);await f.tick();assert.equal((await f.launcher.start()).reason,'route-b-retry-disabled');assert.equal(f.children.length,1);await f.launcher.dispose();await assert.rejects(f.launcher.start(),{code:'disposed'})}finally{await f.close()}
});
