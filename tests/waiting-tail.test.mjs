import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom'),{buildSync}=require('esbuild');
const React=require('react'),{createRoot}=require('react-dom/client');
function bundle(path){const code=buildSync({entryPoints:[path],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text,mod={exports:{}};vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,mod,mod.exports);return mod.exports}
const {ZCodeWaitingTail,installWaitingTail,waitingSession,waitingPreference}=bundle('packages/client/waiting-tail.jsx');
function mount(){const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const root=createRoot(document.getElementById('root'));return {root,dom,async close(){await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT}}}

/** Fake slots facade mirroring the real plugin-facing surface: no declaration probe, register
 *  rejects with the "not declared" fault until ui-chat declares the slot, subscribe notifies. */
function fakeSlots({late=false}={}){
  const listeners=new Set();
  const state={declared:!late,registered:[],declare(){state.declared=true;for(const fn of [...listeners])fn()}};
  return {
    register:(options,component)=>{
      if(!state.declared)throw new Error(`slot "${options.name}" is not declared (a parent entry's children table must declare it)`);
      state.registered.push({options,component});return ()=>{state.registered=state.registered.filter(r=>r.options!==options)};
    },
    subscribe:(_key,fn)=>{listeners.add(fn);return ()=>listeners.delete(fn)},
    state,
  };
}
const ctxFor=slots=>({effect(body){const dispose=body();return()=>{dispose?.()}},slots,connection:{rpc:{call:async()=>({ok:true,value:{phase:null,lastTurn:null,works:[]}})},generation:{subscribe:()=>()=>{}}}});

test('registers the list entry once the turnTail slot is declared',()=>{
  const slots=fakeSlots();
  installWaitingTail(ctxFor(slots));
  assert.equal(slots.state.registered.length,1);
  const {options}=slots.state.registered[0];
  assert.equal(options.name,'conversation.chat.turnTail');
  assert.equal(options.id,'zcode-waiting','list entries coexist by fresh id');
});
test('waits for the turnTail declaration (no boot-order dependency)',()=>{
  const slots=fakeSlots({late:true});
  installWaitingTail(ctxFor(slots));
  assert.equal(slots.state.registered.length,0,'nothing registers before ui-chat declares the slot');
  slots.state.declare();
  assert.equal(slots.state.registered.length,1);
});

test('a foreign registration fault still propagates (only not-declared is retried)',()=>{
  const slots=fakeSlots();
  slots.register=()=>{throw new Error('list slot already has an entry with id "zcode-waiting"')};
  assert.throws(()=>installWaitingTail(ctxFor(slots)),/already has an entry/);
});

/** Static store handle: the component contract is the handle shape, not the poller. */
const handleOf=snapshot=>({subscribe:()=>()=>{},getSnapshot:()=>snapshot});
const turnOf=number=>({turn:number,status:'closed'});
const WORKS=[{workId:'w1',kind:'subagent',title:'A 槽单点复核',status:'running',startedAt:Date.now()-65000,endedAt:null,cancellable:true,turn:4},
  {workId:'w2',kind:'bash',title:'容器内全量测试',status:'resultPending',startedAt:Date.now()-1000,endededAt:null,endedAt:Date.now(),cancellable:false,turn:3}];

test('renders the waiting line only under the last turn while resting between turns',async()=>{
  const view=mount();
  try{
    const waiting={ready:true,dead:false,phase:'completedSuccess',lastTurn:4,works:WORKS};
    await React.act(async()=>{view.root.render(React.createElement(ZCodeWaitingTail,{turn:turnOf(3),waiting:handleOf(waiting)}))});
    assert.equal(document.querySelector('[data-zcode-waiting-tail]'),null,'older turns never carry the line');
    await React.act(async()=>{view.root.render(React.createElement(ZCodeWaitingTail,{turn:turnOf(4),waiting:handleOf(waiting)}))});
    const line=document.querySelector('[data-zcode-waiting-tail]');
    assert.ok(line,'the last turn tail renders the line');
    assert.match(line.textContent,/ZCode 待机 · 等待 2 个后台任务/);
    assert.match(line.textContent,/后台Subagent《A 槽单点复核》运行中 1m/);
    assert.match(line.textContent,/后台终端命令《容器内全量测试》已完成待投递/);
    assert.match(line.textContent,/（第 3 轮启动）/,'works from earlier turns keep their attribution');
    assert.ok(line.querySelector('svg'),'the glyph ties the line to the wake markers');
  }finally{await view.close()}
});

test('stays silent while the agent works, with nothing pending, or on dead stores',async()=>{
  const view=mount();
  try{
    const cases=[
      {ready:true,dead:false,phase:'running',lastTurn:4,works:WORKS},
      {ready:true,dead:false,phase:'completedSuccess',lastTurn:4,works:[]},
      {ready:true,dead:false,phase:null,lastTurn:null,works:[]},
      {ready:true,dead:true,phase:'completedSuccess',lastTurn:4,works:WORKS},
    ];
    for(const state of cases){
      await React.act(async()=>{view.root.render(React.createElement(ZCodeWaitingTail,{turn:turnOf(4),waiting:handleOf(state)}))});
      assert.equal(document.querySelector('[data-zcode-waiting-tail]'),null,JSON.stringify(state));
    }
  }finally{await view.close()}
});

test('the preference owns visibility: default on, off hides the line and persists',async()=>{
  const view=mount();
  try{
    globalThis.localStorage=view.dom.window.localStorage;
    assert.equal(waitingPreference.getSnapshot(),true,'the preference defaults to on (and without storage at all)');
    const waiting={ready:true,dead:false,phase:'completedSuccess',lastTurn:4,
      works:[{workId:'w1',kind:'bash',title:'sleep',status:'running',startedAt:1,endedAt:null,cancellable:true,turn:4}]};
    await React.act(async()=>{view.root.render(React.createElement(ZCodeWaitingTail,{turn:turnOf(4),waiting:handleOf(waiting)}))});
    assert.ok(document.querySelector('[data-zcode-waiting-tail]'),'the line renders while enabled');
    await React.act(async()=>{waitingPreference.setEnabled(false)});
    assert.equal(globalThis.localStorage.getItem('zcodeBridge.waitingTail'),'false','the choice persists in local storage');
    assert.equal(document.querySelector('[data-zcode-waiting-tail]'),null,'the waiting line disappears immediately');
    await React.act(async()=>{waitingPreference.setEnabled(true)});
    assert.ok(document.querySelector('[data-zcode-waiting-tail]'),'re-enabling restores the line');
    assert.equal(globalThis.localStorage.getItem('zcodeBridge.waitingTail'),'true');
    delete globalThis.localStorage;
  }finally{
    delete globalThis.localStorage;
    await view.close()
  }
});

test('waitingSession polls through the parity rpc and retires on non-bridge faults',async()=>{
  const calls=[];
  let respond={ok:true,value:{phase:'completedSuccess',lastTurn:2,works:[{workId:'w9',kind:'bash',title:'sleep',status:'running',startedAt:1}]}};
  const rpc={call:async(_channel,endpoint,payload)=>{calls.push({endpoint,payload});return respond}};
  const generation={subscribe:()=>()=>{}};
  const ctx={connection:{rpc,generation}};
  const handle=waitingSession(ctx,'sess-1');
  const seen=[];
  const off=handle.subscribe(()=>seen.push(handle.getSnapshot()));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(calls[0].endpoint,'parity');
  assert.equal(calls[0].payload.domain,'waiting');
  assert.equal(calls[0].payload.sessionId,'sess-1');
  assert.equal(handle.getSnapshot().works.length,1);
  assert.equal(seen.length,1,'one publish for the first poll');
  respond={ok:false,error:{code:'runtime-identity-locked',message:'locked'}};
  // Drive the interval instead of waiting on wall time: the next tick must retire the store.
  await new Promise(resolve=>setTimeout(resolve,2100));
  assert.equal(handle.getSnapshot().dead,true,'identity-locked sessions stop polling');
  const pollCount=calls.length;
  await new Promise(resolve=>setTimeout(resolve,2100));
  assert.equal(calls.length,pollCount,'no further rpc after retirement');
  off();
  handle.release();
});
