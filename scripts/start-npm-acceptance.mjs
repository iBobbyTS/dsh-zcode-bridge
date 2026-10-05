// Installs the registry release and uses its real plugin manager. Never writes reference/,
// changes HOME, disables the bridge sandbox, or issues a model/official mutation request.
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,existsSync,openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createLauncherConfig} from '../packages/host/launcher/config.mjs';

const args=process.argv.slice(2),allowed=new Set(['--root','--port','--smoke','--prepare-only','--diagnose-version-seams']);
let root,port=3208,smoke=false,prepareOnly=false,diagnose=false;
for(let i=0;i<args.length;i++){
  const arg=args[i];if(!allowed.has(arg))throw Error('Unknown option: '+arg);
  if(arg==='--smoke')smoke=true;else if(arg==='--prepare-only')prepareOnly=true;else if(arg==='--diagnose-version-seams')diagnose=true;
  else {const value=args[++i];if(!value||value.startsWith('--'))throw Error('Missing value for '+arg);if(arg==='--root')root=resolve(value);else port=Number(value)}
}
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
if(smoke&&prepareOnly)throw Error('Choose --smoke or --prepare-only');
if(root){if(existsSync(root))throw Error('Root must be new; existing environments are never overwritten');mkdirSync(root,{recursive:true,mode:0o700})}
else root=mkdtempSync(join(tmpdir(),'dsh-s08-npm-'));
const repo=resolve(fileURLToPath(new URL('..',import.meta.url))),parent=resolve(repo,'..');
const install=join(root,'npm'),dshHome=join(root,'dsh-home'),workspace=join(root,'workspace'),profile=join(dshHome,'profiles/web');
const env={...process.env,DSH_HOME:dshHome,npm_config_cache:join(root,'npm-cache'),PNPM_HOME:join(root,'pnpm-home'),XDG_CACHE_HOME:join(root,'cache'),XDG_DATA_HOME:join(root,'data')};
for(const dir of [install,profile,workspace,env.PNPM_HOME])mkdirSync(dir,{recursive:true,mode:0o700});
const result={root,install,dshHome,workspace,port,registrySpec:'@deepseek-ai/dsh@latest',realModelCalls:0,officialMutationRequests:0,steps:{}};
const save=()=>writeFileSync(join(root,'environment-result.json'),JSON.stringify(result,null,2),{mode:0o600});
let childStop;
function run(label,command,argv){
  const out=spawnSync(command,argv,{cwd:repo,env,encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});
  writeFileSync(join(root,label+'.log'),(out.stdout??'')+(out.stderr??''),{mode:0o600});
  result.steps[label]={exitCode:out.status,error:out.error?.code??null};save();
  if(out.status!==0)throw Error(label+' failed; inspect '+join(root,label+'.log'));
}
try{
  run('npm-install','npm',['install','--prefix',install,'--no-audit','--no-fund','--ignore-scripts','@deepseek-ai/dsh@latest']);
  const pkg=join(install,'node_modules/@deepseek-ai/dsh'),cli=join(pkg,'lib/bin.js');
  result.npmVersion=JSON.parse(readFileSync(join(pkg,'package.json'),'utf8')).version;
  run('bridge-build',process.execPath,[join(repo,'scripts/build.mjs')]);
  const pluginArgs=[cli,'plugin','--profile','web','add','--ignore-scripts','file:'+repo,'file:'+join(repo,'packages/host'),'file:'+join(repo,'packages/client')];
  try{run('plugin-install',process.execPath,pluginArgs)}catch(error){
    const log=readFileSync(join(root,'plugin-install.log'),'utf8');
    const hostVersion=JSON.parse(readFileSync(join(repo,'packages/host/package.json'),'utf8')).version;
    if(!diagnose||!log.includes(`Plugin @dsh-zcode/host@${hostVersion} is incompatible with dsh ${result.npmVersion}`))throw error;
    // Diagnostic only: the runtime's own exact-version permission, in this isolated profile.
    // This never broadens shipped peer ranges or marks an incompatible bridge as accepted.
    result.versionExemption={plugin:'@dsh-zcode/host@'+hostVersion,dshVersion:result.npmVersion,diagnosticOnly:true};save();
    run('diagnostic-version-exemption',process.execPath,[cli,'plugin','--profile','web','allow-version','@dsh-zcode/host@'+hostVersion,'--dsh-version',result.npmVersion,'--accept-risk']);
    run('plugin-install-diagnostic',process.execPath,pluginArgs);
  }
  const base=join(parent,'.agent-work/tmp/host-reuse-probe');
  const launcher={mode:'route-b',scratchRoot:'/private/tmp/dshw/n8',runId:Date.now().toString(36),artifactRoot:process.env.DSH_ACCEPTANCE_ARTIFACT??join(base,'official-extracted'),electronPath:process.env.DSH_ACCEPTANCE_ELECTRON??join(base,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),builtinConfig:'/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json'};
  // Production validator retains HOME/socket/landings; no alternate isolation profile.
  createLauncherConfig(launcher);
  for(const path of [launcher.artifactRoot,launcher.electronPath,launcher.builtinConfig])if(!existsSync(path))throw Error('Missing launcher prerequisite: '+path);
  writeFileSync(join(profile,'cordis.patch.yml'),JSON.stringify([{id:'zcode-bridge-host',config:{authorityMode:'host-backed',launcher}},{id:'session-title-llm',disabled:true}],null,2),{mode:0o600});
  result.launcher={scratchRoot:launcher.scratchRoot,runId:launcher.runId};save();
  if(prepareOnly){result.outcome='prepared';save();console.log(JSON.stringify(result));process.exit(0)}
  // Refuse occupied ports. Never stop another server or reuse its health response.
  await new Promise((ok,no)=>{const server=createServer();server.once('error',no);server.listen(port,'127.0.0.1',()=>server.close(ok))});
  const log=openSync(join(root,'web.log'),'a',0o600);
  const child=spawn(process.execPath,[cli,'web','--no-open','--port',String(port)],{cwd:workspace,env,stdio:['ignore',log,log]});closeSync(log);
  let exited=false,exitCode=null;const done=new Promise(ok=>{child.once('error',error=>{result.bootError=error.code;exited=true;ok()});child.once('exit',code=>{exited=true;exitCode=code;ok()})});
  const stop=async()=>{if(!exited){child.kill('SIGTERM');await Promise.race([done,new Promise(ok=>setTimeout(ok,5000))]);if(!exited){child.kill('SIGKILL');await done}}};
  childStop=stop;
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void stop()});
  result.webPid=child.pid;result.baseURL='http://127.0.0.1:'+port;save();
  const deadline=Date.now()+60000;let reachable=false,cookie;
  while(!exited&&Date.now()<deadline){
    // The web root requires its generated local token. Use only the URL printed by this child.
    // The token stays in the local log; the report contains neither it nor any official credentials.
    const localURL=readFileSync(join(root,'web.log'),'utf8').match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/)?.[1];
    try{if(localURL){
      const exchange=await fetch(localURL,{redirect:'manual',signal:AbortSignal.timeout(1000)});
      result.tokenExchangeStatus=exchange.status;
      cookie=exchange.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
      const response=await fetch(result.baseURL,{headers:{cookie},signal:AbortSignal.timeout(1000)});
      result.httpStatus=response.status;if(response.status===200){reachable=true;break}
    }}catch{}
    await new Promise(ok=>setTimeout(ok,500));
  }
  if(!reachable){await stop();result.outcome='boot-failed';result.webExitCode=exitCode;save();throw Error('Web UI did not boot; inspect '+join(root,'web.log'))}
  // HTTP reachability proves only web boot. Plugin/runtime seam errors remain explicit.
  await new Promise(ok=>setTimeout(ok,3000));
  const statusDeadline=Date.now()+45000;
  do{
    const statusResponse=await fetch(result.baseURL+'/zcode-bridge/status',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method:'status',payload:{}}),signal:AbortSignal.timeout(5000)});
    result.bridgeStatusHttp=statusResponse.status;
    try{const body=await statusResponse.json(),value=body.result?.value;result.bridgeStatus={ok:body.result?.ok??false,state:value?.state,reason:value?.reason,launcherPhase:value?.launcher?.phase,error:body.result?.error?.code}}catch{result.bridgeStatus={ok:false,error:'status-response-unavailable'}}
    if(!['starting','bootstrapping'].includes(result.bridgeStatus.launcherPhase)||exited)break;
    await new Promise(ok=>setTimeout(ok,1000));
  }while(Date.now()<statusDeadline);
  const logText=readFileSync(join(root,'web.log'),'utf8');
  result.pluginErrors=logText.split('\n').filter(line=>/TypeError|ReferenceError|ERR_MODULE_NOT_FOUND|Cannot find|not a function|failed to (load|apply)/i.test(line));
  result.runtimeReady=result.bridgeStatus.launcherPhase==='ready';
  result.outcome=result.pluginErrors.length||!result.bridgeStatus.ok?'seam-differences-found':!result.runtimeReady?'web-booted-runtime-unconfirmed':result.versionExemption?'web-booted-with-diagnostic-exemption':'web-booted';save();
  console.log(JSON.stringify({root,npmVersion:result.npmVersion,outcome:result.outcome,baseURL:result.baseURL,resultPath:join(root,'environment-result.json'),note:'Web boot only; parent owns read-only browser acceptance. Token is in local web.log.'}));
  if(smoke){await stop();result.webExitCode=exitCode;save();if(result.outcome==='seam-differences-found')process.exitCode=2}
  else {await done;result.webExitCode=exitCode;save();process.exitCode=exitCode??1}
}catch(error){await childStop?.();result.error=error.message;result.outcome??='setup-failed';save();console.error(error.message);console.error('Evidence root: '+root);process.exitCode=1}
