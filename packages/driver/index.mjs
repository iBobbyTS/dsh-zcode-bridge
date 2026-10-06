import {installDriver} from './factory.mjs';
import {DriverTransport} from './transport.mjs';
import {installSessionCommandSeams} from './session-commands.mjs';
export {DriverFactory,installDriver,BINDING_EVENT,boundConversationId} from './factory.mjs';
export {DriverAgent} from './agent.mjs';
export {DriverTransport} from './transport.mjs';
export {COMMAND_REJECTIONS,ROUTED_COMMANDS,requestedDelivery} from './commands.mjs';
export {installSessionCommandSeams} from './session-commands.mjs';
export {ConversationEventTranslator,mergeEventWindows,turnEndReason} from './events.mjs';
export const inject=['agents','sessions','sessionProjections','zcodeBridgeHost'];
export async function apply(ctx){
  const [{createScope},{agentEvents},{interruptedTurnClosers}]=await Promise.all([import('@deepseek-ai/dsh-scope'),import('@deepseek-ai/dsh-agent'),import('@deepseek-ai/dsh-session')]);
  const host=ctx.zcodeBridgeHost;
  const driver=installDriver(ctx,{createScope,agentEvents,interruptedTurnClosers,transport:new DriverTransport(host)});
  host.driverState=driver.state;
  if(driver.state.state==='occupied'){
    const seams=ctx.inject(['sessionController','sessionTitle'],async seamCtx=>{
      const [{normalizeSessionTitle},{RemoteError}]=await Promise.all([import('@deepseek-ai/dsh-session-title'),import('@deepseek-ai/dsh-typert-protocol')]);
      seamCtx.fiber.assertActive();
      if(driver.factory.accepting)installSessionCommandSeams(seamCtx,driver.factory,{normalizeSessionTitle,RemoteError});
    });
    if(ctx.get('sessionController')&&ctx.get('sessionTitle'))await seams.await();
  }
  ctx.effect(()=>async()=>{try{await driver.dispose()}finally{if(host.driverState===driver.state)host.driverState={state:'unavailable',reason:'driver-unloaded'}}},'zcode-driver: factory lifecycle');
}
