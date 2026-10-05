// S02 rebind of CB4: official DSH owns conversation subscriptions; this plugin owns only
// the runtime/model seat. Switching that seat must fence identity and target the visible Agent.
import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import vm from 'node:vm';
const require=createRequire(import.meta.url);
test('CB4 rebind: runtime seat A -> B targets B and clears A polling on unmount',async()=>{
 const {JSDOM}=require('jsdom'),React=require('react'),{createRoot}=require('react-dom/client'),{buildSync}=require('esbuild');
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const code=buildSync({entryPoints:['packages/client/runtime-controls.jsx'],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text;const module={exports:{}};vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,module,module.exports);
 const {RuntimeModelSeat}=module.exports;const infos=new Map(['A','B'].map(id=>[id,{runtime:'zcode',selection:{providerId:'provider',modelId:id,options:{reasoningLevel:'high'}}}]));const calls=[];const listeners=new Set();const controls={infos,subscribe:listener=>{listeners.add(listener);return ()=>listeners.delete(listener)},getSnapshot:()=>controls,info:async id=>infos.get(id),select:async(id,selection)=>calls.push({id,selection})};const root=createRoot(document.getElementById('root'));
 try{
  await React.act(async()=>root.render(React.createElement(RuntimeModelSeat,{controls,sessionId:'A'})));
  await React.act(async()=>root.render(React.createElement(RuntimeModelSeat,{controls,sessionId:'B'})));
  assert.equal(document.querySelector('[aria-label="ZCode model"]').value,'B');assert.equal(document.querySelector('[data-zcode-runtime-locked]').getAttribute('data-zcode-runtime-locked'),'zcode');
  await React.act(async()=>document.querySelector('button').click());assert.equal(calls[0].id,'B');assert.equal(calls[0].selection.modelId,'B');assert.ok(document.body.textContent.includes('官方 GUI 可能正在运行本会话'));
 }finally{await React.act(async()=>root.unmount());assert.equal(listeners.size,0);dom.window.close();delete globalThis.window;delete globalThis.document}
});
