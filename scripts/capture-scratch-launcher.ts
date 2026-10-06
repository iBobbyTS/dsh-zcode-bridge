// Clean DSH profile installation → installed launcher LIVE status → stop → uninstall.
import { runProfilePnpm } from '../../dsh/packages/boot/plugin-manager/src/operations.ts';
import { cp, mkdir, mkdtemp, writeFile, readFile, access, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve,join } from 'node:path';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
const scratch=resolve('../.agent-work/tmp/host-reuse-probe');
const output=resolve(process.env.SCRATCH_LAUNCHER_OUTPUT??'docs/probes/checks/scratch-host-launcher/installed');await mkdir(output,{recursive:true});
const source=await mkdtemp(resolve(scratch,'scratch-package-')),profile=await mkdtemp(resolve(scratch,'scratch-profile-'));
const context={profile:'scratch-isolated',dir:profile,installAnchor:resolve('../dsh/apps/cli/package.json'),cwd:resolve('.')};
const exists=async(p:string)=>{try{await access(p);return true}catch{return false}};
const result:any={oracle:'LIVE-DSH-profile-installed-launcher',source,profile};
const installerHome=join(profile,'installer-home');await mkdir(installerHome,{recursive:true});
const userConfig=join(installerHome,'.npmrc');await writeFile(userConfig,'');
const installerEnv={HOME:installerHome,USERPROFILE:installerHome,PATH:'/usr/bin:/bin:/usr/sbin:/sbin',XDG_CONFIG_HOME:join(installerHome,'config'),XDG_DATA_HOME:join(installerHome,'data'),XDG_STATE_HOME:join(installerHome,'state'),XDG_CACHE_HOME:join(installerHome,'cache'),PNPM_HOME:join(installerHome,'pnpm'),npm_config_cache:join(installerHome,'npm-cache'),npm_config_userconfig:userConfig,npm_config_globalconfig:userConfig};
result.installerIsolation={env:installerEnv,store:join(profile,'pnpm-store'),ignoreScripts:true};
const run=async(args:string[])=>{const r=await runProfilePnpm(context as never,['--store-dir='+join(profile,'pnpm-store'),...args] as never,{command:process.execPath,args:[resolve('../dsh/node_modules/pnpm/bin/pnpm.cjs')],env:installerEnv,execution:'service',outputBytes:10000,idleTimeoutMs:120000} as never);return {exitCode:r.exitCode,truncated:r.truncated}};
try{
  await cp(resolve('packages'),resolve(source,'packages'),{recursive:true,filter:p=>!p.includes('node_modules')&&!p.endsWith('.DS_Store')});
  for(const f of ['package.json','cordis.patch.yml','bridge-bundle.json'])await cp(resolve(f),resolve(source,f));
  await writeFile(resolve(profile,'package.json'),JSON.stringify({name:'scratch-isolated',private:true,packageManager:'pnpm@11.7.0',dsh:{profile:{bundles:[]}}}));
  result.install=await run(['add','--ignore-scripts',...['', '/packages/host','/packages/client'].map(p=>'file:'+source+p)]);
  const entry=resolve(profile,'node_modules/@dsh-zcode/host/launcher/index.mjs');result.installedEntry=await exists(entry);
  if(result.install.exitCode!==0||!result.installedEntry)throw Error('install-failed');
  const hostManifest=JSON.parse(await readFile(resolve(profile,'node_modules/@dsh-zcode/host/package.json'),'utf8'));
  result.dependency={declaredZod:hostManifest.dependencies?.zod,resolved:createRequire(realpathSync(entry)).resolve('zod')};
  if(result.dependency.declaredZod!=='4.6.5')throw Error('host-zod-dependency-missing');
  const live=await promisify(execFile)(process.execPath,['scripts/check-scratch-launcher.mjs'],{env:{...process.env,SCRATCH_LAUNCHER_OUTPUT:output,SCRATCH_LAUNCHER_MODULE:entry},maxBuffer:2*1024*1024,timeout:60000});
  await writeFile(resolve(output,'launcher.log'),live.stdout);result.lifecycle=JSON.parse(await readFile(resolve(output,'live.json'),'utf8'));
  const dsh=await promisify(execFile)(process.execPath,['../dsh/node_modules/tsx/dist/cli.mjs','--tsconfig','../dsh/tsconfig.base.json','scripts/check-scratch-dsh.ts'],{env:{...process.env,SCRATCH_LAUNCHER_OUTPUT:output,SCRATCH_HOST_MODULE:resolve(profile,'node_modules/@dsh-zcode/host/index.mjs')},maxBuffer:2*1024*1024,timeout:60000});
  await writeFile(resolve(output,'dsh-live.log'),dsh.stdout);result.dsh=JSON.parse(await readFile(resolve(output,'dsh-live.json'),'utf8'));
  result.uninstall=await run(['remove','@dsh-zcode/bridge','@dsh-zcode/host','@dsh-zcode/bridge-client']);
  result.remaining=await exists(resolve(profile,'node_modules/@dsh-zcode/host'));
  result.pass=result.lifecycle.pass&&result.dsh.pass&&result.uninstall.exitCode===0&&!result.remaining;
}catch(e:any){result.pass=false;result.error=e.code??e.message;result.bootstrapDiagnostic=String(e.stderr??'').split('\n').filter((l:string)=>/Error|ERR_|Cannot|TransformError|Expected/.test(l)).map((l:string)=>l.slice(0,800));process.exitCode=1}
finally{
  // Local files only; the official artifacts and run DBs remain untouched for evidence.
  await writeFile(resolve(output,'profile-roundtrip.json'),JSON.stringify(result,null,2));
  if(result.pass||!process.env.SCRATCH_KEEP_FAILURE){await rm(source,{recursive:true,force:true});await rm(profile,{recursive:true,force:true});}
  console.log(JSON.stringify({pass:result.pass,error:result.error,install:result.install,uninstall:result.uninstall,remaining:result.remaining}));
}
