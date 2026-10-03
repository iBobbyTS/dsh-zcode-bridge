// Own headless official runtime, dedicated workspace, draft-only: zero model/task execution.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';
const destination=resolve(process.argv[2]??'tests/fixtures/s03a');
const workspacePath=await mkdtemp(join(tmpdir(),'zcode-s03a-'));
const installation=await inspectInstallation();
if(!installation.verified)throw Error('Official runtime identity mismatch');
const child=spawn(installation.launcher,[installation.cjs,'app-server','--stdio'],{cwd:workspacePath,env:runtimeEnv(installation.providerConfig),stdio:['pipe','pipe','pipe']});
const exited=new Promise(r=>child.once('close',r));let stderrBytes=0;child.stderr.on('data',b=>stderrBytes+=b.length);
const exchanges=[],notifications=[];
const peer=new ProtocolPeer(child.stdout,child.stdin,{timeoutMs:15000});
peer.onNotification(m=>{if(m.method==='v4/conversation/frame')notifications.push(m)});
const workspace={workspacePath,workspaceKey:workspacePath};
async function request(method,params){
 const record={method,params};exchanges.push(record);
 try{record.result=await peer.request(method,params);return record.result}catch(e){record.error={code:e.code,protocolCode:e.protocolCode};return null}
}
let sessionId,subscriptionId,productionOracle;
try{
 await request('runtime/capabilities',{});
 await request('v4/commands/query',{commands:[{sessionId:null,commandId:'s03a-unknown'}]});
 await request('v4/command',{commandId:'s03a-invalid',clientId:'s03a-capture',sessionId:null,type:'sendText',payload:{},issuedAt:0});
 const draft=await request('v4/command',{commandId:randomUUID(),clientId:'s03a-capture',sessionId:null,type:'createSession',payload:{workspaceId:workspacePath},issuedAt:Date.now()});
 sessionId=draft?.result?.sessionId;
 if(sessionId){
  const subscribed=await request('v4/conversation/subscribe',{topic:'conversation/'+sessionId,connectionId:'s03a-capture',clientMode:'web-remote-replayable',workspace});
  subscriptionId=subscribed?.ack?.subscriptionId;
  if(subscriptionId){
   const renameId=randomUUID();
   await request('v4/command',{commandId:renameId,clientId:'s03a-capture',sessionId,type:'renameSession',payload:{title:'S03.A fixture draft'},issuedAt:Date.now()});
   await request('v4/commands/query',{commands:[{sessionId,commandId:renameId}]});
   const modeId=randomUUID();
   await request('v4/command',{commandId:modeId,clientId:'s03a-capture',sessionId,type:'setFollowupMode',baseRevision:0,payload:{mode:'queue'},issuedAt:Date.now()});
   await request('v4/commands/query',{commands:[{sessionId,commandId:modeId}]});
   await request('v4/command',{commandId:randomUUID(),clientId:'s03a-capture',sessionId,type:'setFollowupMode',baseRevision:999999,payload:{mode:'queue'},issuedAt:Date.now()});
   await new Promise(r=>setTimeout(r,250));
   await request('v4/conversation/resync',{topic:'conversation/'+sessionId,connectionId:'s03a-capture',subscriptionId,base:null,forceSnapshot:true});
   const continuous=await request('v4/conversation/subscribe',{topic:'conversation/'+sessionId,connectionId:'s03a-continuous',clientMode:'desktop-continuous',workspace});
   if(continuous?.ack?.subscriptionId)await request('v4/conversation/unsubscribe',{topic:'conversation/'+sessionId,connectionId:'s03a-continuous',subscriptionId:continuous.ack.subscriptionId});
   await request('v4/conversation/unsubscribe',{topic:'conversation/'+sessionId,connectionId:'s03a-capture',subscriptionId});
  }
  const waiters=new Set();
  const conversation=new V4Conversation(peer,{address:{runtime:'zcode',authority:'official-s03a-capture',workspace:workspacePath,sessionId},workspace,connectionId:'s03a-production',clientId:'s03a-production',runnable:true,onChange:()=>{for(const listener of waiters)listener()}});
  // The internal fixture owner permits only this non-model config command; no app availability claim.
  const waitForLive=()=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{waiters.delete(check);reject(Error('Production projection deadline'))},5000);
   const check=()=>{if(conversation.state.status==='live'){clearTimeout(timer);waiters.delete(check);resolve()}else if(['error','closed'].includes(conversation.state.status)){clearTimeout(timer);waiters.delete(check);reject(Error('Production projection '+conversation.state.error))}};
   waiters.add(check);check();
  });
  try{
   await conversation.connect();await waitForLive();
   const subscribedState=conversation.state;
   const command=await conversation.submit({type:'setFollowupMode',payload:{mode:'guide'}});
   const queried=await conversation.queryCommand(command.commandId);
   await conversation.resync({forceSnapshot:true});await waitForLive();
   productionOracle={status:conversation.state.status,profile:conversation.state.profile,subscriptionId:subscribedState.subscriptionId,initialSeq:subscribedState.snapshot.seq,resyncSeq:conversation.state.snapshot.seq,commandState:command.state,commandAck:command.ack,queryState:queried.state,paidModelCalls:0};
  }finally{await conversation.cancel()}
  await request('v4/command',{commandId:randomUUID(),clientId:'s03a-capture',sessionId,type:'deleteSession',payload:{},issuedAt:Date.now()});
 }
}finally{
 peer.close();await stopOwned(child,exited);await rm(workspacePath,{recursive:true,force:true});
}
// Fixture paths/ids are aliases of captured values; no user session/body/credentials collected.
const raw=JSON.stringify({exchanges,notifications,productionOracle});
const otherSubscriptions=exchanges.filter(x=>x.method==='v4/conversation/subscribe'&&x.result?.ack?.subscriptionId!==subscriptionId).map(x=>x.result?.ack?.subscriptionId).filter(Boolean);
if(productionOracle?.subscriptionId)otherSubscriptions.push(productionOracle.subscriptionId);
const replacements=[[workspacePath,'/fixture/workspace'],[sessionId,'fixture-session'],[subscriptionId,'fixture-subscription'],...otherSubscriptions.map((id,i)=>[id,'fixture-continuous-'+i])].filter(([x])=>x).sort((a,b)=>b[0].length-a[0].length);
let sanitized=raw;for(const [from,to] of replacements)sanitized=sanitized.split(from).join(to);
await mkdir(destination,{recursive:true});
const captured=JSON.parse(sanitized);
await writeFile(join(destination,'official.json'),JSON.stringify({provenance:{kind:'official-runtime-capture',capturedAt:new Date().toISOString(),version:installation.version,build:installation.build,sha256:installation.sha256,paidModelCalls:0,stderrBytes,sanitization:'dedicated workspace/session/subscription identifiers aliased; no model inputs or credentials'},...captured},null,2)+'\n');
console.log(JSON.stringify({exchanges:exchanges.map(x=>({method:x.method,status:x.result?.status,error:x.error})),notifications:notifications.length,productionOracle,paidModelCalls:0}));
