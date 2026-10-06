import {DriverAgent} from '../../packages/driver/agent.mjs';
import {V4Conversation} from '../../packages/host/conversation.mjs';
import {MockPeer,tick,baseSnapshot} from './zcode-runtime-fixture.mjs';
export {tick};
export const message=(id='input',text='hello')=>({id,role:'user',source:{kind:'user',rpcId:id},content:[{type:'text',text}]});
export const queueItem=(id='queue-1',sourceCommandId='foreign-command')=>({
  sourceCommandId,queueItemId:id,clientId:'other',kind:'sendText',text:'queued',attachments:[],
  delivery:{requested:'queue',admitted:'queue'},order:{admissionSeq:1,queuePosition:0},
  steer:{state:'notRequested'},dispatch:{state:'queued'},admittedAt:0,
});
export async function commandWorld(state='idle',{approval=async()=> 'unavailable',store,options={}}={}){
  const peer=new MockPeer();peer.snapshot=baseSnapshot();
  peer.snapshot.control.canStop=state==='turn-running';
  peer.snapshot.control.activeWorks=state==='turn-running'?[{kind:'primaryTurn',foregroundExecutionId:'foreground-1',startedAt:0}]:[];
  peer.snapshot.control.phase=state==='turn-running'?'running':'completedSuccess';
  peer.snapshot.rows.window=[];peer.snapshot.availability.queueEdit={allowed:true};peer.snapshot.availability.sendQueuedNow={allowed:true};
  if(state==='queue-paused'){
    peer.snapshot.queue={items:[queueItem()],autoDrain:false,pauseReason:'manual'};
    peer.snapshot.inputRouting={mode:'choice'};
  }else peer.snapshot.inputRouting={mode:state==='turn-running'?'enqueue':'startNow'};
  const events=[],notifications=[];
  const session={id:'native',header:{cwd:'/workspace'},get seq(){return events.length},eventAt:seq=>events[seq],append(type,data){const event={type,data:structuredClone(data),seq:events.length,time:0};events.push(event);return event}};
  const ctx={get:name=>name==='attachments'?store:undefined};
  const transport={conversation:()=>new V4Conversation(peer,{address:{runtime:'zcode',authority:'official-host',workspace:'/workspace',sessionId:peer.snapshot.sessionId},workspace:{workspacePath:'/workspace',workspaceKey:'/workspace'},connectionId:peer.connectionId,clientId:'test-driver',clientMode:'desktop-continuous',runnable:true,managementAllowed:true,reconnectable:true})};
  const agent=new DriverAgent(ctx,session,options,peer.snapshot.sessionId,{transport,createScope:()=>({ctx}),agentEvents:()=>({emit:(type,payload)=>notifications.push({type,payload}),waterfall:(_type,payload)=>approval(payload)})});
  await agent.ready();await tick();
  if(state==='transport-lost')peer.disconnect();
  return {agent,peer,events,notifications,async drain(){await Promise.allSettled([...agent.tasks]);await tick()},async close(){await agent.stop()}};
}
