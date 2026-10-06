import { runProfilePnpm } from '../../dsh/packages/boot/plugin-manager/src/operations.ts'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const dir=await mkdtemp(resolve(tmpdir(),'install-probe-profile-'));
try {
 await writeFile(resolve(dir,'package.json'),JSON.stringify({name:'install-probe-profile',private:true,packageManager:'pnpm@11.7.0',dsh:{profile:{bundles:[]}}}));
 const result=await runProfilePnpm({profile:'install-probe',dir,installAnchor:resolve('../dsh/apps/cli/package.json'),cwd:resolve('.')},['add','--ignore-scripts','file:'+resolve('.'),'file:'+resolve('packages/host'),'file:'+resolve('packages/client')],{execution:'service',outputBytes:6000,idleTimeoutMs:60000});
 console.log(result.output);console.log(JSON.stringify({oracle:'real-plugin-manager-install',exitCode:result.exitCode}));
 if(result.exitCode!==0)process.exitCode=1;
 else {await readFile(resolve(dir,'node_modules/@dsh-zcode/bridge-client/lib/client.js'));await readFile(resolve(dir,'node_modules/@dsh-zcode/host/index.mjs'));const installedHost=await import(pathToFileURL(resolve(dir,'node_modules/@dsh-zcode/host/runtime.mjs')).href);if(typeof installedHost.BridgeHost!=='function')throw Error('Installed Host import failed');await readFile(resolve(dir,'node_modules/@dsh-zcode/host/vendor/zcode/LICENSE'));console.log(JSON.stringify({artifacts:'host/client exports and installed V4 schema dependency import validated',bundles:JSON.parse(await readFile(resolve(dir,'package.json'),'utf8')).dsh.profile.bundles}));}
}finally{await rm(dir,{recursive:true,force:true})}
