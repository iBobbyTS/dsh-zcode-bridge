// Bridge-owned Electron Main; official Host/CLI and their account resolver remain unchanged.
import { app, utilityProcess, MessageChannelMain, BrowserWindow, webContents } from 'electron';
import { readFileSync } from 'node:fs';
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
const authority=new HostAuthority(),gate=new ProviderRequestGate();
const headless=()=>({windowEvents,windows:BrowserWindow.getAllWindows().length,webContents:webContents.getAllWebContents().length});
let state={phase:'starting',channelAvailable:false,landings:config.landing,login:'disabled-s03',databaseControl:'disabled-s02',sharedOfficialMain:'NO-GO',requestGate:gate.state,services:[]};
const publish=change=>{state={...state,...change,revision:++revision};process.stdout.write(JSON.stringify({type:'launcher-state',state:{...state,headless:headless()}})+'\n')};
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
control.on('line',line=>{if(line==='stop')void stop();});
app.whenReady().then(()=>{
  for(const k of electronPaths)if(app.getPath(k)!==config.paths[k])throw fault('electron-path-mismatch:'+k);
  if(headless().windows||headless().webContents)throw fault('headless-invariant');
  const {port1,port2}=new MessageChannelMain();
  child=utilityProcess.fork(config.hostEntry,[],{cwd:config.cwd,serviceName:config.hostId,env:config.env,stdio:'pipe',execArgv:['--no-warnings']});
  // Discard arbitrary Host output: it may contain secrets. Only byte counts are observed.
  for(const stream of ['stdout','stderr'])child[stream]?.on('data',()=>{});
  child.on('spawn',()=>publish({mainPid:process.pid,hostPid:child.pid,electron:process.versions.electron}));
  child.on('exit',code=>{if(!closing){publish({phase:'failed',channelAvailable:false,reason:'host-exited',hostExitCode:code});void stop(2)}});
  authority.onDatabase=(_id,database)=>publish({database});
  authority.register({hostId:config.hostId,child,workspaceKeys:[],deliveryKind:config.deliveryKind});
  channel=new HostChannel(port1,{onClose:reason=>{if(!closing){publish({phase:'failed',channelAvailable:false,reason});void stop(2)}},onReady:async()=>{
    clearTimeout(deadline);
    // Availability of these state services is verified by their real RPC responses; runtime/
    // session/command names are static topology only and never advertised as runnable.
    try{
      const cached=await channel.call('oauth','restoreCachedSessionState');
      const active=await channel.call('oauth','getActiveProvider');
      const providers=await channel.call('oauth','getProviders');
      const view=await channel.call('provider-settings','getView');
      await channel.call('setting','get');
      if(closing)return;
      disposeEvent=channel.listen('provider-settings','onDidChange',()=>publish({providerStateChanged:true}));
      publish({phase:'ready',channelAvailable:true,auth:cached?.status==='signed-out'?'signed-out':'unconfirmed',activeProviderPresent:active!==null,providerCount:Array.isArray(providers)?providers.length:null,executableProviders:(view?.providers??[]).filter(p=>p.executable).length,services:['oauth','provider-settings','setting'],topologyServices:['zcode-agent','zcode-session','zcode-task'],execution:'disabled-s03',rpcCount:5});
    }catch(e){publish({phase:'failed',reason:typeof e?.code==='string'?e.code:'status-query-failed'});void stop(2)}
  }});
  child.postMessage({type:'init-local',hostId:config.hostId,deliveryKind:config.deliveryKind,databaseStartupId:config.runId,agentSpawnFallbackCwd:config.agentSpawnFallbackCwd,zcodeBuiltinProviderConfigFilePath:config.builtinConfig,runtimeProcessEnvPatch:config.runtimeProcessEnvPatch},[port2]);
});
