import { realpathSync, lstatSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync, readdirSync, accessSync, constants } from 'node:fs';
import { resolve, join, relative, isAbsolute, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { validateLiveHttpOptions } from './live-http.mjs';
import { DEFAULT_ACTIVITY_WINDOW_MS, MIN_ACTIVITY_WINDOW_MS, MAX_ACTIVITY_WINDOW_MS } from './write-gate.mjs';

export const ELECTRON_VERSION='41.0.3';
export const HOST_DIGEST='c143ce16c61ad1d01d8cbfca0a0e2f506aa5afa3858db3f088e69ecf11d588d3';
export const CLI_DIGEST='fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f';
export function fault(code){return Object.assign(new Error(code),{code})}
const inside=(root,p)=>p!==root&&!relative(root,p).startsWith('..')&&!isAbsolute(relative(root,p));
// Reject symlinks at every component, including nonexistent leaves' existing ancestors.
function noLinks(p){for(let q=resolve(p);;q=dirname(q)){try{if(lstatSync(q).isSymbolicLink())throw fault('landing-symlink')}catch(e){if(e.code!=='ENOENT')throw e}if(dirname(q)===q)break;}}
// Probe-only two-Host topology: share DBs, never the data base/provider/credential root.
function sharedDatabases(config){
  if(config.sharedDatabaseRoot===undefined)return null;
  const root=config.sharedDatabaseRoot;
  if(typeof root!=='string'||!isAbsolute(root)||!inside(join(config.scratchRoot,'shared-databases'),root)||inside(config.runRoot,root)||inside(root,config.runRoot))throw fault('shared-database-root-denied');
  noLinks(root);
  const tasks=join(root,'tasks-index.sqlite'),sessionDb=join(root,'db.sqlite');
  for(const p of [tasks,sessionDb]){noLinks(p);if(!lstatSync(p).isFile()||lstatSync(p).size===0)throw fault('shared-database-required');}
  const allowed=new Set([tasks,sessionDb].flatMap(p=>[p,p+'-wal',p+'-shm',p+'-journal']));
  for(const name of readdirSync(root)){const p=join(root,name);if(!allowed.has(p))throw fault('shared-database-extra-file');noLinks(p);if(!lstatSync(p).isFile())throw fault('shared-database-required');}
  return {root,tasks,sessionDb};
}
export function assertLandings(config){
  const {scratchRoot,runRoot,paths,env,runtimeProcessEnvPatch}=config;
  if(!isAbsolute(scratchRoot)||!isAbsolute(runRoot)||!inside(scratchRoot,runRoot))throw fault('scratch-root-required');
  noLinks(scratchRoot);noLinks(runRoot);
  // A scratch root may be explicitly placed under the home; it must never contain real home/data.
  const realHome=config.realHome??homedir();
  if(scratchRoot===realHome||inside(scratchRoot,realHome)||scratchRoot===join(realHome,'.zcode')||inside(join(realHome,'.zcode'),scratchRoot)||inside(join(realHome,'Library'),scratchRoot))throw fault('real-data-root-denied');
  if(config.mode==='live-http')return assertLiveHttpLandings(config);
  const shared=sharedDatabases(config);
  for(const [name,p] of Object.entries(paths)){if(typeof p!=='string'||!isAbsolute(p)||!(inside(runRoot,p)||(name==='sessionDb'&&p===shared?.sessionDb)))throw fault('landing-outside-scratch:'+name);noLinks(p);}
  if(shared&&paths.sessionDb!==shared.sessionDb)throw fault('shared-session-mismatch');
  const tasksLink=join(paths.dataBase,'.zcode/v2/tasks-index.sqlite');
  if(shared&&existsSync(tasksLink)&&(!lstatSync(tasksLink).isSymbolicLink()||realpathSync(tasksLink)!==shared.tasks))throw fault('shared-tasks-link-mismatch');
  const bindings={HOME:paths.home,USERPROFILE:paths.home,ZCODE_DESKTOP_HOME_DIR:paths.home,ZCODE_DATA_BASE_DIR:paths.dataBase,ZCODE_SESSION_DB_PATH:paths.sessionDb,SESSION_DB:paths.sessionDb,ZCODE_HOME:paths.runtimeHome,TMPDIR:paths.temp};
  for(const [key,value] of Object.entries(bindings))for(const source of [env,runtimeProcessEnvPatch])if(source[key]!==value)throw fault('landing-env-mismatch:'+key);
  for(const source of [env,runtimeProcessEnvPatch])if(source.ZCODE_BUILTIN_PROVIDER_CONFIG_FILE!==config.builtinConfig)throw fault('builtin-config-mismatch');
  if(config.cwd!==paths.workspace||config.agentSpawnFallbackCwd!==paths.workspace)throw fault('landing-cwd-mismatch');
  // No inherited overrides, tokens, preload flags or proxy settings can enter either process.
  const allowed=new Set([...Object.keys(bindings),'PATH','SHELL','LANG','ZCODE_BUILTIN_PROVIDER_CONFIG_FILE','ZCODE_NATIVE_SEARCH_ENHANCEMENTS_ENABLED','ZCODE_MEMORY_ENABLED','ZCODE_PROCESS_LABEL']);
  for(const source of [env,runtimeProcessEnvPatch])if(Object.keys(source).some(k=>!allowed.has(k)))throw fault('inherited-env-denied');
  return {passed:true,settings:join(paths.home,'.zcode/v2/setting.json'),tasks:shared?.tasks??tasksLink,sessionDb:paths.sessionDb,keychain:'OS-access-denied',sharedAuthority:'NO-GO'};
}
export function createLauncherConfig({scratchRoot,runId=randomUUID(),artifactRoot,electronPath,builtinConfig,sharedDatabaseRoot,mode='scratch',desktopHome=process.env.ZCODE_DESKTOP_HOME_DIR,activityWindowMs=DEFAULT_ACTIVITY_WINDOW_MS}={}){
  if(!Number.isSafeInteger(activityWindowMs)||activityWindowMs<MIN_ACTIVITY_WINDOW_MS||activityWindowMs>MAX_ACTIVITY_WINDOW_MS)throw fault('activity-window-invalid');
  if([scratchRoot,artifactRoot,electronPath,builtinConfig].some(p=>typeof p!=='string'||!p.trim())||typeof runId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(runId))throw fault('launcher-config-required');
  if(!['scratch','live-http'].includes(mode))throw fault('launcher-mode-invalid');
  const liveHttp=mode==='live-http'?validateLiveHttpOptions({sharedDatabaseRoot,desktopHome}):null;
  scratchRoot=resolve(scratchRoot);const runRoot=join(scratchRoot,'runs',runId),realHome=homedir();
  const paths={home:join(runRoot,'home'),dataBase:join(runRoot,'data-base'),runtimeHome:join(runRoot,'runtime-home'),sessionDb:join(runRoot,'session-db/db.sqlite'),userData:join(runRoot,'userData'),sessionData:join(runRoot,'sessionData'),logs:join(runRoot,'logs'),temp:join(runRoot,'tmp'),workspace:join(runRoot,'workspace')};
  for(const key of ['appData','crashDumps','desktop','documents','downloads','music','pictures','videos'])paths[key]=join(runRoot,'electron-'+key);
  if(sharedDatabaseRoot!==undefined)paths.sessionDb=join(resolve(sharedDatabaseRoot),'db.sqlite');
  const env={PATH:'/usr/bin:/bin:/usr/sbin:/sbin',SHELL:'/bin/sh',LANG:'en_US.UTF-8',HOME:paths.home,USERPROFILE:paths.home,ZCODE_DESKTOP_HOME_DIR:paths.home,ZCODE_DATA_BASE_DIR:paths.dataBase,ZCODE_SESSION_DB_PATH:paths.sessionDb,SESSION_DB:paths.sessionDb,ZCODE_HOME:paths.runtimeHome,TMPDIR:paths.temp,ZCODE_BUILTIN_PROVIDER_CONFIG_FILE:resolve(builtinConfig),ZCODE_NATIVE_SEARCH_ENHANCEMENTS_ENABLED:'0',ZCODE_MEMORY_ENABLED:'0',ZCODE_PROCESS_LABEL:'dsh-host-'+runId};
  const config={scratchRoot,runRoot,runId,executionNonce:randomUUID(),activityWindowMs,hostId:'dsh-host-'+randomUUID(),deliveryKind:'desktop_window',artifactRoot:resolve(artifactRoot),electronPath:resolve(electronPath),builtinConfig:resolve(builtinConfig),realHome,paths,env,runtimeProcessEnvPatch:{...env},cwd:paths.workspace,agentSpawnFallbackCwd:paths.workspace};
  if(sharedDatabaseRoot!==undefined)config.sharedDatabaseRoot=resolve(sharedDatabaseRoot);
  if(mode==='live-http'){
    config.liveHttp=liveHttp;config.mode='live-http';
    paths.home=realHome;paths.dataBase=realHome;paths.runtimeHome=join(realHome,'.zcode/cli');paths.sessionDb=join(realHome,'.zcode/cli/db/db.sqlite');
    Object.assign(env,{HOME:realHome,USERPROFILE:realHome,ZCODE_DATA_BASE_DIR:realHome,ZCODE_SESSION_DB_PATH:paths.sessionDb,SESSION_DB:paths.sessionDb,ZCODE_HOME:paths.runtimeHome});
    if(desktopHome==null)delete env.ZCODE_DESKTOP_HOME_DIR;else env.ZCODE_DESKTOP_HOME_DIR=desktopHome;
    config.runtimeProcessEnvPatch={...env};
  }
  assertLandings(config);return config;
}
export function prepareLauncher(config){
  const landing=assertLandings(config);
  // Runs are always fresh; only the explicit scratch DB probe option can reopen DB fixtures.
  if(existsSync(config.runRoot))throw fault('scratch-run-already-exists');
  for(const [p,code,mode] of [[config.electronPath,'helper-missing',constants.X_OK],[config.builtinConfig,'provider-config-missing',constants.R_OK]]){
    try{if(!lstatSync(p).isFile())throw Error();accessSync(p,mode)}catch{throw fault(code)}
  }
  const hostEntry=join(config.artifactRoot,'out/host/index.js');
  let cli;try{cli=realpathSync(join(dirname(config.artifactRoot),'bundled-resources/glm/zcode.cjs'));accessSync(cli,constants.R_OK)}catch{throw fault('runtime-missing')}
  const identity=JSON.parse(readFileSync(new URL('./official-host-identity.json',import.meta.url),'utf8'));
  for(const entry of identity.files){const p=join(config.artifactRoot,entry.path);noLinks(p);let bytes;try{bytes=readFileSync(p)}catch{throw fault('official-host-missing')}if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw fault('official-host-subtree-mismatch');}
  for(const [p,digest] of [[hostEntry,HOST_DIGEST],[cli,CLI_DIGEST]])if(createHash('sha256').update(readFileSync(p)).digest('hex')!==digest)throw fault('official-artifact-mismatch');
  for(const [key,p] of Object.entries(config.paths)){if(config.mode==='live-http'&&['home','dataBase','runtimeHome','sessionDb'].includes(key))continue;mkdirSync(p===config.paths.sessionDb?dirname(p):p,{recursive:true,mode:0o700});}
  const shared=sharedDatabases(config);
  if(shared){const link=join(config.paths.dataBase,'.zcode/v2/tasks-index.sqlite');mkdirSync(dirname(link),{recursive:true,mode:0o700});symlinkSync(shared.tasks,link,'file');}
  // The official resolver searches cwd/bundled-resources. Keep cwd isolated while exposing
  // the official CLI as a read-only resource, exactly as the official runtime install scratch topology did.
  const resources=join(config.paths.workspace,'bundled-resources');mkdirSync(resources,{recursive:true});
  const glm=join(resources,'glm');if(!existsSync(glm))symlinkSync(dirname(cli),glm,'dir');
  if(realpathSync(glm)!==dirname(cli))throw fault('runtime-resource-mismatch');
  // Recheck after mkdir, before the first Electron/Host process is launched.
  assertLandings(config);
  writeFileSync(join(config.runRoot,'launcher.json'),JSON.stringify({...config,landing,hostEntry}),{mode:0o600});
  return {...config,landing,hostEntry};
}
// Enforcement inherited by Main, utilityProcess, workers and future descendants. Network and
// OS Keychain are always denied; HOME is not a Keychain isolation mechanism.
export function sandboxProfile(config,codeRoot,dependencyRoot,dependencyLinks=[]){
  const quote=p=>JSON.stringify(p);
  // macOS Seatbelt checks the symlink spelling as well as its resolved target. pnpm's
  // sibling node_modules/zod link needs this exact read-only grant; never grant its parent.
  assertLandings(config);
  const shared=sharedDatabases(config);
  if(config.mode==='live-http')return liveHttpSandbox(config,codeRoot,dependencyRoot,dependencyLinks);
  const readRoots=[config.runRoot,...(shared?[shared.root]:[]),realpathSync(config.artifactRoot),dirname(dirname(dirname(config.electronPath))),realpathSync(codeRoot),realpathSync(dependencyRoot),...dependencyLinks];
  const sharedWrites=shared?[shared.root,...[shared.tasks,shared.sessionDb].flatMap(p=>[p,p+'-wal',p+'-shm',p+'-journal'])]:[];
  const ancestors=new Set();for(const p of readRoots)for(let q=dirname(p);q!==dirname(q);q=dirname(q))ancestors.add(q);
  return `(version 1)\n(allow default)\n(deny file-read* (require-all (subpath ${quote(config.realHome)}) (require-not (subpath ${readRoots.map(quote).join(' ')})) (require-not (literal ${[...ancestors].map(quote).join(' ')}))))\n(deny file-write* (require-all (require-not (subpath ${quote(config.runRoot)})) ${sharedWrites.length?'(require-not (literal '+sharedWrites.map(quote).join(' ')+')) ':''}(require-not (subpath "/dev"))))\n(deny network*)\n(deny mach-lookup (global-name "com.apple.securityd" "com.apple.securityd.xpc" "com.apple.trustd"))\n`;
}

function assertLiveHttpLandings(config){
  const {paths,env,runtimeProcessEnvPatch:inner,realHome}=config;
  const configuration=validateLiveHttpOptions({sharedDatabaseRoot:config.sharedDatabaseRoot,desktopHome:config.liveHttp?.desktopHome});
  // macOS sockaddr_un is 104 bytes including NUL. Official read-only CLI creates
  // znr-UUID.sock at startup even when no model task is executed.
  if(Buffer.byteLength(join(paths.temp,'znr-00000000-0000-0000-0000-000000000000.sock'))>103)throw fault('live-http-temp-socket-path-too-long');
  if(realHome!==homedir()||!config.liveHttp?.allowed||config.sharedDatabaseRoot)throw fault('live-http-home-mismatch');
  const defaults={home:realHome,dataBase:realHome,runtimeHome:join(realHome,'.zcode/cli'),sessionDb:join(realHome,'.zcode/cli/db/db.sqlite')};
  for(const [k,p] of Object.entries(paths)){if(defaults[k]?p!==defaults[k]:!inside(config.runRoot,p))throw fault('live-http-landing-mismatch:'+k);noLinks(p);}
  const desktop=config.liveHttp.desktopHome;
  if(desktop!==null&&(!isAbsolute(desktop)||!desktop.trim()))throw fault('live-http-desktop-home-invalid');
  const settingsHome=desktop??realHome;noLinks(join(settingsHome,'.zcode/v2'));
  const expected={PATH:'/usr/bin:/bin:/usr/sbin:/sbin',SHELL:'/bin/sh',LANG:'en_US.UTF-8',HOME:realHome,USERPROFILE:realHome,ZCODE_DATA_BASE_DIR:realHome,ZCODE_SESSION_DB_PATH:paths.sessionDb,SESSION_DB:paths.sessionDb,ZCODE_HOME:paths.runtimeHome,TMPDIR:paths.temp,ZCODE_BUILTIN_PROVIDER_CONFIG_FILE:config.builtinConfig,ZCODE_NATIVE_SEARCH_ENHANCEMENTS_ENABLED:'0',ZCODE_MEMORY_ENABLED:'0',ZCODE_PROCESS_LABEL:'dsh-host-'+config.runId,...(desktop===null?{}:{ZCODE_DESKTOP_HOME_DIR:desktop})};
  for(const source of [env,inner])if(JSON.stringify(Object.entries(source).sort())!==JSON.stringify(Object.entries(expected).sort()))throw fault('live-http-env-mismatch');
  if(config.cwd!==paths.workspace||config.agentSpawnFallbackCwd!==paths.workspace)throw fault('landing-cwd-mismatch');
  return {passed:true,mode:'live-http',settings:join(settingsHome,'.zcode/v2/setting.json'),tasks:join(realHome,'.zcode/v2/tasks-index.sqlite'),sessionDb:paths.sessionDb,keychain:'OS-access-denied',network:'enabled',sharedAuthority:'official-receipts-CAS-unverified',configuration};
}
function liveHttpSandbox(config,codeRoot,dependencyRoot,links){
  const q=p=>JSON.stringify(p);
  const officialRoots=[join(config.realHome,'.zcode/v2'),join(config.realHome,'.zcode/cli'),join(config.liveHttp.desktopHome??config.realHome,'.zcode/v2')];
  // The official agent runtime reads user-scope data roots when it starts a session. Evidence from
  // live-HTTP attempts 1/2 (pre-fix) showed createTask failing before any model request with
  // "EPERM: operation not permitted, stat '~/.zcode/agents'"; the whole ~/.zcode root is therefore
  // granted read-only, because the Host's own credential/agents files plus subagent profiles, skills,
  // commands and hooks all live under it. ~/.agents and ~/.claude are deliberately NOT granted: there
  // is no EPERM evidence for either, and ~/.claude can hold plaintext credentials on some machines.
  // If a future official runtime reports EPERM for one of these roots, capture that diagnostic first
  // and admit only that single root with the evidence. These are read-only grants: writes stay scoped
  // to the run root and the official settings/DB roots, and the Keychain and securityd denials are
  // unchanged.
  // "EPERM: operation not permitted, stat '~/.zcode/agents'"; the whole ~/.zcode root is therefore
  // granted read-only, because the Host's own credential/agents files plus subagent profiles, skills,
  // commands and hooks all live under it. ~/.agents and ~/.claude are deliberately NOT granted: there
  // is no EPERM evidence for either, and ~/.claude can hold plaintext credentials on some machines.
  // If a future official runtime reports EPERM for one of these roots, capture that diagnostic first
  // and admit only that single root with the evidence. These are read-only grants: writes stay scoped
  // to the run root and the official settings/DB roots, and the Keychain and securityd denials are
  // unchanged.
  const officialDataRoots=[join(config.realHome,'.zcode')];
  const readRoots=[config.runRoot,...officialRoots,...officialDataRoots,realpathSync(config.artifactRoot),dirname(dirname(dirname(config.electronPath))),realpathSync(codeRoot),realpathSync(dependencyRoot),...links];
  const ancestors=new Set();for(const p of readRoots)for(let a=dirname(p);a!==dirname(a);a=dirname(a))ancestors.add(a);
  return `(version 1)\n(allow default)\n(deny file-read* (require-all (subpath ${q(config.realHome)}) (require-not (subpath ${readRoots.map(q).join(' ')})) (require-not (literal ${[...ancestors].map(q).join(' ')}))))\n(deny file-write* (require-all (require-not (subpath ${[config.runRoot,...officialRoots].map(q).join(' ')})) (require-not (subpath "/dev"))))\n(deny file-read* file-write* (subpath ${q(join(config.realHome,'Library/Keychains'))} "/Library/Keychains"))\n(deny mach-lookup (global-name "com.apple.securityd" "com.apple.securityd.xpc"))\n`;
}
