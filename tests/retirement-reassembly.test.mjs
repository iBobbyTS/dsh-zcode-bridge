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
import {parseAcceptanceArgs,assertAcceptanceArgs,profilePatchFor,pluginInstallTargets,driverModeProbe,ACCEPTANCE_OPTIONS} from '../scripts/acceptance-driver-mode.mjs';

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
  const {apply}=await import('../packages/driver/index.mjs');
  const registered=[];
  const llm={listProviders:()=>[{id:'zcode',name:'Zcode'}],registerAdapter:(providers,adapter)=>{registered.push({providers,adapter});return ()=>{}}};
  const host={driverState:null,zcodeModels:()=>[{id:'A',models:[{id:'model_a',reasoningLevels:['low'],defaultReasoningLevel:'low'}]}]};
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
  assert.equal(registered.length,1);
  assert.deepEqual(registered[0].providers,['zcode']);
  assert.deepEqual((await registered[0].adapter.listModels('zcode')).map(model=>model.id),['A/model_a'],'the adapter reads the retained host discovery');
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
});

test('the driver lifecycle probe evaluates create->prompt->stop->follow and requires translated events',async()=>{
  const {evaluateDriverLifecycle,runDriverLifecycleProbe,lifecycleEventTypes}=await import('../scripts/acceptance-driver-mode.mjs');
  const transcript={events:[{type:'turn/start'},{type:'user/message'},{type:'assistant/message'},{type:'turn/end'}]};
  const ok=evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{ack:{status:'accepted'}},stopped:{ack:{status:'completed'}},follow:transcript});
  assert.equal(ok.ok,true);
  assert.deepEqual(ok.events,['turn/start','user/message','assistant/message','turn/end']);
  assert.equal(evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{ack:{status:'accepted'}},stopped:{ack:{status:'accepted'}},follow:{events:[]}}).ok,false,'an empty transcript is not a follow readback');
  assert.equal(evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{ack:{status:'accepted'}},stopped:{ack:{status:'accepted'}},follow:{events:[{type:'unrelated/event'}]}}).checks.translated,false,'a transcript without translated events is refused');
  assert.equal(evaluateDriverLifecycle({created:{},prompted:{ack:{status:'accepted'}},stopped:{ack:{status:'accepted'}},follow:transcript}).checks.created,false);
  assert.equal(evaluateDriverLifecycle({created:{sessionId:'s1'},prompted:{ack:{status:'rejected'}},stopped:{ack:{status:'accepted'}},follow:transcript}).checks.prompted,false);
  const calls=[];
  const call=async(endpoint,payload)=>{
    calls.push({endpoint,operation:payload.operation});
    if(endpoint==='runtime')return {sessionId:'s1'};
    if(payload.command?.type==='sendText')return {ack:{status:'accepted'}};
    if(payload.command?.type==='stop')return {ack:{status:'accepted'}};
    return transcript;
  };
  const run=await runDriverLifecycleProbe(call);
  assert.equal(run.ok,true);
  assert.deepEqual(calls.map(entry=>[entry.endpoint,entry.operation]),[['runtime','create'],['conversation','command'],['conversation','command'],['conversation','historyQuery']]);
  const noCreate=await runDriverLifecycleProbe(async()=>({}));
  assert.equal(noCreate.ok,false);assert.equal(noCreate.failure,'create-returned-no-session');
  assert.deepEqual(lifecycleEventTypes({records:[{event:{type:'turn/start'}}]}),['turn/start']);
});
