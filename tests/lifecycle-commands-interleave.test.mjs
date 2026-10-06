import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commandWorld,message} from './helpers/lifecycle-commands.mjs';
import {row} from './helpers/zcode-runtime-fixture.mjs';

// Write-path oracle only. Outcome is the injected peer decision. Guards dominate
// impossible combinations; an accepted peer stimulus cannot bypass local admission.
export const writeOracle=Object.freeze({
  prompt:{idle:null,'turn-running':null,'queue-paused':'held-queue-confirmation-required','transport-lost':'command-outcome-unknown'},
  'queue-edit':{idle:'queue-item-unconfirmed','turn-running':'queue-item-unconfirmed','queue-paused':null,'transport-lost':'command-outcome-unknown'},
  steer:{idle:null,'turn-running':null,'queue-paused':'held-queue-confirmation-required','transport-lost':'command-outcome-unknown'},
  stop:{idle:'stop-target-unconfirmed','turn-running':null,'queue-paused':'stop-target-unconfirmed','transport-lost':'command-outcome-unknown'},
  disconnect:{idle:'outcome-unknown','turn-running':'outcome-unknown','queue-paused':'outcome-unknown','transport-lost':'outcome-unknown'},
});
const outcomes=['accepted','committed','outcome-unknown','explicit-reject'];
const abortRequest=signal=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('lost'),{code:'execution-disconnected'})),{once:true}));

for(const [entry,states] of Object.entries(writeOracle))for(const [state,guard] of Object.entries(states))for(const outcome of outcomes){
  test(`write oracle: ${entry} / ${state} / ${outcome}`,async()=>{
    const w=await commandWorld(state==='transport-lost'?'idle':state);
    const original=w.peer.request.bind(w.peer);
    try{
      if(state==='transport-lost'||entry==='disconnect'){
        let issued;const sent=new Promise(resolve=>{issued=resolve});
        w.peer.request=async(method,params,options)=>{
          if(method!=='v4/command')return original(method,params,options);
          w.peer.calls.push({method,params:structuredClone(params)});issued();return abortRequest(options.signal);
        };
        const pending=w.agent.submitControl({type:'setAutoDrain',commandId:'uncertain-original',payload:{autoDrain:false}});
        await sent;w.peer.disconnect();
        assert.equal(w.agent.conversation.command('uncertain-original').state,'outcome-unknown','classification is synchronous, before reconnect or successor');
        assert.equal((await pending).state,'outcome-unknown');
        if(entry==='disconnect'){assert.equal(w.peer.calls.filter(c=>c.method==='v4/command').length,1);return}
        w.peer.request=original;
      }else{
        w.peer.request=async(method,params,options)=>{
          if(method!=='v4/command')return original(method,params,options);
          w.peer.calls.push({method,params:structuredClone(params)});
          if(outcome==='outcome-unknown'){
            w.peer.disconnect();throw Object.assign(new Error('lost'),{code:'execution-disconnected'});
          }
          const ack={commandId:params.commandId,status:outcome==='explicit-reject'?'rejected':'accepted',revisionAtDecision:w.peer.snapshot.revision,...(outcome==='explicit-reject'?{reasonCode:'oracle.explicitReject'}:{})};
          w.peer.acks.set(params.commandId,ack);
          if(outcome==='committed'){
            const snapshot=structuredClone(w.peer.snapshot);snapshot.seq++;snapshot.revision++;
            if(params.type==='stop'){snapshot.control.canStop=false;snapshot.control.activeWorks=[]}
            if(params.type==='sendText')snapshot.rows.window=[row('turnHeader',1,{origin:'userInput',state:'completedSuccess',startedAt:0,sourceCommandId:params.commandId})];
            w.peer.publish(snapshot);
          }
          return options.onResult(ack);
        };
      }
      let result,error;
      try{
        if(entry==='prompt'||entry==='steer'){
          w.agent[entry==='prompt'?'followup':'steer'](message('oracle-input'));
          result=await w.agent.inputs.get('oracle-input').task;
        }else if(entry==='queue-edit')result=await w.agent.queueAction({queueItemId:'queue-1',action:'edit',newText:'edited'});
        else result=await w.agent.submitControl({type:'stop',payload:{expectedForegroundExecutionId:'foreground-1'}});
      }catch(caught){error=caught}
      if(guard){
        assert.equal(error?.code,guard);assert.equal(result,undefined);
        assert.equal(w.peer.calls.filter(c=>c.method==='v4/command').length,state==='transport-lost'?1:0);
      }else{
        assert.equal(error,undefined);
        if(outcome==='outcome-unknown')assert.equal(result.state,'outcome-unknown');
        else if(outcome==='explicit-reject'){assert.equal(result.state,'rejected');assert.equal(result.ack.reasonCode,'oracle.explicitReject')}
        else if(outcome==='committed')assert.equal(result.state,'completed');
        else {assert.equal(result.ack.status,'accepted');assert.equal(result.state,entry==='queue-edit'?'completed':'accepted-awaiting-terminal')}
      }
      assert.equal(w.agent.conversation.state.observerErrors,0);
    }finally{await w.close()}
  });
}

test('lost ACK queries the original id before any new command and never replays it',async()=>{
  const w=await commandWorld();
  try{
    w.peer.loseAck=true;w.agent.followup(message('first'));await w.drain();
    const input=w.agent.inputs.get('first');assert.equal(w.agent.conversation.command(input.commandId).state,'outcome-unknown');
    w.agent.followup(message('next'));await w.drain();
    const writes=w.peer.calls.filter(c=>c.method==='v4/command');const query=w.peer.calls.findIndex(c=>c.method==='v4/commands/query');
    assert.equal(writes.length,2);assert.equal(writes.filter(c=>c.params.commandId===input.commandId).length,1);
    assert.deepEqual(w.peer.calls[query].params.commands,[{sessionId:w.agent.zcodeConversationId,commandId:input.commandId}]);
    assert.ok(query<w.peer.calls.findIndex(c=>c.params?.commandId===w.agent.inputs.get('next').commandId));
  }finally{await w.close()}
});
