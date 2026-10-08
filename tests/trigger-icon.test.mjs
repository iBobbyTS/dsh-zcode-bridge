import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom'),{buildSync}=require('esbuild');
const React=require('react'),{createRoot}=require('react-dom/client');
function bundle(path){const code=buildSync({entryPoints:[path],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text,mod={exports:{}};vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,mod,mod.exports);return mod.exports}
const {TriggerUserMessage,installTriggerIcon}=bundle('packages/client/trigger-icon.jsx');
function mount(){const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const root=createRoot(document.getElementById('root'));return {root,async close(){await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT}}}
const Official=({label})=>React.createElement('div',{'data-official':label,'data-official-root':label},
  React.createElement('div',{className:'x_userStack'},React.createElement('div',{className:'x_bubble'},'official')));

/** Fake slots service: entries/register/subscribe with a late populating chat slot. */
function fakeSlots({late=false}={}){
  const listeners=new Set();
  const state={entries:[],registered:[],populate(){state.entries=[{component:React.memo(Official),options:{key:'user'}}];for(const fn of [...listeners])fn()}};
  if(!late)state.populate();
  return {
    entries:()=>state.entries,
    register:(options,component)=>{state.registered.push({options,component});return ()=>{state.registered=state.registered.filter(r=>r.options!==options)}},
    subscribe:(_key,fn)=>{listeners.add(fn);return ()=>listeners.delete(fn)},
    state,
  };
}
const ctxFor=slots=>({effect(body){const dispose=body();return()=>{dispose?.()}}});

test('registers immediately at lower priority when the official user entry exists',()=>{
  const slots=fakeSlots();
  installTriggerIcon({...ctxFor(slots),slots});
  assert.equal(slots.state.registered.length,1);
  const {options}=slots.state.registered[0];
  assert.equal(options.key,'user');
  assert.equal(options.priority,-10,'lower priority shadows the official cell');
  assert.equal(options.locale,'chat','the t seat synthesizes from the official namespace');
});

test('waits for the chat slot to appear before registering (no boot-order dependency)',()=>{
  const slots=fakeSlots({late:true});
  installTriggerIcon({...ctxFor(slots),slots});
  assert.equal(slots.state.registered.length,0,'nothing registers while ui-chat is absent');
  slots.state.populate();
  assert.equal(slots.state.registered.length,1,'the shadow registers when the official entry appears');
});

test('a marked trigger bubble gains a pinned glyph; plain user rows pass through untouched',async()=>{
  const view=mount();
  try{
    await React.act(async()=>{view.root.render(React.createElement(TriggerUserMessage,{node:{data:{source:{kind:'user'}}}},React.createElement(Official,{label:'plain'})))});
    assert.equal(document.querySelector('[data-zcode-trigger-row]'),null);
    assert.ok(document.querySelector('[data-official="plain"]'));

    await React.act(async()=>{view.root.render(React.createElement(TriggerUserMessage,{node:{data:{source:{kind:'user',zcodeTrigger:true}}}},React.createElement(Official,{label:'trigger'})))});
    const row=document.querySelector('[data-zcode-trigger-row]');
    assert.ok(row,'the decorated row exists');
    assert.ok(row.querySelector('[data-official="trigger"]'),'the official renderer still renders inside');
    const glyph=row.querySelector('[data-zcode-trigger-glyph]');
    assert.ok(glyph,'the pinned glyph exists');
    assert.equal(glyph.style.position,'absolute','the glyph is pinned, not flow-placed');
    assert.equal(row.style.position,'relative','the row is the pinning base');
    // jsdom rects are zero, so the pinned coordinates resolve to the clamped
    // origin; the essential assertion is that they were WRITTEN — the original
    // NaN bug left them empty because SVG exposes no offsetWidth.
    assert.match(glyph.style.left,/^[\d.]+px$/,'left coordinate is a written pixel value');
    assert.match(glyph.style.top,/-?[\d.]+px$/,'top coordinate is a written pixel value');
  }finally{await view.close()}
});

test('with no chat plugin ever loading, nothing registers and nothing throws',()=>{
  const slots=fakeSlots({late:true});
  assert.doesNotThrow(()=>installTriggerIcon({...ctxFor(slots),slots}));
  assert.equal(slots.state.registered.length,0);
});
