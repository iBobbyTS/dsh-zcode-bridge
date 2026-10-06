import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {validateLiveHttpOptions} from '../packages/host/launcher/live-http.mjs';
import {createLauncherConfig,assertLandings,sandboxProfile} from '../packages/host/launcher/config.mjs';
import {decideSharedWrite,SharedWriteGate} from '../packages/host/launcher/write-gate.mjs';
import {compareObservation,authProjection,usageProjection,LIVE_HTTP_READ_CALLS} from '../packages/host/launcher/observation.mjs';
import {BridgeHost} from '../packages/host/runtime.mjs';
const root=mkdtempSync('/private/tmp/scratch-launcher-test-');
const options=()=>({scratchRoot:root,runId:'unit',artifactRoot:resolve('packages/host'),electronPath:'/read-only/electron',builtinConfig:'/read-only/builtin.json'});
test.after(()=>rmSync(root,{recursive:true,force:true}));
test('Live-HTTP validates ordinary options without public authorization documents',()=>{
 assert.equal(validateLiveHttpOptions().allowed,true);
 for(const desktopHome of ['', 'relative', 17, {}])assert.throws(()=>validateLiveHttpOptions({desktopHome}),{code:'live-http-desktop-home-invalid'});
 assert.throws(()=>validateLiveHttpOptions({sharedDatabaseRoot:root}),{code:'live-http-shared-probe-denied'});
 assert.throws(()=>validateLiveHttpOptions({customCipher:true}),{code:'live-http-custom-cipher-env-unsupported'});
});
test('Live-HTTP has no document gate or scratch fallback; configuration errors remain explicit',()=>{
 const c=createLauncherConfig({...options(),mode:'live-http'});assert.equal(c.mode,'live-http');assert.equal(c.liveHttp.allowed,true);assert.equal(c.env.HOME,homedir());assert.equal(assertLandings(c).mode,'live-http');
 assert.throws(()=>createLauncherConfig({...options(),mode:'live-http',desktopHome:'relative'}),{code:'live-http-desktop-home-invalid'});
 const old=process.env.ZCODE_CREDENTIAL_SECRET;process.env.ZCODE_CREDENTIAL_SECRET='';
 try{assert.throws(()=>createLauncherConfig({...options(),mode:'live-http'}),{code:'live-http-custom-cipher-env-unsupported'})}finally{if(old===undefined)delete process.env.ZCODE_CREDENTIAL_SECRET;else process.env.ZCODE_CREDENTIAL_SECRET=old}
});
test('authorized Live-HTTP pins natural real HOME, DATA_BASE and default session DB; preserves desktop override',()=>{
 const c=createLauncherConfig({...options(),mode:'live-http',desktopHome:join(root,'desktop')});
 assert.equal(c.mode,'live-http');assert.equal(c.env.HOME,homedir());assert.equal(c.env.ZCODE_DATA_BASE_DIR,homedir());assert.equal(c.env.ZCODE_DESKTOP_HOME_DIR,join(root,'desktop'));assert.equal(c.paths.sessionDb,join(homedir(),'.zcode/cli/db/db.sqlite'));assert.equal(assertLandings(c).keychain,'OS-access-denied');
 for(const key of ['HOME','ZCODE_DATA_BASE_DIR','ZCODE_SESSION_DB_PATH']){const bad=structuredClone(c);bad.env[key]='/elsewhere';assert.throws(()=>assertLandings(bad),/env-mismatch/);}
 const long=structuredClone(c);long.paths.temp=join(long.runRoot,'x'.repeat(100));assert.throws(()=>assertLandings(long),/temp-socket-path-too-long/);
 const sb=sandboxProfile(c,resolve('packages/host'),resolve('node_modules/zod'));assert.ok(!sb.includes('(deny network*)'));assert.ok(sb.includes('com.apple.securityd'));assert.ok(sb.includes('Library/Keychains'));assert.ok(!sb.includes('(subpath "'+homedir()+'") (require-not')||sb.includes('deny file-read*'));
 // The official agent runtime needs read access to the whole user-scope ~/.zcode root (the
 // Host's own credential/agents files plus subagent profiles/skills/commands/hooks). The keychain
 // and securityd denials above stay, and writes remain scoped (no wholesale ~/.zcode write).
 assert.ok(sb.includes(JSON.stringify(join(homedir(),'.zcode'))));
 // ~/.agents and ~/.claude are deliberately denied: no EPERM evidence, and ~/.claude may hold
 // plaintext credentials. Re-admit only per-root with a captured diagnostic.
 for(const root of ['.agents','.claude'])assert.ok(!sb.includes(JSON.stringify(join(homedir(),root))));
 assert.ok(!sb.includes('(require-not (subpath '+JSON.stringify(join(homedir(),'.zcode'))+')'));
});
const now=1000000,task={taskId:'a',status:'running',updatedAt:now};
for(const [name,input,decision,reason,allowed] of [
 ['other active',{task,observedAt:now},'active','official-gui-active-turn',true],
 ['our memory cannot bypass unavailable DB',{owned:true},'unknown','shared-task-signal-unavailable-or-stale',false],
 ['terminal unverifiable',{task:{...task,status:'completed',updatedAt:1},observedAt:now},'unverifiable','shared-terminal-task-liveness-unverifiable',true],
 ['error terminal unverifiable',{task:{...task,status:'error'},observedAt:now},'unverifiable','shared-terminal-task-liveness-unverifiable',true],
 ['confirmation does not claim idle',{task:{...task,status:'completed',updatedAt:1},observedAt:now,confirmed:true},'unverifiable','shared-terminal-task-liveness-unverifiable',true],
 ['missing task',{},'unknown','shared-task-signal-unavailable-or-stale',false],
 ['old observation',{task,observedAt:now-6000},'unknown','shared-task-signal-unavailable-or-stale',false],
 ['old running',{task:{...task,updatedAt:1},observedAt:now},'unknown','shared-task-liveness-unknown',true],
 ['unconfirmed status',{task:{...task,status:undefined},observedAt:now},'unknown','shared-task-liveness-unknown',true],
 ['future timestamp',{task:{...task,updatedAt:now+1},observedAt:now},'unknown','shared-task-liveness-unknown',true],
])test('event write gate: '+name,()=>{const r=decideSharedWrite({...input,now});assert.deepEqual([r.decision,r.reason,r.allowed],[decision,reason,allowed]);assert.equal(r.readOnlyOpen,true);assert.equal(r.kickOtherOwner,false);});
test('fresh query on each event, terminal unverifiable, automation warning, no write dispatch',async()=>{
 let calls=0,status='running';const g=new SharedWriteGate({readTask:async()=>{calls++;return {...task,status,cronAutomationId:'cron'};},clock:()=>now});
 assert.equal((await g.preflight({})).allowed,true);status='completed';const r=await g.preflight({});assert.deepEqual([r.decision,r.allowed,r.requiresConfirmation],['unverifiable',true,false]);assert.equal(r.warning,'automation-bound-session-may-run-in-background');assert.equal(calls,2);
 const unknown=await new SharedWriteGate({readTask:async()=>{throw Error();}}).preflight({});assert.equal(unknown.allowed,false);
});
test('operator confirmation never invents idle or gates official admission',async()=>{
 const confirmed=new SharedWriteGate({readTask:async()=>({...task,status:'completed',updatedAt:1}),isConfirmed:()=>true,clock:()=>now,readActivity:async()=>{throw Error('must not sample')}});
 const r=await confirmed.preflight({});assert.deepEqual([r.decision,r.allowed,r.reason],['unverifiable',true,'shared-terminal-task-liveness-unverifiable']);
});
const usage={totalTokens:2,inputTokens:1,outputTokens:1,totalSessions:1,totalTurns:1,toolCallCount:0,requestCount:1};
const sample=()=>({tasks:[task],usage:{...usage},rpc:['zcode-task.listTasks']});
test('triple observation accepts only stable official usage, no new run and fixed RPC allowlist',()=>{
 assert.equal(compareObservation(sample(),sample()).pass,true);
 const u=sample();u.usage.requestCount++;assert.equal(compareObservation(sample(),u).reason,'shared-usage-changed-attribution-unknown');
 const t=sample();t.tasks.push({...task,taskId:'new'});assert.equal(compareObservation(sample(),t).newRunCount,1);
 const changed=sample();changed.tasks=[{...task,status:'completed'}];assert.equal(compareObservation(changed,sample()).newRunCount,1);
 const r=sample();r.rpc.push('zcode-agent.resumeSession');assert.equal(compareObservation(sample(),r).whitelistUnchanged,false);
 assert.equal(compareObservation(null,sample()).pass,false);
 for(const s of ['closeSession','closeDeferredDraftSession','sendConversationCommandV4','resumeSession','testModelConnectivity'])assert.ok(LIVE_HTTP_READ_CALLS.every(c=>!c.includes(s)));
});
test('auth is projected only from official authenticated state and executable provider; failures remain explicit',()=>{
 assert.equal(authProjection({status:'authenticated'},'active',{providers:[{providerId:'account:zai-start-plan',accountState:{availability:'available',current:true,entitled:true},executable:true}]}).auth,'authenticated');
 assert.equal(authProjection({status:'authenticated'},'active',{providers:[{providerId:'deepseek',executable:true}]}).auth,'unconfirmed');
 assert.equal(authProjection({status:'authenticated'},null,{providers:[]}).auth,'unconfirmed');
 assert.equal(authProjection({status:'signed-out'},null,{providers:[]}).auth,'signed-out');assert.equal(authProjection({status:'reauthentication-required'},null,{}).auth,'reauthentication-required');assert.throws(()=>authProjection({},null,{}),/unconfirmed/);
 assert.equal(usageProjection({source:'agent-db',summary:usage,models:[{requestCount:1}]}).requestCount,1);
});
test('Host-backed projection exposes official multi-workspace metadata without a second CLI; write remains disabled',async()=>{
 let listener;const launcher={state:{},subscribe:f=>(listener=f,()=>{}),start:async()=>({phase:'ready',auth:'authenticated',mainPid:1}),read:async()=>({tasks:[{...task,title:'real',workspacePath:'/project'}],observedAt:now}),dispose:async()=>{}};
 const h=new BridgeHost({authorityMode:'host-backed',launcher,spawnProcess:()=>{throw Error('must not spawn');}});
 assert.equal((await h.connect()).auth,'authenticated');const result=await h.listSessions();assert.equal(result.sessions[0].address.workspace,'/project');assert.equal(result.catalog.readOnly,true);assert.equal(result.management.rename,false);assert.throws(()=>h.createConversation(result.sessions[0].address),/source-unavailable/);
 listener({phase:'failed',reason:'official-credential-recovery-observed'});assert.equal(h.status.connected,false);await h.dispose();
});
test('Host presentation exposes only verified title sources and hides deleted metadata',async()=>{
 const task={taskId:'one',title:'Title',workspacePath:'/project',status:'completed',updatedAt:10};
 const launcher={state:{},subscribe:()=>()=>{},start:async()=>({phase:'ready',auth:'authenticated',mainPid:1}),read:async()=>({tasks:[{...task,titleOverridden:true,pinned:true},{...task,taskId:'unknown'},{...task,taskId:'generated',titleSource:'generated'},{...task,taskId:'deleted',deleted:true}],observedAt:20}),dispose:async()=>{}};
 const h=new BridgeHost({authorityMode:'host-backed',launcher});
 try{await h.connect();const result=await h.listSessions();assert.equal(result.sessions.length,3);assert.deepEqual(result.sessions.map(row=>row.sharedTask.titleSource),['custom','unknown','generated']);assert.equal(result.sessions[0].sharedTask.pinned,true);assert.equal(result.management.rename,false)}finally{await h.dispose()}
});
