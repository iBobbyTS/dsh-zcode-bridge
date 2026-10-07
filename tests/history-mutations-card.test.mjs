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
import {historyRuntime} from './fixtures/history-management-runtime.mjs';

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
  const records=new Map();
  const state=()=>({status:'live',commands:[...records.values()].map(record=>structuredClone(record)),admission:{allowed:true},managementAdmission:{allowed:true},
    snapshot:{sessionId:'one',revision,logEpoch:'epoch-1',rows:structuredClone(history.initial.frame.payload.snapshot.rows),...(sharedContextImport?{sharedContextImport}:{})}});
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
      // Mirror the ingress CAS: a command whose baseline is missing or not the current revision is
      // rejected exactly like the real parity driver/history seam.
      calls.push({type,params:structuredClone(params),snapshot:structuredClone(snapshot)});
      if(typeof snapshot?.revision!=='number'||typeof snapshot?.logEpoch!=='string'||snapshot.revision!==revision)
        throw Object.assign(new Error('stale projection'),{code:'parity-projection-stale'});
      revision++;
      const record={commandId:'c-'+calls.length,type,state:'completed',ack:{status:'accepted'}};records.set(record.commandId,record);return structuredClone(record);
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
  // The projection-snapshot ingress must carry a real CAS baseline, not an undefined token.
  for(const type of ['createSelectionSideSession','discardSharedContext']){
    const call=controller.calls.find(candidate=>candidate.type===type);
    assert.equal(typeof call.snapshot.revision,'number',`${type} carries revision`);
    assert.equal(typeof call.snapshot.logEpoch,'string',`${type} carries logEpoch`);
  }
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


for(const type of ['retryTurn','editUserQuery'])for(const terminal of ['failed','completed'])test(`${type} card polls the real top-level V4 ledger from accepted to ${terminal}`,async()=>{
 const {React,createRoot,Simulate,HistoryMutationsCard}=load(),f=historyRuntime(),root=createRoot(document.getElementById('root'));
 const controller={subscribe:()=>()=>{},call:async()=>f.conversation.state,async command(type,payload,snapshot){const pending=f.conversation.submit({type,payload,baseRevision:snapshot.revision,baseLogEpoch:snapshot.logEpoch});f.ack();return pending}};
 try{
  await f.open();assert.equal(f.conversation.state.snapshot.commands,undefined);assert.deepEqual(f.conversation.state.commands,[]);
  await React.act(async()=>root.render(React.createElement(HistoryMutationsCard,{controller,pollMs:5})));
  if(type==='retryTurn')await React.act(async()=>Simulate.click(q('[data-zcode-history-row="6"] [data-zcode-history-retry]')));
  else{
   await React.act(async()=>Simulate.click(q('[data-zcode-history-row="5"] [data-zcode-history-edit]')));
   await React.act(async()=>Simulate.change(q('[data-zcode-history-edit-text]'),{target:{value:'new input'}}));
   await React.act(async()=>Simulate.click(q('[data-zcode-history-edit-submit]')));
  }
  assert.match(q('[data-zcode-history-result]').textContent,/accepted-awaiting-terminal/);
  const record=f.conversation.state.commands.at(-1);assert.equal(record.type,type);assert.equal(record.ack.status,'accepted');
  // The canonical turn header updates the existing ledger, while the old receipt
  // object returned to the card remains accepted-awaiting-terminal.
  await React.act(async()=>{f.update(snapshot=>{const header=snapshot.rows.window.find(row=>row.kind==='turnHeader'&&row.turnId==='turn-2');header.sourceCommandId=record.commandId;header.state=terminal==='failed'?'failed':'completedSuccess';snapshot.control.phase=terminal==='failed'?'error':'completedSuccess'});await new Promise(resolve=>setTimeout(resolve,25))});
  assert.equal(f.conversation.command(record.commandId).state,terminal);assert.equal(f.conversation.command(record.commandId).ack.status,'accepted');
  assert.match(q('[data-zcode-history-result]').textContent,new RegExp(`${type}: ${terminal}`));assert.doesNotMatch(q('[data-zcode-history-result]').textContent,/accepted-awaiting-terminal/);
 }finally{await React.act(async()=>root.unmount());f.dispose();window.close()}
});
