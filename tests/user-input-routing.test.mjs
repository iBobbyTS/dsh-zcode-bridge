// userInput routing: the two-axis split (official live-root ask vs plugin questionnaire card),
// request/answer mapping, the shared resolveInteraction kind guard, and the real official
// userQuestions waterfall/service consumption. Driver wiring uses a recording service double;
// the official-path answerer semantics are proven against the real rc.2 UserQuestionService
// waterfall (an answerer registered on the official event is how the real forwarder consumes it).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {classifyUserInputRoute,USER_INPUT_OFFICIAL,USER_INPUT_PLUGIN,officialRequestQuestions,officialAnswerPayload,buildElicitationContent} from '../packages/host/user-input.mjs';
import {validateInteractionRoute} from '../packages/driver/hook-review.mjs';
import {commandWorld,tick} from './helpers/lifecycle-commands.mjs';

const npmRoot=process.env.DSH_DRIVER_NPM_NODE_MODULES??'/private/tmp/dsh-local-npm-verify/npm/node_modules';
const artifact=name=>join(npmRoot,'@deepseek-ai',name,'lib/index.js');
const available=['cordis','dsh-user-questions','dsh-session-projection'].every(name=>existsSync(artifact(name)));
const real={skip:available?false:'requires rc.2 npm artifacts; set DSH_DRIVER_NPM_NODE_MODULES'};

const userInput=(payload={},extra={})=>({interactionId:'ui-1',kind:'userInput',anchorRowId:null,createdAt:0,payload:{kind:'userInput',prompt:'Pick one',freeText:true,...payload},...extra});
const publish=(w,edit)=>{const snapshot=structuredClone(w.peer.snapshot);snapshot.seq++;snapshot.revision++;edit(snapshot);w.peer.publish(snapshot)};
const commands=w=>w.peer.calls.filter(call=>call.method==='v4/command').map(call=>call.params);

test('the two-axis routing table freezes eight combinations: sensitive/freeText/autoResolution',()=>{
  const table=[
    [{sensitive:false,freeText:true,auto:false},USER_INPUT_OFFICIAL],
    [{sensitive:false,freeText:true,auto:true},USER_INPUT_PLUGIN],
    [{sensitive:false,freeText:false,auto:false},USER_INPUT_PLUGIN],
    [{sensitive:false,freeText:false,auto:true},USER_INPUT_PLUGIN],
    [{sensitive:true,freeText:true,auto:false},USER_INPUT_PLUGIN],
    [{sensitive:true,freeText:true,auto:true},USER_INPUT_PLUGIN],
    [{sensitive:true,freeText:false,auto:false},USER_INPUT_PLUGIN],
    [{sensitive:true,freeText:false,auto:true},USER_INPUT_PLUGIN],
  ];
  for(const [{sensitive,freeText,auto},expected] of table){
    const interaction=userInput({freeText,...(sensitive?{sensitive:true}:{})},{...(auto?{autoResolution:{state:'visibleCountdown',startedAt:0,visibleAt:0,deadlineAt:9}}:{})});
    assert.equal(classifyUserInputRoute(interaction),expected,JSON.stringify({sensitive,freeText,auto}));
  }
  assert.equal(classifyUserInputRoute(userInput()),USER_INPUT_OFFICIAL,'missing flags are the generic untimed variant');
  assert.equal(classifyUserInputRoute(userInput({},{autoResolution:{state:'snoozed',startedAt:0,snoozedAt:1}})),USER_INPUT_PLUGIN,'an already-snoozed timer still routes to the plugin card');
  assert.throws(()=>classifyUserInputRoute({kind:'permission',payload:{}}),error=>error.code==='interaction-mapping-unavailable');
});

test('official mapping preserves multi-question options/multiSelect and maps the official answer back',()=>{
  const interaction=userInput({prompt:'Review',questions:[
    {question:'Which environment?',header:'Env',options:[{label:'staging',description:'safe'},{label:'production'}]},
    {question:'Notes?',header:'Notes',options:[],multiSelect:false},
  ]});
  assert.deepEqual(officialRequestQuestions(interaction),[
    {id:'q0',question:'Which environment?',header:'Env',options:[{label:'staging',description:'safe'},{label:'production'}]},
    {id:'q1',question:'Notes?',header:'Notes'},
  ]);
  assert.deepEqual(officialAnswerPayload(interaction,{answers:[{id:'q0',selected:['staging']},{id:'q1',selected:[],custom:'looks fine'}]}),{
    content:{answers:{'Which environment?':'staging','Notes?':'looks fine'},answer_0:'staging',answer_1:'looks fine'},
  });
  const flat=userInput({prompt:'Continue?',freeText:false,options:[{optionId:'yes',label:'Yes'},{optionId:'no',label:'No'}]});
  assert.deepEqual(officialRequestQuestions(flat),[{id:'q0',question:'Continue?',options:[{label:'Yes'},{label:'No'}]}]);
  assert.deepEqual(officialAnswerPayload(flat,{answers:[{id:'q0',selected:['Yes']}]}),{optionId:'yes'});
  assert.deepEqual(officialAnswerPayload(flat,{answers:[{id:'q0',selected:[],custom:'maybe'}]}),{freeText:'maybe'});
  assert.deepEqual(buildElicitationContent([{question:'Q',multiSelect:true,options:[]}],[{selectedValues:['a','b'],customAnswer:''}]),{answers:{Q:'a, b'},answer_0:['a','b'],answer:['a','b']});
});

test('the shared kind guard blocks hook review from the resolveInteraction entry and allows permission/userInput',()=>{
  const conversation=kind=>({state:{snapshot:{pendingInteractions:[{interactionId:'x',kind}]}}});
  for(const kind of ['permission','userInput'])validateInteractionRoute(conversation(kind),{type:'resolveInteraction',payload:{interactionId:'x'}});
  for(const type of ['resolveInteraction','snoozeInteractionAutoResolution'])assert.throws(()=>validateInteractionRoute(conversation('workspaceHookReview'),{type,payload:{interactionId:'x'}}),error=>error.code==='interaction-mapping-unavailable');
  validateInteractionRoute(conversation('workspaceHookReview'),{type:'sendText',payload:{interactionId:'x'}});
  validateInteractionRoute(conversation('workspaceHookReview'),{type:'resolveInteraction',payload:{interactionId:'other'}});
});

test('driver routing sends only the generic variant to the official asker and maps the answer to resolveInteraction',async()=>{
  const calls=[];
  const userQuestions={async ask(request){calls.push(request);return {answers:[{id:'q0',selected:['Yes']}]}}};
  const w=await commandWorld('idle',{userQuestions});
  try{
    publish(w,s=>{s.pendingInteractions=[userInput({prompt:'Continue?',options:[{optionId:'yes',label:'Yes'}]})]});
    await w.drain();
    assert.equal(calls.length,1,'the official asker is used once');
    assert.equal(calls[0].agent,w.agent,'the live agent instance is supplied for the official live-root check');
    assert.deepEqual(calls[0].questions,[{id:'q0',question:'Continue?',options:[{label:'Yes'}]}]);
    const sent=commands(w).filter(command=>command.type==='resolveInteraction');
    assert.equal(sent.length,1);
    assert.deepEqual(sent[0].payload,{interactionId:'ui-1',answer:{optionId:'yes'}});
  }finally{await w.close()}
});

test('restricted and timed variants stay pending for the plugin card: no official ask, no driver submission, no mapping error',async()=>{
  const cases=[
    ['sensitive',userInput({sensitive:true}),{}],
    ['no-free-text',userInput({freeText:false}),{}],
    ['timed',userInput(), {autoResolution:{state:'visibleCountdown',startedAt:0,visibleAt:0,deadlineAt:9}}],
  ];
  for(const [name,interaction,extra] of cases){
    const calls=[];
    const w=await commandWorld('idle',{userQuestions:{async ask(request){calls.push(request);return {answers:[]}}}});
    try{
      publish(w,s=>{s.pendingInteractions=[{...interaction,...extra}]});
      await w.drain();
      assert.equal(calls.length,0,`${name}: the official asker is never used`);
      assert.equal(commands(w).some(command=>command.type==='resolveInteraction'),false,`${name}: no driver answer is submitted`);
      assert.equal(w.agent.lastError,null,`${name}: the interaction stays pending without a mapping error`);
      assert.equal(w.agent.conversation.state.snapshot.pendingInteractions.length,1);
    }finally{await w.close()}
  }
});

test('an official asker refusal surfaces the official error instead of resolving locally',async()=>{
  const w=await commandWorld('idle',{userQuestions:{async ask(){throw Object.assign(new Error('no answerer'),{code:'NO_PROVIDER'})}}});
  try{
    publish(w,s=>{s.pendingInteractions=[userInput()]});
    await w.drain();
    assert.equal(commands(w).some(command=>command.type==='resolveInteraction'),false);
    assert.ok(w.notifications.some(event=>event.type==='agent/error'&&event.payload.error.code==='NO_PROVIDER'),'the waterfall refusal is explicit');
  }finally{await w.close()}
});

test('the real official userQuestions waterfall consumes the mapped request and returns the answer',real,async()=>{
  const [{Context},{default:UserQuestionService}]=await Promise.all(['cordis','dsh-user-questions'].map(name=>import(pathToFileURL(artifact(name)))));
  const ctx=new Context();
  new UserQuestionService(ctx);
  const received=[];
  ctx.on('user-questions/request',request=>{received.push(request);return {answers:[{id:'q0',selected:['Yes']}]}});
  const flat=userInput({prompt:'Continue?',freeText:false,options:[{optionId:'yes',label:'Yes'},{optionId:'no',label:'No'}]});
  const questions=officialRequestQuestions(flat);
  const answer=await ctx.userQuestions.ask({questions});
  assert.equal(received.length,1,'the request flows through the real official waterfall');
  assert.deepEqual(received[0].questions,questions);
  assert.deepEqual(officialAnswerPayload(flat,answer),{optionId:'yes'});
  const bare=new Context();
  new UserQuestionService(bare);
  await assert.rejects(bare.userQuestions.ask({questions}),error=>error.code==='NO_PROVIDER','no answerer is an explicit official failure');
  await ctx.fiber.dispose();await bare.fiber.dispose();
});
