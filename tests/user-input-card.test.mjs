// Plugin questionnaire card (the restricted/timed userInput variants): masked sensitive input with
// no draft, disabled free text, first-operation snooze for timed variants, and ZCode-authoritative
// late/rejected settlement. Component-level with the real published card under jsdom.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';

const repo=process.cwd();
const require=createRequire(pathToFileURL(resolve(repo,'package.json')));
const {JSDOM}=require('jsdom');
const {buildSync}=require('esbuild');

function load(){
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const React=require('react');
  const {createRoot}=require('react-dom/client');
  const {Simulate}=require('react-dom/test-utils');
  const code=buildSync({entryPoints:[resolve(repo,'packages/client/user-input-card.jsx')],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text;
  const mod={exports:{}};
  vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,mod,mod.exports);
  return {React,createRoot,Simulate,UserInputCard:mod.exports.UserInputCard,dom};
}
function fakeController(interactions,{commandError,cas=false,alwaysStale=false}={}){
  let state={admission:{allowed:true},managementAdmission:{allowed:true},snapshot:{pendingInteractions:interactions,revision:1,logEpoch:'epoch-1'}};
  const calls=[];
  return {calls,
    setInteractions(next){state={...state,snapshot:{...state.snapshot,pendingInteractions:next}}},
    bumpRevision(){state={...state,snapshot:{...state.snapshot,revision:state.snapshot.revision+1}}},
    get revision(){return state.snapshot.revision},
    subscribe:()=>()=>{},
    async call(domain,operation){if(domain==='snapshot'&&operation==='read')return structuredClone(state);throw Object.assign(new Error('unexpected '+domain),{code:'unexpected'})},
    async command(type,params,snapshot){
      calls.push({type,params,snapshot:structuredClone(snapshot)});
      if(commandError)throw commandError;
      // Model the official CAS: a command carries the revision it was rendered against.
      if((cas||alwaysStale)&&snapshot?.revision!==state.snapshot.revision)throw Object.assign(new Error('stale projection'),{code:'parity-projection-stale'});
      if(alwaysStale)throw Object.assign(new Error('stale projection'),{code:'parity-projection-stale'});
      if(type==='snoozeInteractionAutoResolution')state={...state,snapshot:{...state.snapshot,revision:state.snapshot.revision+1}};
      return {ack:{status:'accepted'},state:'accepted-awaiting-terminal'};
    },
  };
}
const masked=(id='ui-1',extra={})=>({interactionId:id,kind:'userInput',anchorRowId:null,createdAt:0,payload:{kind:'userInput',prompt:'Secret',freeText:true,sensitive:true,...extra}});
const flat=(extra={},outer={})=>({interactionId:'ui-1',kind:'userInput',anchorRowId:null,createdAt:0,payload:{kind:'userInput',prompt:'Continue?',freeText:true,...extra},...outer});
test('sensitive variant: masked input, no draft restore from answerDrafts, nothing stored',async()=>{
  const {React,createRoot,Simulate,UserInputCard}=load();
  const controller=fakeController([masked('ui-1',{answerDrafts:{answer_0:['restored-secret']}})]);
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(UserInputCard,{controller,pollMs:0})));
  const input=document.querySelector('[data-zcode-user-input-custom="0"]');
  assert.equal(input.getAttribute('type'),'password','sensitive input is masked');
  assert.equal(input.value,'','the official answerDrafts are never restored into the plugin card');
  assert.ok(document.querySelector('[data-zcode-user-input-masked]'));
  assert.equal(window.localStorage.length,0,'no draft is persisted');
  assert.equal(/* no stored draft key anywhere */ JSON.stringify(window.localStorage).includes('restored-secret'),false);
  Simulate.change(input,{target:{value:'typed-secret'}});
  assert.equal(controller.calls.length,0,'typing alone does not send anything');
  root.unmount();
});

test('freeText=false disables the free-text input and the answer uses the option id',async()=>{
  const {React,createRoot,Simulate,UserInputCard}=load();
  const controller=fakeController([flat({freeText:false,options:[{optionId:'yes',label:'Yes'},{optionId:'no',label:'No'}]})]);
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(UserInputCard,{controller,pollMs:0})));
  assert.equal(document.querySelector('[data-zcode-user-input-custom="0"]'),null,'no free-text row for freeText=false');
  const submit=document.querySelector('[data-zcode-user-input-submit]');
  assert.equal(submit.disabled,true);
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-option="yes"]')));
  assert.equal(submit.disabled,false);
  await React.act(async()=>Simulate.click(submit));
  const sent=controller.calls.filter(call=>call.type==='resolveInteraction');
  assert.deepEqual(sent[0].params,{interactionId:'ui-1',answer:{optionId:'yes'}});
  root.unmount();
});

test('a timed variant snoozes on the first operation before the answer is sent',async()=>{
  const {React,createRoot,Simulate,UserInputCard}=load();
  const interaction=flat({freeText:false,options:[{optionId:'yes',label:'Yes'}]},{autoResolution:{state:'visibleCountdown',startedAt:0,visibleAt:0,deadlineAt:9}});
  const controller=fakeController([interaction]);
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(UserInputCard,{controller,pollMs:0})));
  assert.ok(document.querySelector('[data-zcode-user-input-timed]'));
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-option="yes"]')));
  assert.deepEqual(controller.calls.map(call=>call.type),['snoozeInteractionAutoResolution'],'the first operation snoozes before any answer');
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-submit]')));
  assert.deepEqual(controller.calls.map(call=>call.type),['snoozeInteractionAutoResolution','resolveInteraction']);
  assert.equal(controller.calls.filter(call=>call.type==='snoozeInteractionAutoResolution').length,1,'snooze is idempotent per interaction');
  root.unmount();
});

test('after the first-operation snooze advances the revision, the immediate submit uses the fresh CAS and succeeds first try',async()=>{
  const {React,createRoot,Simulate,UserInputCard}=load();
  const interaction=flat({freeText:false,options:[{optionId:'yes',label:'Yes'}]},{autoResolution:{state:'visibleCountdown',startedAt:0,visibleAt:0,deadlineAt:9}});
  const controller=fakeController([interaction],{cas:true});
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(UserInputCard,{controller,pollMs:0})));
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-option="yes"]')));
  assert.equal(controller.revision,2,'the snooze advanced the official revision');
  // Immediately submit inside the poll window: the render closure still holds revision 1.
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-submit]')));
  const resolved=controller.calls.filter(call=>call.type==='resolveInteraction');
  assert.equal(resolved.length,1,'the timed submit needs no retry: it reads the post-snooze CAS itself');
  assert.equal(resolved[0].snapshot.revision,2,'the command carries the current revision');
  assert.deepEqual(resolved[0].params,{interactionId:'ui-1',answer:{optionId:'yes'}});
  assert.equal(document.querySelector('[data-zcode-user-input-error]'),null);
  assert.ok(document.querySelector('[data-zcode-user-input-notice]'));
  root.unmount();
});

test('a stale CAS baseline is recovered by one re-read and resend, never an unbounded retry',async()=>{
  const {React,createRoot,Simulate,UserInputCard}=load();
  const interaction=flat({freeText:false,options:[{optionId:'yes',label:'Yes'}]});
  const controller=fakeController([interaction],{cas:true});
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(UserInputCard,{controller,pollMs:0})));
  controller.bumpRevision();
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-option="yes"]')));
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-submit]')));
  const resolved=controller.calls.filter(call=>call.type==='resolveInteraction');
  assert.equal(resolved.length,2,'exactly one retry after the stale rejection');
  assert.equal(resolved[0].snapshot.revision,1);
  assert.equal(resolved[1].snapshot.revision,2,'the resend uses the freshly read baseline');
  assert.ok(document.querySelector('[data-zcode-user-input-notice]'));
  assert.equal(document.querySelector('[data-zcode-user-input-error]'),null);
  root.unmount();
});

test('a persistently stale projection is surfaced after exactly one retry',async()=>{
  const {React,createRoot,Simulate,UserInputCard}=load();
  const interaction=flat({freeText:false,options:[{optionId:'yes',label:'Yes'}]});
  const controller=fakeController([interaction],{alwaysStale:true});
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(UserInputCard,{controller,pollMs:0})));
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-option="yes"]')));
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-submit]')));
  assert.equal(controller.calls.filter(call=>call.type==='resolveInteraction').length,2,'one retry, not a loop');
  assert.match(document.querySelector('[data-zcode-user-input-error]').textContent,/parity-projection-stale/);
  root.unmount();
});

test('a late answer is settled by ZCode: the rejected/noop receipt is shown and no success is fabricated',async()=>{
  const {React,createRoot,Simulate,UserInputCard}=load();
  const error=Object.assign(new Error('already resolved'),{code:'proto.alreadyResolved'});
  const controller=fakeController([flat({freeText:false,options:[{optionId:'yes',label:'Yes'}]})],{commandError:error});
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(UserInputCard,{controller,pollMs:0})));
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-option="yes"]')));
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-submit]')));
  assert.match(document.querySelector('[data-zcode-user-input-error]').textContent,/proto\.alreadyResolved/);
  assert.equal(document.querySelector('[data-zcode-user-input-notice]'),null,'a refused receipt is never presented as an accepted answer');
  root.unmount();
});

test('the questionnaire card sends the lossless multi-question content for the plugin variant',async()=>{
  const {React,createRoot,Simulate,UserInputCard}=load();
  const interaction={interactionId:'ui-2',kind:'userInput',anchorRowId:null,createdAt:0,autoResolution:{state:'visibleCountdown',startedAt:0,visibleAt:0,deadlineAt:5},payload:{kind:'userInput',prompt:'Review',freeText:true,questions:[
    {question:'Which environment?',header:'Env',options:[{label:'staging'},{label:'production'}]},
    {question:'Notes?',header:'Notes',options:[]},
  ]}};
  const controller=fakeController([interaction]);
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(UserInputCard,{controller,pollMs:0})));
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-option="0:staging"]')));
  await React.act(async()=>Simulate.change(document.querySelector('[data-zcode-user-input-custom="1"]'),{target:{value:'looks fine'}}));
  await React.act(async()=>Simulate.click(document.querySelector('[data-zcode-user-input-submit]')));
  const sent=controller.calls.filter(call=>call.type==='resolveInteraction');
  assert.deepEqual(sent[0].params,{interactionId:'ui-2',answer:{content:{answers:{'Which environment?':'staging','Notes?':'looks fine'},answer_0:'staging',answer_1:'looks fine'}}});
  root.unmount();
});

test('the card renders nothing when every pending interaction belongs to the official path',async()=>{
  const {React,createRoot,UserInputCard}=load();
  const controller=fakeController([{interactionId:'ui-3',kind:'userInput',payload:{kind:'userInput',prompt:'generic',freeText:true}}]);
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(UserInputCard,{controller,pollMs:0})));
  assert.equal(document.querySelector('[data-zcode-user-input-card]'),null,'generic userInput is the official composer path');
  root.unmount();
});
