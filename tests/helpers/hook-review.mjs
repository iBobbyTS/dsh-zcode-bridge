import {readFileSync} from 'node:fs';
import {DriverAgent} from '../../packages/driver/agent.mjs';
import {parityWorld,tick} from './settings-panel-parity.mjs';
export {tick};
export const hookSnapshot=()=>structuredClone(JSON.parse(readFileSync(new URL('../fixtures/interaction-plan-review-trust/hook-review.json',import.meta.url))).initial.frame.payload.snapshot);
/** Full Main facade relay + real V4 projection + native driver + root parity
 * ingress. Only Cordis/session effects and remote service are test doubles. */
export async function hookWorld(){
  const w=await parityWorld(),legacy=w.runtime.agents.get(w.id),events=[],errors=[];
  const session={id:'native-hooks',header:{cwd:'/execution'},get seq(){return events.length},eventAt:seq=>events[seq],append(type,data){const event={type,data:structuredClone(data),seq:events.length,time:0};events.push(event);return event}};
  const agent=new DriverAgent({},session,{},'one',{transport:{conversation:()=>legacy.conversation},createScope:()=>({ctx:{}}),agentEvents:()=>({emit:(type,payload)=>errors.push({type,payload}),waterfall:async()=>{throw Error('review must remain pending')}})});
  w.agents.set(session.id,agent);
  const publish=async edit=>{
    const snapshot=hookSnapshot();snapshot.sessionId='one';snapshot.seq=w.official.snapshot.seq+1;snapshot.revision=w.official.snapshot.revision+1;
    snapshot.pendingInteractions[0].payload.sessionId='one';edit?.(snapshot);w.official.publish(snapshot);await tick();return agent.conversation.state.snapshot;
  };
  await publish();await agent.ready();
  return {...w,agent,errors,events,publish,async close(){await agent.stop();await w.close()}};
}
