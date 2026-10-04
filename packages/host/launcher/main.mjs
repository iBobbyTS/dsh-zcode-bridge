// Bridge-owned Electron Main; official Host/CLI and their account resolver remain unchanged.
import { app, utilityProcess, MessageChannelMain, BrowserWindow, webContents } from 'electron';
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTE_B_READ_CALLS, ROUTE_B_SEND_CALLS, authProjection, usageProjection } from './observation.mjs';
import { SharedWriteGate, usageActivity } from './write-gate.mjs';
import { createMinimalTurn } from './minimal-turn.mjs';
import { projectTask, projectTaskCatalog } from './task-catalog.mjs';
import { createInterface } from 'node:readline';
import { ELECTRON_VERSION, assertLandings, fault } from './config.mjs';
import { HostChannel } from './channel.mjs';
import { HostAuthority, ProviderRequestGate } from './authority.mjs';

const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
assertLandings(config);
if(process.versions.electron!==ELECTRON_VERSION)throw fault('electron-version-mismatch');
if(process.cwd()!==config.paths.workspace)throw fault('main-cwd-mismatch');
for(const [key,value] of Object.entries(config.env))if(process.env[key]!==value)throw fault('main-env-mismatch:'+key);
app.setName('DSH ZCode Host');app.setActivationPolicy('prohibited');app.disableHardwareAcceleration();
const electronPaths=['home','appData','userData','sessionData','logs','temp','crashDumps','desktop','documents','downloads','music','pictures','videos'];
for(const k of electronPaths)app.setPath(k,config.paths[k]);
app.commandLine.appendSwitch('no-sandbox');app.commandLine.appendSwitch('disable-background-networking');app.commandLine.appendSwitch('disable-crash-reporter');
let child,channel,closing=false,windowEvents=0,revision=0,disposeEvent;
const routeB=config.mode==='route-b', rpc=[];
let lastRpc=null;
const READ_CALLS=new Set(ROUTE_B_READ_CALLS);
const safeCall=async(svc,method,args=[])=>{const name=svc+'.'+method;if(!READ_CALLS.has(name))throw fault('route-b-read-denied');lastRpc=name;rpc.push(name);return channel.call(svc,method,args)};
// S04 write ledger. Separate from the read-only `rpc` observation so the S03 zero-request
// whitelist evidence stays meaningful; every entry is checked against the fixed send allowlist.
const SEND_CALLS=new Set(ROUTE_B_SEND_CALLS),writeRpc=[];
const safeSend=async(svc,method,args=[])=>{const name=svc+'.'+method;if(!SEND_CALLS.has(name))throw fault('route-b-write-denied');writeRpc.push(name);return channel.call(svc,method,args,{timeoutMs:110000})};
const minimalTurnMarker=()=>join(config.runRoot,'s04-minimal-turn.json');
let minimalTurn;
const schedulerPolicy={spawned:false,wakeCallback:false,settlementCallback:false,dispatchMessages:false};
const authority=new HostAuthority(),gate=new ProviderRequestGate();
const headless=()=>({windowEvents,windows:BrowserWindow.getAllWindows().length,webContents:webContents.getAllWebContents().length});
let state={phase:'starting',channelAvailable:false,landings:config.landing,login:'disabled-s03',databaseControl:'disabled-s02',sharedOfficialMain:'NO-GO',requestGate:gate.state,services:[],routeB:config.routeB??null,schedulerPolicy};
const publish=change=>{state={...state,...change,revision:++revision};const line=JSON.stringify({type:'launcher-state',at:Date.now(),state:{...state,headless:headless()}})+'\n';if(routeB)appendFileSync(join(config.runRoot,'launcher-states.jsonl'),line,{mode:0o600});process.stdout.write(line)};
export async function stop(code=0){
  if(closing)return;closing=true;clearTimeout(deadline);disposeEvent?.();channel?.close();authority.dispose();
  publish({phase:'stopping',channelAvailable:false,services:[]});
  if(child){const ended=new Promise(resolve=>child.once('exit',resolve));child.postMessage({type:'dispose'});await Promise.race([ended,new Promise(resolve=>setTimeout(resolve,1000))]);child.kill();await Promise.race([ended,new Promise(resolve=>setTimeout(resolve,2000))]);}
  publish({phase:'stopped',authority:authority.diagnostics});app.exit(code);
}
const deadline=setTimeout(()=>{publish({phase:'failed',reason:'launcher-start-timeout'});void stop(2)},30000);
app.on('browser-window-created',()=>{windowEvents++;publish({phase:'failed',reason:'window-creation-denied'});void stop(3)});
app.on('web-contents-created',()=>{publish({phase:'failed',reason:'webcontents-creation-denied'});void stop(3)});
app.on('activate',()=>{});app.on('open-url',event=>event.preventDefault());
app.on('before-quit',e=>{if(!closing){e.preventDefault();void stop()}});
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
const control=createInterface({input:process.stdin});control.on('close',()=>void stop());
let reading=Promise.resolve();
control.on('line',line=>{
  if(line==='stop'){void stop();return;}
  if(!routeB||closing)return;
  let m;try{m=JSON.parse(line)}catch{return;}
  if(!Number.isSafeInteger(m.id)||!['catalog','preflight','observation','taskUsage','sendMinimalTask'].includes(m.operation)||Object.keys(m).some(k=>!['id','operation','address'].includes(k)))return;
  reading=reading.then(async()=>{
    if(closing)return;
    try{
      // S04: single bridge-owned model turn. Creates its own session and sends one prompt; it never
      // reads a caller address and never resumes/closes anything.
      if(m.operation==='sendMinimalTask'){
        minimalTurn??=createMinimalTurn({call:safeSend,usage:async()=>usageProjection(await safeCall('zcode-agent','getAppUsageStats',[{range:'all',timeZone:'UTC'}])),readTasks,workspacePath:config.paths.workspace,recordClaim:()=>{if(existsSync(minimalTurnMarker()))throw fault('minimal-turn-already-claimed');writeFileSync(minimalTurnMarker(),JSON.stringify({at:Date.now(),prompt:'Reply with exactly: ok'}),{mode:0o600})},hasClaimed:()=>existsSync(minimalTurnMarker())});
        const result=await minimalTurn.run();
        const value={...result,writeRpc:[...writeRpc]};
        publish({minimalTurn:{taskId:value.taskId,workspacePath:value.workspacePath,claims:writeRpc.length}});
        if(closing)return;
        process.stdout.write(JSON.stringify({type:'launcher-read',id:m.id,ok:true,value})+'\n');
        return;
      }
      const tasks=await readTasks();let value;
      if(m.operation==='catalog')value={tasks,observedAt:Date.now()};
      if(m.operation==='preflight'){
        const t=tasks.find(t=>t.taskId===m.address?.sessionId&&t.workspacePath===m.address?.workspace);
        const gate=new SharedWriteGate({
          isOwned:()=>authority.owns(config.hostId,t??{taskId:m.address?.sessionId,workspacePath:m.address?.workspace}),
          readTask:async()=>{const raw=t?await safeCall('zcode-task','getTaskMeta',[{taskId:t.taskId,workspacePath:t.workspacePath,...(t.workspaceIdentity?{workspaceIdentity:t.workspaceIdentity}:{})}]):null;return raw?projectTask(raw):null;},
          readActivity:()=>safeCall('zcode-agent','getTaskTokenUsage',[{sessionId:t.taskId,workspacePath:t.workspacePath,...(t.workspaceIdentity?{workspaceIdentity:t.workspaceIdentity}:{})}]),
          windowMs:config.activityWindowMs,
        });
        value=await gate.preflight(m.address);
      }
      if(m.operation==='observation')value={tasks,usage:usageProjection(await safeCall('zcode-agent','getAppUsageStats',[{range:'all',timeZone:'UTC'}])),rpc:[...rpc],writeRpc:[...writeRpc],at:Date.now(),schedulerPolicy};
      // Per-session official usage readback (the S04 model-request accounting surface).
      if(m.operation==='taskUsage'){
        if(!m.address||typeof m.address.sessionId!=='string'||!m.address.sessionId||typeof m.address.workspace!=='string'||!m.address.workspace)throw fault('route-b-address-required');
        const raw=await safeCall('zcode-agent','getTaskTokenUsage',[{sessionId:m.address.sessionId,workspacePath:m.address.workspace,...(m.address.workspaceIdentity?{workspaceIdentity:m.address.workspaceIdentity}:{})}]);
        value={address:m.address,usage:usageActivity(raw,m.address.sessionId),at:Date.now()};
      }
      if(closing)return;
      process.stdout.write(JSON.stringify({type:'launcher-read',id:m.id,ok:true,value})+'\n');
    }catch(e){
      // Local-only diagnostic (scratch runRoot, 0600): the carrier returns only a code, so the
      // bounded message is retained here for the operator. It is never forwarded to DSH state.
      try{appendFileSync(join(config.runRoot,'launcher-read-errors.jsonl'),JSON.stringify({operation:m.operation,code:typeof e?.code==='string'?e.code:null,name:typeof e?.name==='string'?e.name:null,message:String(e?.message??'').slice(0,300),at:Date.now()})+'\n',{mode:0o600})}catch{}
      process.stdout.write(JSON.stringify({type:'launcher-read',id:m.id,ok:false,code:typeof e.code==='string'?e.code:'route-b-read-failed'})+'\n');publish({phase:'failed',reason:'route-b-read-failed'});void stop(2);
    }
  });
});
async function verifyProvider(){
  const active=await safeCall('oauth','getActiveProvider'),view=await safeCall('provider-settings','getView');
  if(closing)return;
  const auth=authProjection({status:active===null?'signed-out':'authenticated'},active,view);
  if(auth.auth!=='authenticated')throw fault('official-provider-status-lost');
  publish(auth);
}
async function readTasks(){
  const a=await safeCall('zcode-task','listTasks',[{}]),b=await safeCall('zcode-task','listPinnedTasks',[{}]);
  return projectTaskCatalog(a,b);
}
app.whenReady().then(()=>{
  for(const k of electronPaths)if(app.getPath(k)!==config.paths[k])throw fault('electron-path-mismatch:'+k);
  if(headless().windows||headless().webContents)throw fault('headless-invariant');
  const {port1,port2}=new MessageChannelMain();
  child=utilityProcess.fork(config.hostEntry,[],{cwd:config.cwd,serviceName:config.hostId,env:config.env,stdio:'pipe',execArgv:['--no-warnings']});
  // Discard arbitrary Host output: it may contain secrets. Only byte counts are observed.
  for(const stream of ['stdout','stderr'])child[stream]?.on('data',data=>{
    // Match fixed categories transiently; never retain or export Host text/profile/credential values.
    const text=data.toString();
    if(/credential decrypt failed|corrupt OAuth|credentials are corrupt|refusing to overwrite corrupt credential/i.test(text)){publish({phase:'failed',reason:'official-credential-recovery-observed'});void stop(2);}
    if(/builtin.*config|built-in.*config/i.test(text))publish({backgroundConfig:{observed:true,outcome:/fail|invalid|error/i.test(text)?'failure':/success|refreshed|updated/i.test(text)?'success':'unconfirmed'}});
  });
  child.on('spawn',()=>publish({mainPid:process.pid,hostPid:child.pid,electron:process.versions.electron}));
  child.on('exit',code=>{if(!closing){publish({phase:'failed',channelAvailable:false,reason:'host-exited',hostExitCode:code});void stop(2)}});
  authority.onDatabase=(_id,database)=>publish({database});
  authority.register({hostId:config.hostId,child,workspaceKeys:[],deliveryKind:config.deliveryKind});
  channel=new HostChannel(port1,{...(routeB?{allowCalls:new Set([...ROUTE_B_READ_CALLS,...ROUTE_B_SEND_CALLS])}:{}),onClose:reason=>{if(!closing){publish({phase:'failed',channelAvailable:false,reason});void stop(2)}},onReady:async()=>{
    clearTimeout(deadline);
    // Availability of these state services is verified by their real RPC responses; runtime/
    // session/command names are static topology only and never advertised as runnable.
    try{
      const cached=await safeCall('oauth','restoreCachedSessionState');
      if(routeB&&cached?.status!=='authenticated'){publish({phase:'failed',auth:cached?.status??'unconfirmed',reason:cached?.status==='reauthentication-required'?'official-account-reauthentication-required':'official-account-signed-out-stop'});void stop(2);return;}
      const active=await safeCall('oauth','getActiveProvider');
      const providers=await safeCall('oauth','getProviders');
      const view=await safeCall('provider-settings','getView');
      await safeCall('setting','get');
      if(closing)return;
      disposeEvent=channel.listen('provider-settings','onDidChange',()=>{
        publish({providerStateChanged:true});
        if(routeB&&!closing)void verifyProvider().catch(()=>{publish({phase:'failed',auth:'unconfirmed',reason:'official-provider-status-lost'});void stop(2);});
      });
      if(routeB){
        const auth=authProjection(cached,active,view);
        if(auth.auth!=='authenticated')throw fault('official-provider-not-executable');
        publish({...auth,authVerified:true,execution:'read-only-s03',schedulerPolicy});
        const tasks=await readTasks();
        // Read-only CLI acquisition: no initializeWorkspace/resume/stream recovery/warmup.
        const sample=tasks.find(t=>!t.workspaceIdentity?.startsWith('ssh:')&&!t.workspaceIdentity?.startsWith('wsl:'));
        const sessions=await safeCall('zcode-agent','listSessions',[{workspacePath:config.paths.workspace,workspaceIdentity:sample?.workspaceIdentity??sample?.workspacePath??config.paths.workspace,sessionIds:sample?[sample.taskId]:[],limit:1,runtimePolicy:'start-if-needed'}]);
        const usage=usageProjection(await safeCall('zcode-agent','getAppUsageStats',[{range:'all',timeZone:'UTC'}]));
        publish({phase:'ready',channelAvailable:true,...auth,login:'cached-official-account',services:['oauth','provider-settings','setting','zcode-task','zcode-agent'],execution:'read-only-s03',rpcCount:rpc.length,taskCount:tasks.length,sessionListCount:Array.isArray(sessions)?sessions.length:null,observationBaseline:{tasks,usage,rpc:[...rpc],at:Date.now()},schedulerPolicy});return;
      }
      publish({phase:'ready',channelAvailable:true,providers:authProjection(cached,active,view).providers,auth:cached?.status==='signed-out'?'signed-out':'unconfirmed',activeProviderPresent:active!==null,providerCount:Array.isArray(providers)?providers.length:null,executableProviders:(view?.providers??[]).filter(p=>p.executable).length,services:['oauth','provider-settings','setting'],topologyServices:['zcode-agent','zcode-session','zcode-task'],execution:'disabled-s03',rpcCount:5});
    }catch(e){publish({phase:'failed',failedRpc:lastRpc,reason:typeof e?.code==='string'?e.code:'status-query-failed',errorCategory:/disposed/i.test(e?.message??'')?'runtime-disposed':/no_active_workspace/.test(e?.message??'')?'usage-runtime-unavailable':'official-status-query-failed'});void stop(2)}
  }});
  child.postMessage({type:'init-local',hostId:config.hostId,deliveryKind:config.deliveryKind,databaseStartupId:config.runId,agentSpawnFallbackCwd:config.agentSpawnFallbackCwd,zcodeBuiltinProviderConfigFilePath:config.builtinConfig,runtimeProcessEnvPatch:config.runtimeProcessEnvPatch},[port2]);
});
