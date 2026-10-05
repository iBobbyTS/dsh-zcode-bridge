import { randomUUID } from 'node:crypto';
import { parseCommandEnvelope } from '../vendor/zcode/v4.mjs';
import { fault } from './config.mjs';

export const EXECUTION_CALLS = Object.freeze(['helloConversationV4','initializeConversationV4','subscribeConversationV4','resyncConversationV4','unsubscribeConversationV4','sendConversationCommandV4','queryConversationCommandsV4'].map(name=>'zcode-agent.'+name));
export const EXECUTION_EVENTS = new Set(['zcode-agent.onDynamicConversationFrame']);
export const EXECUTION_COMMANDS = new Set(['createSession','sendText','stop','resolveInteraction','switchModelConfig','renameSession']);
const methods = {
  'v4/conversation/subscribe':'subscribeConversationV4',
  'v4/conversation/resync':'resyncConversationV4',
  'v4/conversation/unsubscribe':'unsubscribeConversationV4',
  'v4/command':'sendConversationCommandV4',
  'v4/commands/query':'queryConversationCommandsV4',
};
/** Main owns workspace identity and capability allowlists. The private stdin pipe and nonce bind
 * every request to the exact launched child; browser callers never receive this transport. */
export function createExecutionRelay({channel,workspacePath,workspaceIdentity,emit,onCommand=()=>{},resolveWorkspace,maxPending=32}) {
  let pending=0,disposed=false;
  const subscriptions=new Map(),eventOffs=new Map();
  // The official host treats the attachment workspace identity as authoritative: without it a
  // cold subscribe can only infer the workspace from the persisted session path, which a
  // just-created session does not have yet — the hydrate then misses and no initial frame flows.
  const target={workspacePath,...(workspaceIdentity?{workspaceIdentity}:{})};
  return {
    async request(method,params) {
      if(disposed||pending>=maxPending)throw fault(disposed?'execution-disposed':'execution-pending-limit');
      pending++;
      try {
        if(method==='hello')return await channel.call('zcode-agent','helloConversationV4',[]);
        if(method==='initialize')return await channel.call('zcode-agent','initializeConversationV4',[params]);
        const name=methods[method];if(!name)throw fault('execution-method-denied');
        let payload={...target};
        if(params?.workspace&&params.workspace.workspacePath!==workspacePath){
          const path=params.workspace.workspacePath;
          if(typeof path!=='string'||params.workspace.workspaceKey!==path||!resolveWorkspace)throw fault('execution-workspace-denied');
          const resolved=await resolveWorkspace(path);if(!resolved)throw fault('execution-workspace-denied');
          payload={workspacePath:path,workspaceIdentity:resolved.workspaceIdentity??path};
        }
        if(method==='v4/command') {
          const {workspace:_workspace,...envelope}=params;const parsed=parseCommandEnvelope(envelope);
          if(!parsed.ok||!EXECUTION_COMMANDS.has(params.type))throw fault('execution-command-denied');
          payload.envelope=parsed.value??parsed.envelope??envelope;
          payload.clientMode='desktop-continuous';onCommand({commandId:params.commandId,type:params.type,sessionId:params.sessionId});
        } else if(method==='v4/conversation/subscribe') {
          if(typeof params.topic!=='string'||!params.topic.startsWith('conversation/'))throw fault('execution-topic-denied');
          if(subscriptions.size>=16&&!subscriptions.has(params.topic))throw fault('execution-subscription-limit');
          payload={...payload,sessionId:params.topic.slice(13),clientMode:'desktop-continuous',visibility:'foreground',...(params.base?{base:params.base}:{})};
          // Subscribe to the frame event before the initial request: the official ACK and initial
          // frame may arrive in one turn of the event loop.
          const eventTarget={workspacePath:payload.workspacePath,workspaceIdentity:payload.workspaceIdentity};
          if(!eventOffs.has(payload.workspacePath))eventOffs.set(payload.workspacePath,channel.listen('zcode-agent','onDynamicConversationFrame',frame=>emit({method:'v4/conversation/frame',params:frame}),[eventTarget]));subscriptions.set(params.topic,true);
        } else if(method==='v4/commands/query')payload.commands=params.commands;
        else payload={...payload,subscriptionId:params.subscriptionId,...(method.includes('resync')?{base:params.base??null,forceSnapshot:params.forceSnapshot===true}:{})};
        const result=await channel.call('zcode-agent',name,[payload],{timeoutMs:25000});if(method==='v4/conversation/subscribe')subscriptions.set(params.topic,result.ack?.subscriptionId);if(method==='v4/conversation/unsubscribe')for(const [topic,id] of subscriptions)if(id===params.subscriptionId)subscriptions.delete(topic);return result;
      } finally {pending--;}
    },
    dispose(){disposed=true;for(const off of eventOffs.values())off();eventOffs.clear();subscriptions.clear()},
  };
}

/** ProtocolPeer face over the authenticated launcher carrier, consumed by the unchanged V4
 * projection owner. Delivery is deferred until onResult establishes the ACK reservation. */
export class LauncherPeer {
  closed=false;
  constructor(launcher){this.launcher=launcher;this.connectionId='bridge-'+randomUUID();this.listeners=new Set();this.closers=new Set();this.off=launcher.onExecutionEvent(event=>{setImmediate(()=>{if(!this.closed)for(const listener of this.listeners)listener(event)})});this.offState=launcher.subscribe(state=>{if(state.phase!=='ready')for(const listener of this.closers)listener('execution-disconnected')})}
  async request(method,params,{onResult,signal}={}){if(this.closed)throw fault('execution-disposed');const result=await this.launcher.execution(method,params,{signal});return onResult?onResult(result):result}
  onNotification(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener)}
  onClosed(listener){this.closers.add(listener);return ()=>this.closers.delete(listener)}
  close(){this.closed=true;this.off();this.offState();this.listeners.clear();this.closers.clear()}
}
