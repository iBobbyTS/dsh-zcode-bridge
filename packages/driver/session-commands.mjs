import {DriverAgent} from './agent.mjs';
import {commandFault} from './commands.mjs';
import {withQueueSteer} from './queue-steer.mjs';

/** rc.2 Remote methods delegate to this command object even when already bound.
 * sessionTitle.rename itself is synchronous; the async ACK/read barrier belongs
 * at its official command entry, before the native service is allowed to append.
 */
export function installSessionCommandSeams(ctx,factory,{normalizeSessionTitle,RemoteError}){
  const controller=ctx.get('sessionController'),titles=ctx.get('sessionTitle');
  const commands=controller?.commands;
  if(!commands||typeof commands.rename!=='function'||typeof commands.updateQueue!=='function'||typeof controller.resolveAgent!=='function')throw commandFault('driver-session-command-contract-unavailable');
  const owned=agent=>agent instanceof DriverAgent&&agent.transport===factory.transport;
  const rename=commands.rename,updateQueue=commands.updateQueue;
  const wrappedRename=async function(request){
    const found=await controller.resolveAgent(request.sessionId);
    if(found.error)throw found.error;
    const agent=found.agent;
    if(!owned(agent))return rename.call(this,request);
    if(!factory.accepting)throw commandFault('driver-not-active');
    const title=normalizeSessionTitle(request.title,titles.config.maxTitleBytes);
    if(!title)throw new RemoteError('session/title-invalid','session title must contain visible characters',{sessionId:agent.id});
    return agent.track((async()=>{
      const officialTitle=await agent.renameAndRead(title);
      agent.assertAvailable();
      if(ctx.agents.get(agent.id)!==agent)throw commandFault('rename-owner-replaced');
      const accepted=titles.rename(agent.session,officialTitle);
      if(accepted.title!==officialTitle)throw commandFault('rename-title-mismatch');
      return {title:accepted.title,seq:accepted.eventSeq};
    })());
  };
  const wrappedUpdateQueue=async function(request){
    if(request.action.kind!=='steer')return updateQueue.call(this,request);
    const found=await controller.resolveAgent(request.sessionId);
    if(found.error)throw found.error;
    if(!owned(found.agent))return updateQueue.call(this,request);
    if(!factory.accepting)throw commandFault('driver-not-active');
    return withQueueSteer(found.agent,request.itemId,()=>updateQueue.call(this,request));
  };
  return ctx.effect(()=>{
    const descriptors=new Map(['rename','updateQueue'].map(name=>[name,Object.getOwnPropertyDescriptor(commands,name)]));
    commands.rename=wrappedRename;commands.updateQueue=wrappedUpdateQueue;
    return ()=>{
      for(const [name,wrapper] of [['rename',wrappedRename],['updateQueue',wrappedUpdateQueue]]){
        if(commands[name]!==wrapper)continue;
        const descriptor=descriptors.get(name);
        if(descriptor)Object.defineProperty(commands,name,descriptor);else delete commands[name];
      }
    };
  },'zcode-driver: official session command seams');
}
