// Persistent operator review server. DSH profile isolated; only the official Host uses real HOME.
import {mkdirSync,writeFileSync,readFileSync,symlinkSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyRouteBArtifacts} from '../packages/host/launcher/route-b.mjs';
const repo=resolve('.'),parent=resolve('..'),root=join(parent,'.agent-work/tmp/s03-p2-web'),dshHome=join(root,'dsh-home'),profile=join(dshHome,'profiles/web');
const artifacts=Object.fromEntries(Object.entries({s01:join(repo,'docs/probes/AUTH-PHASE2-S01.md'),plan:join(parent,'.agent-work/PLAN-PHASE2.md')}).map(([k,path])=>[k,{path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}]));
verifyRouteBArtifacts(artifacts);
for(const p of [profile,join(profile,'node_modules/@dsh-zcode'),join(root,'workspace')])mkdirSync(p,{recursive:true});
for(const [name,path] of Object.entries({bridge:repo,host:join(repo,'packages/host'),'bridge-client':join(repo,'packages/client')})){const target=join(profile,'node_modules/@dsh-zcode',name);if(!existsSync(target))symlinkSync(path,target,'dir');}
writeFileSync(join(profile,'package.json'),JSON.stringify({name:'s03-route-b-web',private:true,dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','@dsh-zcode/bridge']}}},null,2));
writeFileSync(join(profile,'cordis.yml'),'[]\n');
const base=join(parent,'.agent-work/tmp/host-reuse-probe');
const launcher={mode:'route-b',routeBArtifacts:artifacts,scratchRoot:'/private/tmp/s3web',runId:'web-'+Date.now().toString(36),artifactRoot:join(base,'official-extracted'),electronPath:join(base,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),builtinConfig:'/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json'};
// JSON is valid YAML; IDs merge into the existing owning plugins, no second native agent.
writeFileSync(join(profile,'cordis.patch.yml'),JSON.stringify([{id:'zcode-bridge-host',config:{authorityMode:'host-backed',launcher}},{id:'ui-settings-general',name:'@deepseek-ai/dsh-client-ui-settings-general',config:{welcomeNoticeVersion:'2026-09-28.1'}}],null,2));
const env={...process.env,DSH_HOME:dshHome};
console.log(JSON.stringify({dshHome,profile,cwd:join(root,'workspace'),baseURL:'http://127.0.0.1:3092',HOME:env.HOME,ZCODE_DESKTOP_HOME_DIR:env.ZCODE_DESKTOP_HOME_DIR??null,nativeModelRequests:'none initiated',zcode:'read-only-s03; Connect then Refresh sidebar'}));
const child=spawn(process.execPath,[join(parent,'dsh/apps/cli/lib/bin.js'),'web','--no-open','--port','3092'],{cwd:join(root,'workspace'),env,stdio:'inherit'});
writeFileSync(join(root,'server-pid.json'),JSON.stringify({supervisorPid:process.pid,cliPid:child.pid,baseURL:'http://127.0.0.1:3092',profile,launcherScratch:launcher.scratchRoot,launcherRunId:launcher.runId},null,2));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code??1));
