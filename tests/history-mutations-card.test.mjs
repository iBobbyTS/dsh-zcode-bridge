// Plugin history-mutation dock: the five migrated operations trigger through the parity data
// chain, preview and apply stay separate, and the frozen CAS token keeps every action pinned to
// the rows/revision it was read from. Component-level with the real published card under jsdom.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';

const repo=process.cwd();
const require=createRequire(pathToFileURL(resolve(repo,'package.json')));
const {JSDOM}=require('jsdom');
const {buildSync}=require('esbuild');
const history=JSON.parse(readFileSync(resolve(repo,'tests/fixtures/history-management/success.json'),'utf8'));
const pendingContext=JSON.parse(readFileSync(resolve(repo,'tests/fixtures/attachments-context/success.json'),'utf8')).initial.frame.payload.snapshot.sharedContextImport;

function load(){
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const React=require('react');
  const {createRoot}=require('react-dom/client');
  const {Simulate}=require('react-dom/test-utils');
  const code=buildSync({entryPoints:[resolve(repo,'packages/client/history-mutations.jsx')],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text;
  const mod={exports:{}};
  vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,mod,mod.exports);
  return {React,createRoot,Simulate,HistoryMutationsCard:mod.exports.HistoryMutationsCard};
}
function fakeController({sharedContextImport=null}={}){
  const listeners=new Set();
  let revision=1;
  const state=()=>({status:'live',admission:{allowed:true},managementAdmission:{allowed:true},
    snapshot:{sessionId:'one',revision,logEpoch:'epoch-1',rows:structuredClone(history.initial.frame.payload.snapshot.rows),commands:[],...(sharedContextImport?{sharedContextImport}:{})}});
  const calls=[];
  return {calls,get revision(){return revision},bump(){revision++},notify(){for(const listener of listeners)listener()},
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener)},
    async call(domain,operation,kind,params,options){
      if(domain==='snapshot'&&operation==='read')return state();
      if(domain==='history'&&operation==='read'){
        calls.push({type:`history:${kind}`,params:structuredClone(params),options:structuredClone(options)});
        if(kind==='fileRewindPreview')return {kind,target:structuredClone(params.target),baseRevision:options.snapshot.revision,baseLogEpoch:options.snapshot.logEpoch,result:structuredClone(history.preview)};
        return {kind,target:structuredClone(params.target),baseRevision:options.snapshot.revision,baseLogEpoch:options.snapshot.logEpoch,result:structuredClone(history.fileChanges)};
      }
      throw Object.assign(new Error('unexpected '+domain),{code:'unexpected'});
    },
    async command(type,params,snapshot){
      calls.push({type,params:structuredClone(params),snapshot:structuredClone(snapshot)});
      revision++;
      return {commandId:'c-'+calls.length,type,state:'completed',ack:{status:'accepted'}};
    },
  };
}
const q=selector=>document.querySelector(selector);

test('the dock triggers all five migrated operations through the parity data chain',async()=>{
  const {React,createRoot,Simulate,HistoryMutationsCard}=load();
  const controller=fakeController({sharedContextImport:pendingContext});
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(HistoryMutationsCard,{controller,pollMs:0})));
  assert.ok(q('[data-zcode-history-mutations]'));
  // retryTurn (the only assistant row whose official actions allow it)
  await React.act(async()=>Simulate.click(q('[data-zcode-history-row="6"] [data-zcode-history-retry]')));
  // editUserQuery (the only user row whose official actions allow it)
  await React.act(async()=>Simulate.click(q('[data-zcode-history-row="5"] [data-zcode-history-edit]')));
  await React.act(async()=>Simulate.change(q('[data-zcode-history-edit-text]'),{target:{value:'edited text'}}));
  await React.act(async()=>Simulate.click(q('[data-zcode-history-edit-submit]')));
  // file rewind preview then apply
  await React.act(async()=>Simulate.click(q('[data-zcode-history-preview]')));
  await React.act(async()=>Simulate.click(q('[data-zcode-history-apply]')));
  // The rewind row is the first turn header; the apply command keeps that frozen token.
  // selection side session + discard shared context
  await React.act(async()=>Simulate.change(q('[data-zcode-history-side-text]'),{target:{value:'selected'}}));
  await React.act(async()=>Simulate.click(q('[data-zcode-history-side]')));
  await React.act(async()=>Simulate.click(q('[data-zcode-history-discard]')));
  const sent=controller.calls.filter(call=>call.type&&!call.type.startsWith('history:')).map(call=>call.type);
  for(const type of ['retryTurn','editUserQuery','applyFileRewind','createSelectionSideSession','discardSharedContext'])assert.ok(sent.includes(type),`${type} triggered`);
  assert.ok(controller.calls.some(call=>call.type==='history:fileRewindPreview'));
  const edited=controller.calls.find(call=>call.type==='editUserQuery');
  assert.deepEqual(edited.params,{target:{rowId:5,entityId:'input-2'},newText:'edited text',workspaceMode:'preserve'});
  assert.deepEqual(controller.calls.find(call=>call.type==='createSelectionSideSession').params,{firstInput:{text:'selected'}});
  root.unmount();
});

test('preview and apply are separate: preview sends no applyFileRewind, apply reuses the preview baseline',async()=>{
  const {React,createRoot,Simulate,HistoryMutationsCard}=load();
  const controller=fakeController();
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(HistoryMutationsCard,{controller,pollMs:0})));
  await React.act(async()=>Simulate.click(q('[data-zcode-history-preview]')));
  assert.equal(controller.calls.some(call=>call.type==='applyFileRewind'),false,'preview alone never applies');
  assert.ok(q('[data-zcode-history-preview]'));
  const previewCall=controller.calls.find(call=>call.type==='history:fileRewindPreview');
  await React.act(async()=>Simulate.click(q('[data-zcode-history-apply]')));
  const applied=controller.calls.find(call=>call.type==='applyFileRewind');
  assert.equal(applied.snapshot.revision,previewCall.options.snapshot.revision,'apply reuses the frozen preview baseline');
  assert.equal(applied.snapshot.logEpoch,previewCall.options.snapshot.logEpoch);
  root.unmount();
});

test('a changed projection invalidates the editor token and a new preview is required before apply',async()=>{
  const {React,createRoot,Simulate,HistoryMutationsCard}=load();
  const controller=fakeController();
  const root=createRoot(document.getElementById('root'));
  const settle=async()=>{await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,25))})};
  await React.act(async()=>root.render(React.createElement(HistoryMutationsCard,{controller,pollMs:5})));
  await React.act(async()=>Simulate.click(q('[data-zcode-history-row="5"] [data-zcode-history-edit]')));
  assert.equal(q('[data-zcode-history-edit-submit]').disabled,false);
  controller.bump();
  await settle();
  assert.ok(q('[data-zcode-history-edit-submit]').disabled,'a stale editor token cannot execute');
  assert.match(document.body.textContent,/History changed/);
  await React.act(async()=>Simulate.click(q('[data-zcode-history-preview]')));
  controller.bump();
  await settle();
  assert.ok(q('[data-zcode-history-apply]').disabled,'an expired preview cannot be applied');
  assert.match(document.body.textContent,/Preview expired/);
  root.unmount();
});

test('discard shared context is only enabled for a pending import',async()=>{
  const {React,createRoot,HistoryMutationsCard}=load();
  const controller=fakeController({sharedContextImport:{...pendingContext,status:'attached'}});
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(HistoryMutationsCard,{controller,pollMs:0})));
  assert.ok(q('[data-zcode-history-discard]').disabled,'an attached import cannot be withdrawn');
  root.unmount();
});
