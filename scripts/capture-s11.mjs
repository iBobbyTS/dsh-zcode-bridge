// Read-only official host capability/registration probe. No model/GUI/helper launch.
import { spawn, execFile } from 'node:child_process';
import { mkdtemp, realpath, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ProtocolPeer, HostCallbackError } from '../packages/host/protocol.mjs';
import { CatalogClient } from '../packages/host/catalog.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';
const destination=resolve(process.argv[3]??'tests/fixtures/s11');
const workspacePath=await realpath(await mkdtemp(join(tmpdir(),'zcode-s11-ws-')));
const home=await mkdtemp(join(tmpdir(),'zcode-s11-home-'));
const evidence={provenance:{kind:'official-runtime-capture',capturedAt:new Date().toISOString(),paidModelCalls:0,isolation:'dedicated tmp HOME + workspace',sanitization:'paths/session aliased; stderr counted only'},probes:{},reverseRequests:[],notificationMethods:[]};
let child,peer,exited,conversation,catalog,sessionId;
const sanitize=value=>JSON.parse(JSON.stringify(value).split(home).join('/fixture/s11-home').split(workspacePath).join('/fixture/s11-workspace').split(sessionId??'__no_session__').join('s11-session'));
async function probe(name,method,params){try{const result=await peer.request(method,params);evidence.probes[name]={method,result:sanitize(result)};return result}catch(error){evidence.probes[name]={method,error:{code:error.code,protocolCode:error.protocolCode}}}}
try{
 const installation=await inspectInstallation(process.argv[2]??'/Applications/ZCode.app');
 if(!installation.verified)throw Error('installation-unverified');
 Object.assign(evidence.provenance,{version:installation.version,build:installation.build,sha256:installation.sha256,stderrBytes:0});
 const sdk=join(installation.appPath,'Contents/Resources/glm/packages/zcode-cua-plugin/scripts/computer-use-client.mjs');
 const nodeHost=join(installation.appPath,'Contents/Resources/glm/packages/node-repl-host/dist/mcp/server.js');
 const helper=join(installation.appPath,'Contents/Resources/cua-helper/ZCode Computer Use.app/Contents/MacOS/ZCode Computer Use');
 const sdkText=await readFile(sdk,'utf8'),nodeHostText=await readFile(nodeHost,'utf8');
 evidence.packagedCua={sdk:{path:sdk,sha256:createHash('sha256').update(sdkText).digest('hex'),setupLine:sdkText.slice(0,sdkText.indexOf('export async function setupComputerUseRuntime')).split('\n').length},nodeHost:{path:nodeHost,sha256:createHash('sha256').update(nodeHostText).digest('hex'),captureLine:nodeHostText.slice(0,nodeHostText.indexOf('function captureComputerUseRuntimeFromEnvironment')).split('\n').length,standaloneLaunchLine:nodeHostText.slice(0,nodeHostText.indexOf('async function ensureStandaloneHelperLaunched')).split('\n').length},helper:{path:helper,present:(await stat(helper)).isFile(),launched:false,permissions:'unknown'}};
 // Official SDK non-model self-check: absent bridge rejects BEFORE any call/socket/helper launch.
 const {stdout}=await promisify(execFile)(installation.launcher,['--input-type=module','-e',`const sdk=await import(${JSON.stringify(pathToFileURL(sdk).href)});try{await sdk.setupComputerUseRuntime({globals:{}});console.log(JSON.stringify({setup:'unexpected-success'}))}catch(error){console.log(JSON.stringify({setup:'unavailable',message:error.message,exportedMethods:sdk.COMPUTER_METHOD_NAMES}))}`],{cwd:workspacePath,env:{...runtimeEnv(installation.providerConfig),HOME:home},timeout:5000,maxBuffer:4096});
 evidence.probes.cuaSdkSelfCheck={method:'official SDK setupComputerUseRuntime({globals:{}})',result:JSON.parse(stdout.trim())};
 if(evidence.probes.cuaSdkSelfCheck.result.setup!=='unavailable')throw Error('unexpected-cua-selfcheck-success');
 const artifact=await readFile(installation.cjs,'utf8');
 evidence.installedCarrierStrings=Object.fromEntries(['interaction/browserList','interaction/browserExecute','computer-use/operation-event','v4/cua/permission-observation','ZCODE_CUA_PERMISSION_BROKER_SOCKET'].map(name=>[name,{offset:artifact.indexOf(name),line:artifact.slice(0,artifact.indexOf(name)).split('\n').length}]));
 child=spawn(installation.launcher,[installation.cjs,'app-server','--stdio'],{cwd:workspacePath,env:{...runtimeEnv(installation.providerConfig),HOME:home},stdio:['pipe','pipe','pipe']});
 exited=new Promise(r=>child.once('close',r));child.stderr.on('data',b=>evidence.provenance.stderrBytes+=b.length);
 peer=new ProtocolPeer(child.stdout,child.stdin,{timeoutMs:20000,onRequest:m=>{evidence.reverseRequests.push(sanitize(m));throw new HostCallbackError(-32601,'No executor in read-only capture')}});
 peer.onNotification(m=>{if(!evidence.notificationMethods.includes(m.method))evidence.notificationMethods.push(m.method)});
 await probe('capabilities','runtime/capabilities',{});
 catalog=new CatalogClient(peer,{workspace:{workspacePath,workspaceKey:workspacePath}});
 for(const [name,kind,params] of [['plugins','pluginsList',{}],['mcpStatus','mcpList',{mode:'status'}],['skills','skillReference',{}]])evidence.probes[name]={kind,result:sanitize(await catalog.read(kind,params))};
 const created=await peer.request('v4/command',{commandId:randomUUID(),clientId:'s11-capture',sessionId:null,type:'createSession',payload:{workspaceId:workspacePath},issuedAt:Date.now()});
 evidence.probes.create={method:'v4/command createSession',result:sanitize(created)};
 sessionId=created.result?.sessionId??created.ack?.result?.sessionId;if(!sessionId)throw Error('session-not-created');
 evidence.reverseRequests=evidence.reverseRequests.map(sanitize);evidence.probes.create.result=sanitize(created);
 conversation=new V4Conversation(peer,{address:{runtime:'zcode',authority:'s11-capture',workspace:workspacePath,sessionId},workspace:{workspacePath,workspaceKey:workspacePath},clientId:'s11-capture',connectionId:'s11-capture'});
 await conversation.connect();
 for(let i=0;i<300&&conversation.state.status!=='live';i++)await new Promise(r=>setTimeout(r,10));
 if(conversation.state.status!=='live')throw Error('projection-not-live');
 evidence.probes.mcpAfterMaterialization={kind:'mcpList',result:sanitize(await catalog.read('mcpList',{mode:'status'}))};
 evidence.probes.mcpConnect={kind:'mcpList',result:sanitize(await catalog.read('mcpList',{mode:'connect'}))};
 evidence.probes.projection={method:'v4/conversation/subscribe',result:sanitize(conversation.state)};
 // Direction check only: -32601 does NOT disprove reverse carrier reachability.
 await probe('browserListOutbound','interaction/browserList',{requestId:'s11-direction',sessionId,workspaceKey:workspacePath,workspacePath,clientMode:'web-remote-replayable',sessionContext:'live'});
 await probe('browserExecuteOutbound','interaction/browserExecute',{requestId:'s11-direction-execute',sessionId,command:{method:'list'}});
 evidence.toolRegistration={state:'unverified',reason:'no app-server tool-list method; plugin hostMcpServerNames and mcp/status are registration metadata, not proof of executable tools'};
 evidence.nonModelTrigger={found:true,executed:'official SDK absent-bridge self-check (no socket or helper launch)',browserCallbackTriggerFound:false,scope:'app-server method table + create/subscribe/read-only catalogs; CLI headless browser factory belongs to prompt CLI, not app-server',realCallbackFrames:'NOT_RUN: model-triggered; source and installed artifact establish carrier, fixtures test responder'};
 evidence.status='PASS';
}catch(error){evidence.status='NOT_RUN';evidence.reason=error.code??error.message}
finally{await conversation?.cancel().catch(()=>{});catalog?.dispose();peer?.close();if(child)await stopOwned(child,exited);await rm(workspacePath,{recursive:true,force:true});await rm(home,{recursive:true,force:true})}
await mkdir(destination,{recursive:true});await writeFile(join(destination,'official.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,reason:evidence.reason,paidModelCalls:0,plugins:evidence.probes.plugins?.result.plugins.filter(p=>/browser|cua|node-repl/.test(p.id)).map(p=>({id:p.id,enabled:p.enabled,hostMcpServerNames:p.hostMcpServerNames,mcpServerNames:p.mcpServerNames})),mcp:evidence.probes.mcpStatus,reverseRequests:evidence.reverseRequests.length,notifications:evidence.notificationMethods,directionChecks:[evidence.probes.browserListOutbound,evidence.probes.browserExecuteOutbound],installedCarrierStrings:evidence.installedCarrierStrings},null,2));
if(evidence.status!=='PASS')process.exitCode=1;
