import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backgroundWaiting} from '../packages/host/background-waiting.mjs';
import {eventRowKey} from '../packages/driver/events.mjs';

const agent=({snapshot,turns})=>({conversation:{state:{snapshot}},translator:{turns:new Map(turns)}});

test('derives works with phase and turn attribution from the live snapshot',()=>{
  const logEpoch='ep1';
  const snapshot={
    logEpoch,
    control:{phase:'completedSuccess'},
    backgroundWorks:[
      {workId:'w1',kind:'subagent',title:'A 槽单点复核',status:'running',startedAt:1000,cancellable:true,childSessionId:'sess_child'},
      {workId:'w2',kind:'bash',title:'容器内全量测试',status:'resultPending',startedAt:2000,endedAt:5000},
    ],
    rows:{window:[
      {kind:'toolCall',rowId:11,turnId:'turnA',workId:'w1',toolName:'Agent',status:'success'},
      {kind:'subagent',rowId:12,turnId:'turnB',workId:'w2',subagentType:'review',status:'running',summaryText:''},
      {kind:'toolCall',rowId:13,turnId:'turnA',toolName:'Bash',status:'success'}, // no workId: ignored
    ]},
  };
  const turns=[[eventRowKey(logEpoch,'turnA'),{turn:3,closed:true}],[eventRowKey(logEpoch,'turnB'),{turn:7,closed:true}]];
  const waiting=backgroundWaiting(agent({snapshot,turns}));
  assert.equal(waiting.phase,'completedSuccess');
  assert.equal(waiting.lastTurn,7);
  assert.equal(waiting.works.length,2);
  assert.deepEqual(waiting.works[0],{workId:'w1',kind:'subagent',title:'A 槽单点复核',status:'running',
    startedAt:1000,endedAt:null,cancellable:true,childSessionId:'sess_child',turn:3});
  assert.equal(waiting.works[1].turn,7,'subagent rows attribute by their own workId');
  assert.equal(waiting.works[1].endedAt,5000);
  assert.equal(waiting.works[1].cancellable,false);
});

test('attribution degrades to null when the launching row or translator entry is unknown',()=>{
  const snapshot={
    logEpoch:'ep1',control:{phase:'completedInterrupted'},
    backgroundWorks:[{workId:'wX',kind:'workflow',title:'run',status:'running',startedAt:1}],
    rows:{window:[{kind:'toolCall',rowId:1,turnId:'turnUnknown',workId:'wX'}]},
  };
  const turns=[[eventRowKey('ep1','turnOther'),{turn:2}]];
  const waiting=backgroundWaiting(agent({snapshot,turns}));
  assert.equal(waiting.works[0].turn,null,'no translator entry for the anchor turn');
  assert.equal(waiting.lastTurn,2);
});

test('empty and missing snapshots stay silent',()=>{
  assert.deepEqual(backgroundWaiting(agent({snapshot:{logEpoch:'e',control:{phase:'running'},backgroundWorks:[],rows:{window:[]}},turns:[]})),
    {phase:'running',lastTurn:null,works:[]});
  assert.deepEqual(backgroundWaiting(agent({snapshot:undefined,turns:[]})),
    {phase:null,lastTurn:null,works:[]});
  assert.deepEqual(backgroundWaiting({conversation:{state:{snapshot:null}}}),
    {phase:null,lastTurn:null,works:[]});
});
