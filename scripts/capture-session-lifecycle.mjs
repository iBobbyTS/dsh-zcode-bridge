// Dedicated self-owned headless process. All inputs are protocol metadata/config;
// no GUI, credential reads, model inputs, session/close or database access.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {inspectInstallation,runtimeEnv} from '../packages/host/installation.mjs';import {ProtocolPeer} from '../packages/host/protocol.mjs';import {BridgeHost,stopOwned} from '../packages/host/runtime.mjs';
const destination=resolve(process.argv[2]??'tests/fixtures/session-lifecycle'),workspacePath=await realpath(await mkdtemp(join(tmpdir(),'zcode-session-lifecycle-')));
const installation=await inspectInstallation();assert.equal(installation.verified,true);
const child=spawn(installation.launcher,[installation.cjs,'app-server','--stdio'],{cwd:workspacePath,env:runtimeEnv(installation.providerConfig),stdio:['pipe','pipe','pipe']});
const exited=new Promise(resolve=>child.once('close',resolve));let stderrBytes=0;child.stderr.on('data',b=>stderrBytes+=b.length);
const workspace={workspacePath,workspaceKey:workspacePath},exchanges=[],notifications=[],ids=[];const peer=new ProtocolPeer(child.stdout,child.stdin);
peer.onNotification(m=>{if(m.method==='v4/conversation/frame')notifications.push(m)});
const request=async(method,params)=>{const exchange={method,params};exchanges.push(exchange);try{const result=await peer.request(method,params);exchange.result=method==='session/create'?{session:result.session,runtime:result.runtime}:result;return result}catch(e){exchange.error={code:e.code,protocolCode:e.protocolCode};throw e}};
let host,oracle;
try{
 await request('runtime/capabilities',{});
 for(let i=0;i<3;i++){const result=await request('session/create',{workspace,persistence:'immediate',titleGenerationEnabled:false});ids.push(result.session.sessionId)}
 const prefix=await request('session/list',{workspace,limit:2}),complete=await request('session/list',{workspace,limit:4});assert.ok(prefix.sessions.length>=2);assert.equal(complete.sessions.length,3);
 const stale=await request('v4/command',{commandId:randomUUID(),clientId:'session-lifecycle-capture',sessionId:ids[0],type:'setFollowupMode',baseRevision:99999,payload:{mode:'queue'},issuedAt:Date.now()});assert.equal(stale.status,'stale');
 // The test harness transfers its own child to the production Host only after
 // draining/withdrawing the capture peer. No production attach capability is added.
 peer.close();host=new BridgeHost({workspacePath,inspect:async()=>installation,spawnProcess:()=>child});const status=await host.connect();assert.equal(status.connected,true);assert.equal(status.state,'restricted');
 const catalog=await host.listSessions();assert.equal(catalog.sessions.length,3);const address=catalog.sessions[0].address;
 const a=await host.openConversation(address),b=await host.openConversation(address);
 const waitLive=async opened=>{for(let i=0;i<500;i++){opened.state=await host.conversationOperation({handle:opened.handle,operation:'state'});if(opened.state.status==='live')return;if(['error','closed'].includes(opened.state.status))throw Error(opened.state.error);await new Promise(resolve=>setTimeout(resolve,10))}throw Error('official-initial-frame-timeout')};
 await waitLive(a);await waitLive(b);
 const searched=catalog.sessions.filter(row=>(row.title||row.address.sessionId).includes(address.sessionId));assert.equal(searched.length,1);assert.equal(catalog.sessions.filter(row=>(row.title||row.address.sessionId).includes('absent-session-lifecycle-query')).length,0);
 const rename=await host.conversationOperation({handle:a.handle,operation:'command',command:{type:'renameSession',payload:{title:'Session lifecycle isolated title'}}});
 const afterRename=await host.listSessions();assert.equal(afterRename.sessions[0].title,catalog.sessions[0].title);
 const deletion=await host.conversationOperation({handle:b.handle,operation:'command',command:{type:'deleteSession',payload:{}}});assert.equal(deletion.ack.status,'accepted');assert.equal((await host.listSessions()).sessions.some(row=>row.address.sessionId===address.sessionId),false);
 for(const row of (await host.listSessions()).sessions){const opened=await host.openConversation(row.address);await waitLive(opened);await host.conversationOperation({handle:opened.handle,operation:'command',command:{type:'deleteSession',payload:{}}})}
 oracle={authorityKind:'owned-headless',sharedGui:'unverified',state:status.state,create:'PASS',list:'PASS',limitBoundary:{limit:2,prefix:prefix.sessions.length,total:3,observation:'live-record merge can exceed limit; stored prefix truncation is fixture-tested'},search:'PASS (local title/id projection; positive=1, negative=0)',open:'PASS (two independent V4 owners)',rename:{status:rename.state,ack:rename.ack,result:'FAILED (official Session not found)'},stale:{status:stale.status,reasonCode:stale.reasonCode,revisionAtDecision:stale.revisionAtDecision},delete:'PASS',remaining:(await host.listSessions()).sessions.length,paidModelCalls:0};
 assert.equal(oracle.remaining,0);
}catch(e){oracle={result:'FAILED',error:e.message,stack:e.stack,paidModelCalls:0};process.exitCode=1}
finally{peer.close();if(host)await host.dispose();else await stopOwned(child,exited);await rm(workspacePath,{recursive:true,force:true})}
// Keep source fields; alias only this run's dedicated workspace/session ids.
let serialized=JSON.stringify({exchanges,notifications,oracle});serialized=serialized.split(workspacePath).join('/fixture/session-lifecycle-workspace');for(let i=0;i<ids.length;i++)serialized=serialized.split(ids[i]).join('session-lifecycle-official-'+i);
await mkdir(destination,{recursive:true});await writeFile(join(destination,'official.json'),JSON.stringify({provenance:{kind:'official-runtime-capture',capturedAt:new Date().toISOString(),version:installation.version,build:installation.build,sha256:installation.sha256,paidModelCalls:0,stderrBytes,changes:['dedicated workspace/session identifiers aliased','session/create response retains only session/runtime metadata'],scope:'owned live process; GUI and cold authority unverified'},...JSON.parse(serialized)},null,2)+'\n');
console.log(JSON.stringify(oracle));
