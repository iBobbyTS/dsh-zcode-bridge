// Regression (auto-start & self-heal): a websocket reconnect (connection generation bump) must
// not leave the availability projection stuck on host-unreachable — scheduled re-reads recover
// it; transport-raced reads retry a bounded number of times and then stop until a new read.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {RETIRED_TEMP_SKIP} from './helpers/legacy-retired.mjs';

const require=createRequire(pathToFileURL(resolve('package.json')));
const {buildSync}=require('esbuild');
// S01 ⑩: RETIRED_TEMP_SKIP — the module-level bundle targeted packages/client/sources.mjs
// (fork-era foreign-source layer) and the deleted ../dsh tsconfig, so it threw before any
// test ran. The loader is kept lazy for the S02/S03 rebind; see
// tests/helpers/legacy-retired.mjs.
let RuntimeSessions;
function loadRuntimeSessions(){
  const code=buildSync({
    stdin:{contents:"export {RuntimeSessions} from './packages/client/sources.mjs';",resolveDir:process.cwd()},
    bundle:true,write:false,platform:'node',format:'cjs',external:['react'],
    jsx:'automatic',
  }).outputFiles[0].text;
  const mod={exports:{}};
  vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,mod,mod.exports);
  RuntimeSessions=mod.exports.RuntimeSessions;
}

const native={list:{getSnapshot:()=>({ids:[],byId:{}}),subscribe:()=>()=>{}},refresh:async()=>{}};
const okResponse=()=>({ok:true,value:{sessions:[],scope:{authority:'official-host:1',workspace:'/w'},catalog:{complete:true,truncated:false,deleted:[],sharedGui:'unverified'},availability:{state:'restricted',reason:'not-connected',capabilities:{create:false,open:false,nativeAgent:false}}}});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('generation bump self-heals host-unreachable through scheduled re-reads',{skip:RETIRED_TEMP_SKIP},async()=>{
  loadRuntimeSessions();
  let calls=0;const listeners=[];
  const rpc={call:async()=>{calls++;return okResponse()}};
  const sources=new RuntimeSessions({sessions:native,rpc,nativeAuthority:'native',connectionGeneration:{subscribe:fn=>{listeners.push(fn);return ()=>{} }}});
  try{
    await sources.refresh();
    assert.equal(sources.zcodeAvailability.getSnapshot().reason,'not-connected');
    for(const fn of listeners)fn();
    assert.equal(sources.zcodeAvailability.getSnapshot().reason,'host-unreachable');
    const readsAtBump=calls;
    await sleep(2200);
    assert.ok(calls>=readsAtBump+2,'both scheduled re-reads fired');
    assert.equal(sources.zcodeAvailability.getSnapshot().reason,'not-connected');
  }finally{await sources.dispose()}
});

test('transport failures retry a bounded number of times, then stop until a fresh read',{skip:RETIRED_TEMP_SKIP},async()=>{
  loadRuntimeSessions();
  let calls=0,mode='transport';
  const rpc={call:async()=>{calls++;if(mode==='transport')throw new Error('websocket not ready');return okResponse()}};
  const sources=new RuntimeSessions({sessions:native,rpc,nativeAuthority:'native'});
  try{
    await sources.refresh();
    assert.equal(sources.zcodeAvailability.getSnapshot().reason,'host-unreachable');
    await sleep(2800);                                   // retries at ~400/1200/2400ms, none after
    assert.equal(calls,4,'initial read plus exactly three bounded retries');
    await sleep(800);
    assert.equal(calls,4,'no further retries are scheduled');
    assert.equal(sources.zcodeAvailability.getSnapshot().reason,'host-unreachable');
    mode='ok';
    await sources.refresh();                             // an explicit read recovers and resets the budget
    assert.equal(sources.zcodeAvailability.getSnapshot().reason,'not-connected');
  }finally{await sources.dispose()}
});
