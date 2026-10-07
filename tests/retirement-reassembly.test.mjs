// Driver-only reassembly: bundle/files whitelists, patch/bundle rows, the llm route re-home, the
// retained send-now dock + interlock notice, and the offline-testable acceptance --driver-mode
// helpers. Component checks bundle the real published sources under jsdom.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
import {parseAcceptanceArgs,assertAcceptanceArgs,profilePatchFor,pluginInstallTargets,driverModeProbe,mergeAcceptanceOutcome,acceptanceExitCode,ACCEPTANCE_OPTIONS} from '../scripts/acceptance-driver-mode.mjs';
import {ParityController} from '../packages/client/parity.mjs';
import {ParityService,PARITY_NATIVE_COMMANDS} from '../packages/host/parity.mjs';
import {commandWorld,queueItem,tick} from './helpers/lifecycle-commands.mjs';

const repo=process.cwd();
const read=(...parts)=>readFileSync(join(repo,...parts),'utf8');
const json=p=>JSON.parse(read(p));
const npmRoot=process.env.DSH_DRIVER_NPM_NODE_MODULES??'/private/tmp/dsh-local-npm-verify/npm/node_modules';
const artifact=name=>join(npmRoot,'@deepseek-ai',name,'lib/index.js');
const cordisAvailable=['cordis','dsh-agent','dsh-session','dsh-scope'].every(name=>existsSync(artifact(name)));
const real={skip:cordisAvailable?false:'requires rc.2 npm artifacts; set DSH_DRIVER_NPM_NODE_MODULES'};

test('bundle and files whitelists ship the driver and drop the retired co-existence layer',()=>{
  const patch=read('cordis.patch.yml');
  assert.match(patch,/id: zcode-driver\s+name: '@dsh-zcode\/driver'/);
  assert.doesNotMatch(patch,/disabled:/,'the delivered patch never disables an official row');
  assert.doesNotMatch(patch,/id: (agent-loop|ui-settings-agent-loop)\b/,'no official row added or altered');
  const bundle=json('bridge-bundle.json');
  assert.ok(bundle.plugins.some(plugin=>plugin.id==='zcode-driver'&&plugin.kind==='host'));
  const rootFiles=json('package.json').files;
  assert.ok(rootFiles.includes('packages/driver/*.mjs'));
  assert.ok(rootFiles.includes('packages/client/lib/client.js'));
  for(const retired of ['packages/client/runtime.mjs','packages/client/runtime-controls.mjs'])assert.equal(rootFiles.includes(retired),false,`root files exclude ${retired}`);
  const clientFiles=json('packages/client/package.json').files;
  for(const retired of ['runtime.mjs','runtime-controls.mjs'])assert.equal(clientFiles.includes(retired),false,`client files exclude ${retired}`);
  assert.ok(clientFiles.includes('lib/client.js'));
});

test('the published client artifact carries no co-existence identifiers and keeps the retained dock',()=>{
  const code=buildSync({entryPoints:[join(repo,'packages/client/client.jsx')],bundle:true,write:false,platform:'browser',format:'esm',external:['react','@deepseek-ai/*']}).outputFiles[0].text;
  for(const residue of ['RuntimeHero','RuntimeLockedLabel','RuntimeLifecycleDock','zcode-provider-badge','zcode-conversation-view','zcode-directory','ZCodeConversationView'])
    assert.equal(code.includes(residue),false,`published artifact excludes ${residue}`);
  for(const kept of ['zcode-send-now-dock','zcode-interlock','data-zcode-user-input','data-zcode-history-mutations','data-zcode-hook-review'])
    assert.ok(code.includes(kept),`published artifact keeps ${kept}`);
});

test('the retired host runtime wiring no longer installs the mirror guards/history or the llm route',()=>{
  const source=read('packages/host/zcode-runtime.mjs');
  assert.doesNotMatch(source,/installMirrorGuards\s*\(/,'mirror guards are not installed by the host runtime entry');
  assert.doesNotMatch(source,/installMirrorHistory\s*\(/,'mirror history is not installed by the host runtime entry');
  assert.doesNotMatch(source,/installZCodeLlm\s*\(/,'the llm route is not registered by the retired host entry');
  assert.match(source,/host\.zcodeCatalog=\(\)=>runtime\.catalogSnapshot\(\)/,'the catalog read side the driver consumes is retained');
  assert.match(source,/host\.zcodeModels=\(\)=>runtime\.modelProviders\(\)/,'the model discovery the adapter consumes is retained');
});

test('driver occupancy re-homes the zcode llm route onto the official registry',real,async()=>{
  const {registerHooks}=await import('node:module');
  const anchor=pathToFileURL(join(npmRoot,'..','resolve-anchor.js')).href;
  registerHooks({resolve(specifier,context,nextResolve){return specifier.startsWith('@deepseek-ai/')?nextResolve(specifier,{...context,parentURL:anchor}):nextResolve(specifier,context)}});
  const {apply,armLlmRouteReadiness}=await import('../packages/driver/index.mjs');
  const registered=[],announcements=[];
  const llm={listProviders:()=>[{id:'zcode',name:'Zcode'}],registerAdapter:(providers,adapter)=>{registered.push({providers,adapter});const handle=()=>{};handle.replace=next=>announcements.push(next);return handle}};
  // The host assigns `zcodeModels` asynchronously at the end of installZCodeRuntime; the driver
  // must not judge its presence once at install time.
  const host={driverState:null};
  const ctx={
    zcodeBridgeHost:host,fiber:{assertActive(){}},
    get:name=>({llm,sessionPersistence:undefined,sessionQuery:undefined,sessions:undefined,workspaceRegistry:undefined}[name]),
    effect:callback=>{const result=callback();const cleanups=[];if(result&&typeof result.next==='function'){let step=result.next();while(!step.done){if(step.value)cleanups.push(step.value);step=result.next()}}else if(typeof result==='function')cleanups.push(result);return ()=>{for(const cleanup of cleanups.splice(0).reverse())try{cleanup()}catch{}}},
    on:()=>()=>{},emit(){},inject:(names,callback)=>({await:async()=>{if(names.includes('llm'))await callback(ctx)}}),
    agents:{setFactory(){return ()=>{}}},sessions:{},sessionProjections:{register(){return ()=>{}}},
  };
  await apply(ctx);
  assert.equal(host.driverState.state,'occupied');
  assert.equal(host.llmRouteState.state,'registered');
  assert.equal(host.llmRouteState.discovery(),false,'discovery is not ready yet at install time');
  assert.equal(registered.length,1);
  assert.deepEqual(registered[0].providers,['zcode']);
  assert.deepEqual(await registered[0].adapter.listModels('zcode'),[],'an unready discovery advertises nothing instead of failing the route');
  // The host finishes asynchronously; the already-registered route picks discovery up lazily.
  host.zcodeModels=()=>[{id:'A',models:[{id:'model_a',reasoningLevels:['low'],defaultReasoningLevel:'low'}]}];
  assert.equal(host.llmRouteState.discovery(),true);
  assert.deepEqual((await registered[0].adapter.listModels('zcode')).map(model=>model.id),['A/model_a'],'the adapter reads the retained host discovery after the host is ready');
  // installZCodeLlm keeps the official handle's `replace`, so readiness can re-announce the route.
  const {installZCodeLlm}=await import('../packages/host/zcode-llm.mjs');
  const directReplaces=[],directHandle=()=>{};directHandle.replace=next=>directReplaces.push(next);
  const directLlm={registerAdapter:()=>directHandle};
  const installed=installZCodeLlm({get:()=>directLlm,effect:()=>{}},{discover:async()=>[]});
  assert.equal(typeof installed.replace,'function','the registration handle keeps the official replace');
  installed.replace(['zcode']);
  assert.deepEqual(directReplaces,[['zcode']]);
  // Readiness re-announces the route through the official handle so `llm/adapters-updated` fires
  // once, waking the catalog cache and the default-model cover together.
  let ready=false,setTimeoutStore=null,readyCalls=0;
  const stop=armLlmRouteReadiness({replace:next=>announcements.push(next),isReady:()=>ready,onReady:()=>{readyCalls++},intervalMs:1,maxAttempts:5,setTimeoutImpl:fn=>{setTimeoutStore=fn;return {unref(){}}},clearTimeoutImpl:()=>{}});
  assert.equal(readyCalls,0,'a pending discovery arms a timer instead of concluding');
  ready=true;setTimeoutStore();
  assert.deepEqual(announcements,[['zcode']],'the route is re-announced exactly once when discovery becomes ready');
  assert.equal(readyCalls,1);
  stop();
  // Already-ready discovery does not need a replacement announcement.
  let replaceCalls=0;const stop2=armLlmRouteReadiness({replace:()=>replaceCalls++,isReady:()=>true,onReady:()=>{}});
  assert.equal(replaceCalls,0);stop2();
  // Bounded: a discovery that never becomes ready ends as an explicit failure, not a silent hang.
  const failures=[];let neverTick=null;
  const stop3=armLlmRouteReadiness({replace:()=>{},isReady:()=>false,onReady:error=>failures.push(error?.code),maxAttempts:1,intervalMs:1,setTimeoutImpl:fn=>{neverTick=fn;return {unref(){}}},clearTimeoutImpl:()=>{}});
  neverTick();
  assert.deepEqual(failures,['llm-route-readiness-timeout']);stop3();
});

function loadDock(){
  const require=createRequire(pathToFileURL(resolve(repo,'package.json')));
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const React=require('react');
  const {createRoot}=require('react-dom/client');
  const {Simulate}=require('react-dom/test-utils');
  const code=buildSync({entryPoints:[join(repo,'packages/client/session-dock-controls.jsx')],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text;
  const mod={exports:{}};
  vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,mod,mod.exports);
  return {React,createRoot,Simulate,...mod.exports};
}
function controllerWith({sendQueuedNowAllowed=true,driverState}){
  const calls=[];
  const state={status:'live',snapshot:{revision:4,logEpoch:'epoch-4',queue:{items:[{queueItemId:'q-1',text:'paused input',dispatch:{state:'queued'}}]},availability:{sendQueuedNow:{allowed:sendQueuedNowAllowed,...(sendQueuedNowAllowed?{}:{reasonCode:'sendQueuedNowRequiresRunning'})}}},...driverState?{driverState}:{}};
  return {calls,driverState,
    subscribe:()=>()=>{},
    async call(domain,operation){if(domain==='snapshot'&&operation==='read')return structuredClone(state);throw new Error('unexpected')},
    async command(type,params,snapshot){calls.push({type,params,snapshot:structuredClone(snapshot)});return {ack:{status:'accepted'},state:'accepted-awaiting-terminal'}},
  };
}

test('the retained send-now dock issues sendQueuedNow with the frozen CAS only when the official queue allows it',async()=>{
  const {React,createRoot,Simulate,QueueSendNowControl}=loadDock();
  const root=createRoot(document.getElementById('root'));
  const controller=controllerWith({sendQueuedNowAllowed:true});
  await React.act(async()=>root.render(React.createElement(QueueSendNowControl,{controller,pollMs:0})));
  const button=document.querySelector('[data-zcode-send-now="q-1"]');
  assert.ok(button,'the paused queued input has a send-now entry');
  assert.equal(button.disabled,false);
  await React.act(async()=>Simulate.click(button));
  assert.deepEqual(controller.calls,[{type:'sendQueuedNow',params:{queueItemId:'q-1'},snapshot:{revision:4,logEpoch:'epoch-4'}}],'the command carries the frozen CAS baseline');
  const denied=controllerWith({sendQueuedNowAllowed:false});
  await React.act(async()=>root.render(React.createElement(QueueSendNowControl,{controller:denied,pollMs:0})));
  assert.equal(document.querySelector('[data-zcode-send-now="q-1"]').disabled,true);
  assert.match(document.querySelector('[data-zcode-send-now-unavailable]').textContent,/sendQueuedNowRequiresRunning/);
  assert.equal(denied.calls.length,0,'a denied control never reaches the wire');
  root.unmount();
});

test('a native driver session routes the send-now dock command through parity to submitControl',async()=>{
  assert.ok(PARITY_NATIVE_COMMANDS.has('sendQueuedNow'));
  const w=await commandWorld('idle');
  try{
    const published=structuredClone(w.peer.snapshot);published.seq++;published.revision++;
    published.availability={...published.availability,sendQueuedNow:{allowed:true}};
    published.queue={items:[queueItem()],autoDrain:true,pauseReason:'manual'};
    w.peer.publish(published);await tick();
    const agent=w.agent;
    const runtime={disposed:false,ctx:{agents:{get:id=>id===agent.id?agent:undefined}}};
    const parity=new ParityService(runtime);
    const rpc={call:async(_channel,_endpoint,payload)=>{try{return {ok:true,value:await parity.handle(payload)}}catch(error){return {ok:false,error:{code:error.code??'mock-failure',message:error.message}}}}};
    const controller=new ParityController(rpc,{sessionId:agent.id});
    try{
      const current=agent.conversation.state.snapshot;
      const result=await controller.command('sendQueuedNow',{queueItemId:'queue-1'},{revision:current.revision,logEpoch:current.logEpoch});
      assert.equal(result.ack.status,'accepted');
      const sent=w.peer.calls.filter(call=>call.method==='v4/command').map(call=>call.params).find(command=>command.type==='sendQueuedNow');
      assert.ok(sent,'the send-now command reached the official wire');
      assert.equal(sent.baseRevision,current.revision,'the wire envelope keeps the frozen CAS revision');
      assert.deepEqual(sent.payload,{queueItemId:'queue-1'});
      const before=w.peer.calls.length;
      await assert.rejects(controller.command('sendQueuedNow',{queueItemId:'queue-1'},{revision:current.revision-1,logEpoch:current.logEpoch}),error=>error.code==='parity-projection-stale');
      assert.equal(w.peer.calls.length,before,'a stale baseline is refused before the wire');
    }finally{controller.dispose()}
  }finally{await w.close()}
});

test('the interlock notice is visible only while the official loop blocks the driver',async()=>{
  const {React,createRoot,ZCodeInterlockBanner}=loadDock();
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(ZCodeInterlockBanner,{status:{driverState:{state:'blocked-official-loop-active',reason:'disable official agent loop'}}})));
  assert.ok(document.querySelector('[data-zcode-interlock]'),'blocked state shows the notice');
  assert.match(document.body.textContent,/disable official agent loop/);
  await React.act(async()=>root.render(React.createElement(ZCodeInterlockBanner,{status:{driverState:{state:'occupied'}}})));
  assert.equal(document.querySelector('[data-zcode-interlock]'),null,'occupied state hides the notice');
  await React.act(async()=>root.render(React.createElement(ZCodeInterlockBanner,{status:{}})));
  assert.equal(document.querySelector('[data-zcode-interlock]'),null);
  root.unmount();
});

test('the acceptance runner --driver-mode helpers are offline-testable and leave non-driver mode unchanged',()=>{
  assert.ok(ACCEPTANCE_OPTIONS.has('--driver-mode'));
  assert.deepEqual(parseAcceptanceArgs(['--driver-mode','--port','3210']),{root:undefined,port:3210,smoke:false,prepareOnly:false,diagnose:false,driverMode:true});
  assert.throws(()=>parseAcceptanceArgs(['--unknown']),/Unknown option/);
  assert.throws(()=>parseAcceptanceArgs(['--root']),/Missing value/);
  assert.throws(()=>assertAcceptanceArgs({port:1}),/Invalid port/);
  const launcher={mode:'live-http'};
  const plain=profilePatchFor({launcher,driverMode:false});
  assert.equal(plain.some(row=>row.id==='agent-loop'),false,'the delivered/generated non-driver profile never disables an official row');
  assert.deepEqual(plain.map(row=>row.id),['zcode-bridge-host','session-title-llm']);
  assert.deepEqual(profilePatchFor({launcher,driverMode:true}).map(row=>[row.id,row.disabled??false]),[['agent-loop',true],['zcode-bridge-host',false],['session-title-llm',true]],'driver mode disables the official row only in the isolated profile');
  assert.equal(pluginInstallTargets({repo:repo.startsWith('/')?repo:'/repo',driverMode:false}).length,3);
  assert.ok(pluginInstallTargets({repo:'/repo',driverMode:true}).some(target=>target.endsWith('/packages/driver')),'driver mode installs the driver package');
  const ok=driverModeProbe({driverMode:true,bridgeStatus:{ok:true,launcherPhase:'ready',driverState:{state:'occupied'}},pluginErrors:[]});
  assert.deepEqual(ok,{ok:true,checks:{bridgeStatusOk:true,launcherReady:true,pluginErrors:true,driverOccupied:true}});
  assert.equal(driverModeProbe({driverMode:true,bridgeStatus:{ok:true,launcherPhase:'ready',driverState:{state:'blocked-official-loop-active'}},pluginErrors:[]}).ok,false,'driver mode requires occupancy');
  assert.equal(driverModeProbe({driverMode:false,bridgeStatus:{ok:true,launcherPhase:'ready'},pluginErrors:[]}).ok,true,'non-driver mode probe is unchanged');
  // Outcome merge: a failed lifecycle probe is preserved over the generic boot result and is a
  // non-zero smoke exit; a successful or disabled probe leaves the generic outcome and codes alone.
  assert.equal(mergeAcceptanceOutcome({genericOutcome:'web-booted',driverLifecycleProbe:{ok:false,failure:'no-session'}}),'driver-lifecycle-probe-unconfirmed','a failed probe is never masked by the generic outcome');
  assert.equal(mergeAcceptanceOutcome({genericOutcome:'seam-differences-found',driverLifecycleProbe:{ok:false}}),'driver-lifecycle-probe-unconfirmed');
  assert.equal(mergeAcceptanceOutcome({genericOutcome:'web-booted',driverLifecycleProbe:{ok:true}}),'web-booted');
  assert.equal(mergeAcceptanceOutcome({genericOutcome:'web-booted',driverLifecycleProbe:undefined}),'web-booted','a disabled probe leaves the generic outcome');
  assert.equal(acceptanceExitCode({smoke:true,outcome:'driver-lifecycle-probe-unconfirmed',webExitCode:0}),2,'a probe failure is a non-zero smoke exit');
  assert.equal(acceptanceExitCode({smoke:true,outcome:'seam-differences-found',webExitCode:0}),2);
  assert.equal(acceptanceExitCode({smoke:true,outcome:'web-booted',webExitCode:0}),0,'a successful probe keeps the smoke exit at zero');
  assert.equal(acceptanceExitCode({smoke:false,outcome:'web-booted',webExitCode:0}),0,'non-smoke reports the child exit code');
  assert.equal(acceptanceExitCode({smoke:false,outcome:'web-booted',webExitCode:undefined}),1,'a missing child exit code is non-zero');
});

test('the driver lifecycle probe evaluates create->prompt->stop->page and requires translated events',async()=>{
  const {evaluateDriverLifecycle,runDriverLifecycleProbe,lifecycleEventTypes,OFFICIAL_SESSION_METHODS,officialRemoteCall}=await import('../scripts/acceptance-driver-mode.mjs');
  const transcript={events:[{type:'turn/start'},{type:'user/message'},{type:'assistant/message'},{type:'turn/end'}]};
  // Official receipts are {accepted:true} with no ack/state (SessionPromptValue/SessionCancelValue).
  const official=evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{accepted:true},stopped:{accepted:true},page:transcript});
  assert.equal(official.ok,true);
  assert.equal(official.checks.prompted,true,'the official prompt receipt marks the step accepted');
  assert.equal(official.checks.stopped,true,'the official cancel receipt marks the step accepted');
  assert.deepEqual(official.events,['turn/start','user/message','assistant/message','turn/end']);
  // The legacy bridge ack/state vocabulary stays a compatibility positive.
  assert.equal(evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{ack:{status:'accepted'}},stopped:{ack:{status:'completed'}},page:transcript}).ok,true);
  // A refusal is never accepted in either shape.
  assert.equal(evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{accepted:false},stopped:{accepted:true},page:transcript}).checks.prompted,false);
  assert.equal(evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{ack:{status:'rejected'}},stopped:{accepted:true},page:transcript}).checks.prompted,false);
  assert.equal(evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{ack:{status:'accepted'}},stopped:{ack:{status:'accepted'}},page:{events:[]}}).ok,false,'an empty transcript is not a follow readback');
  assert.equal(evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{ack:{status:'accepted'}},stopped:{ack:{status:'accepted'}},page:{events:[{type:'unrelated/event'}]}}).checks.translated,false,'a transcript without translated events is refused');
  assert.equal(evaluateDriverLifecycle({created:{},prompted:{ack:{status:'accepted'}},stopped:{ack:{status:'accepted'}},page:transcript}).checks.created,false);
  assert.equal(evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{ack:{status:'rejected'}},stopped:{ack:{status:'accepted'}},page:transcript}).checks.prompted,false);
  assert.deepEqual(Object.values(OFFICIAL_SESSION_METHODS),['session/create','session/prompt','session/cancel','session/page'],'the probe targets the official session API, never the bridge endpoints');
  const calls=[];
  const call=async(method,params)=>{
    calls.push({method,params});
    if(method===OFFICIAL_SESSION_METHODS.create)return {sessionId:'s1'};
    if(method===OFFICIAL_SESSION_METHODS.page)return transcript;
    return {accepted:true};
  };
  const run=await runDriverLifecycleProbe(call);
  assert.equal(run.ok,true);
  assert.equal(run.checks.prompted,true,'the official-shaped prompt reply is accepted');
  assert.equal(run.checks.stopped,true,'the official-shaped cancel reply is accepted');
  assert.deepEqual(calls.map(entry=>entry.method),['session/create','session/prompt','session/cancel','session/page'],'follow is replaced by the official page cold read');
  const prompt=calls.find(entry=>entry.method==='session/prompt').params.request;
  assert.equal(prompt.sessionId,'s1');
  assert.equal(prompt.mode,'steer','SessionPromptRequest requires an explicit admission mode');
  assert.match(prompt.requestId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,'the prompt carries a client-minted request id');
  assert.deepEqual(prompt.content,[{type:'text',text:'Reply with exactly: ok'}]);
  const page=calls.find(entry=>entry.method==='session/page').params.request;
  assert.equal(page.throughSeq,-1);
  assert.equal(page.address.kind,'session','SessionAddress is a discriminated union and the ordinary variant needs kind');
  assert.equal(page.address.sessionId,'s1');
  const noCreate=await runDriverLifecycleProbe(async()=>({}));
  assert.equal(noCreate.ok,false);assert.equal(noCreate.failure,'create-returned-no-session');
  assert.deepEqual(lifecycleEventTypes({records:[{type:'event',event:{type:'turn/start'}},{type:'event',event:{type:'assistant/message'}}]}),['turn/start','assistant/message'],'page records are event envelopes');
  assert.deepEqual(lifecycleEventTypes({events:[{type:'turn/start'}]}),['turn/start']);
  // The official remote caller uses the /api channel, the client-request envelope and the
  // server-response reply shape; a mismatched or failed reply is refused.
  const requests=[];let rpcCounter=0;
  const fetchImpl=async(url,options)=>{requests.push({url,options});const sent=JSON.parse(options.body);return {async json(){return {type:'server-response',rpcId:sent.rpcId,result:{ok:true,value:{sessionId:'s1'}}}}}};
  const remoteCall=officialRemoteCall({baseURL:'http://127.0.0.1:9',cookie:'c=1',fetchImpl,newRpcId:()=>`rpc-${++rpcCounter}`});
  assert.deepEqual(await remoteCall('session/create',{cwd:'/w'}),{sessionId:'s1'});
  assert.equal(requests[0].url,'http://127.0.0.1:9/api/session/create');
  assert.equal(requests[0].options.headers.cookie,'c=1');
  assert.deepEqual(JSON.parse(requests[0].options.body),{type:'client-request',rpcId:'rpc-1',method:'session/create',payload:{args:{cwd:'/w'}}});
  const mismatch=officialRemoteCall({baseURL:'http://x',fetchImpl:async()=>({async json(){return {type:'server-response',rpcId:'other',result:{ok:true,value:1}}}})});
  await assert.rejects(mismatch('session/page',{}),error=>error.code==='official-remote-envelope-mismatch');
  const failed=officialRemoteCall({baseURL:'http://x',newRpcId:()=>'rpc-9',fetchImpl:async()=>({async json(){return {type:'server-response',rpcId:'rpc-9',result:{ok:false,error:{code:'no-session'}}}}})});
  await assert.rejects(failed('session/page',{}),error=>error.code==='no-session');
});
