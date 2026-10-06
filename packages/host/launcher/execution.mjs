import { randomUUID } from 'node:crypto';
import { parseCommandEnvelope } from '../vendor/zcode/v4.mjs';
import { PARITY_METHODS, PARITY_CALLS, requestParity } from './parity.mjs';
import { fault } from './config.mjs';

export const EXECUTION_CALLS = Object.freeze(['helloConversationV4','initializeConversationV4','subscribeConversationV4','resyncConversationV4','unsubscribeConversationV4','sendConversationCommandV4','queryConversationCommandsV4'].map(name=>'zcode-agent.'+name).concat(PARITY_CALLS));
export const EXECUTION_EVENTS = new Set(['zcode-agent.onDynamicConversationFrame','zcode-agent.onDynamicPluginOperationProgress']);
export const EXECUTION_COMMANDS = new Set(['createSession','sendText','stop','resolveInteraction','snoozeInteractionAutoResolution','respondWorkspaceHookReview','toggleWorkspaceHookReviewItem','revokeWorkspaceHookTrust','requestWorkspaceHookReview','switchModelConfig','renameSession','editQueueItem','sendQueuedNow','reorderQueueItem','setAutoDrain','setFollowupMode','switchCollaborationMode','pauseGoal','resumeGoal','sendGoalCommand','setAssistantFeedback','startSavedWorkflow','resumeWorkflowRun','amendWorkflowRunSettings','cancelBackgroundWork']);
const methods = {
  'v4/conversation/subscribe':'subscribeConversationV4',
  'v4/conversation/resync':'resyncConversationV4',
  'v4/conversation/unsubscribe':'unsubscribeConversationV4',
  'v4/command':'sendConversationCommandV4',
  'v4/commands/query':'queryConversationCommandsV4',
};
/** Main owns workspace identity and capability allowlists. The private stdin pipe and nonce bind
 * every request to the exact launched child; browser callers never receive this transport. */
export function createExecutionRelay({channel,workspacePath,workspaceIdentity,emit,onCommand=()=>{},resolveWorkspace,maxPending=32,maxSubscriptions=64}) {
  let pending=0,disposed=false;
  const subscriptions=new Map(),subscriptionWorkspaces=new Map(),eventOffs=new Map();
  const releaseWorkspace=path=>{if(path&&![...subscriptionWorkspaces.values()].includes(path)){eventOffs.get(path)?.();eventOffs.delete(path)}};
  // The official host treats the attachment workspace identity as authoritative: without it a
  // cold subscribe can only infer the workspace from the persisted session path, which a
  // just-created session does not have yet — the hydrate then misses and no initial frame flows.
  const target={workspacePath,...(workspaceIdentity?{workspaceIdentity}:{})};
  return {
    async request(method,params) {
      if(disposed||pending>=maxPending)throw Object.assign(fault(disposed?'execution-disposed':'execution-pending-limit'),{sent:false});
      pending++;let rpcIssued=false,subscriptionReservation;
      try {
        if(method==='hello')return await channel.call('zcode-agent','helloConversationV4',[]);
        if(method==='initialize')return await channel.call('zcode-agent','initializeConversationV4',[params]);
        const name=methods[method];
        const parity=Object.hasOwn(PARITY_METHODS,method)||['process/childProcesses','automation/list','automation/checkTaskBinding','automation/create','automation/update','offPeak/list','offPeak/create','bridge/preferences/read','bridge/preferences/update'].includes(method);
        if(!name&&!parity)throw fault('execution-method-denied');
        let payload={...target};
        if(params?.workspace&&(typeof params.workspace.workspacePath!=='string'||params.workspace.workspaceKey!==params.workspace.workspacePath))throw fault('execution-workspace-denied');
        if(params?.workspace&&params.workspace.workspacePath!==workspacePath){
          const path=params.workspace.workspacePath;
          if(typeof path!=='string'||params.workspace.workspaceKey!==path||!resolveWorkspace)throw fault('execution-workspace-denied');
          const resolved=await resolveWorkspace(path);if(!resolved)throw fault('execution-workspace-denied');
          payload={workspacePath:path,workspaceIdentity:resolved.workspaceIdentity??path};
        }
        if(parity){rpcIssued=true;return await requestParity(channel,method,params,payload,emit)}
        if(method==='v4/command') {
          const {workspace:_workspace,...envelope}=params;const parsed=parseCommandEnvelope(envelope);
          if(!parsed.ok||!EXECUTION_COMMANDS.has(params.type))throw fault('execution-command-denied');
          payload.envelope=parsed.value??parsed.envelope??envelope;
          payload.clientMode='desktop-continuous';onCommand({commandId:params.commandId,type:params.type,sessionId:params.sessionId});
        } else if(method==='v4/conversation/subscribe') {
          if(typeof params.topic!=='string'||!params.topic.startsWith('conversation/'))throw fault('execution-topic-denied');
          const stale=subscriptions.get(params.topic);
          if(stale!==undefined&&typeof stale==='object')throw fault('execution-subscription-active');
          // A completed registration the consumer no longer owns (ACK rejected after the official
          // subscription existed, or a transport loss that skipped unsubscribe) must not wedge
          // every later resubscribe behind the duplicate guard: replace it. Release the old
          // official subscription through the normal unsubscribe path first, tolerating failure.
          if(stale!==undefined){
            await this.request('v4/conversation/unsubscribe',{...params,subscriptionId:stale}).catch(()=>{});
            const current=subscriptions.get(params.topic);
            if(current!==undefined&&typeof current==='object')throw fault('execution-subscription-active');
            const path=subscriptionWorkspaces.get(params.topic);subscriptions.delete(params.topic);subscriptionWorkspaces.delete(params.topic);releaseWorkspace(path);
          }
          if(subscriptions.size>=maxSubscriptions)throw fault('execution-subscription-limit');
          payload={...payload,sessionId:params.topic.slice(13),clientMode:'desktop-continuous',visibility:'foreground',...(params.base?{base:params.base}:{})};
          // Subscribe to the frame event before the initial request: the official ACK and initial
          // frame may arrive in one turn of the event loop.
          const eventTarget={workspacePath:payload.workspacePath,workspaceIdentity:payload.workspaceIdentity};
          if(!eventOffs.has(payload.workspacePath))eventOffs.set(payload.workspacePath,channel.listen('zcode-agent','onDynamicConversationFrame',frame=>emit({method:'v4/conversation/frame',params:frame}),eventTarget));subscriptionReservation={};subscriptions.set(params.topic,subscriptionReservation);subscriptionWorkspaces.set(params.topic,payload.workspacePath);
        } else if(method==='v4/commands/query')payload.commands=params.commands;
        else payload={...payload,subscriptionId:params.subscriptionId,...(method.includes('resync')?{base:params.base??null,forceSnapshot:params.forceSnapshot===true}:{})};
        rpcIssued=true;const result=await channel.call('zcode-agent',name,[payload],{timeoutMs:25000});if(method==='v4/conversation/subscribe'&&subscriptions.get(params.topic)===subscriptionReservation)subscriptions.set(params.topic,result.ack?.subscriptionId);if(method==='v4/conversation/unsubscribe')for(const [topic,id] of subscriptions)if(id===params.subscriptionId){const path=subscriptionWorkspaces.get(topic);subscriptions.delete(topic);subscriptionWorkspaces.delete(topic);releaseWorkspace(path)};return result;
      } catch(error){if(subscriptionReservation&&subscriptions.get(params.topic)===subscriptionReservation){const path=subscriptionWorkspaces.get(params.topic);subscriptions.delete(params.topic);subscriptionWorkspaces.delete(params.topic);releaseWorkspace(path)}if(!rpcIssued)error.sent=false;throw error}finally {pending--;}
    },
    dispose(){disposed=true;for(const off of eventOffs.values())off();eventOffs.clear();subscriptions.clear();subscriptionWorkspaces.clear()},
  };
}

/** ProtocolPeer face over the authenticated launcher carrier, consumed by the unchanged V4
 * projection owner. Delivery is deferred until onResult establishes the ACK reservation. */
export class LauncherPeer {
  closed=false;generation=0;reservations=new Set();bufferedBytes=0;
  constructor(launcher){this.launcher=launcher;this.connectionId='bridge-'+randomUUID();this.listeners=new Set();this.closers=new Set();this.off=launcher.onExecutionEvent(event=>this.receive(event));this.offState=launcher.subscribe(state=>{if(state.phase!=='ready'){this.generation++;for(const entry of this.reservations){entry.events=[];entry.error=fault(state.reason??'execution-disconnected')}this.reservations.clear();this.bufferedBytes=0;for(const listener of this.closers)listener(state.reason??'execution-disconnected')}})}
  deliver(event){if(!this.closed)for(const listener of this.listeners)listener(event)}
  receive(event){
    if(this.closed)return;
    const reservation=[...this.reservations].find(entry=>entry.topic===event.params?.topic&&(!entry.subscriptionId||entry.subscriptionId===event.params?.subscriptionId));
    if(!reservation){this.deliver(event);return}
    const bytes=Buffer.byteLength(JSON.stringify(event));
    if(reservation.events.length>=128||this.bufferedBytes+bytes>8*1024*1024){reservation.error=fault('execution-reservation-limit');return}
    reservation.events.push({event,bytes});this.bufferedBytes+=bytes;
  }
  prepareCommand(params){
    if(this.closed||this.launcher.state?.phase!=='ready'||this.launcher.state?.auth!=='authenticated')throw Object.assign(fault('execution-unavailable'),{sent:false});
    const {workspace:_workspace,...envelope}=params;const parsed=parseCommandEnvelope(envelope);
    if(!parsed.ok||!EXECUTION_COMMANDS.has(params.type))throw Object.assign(fault('execution-command-denied'),{sent:false});
  }
  async request(method,params,{onResult,signal}={}){
    if(this.closed)throw Object.assign(fault('execution-disposed'),{sent:false});
    // Frames can precede the ACK over separate Host/launcher messages, even across event-loop
    // turns. Release only after the consumer's reservation callback, never after a timing delay.
    const generation=this.generation;
    const reservation=['v4/conversation/subscribe','v4/conversation/resync'].includes(method)?{topic:params.topic,subscriptionId:params.subscriptionId,events:[]}:null;
    if(reservation)this.reservations.add(reservation);
    try{
      const result=await this.launcher.execution(method,params,{signal});
      if(generation!==this.generation||this.closed)throw fault('execution-disconnected');
      if(reservation?.error)throw reservation.error;
      const handled=onResult?await onResult(result):result;
      if(generation!==this.generation||this.closed)throw fault('execution-disconnected');
      if(reservation){this.reservations.delete(reservation);const held=reservation.events;reservation.events=[];this.bufferedBytes-=held.reduce((sum,item)=>sum+item.bytes,0);for(const {event} of held)if(event.params?.subscriptionId===result.ack?.subscriptionId)this.deliver(event);}
      return handled;
    }finally{if(reservation){this.reservations.delete(reservation);for(const {bytes} of reservation.events)this.bufferedBytes-=bytes;reservation.events=[];}}
  }
  onNotification(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener)}
  onClosed(listener){this.closers.add(listener);return ()=>this.closers.delete(listener)}
  close(){this.closed=true;this.off();this.offState();this.listeners.clear();this.closers.clear();for(const reservation of this.reservations)reservation.events=[];this.reservations.clear();this.bufferedBytes=0}
}
