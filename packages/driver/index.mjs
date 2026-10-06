import {installDriver} from './factory.mjs';
import {DriverTransport} from './transport.mjs';
export {DriverFactory,installDriver,BINDING_EVENT,boundConversationId} from './factory.mjs';
export {DriverAgent} from './agent.mjs';
export {DriverTransport} from './transport.mjs';
export {COMMAND_REJECTIONS,ROUTED_COMMANDS,requestedDelivery} from './commands.mjs';
export const inject=['agents','sessions','sessionProjections','zcodeBridgeHost'];
export async function apply(ctx){
  const [{createScope},{agentEvents}]=await Promise.all([import('@deepseek-ai/dsh-scope'),import('@deepseek-ai/dsh-agent')]);
  const host=ctx.zcodeBridgeHost;
  const driver=installDriver(ctx,{createScope,agentEvents,transport:new DriverTransport(host)});
  host.driverState=driver.state;
  ctx.effect(()=>async()=>{try{await driver.dispose()}finally{if(host.driverState===driver.state)host.driverState={state:'unavailable',reason:'driver-unloaded'}}},'zcode-driver: factory lifecycle');
}
