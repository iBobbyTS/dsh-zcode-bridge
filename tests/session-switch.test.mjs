// Model selection rebind of CB4: the composer badge and locked-runtime display are additive
// entries over official session state. Switching sessions must fence identity and clear subscriptions.
import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
test('CB4 rebind: badge follows the session selection store and the locked display targets the visible session',async()=>{
 const {JSDOM}=require('jsdom'),React=require('react'),{createRoot}=require('react-dom/client');
 const {ProviderBadge,RuntimeLockedLabel}=await import('../packages/client/runtime-controls.mjs');
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const listeners=new Set();let selection={current:{provider:'deepseek-account',model:'deepseek-flash'}};
 const store={getSnapshot:()=>selection,subscribe:listener=>{listeners.add(listener);return ()=>listeners.delete(listener)}};
 const infos=new Map([['A',{runtime:'zcode'}],['B',{runtime:'native',locked:true}]]);const infoCalls=[];
 const stable={};const controls={infos,subscribe:listener=>{listeners.add(listener);return ()=>listeners.delete(listener)},getSnapshot:()=>stable,info:async id=>{infoCalls.push(id);return infos.get(id)}};
 const root=createRoot(document.getElementById('root'));
 try{
  await React.act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement(ProviderBadge,{store}),React.createElement(RuntimeLockedLabel,{controls,sessionId:'A'}))));
  assert.equal(document.querySelector('[data-zcode-provider-badge]').getAttribute('data-zcode-provider-badge'),'whale');
  assert.equal(document.querySelector('[data-zcode-runtime-locked]').getAttribute('data-zcode-runtime-locked'),'zcode');
  assert.ok(document.body.textContent.includes('ZCode · locked'));assert.equal(document.body.textContent.includes('官方 GUI'),false);
  await React.act(async()=>{selection={current:{provider:'zcode',model:'A/model_a'}};for(const listener of [...listeners])listener()});
  assert.equal(document.querySelector('[data-zcode-provider-badge]').getAttribute('data-zcode-provider-badge'),'zcode');
  await React.act(async()=>root.render(React.createElement(RuntimeLockedLabel,{controls,sessionId:'B'})));
  assert.equal(document.querySelector('[data-zcode-runtime-locked]').getAttribute('data-zcode-runtime-locked'),'native');
  assert.ok(infoCalls.includes('A')&&infoCalls.includes('B'));
 }finally{await React.act(async()=>root.unmount());assert.equal(listeners.size,0);dom.window.close();delete globalThis.window;delete globalThis.document}
});
