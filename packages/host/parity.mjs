import { CatalogClient } from './catalog.mjs';
import { InsightsClient } from './insights.mjs';
import { AutomationClient } from './automation.mjs';
import { zcodeWorkspacePresentationSchema } from './vendor/zcode/v4.mjs';
import { requestWorkflow } from './workflow.mjs';
const fault=code=>Object.assign(new Error(code),{code,sent:false});
const deletion=new Set(['delete','uninstall','marketplaceRemove']);
/** S06 routing owner. Rebuild clients after each transport generation, retaining no unknown
 * capability denial. Workspace/session addresses are resolved from registered mirror records. */
export class ParityService {
  clients=new Map();
  constructor(runtime){this.runtime=runtime}
  async handle(payload,signal){
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(key=>!['domain','operation','kind','params','sessionId','operationId','baseRevision','baseLogEpoch','heldQueue'].includes(key)))throw fault('invalid-payload');
    const {domain,operation,kind,sessionId,operationId}=payload,params=payload.params??{};
    if(!params||typeof params!=='object'||Array.isArray(params)||['workspace','workspacePath','workspaceIdentity','sessionId','connectionId','__zcodeTrustedV4Connection'].some(key=>Object.hasOwn(params,key)))throw fault('invalid-payload');
    if(this.runtime.disposed)throw fault('disposed');
    signal?.throwIfAborted();
    await this.runtime.ensurePeer();if(this.runtime.disposed)throw fault('disposed');
    const record=sessionId===undefined?null:this.runtime.store.records.get(sessionId);
    if(sessionId!==undefined&&(!record||this.runtime.absent.has(sessionId)))throw fault('runtime-identity-locked');
    if(record)this.runtime.assertMirrorOwner(record);
    const path=record?.workspace??this.runtime.host.launcher.state.executionWorkspace;
    const workspace={workspacePath:path,workspaceKey:path};
    const peer=this.runtime.peer;
    const scopedPeer={request:(method,p,options)=>peer.request(method,{...p,workspace},options)};
    let clients=this.clients.get(path);
    if(!clients||clients.peer!==peer||clients.generation!==peer.generation){clients?.catalog.dispose();clients?.insights.dispose();clients?.automation.dispose();
      const scoped={request:(method,p,options)=>peer.request(method,{...p,workspace},options),onNotification:fn=>peer.onNotification(fn),get closed(){return peer.closed}};
      clients={peer,generation:peer.generation,catalog:new CatalogClient(scoped,{workspace,managementAllowed:true}),insights:new InsightsClient(scoped,{auth:'authenticated',executionAllowed:true,workspace}),automation:new AutomationClient(scoped,{auth:'authenticated',hostBacked:true})};this.clients.set(path,clients);
    }
    if(domain==='catalog'){
      if(operation==='state')return {admission:clients.catalog.admission,operations:clients.catalog.operations,workspace:path,auth:'authenticated',installationVerified:this.runtime.host.status.installation?.verified===true};
      if(operation==='read')return clients.catalog.read(kind,params,{signal});
      if(operation==='operate'&&!deletion.has(kind))return clients.catalog.operate(kind,params,{signal,operationId});
    }
    if(domain==='insights'){
      if(operation==='state')return clients.insights.state();
      if(operation==='read')return clients.insights.read(kind,params,{signal});
      if(operation==='operate')return clients.insights.operate(kind,params,{signal});
    }
    if(domain==='automation'){
      if(operation==='state')return clients.automation.state();
      if(operation==='read')return clients.automation.read(kind,params,{signal});
      if(operation==='operate'&&!deletion.has(kind))return clients.automation.operate(kind,params,{signal});
    }
    if(domain==='workflow'&&['read','manage'].includes(operation)&&kind!=='delete'){
      if(operation==='read'&&!record?.officialId)throw fault('official-session-required');
      return requestWorkflow(scopedPeer,{kind,params,workspace,sessionId:record?.officialId,management:operation==='manage'},{signal});
    }
    if(domain==='workspace'&&operation==='read'){
      if(Object.keys(params).length)throw fault('invalid-payload');
      // Explicit refresh observes the official catalog; no Session is activated by presentation reads.
      if(!record)await this.runtime.refreshDirectory();
      const paths=record?[record.workspace]:[...new Set([this.runtime.host.launcher.state.executionWorkspace,
        ...[...this.runtime.store.records.values()].filter(value=>value.officialId&&!this.runtime.absent.has(value.id)).map(value=>value.workspace)])];
      const generation=peer.generation,presentations=[];
      for(const path of paths){
        if(signal?.aborted)throw fault('cancelled');
        const target={workspacePath:path,workspaceKey:path};
        try{
          const presentation=zcodeWorkspacePresentationSchema.parse(await peer.request('workspace/readPresentation',{workspace:target},{signal}));
          if(presentation.workspace.workspacePath!==path)throw fault('workspace-presentation-identity-mismatch');
          presentations.push({workspace:path,presentation});
        }catch(error){if(signal?.aborted)throw fault('cancelled');presentations.push({workspace:path,error:{code:error.code??'workspace-presentation-invalid'}})}
        if(this.runtime.disposed||peer.generation!==generation)throw fault('parity-owner-replaced');
      }
      return {presentations};
    }
    if(domain==='preferences'&&['read','update'].includes(operation))return peer.request('bridge/preferences/'+operation,{...params,workspace},{signal});
    // Conversation resources/control stay with S04's projection, target admission and command ledger.
    if(['command','attachment','snapshot'].includes(domain)){
      const agent=this.runtime.agents.get(sessionId);if(!agent||!record?.officialId)throw fault('official-session-required');
      agent.touch();await agent.connect();if(!await agent.whenProjectionReady())throw fault('projection-unconfirmed');if(signal?.aborted)throw fault('cancelled');
      if(domain==='snapshot')return agent.conversation.state;
      if(domain==='command'){
        const allowed=new Set(['setAssistantFeedback','startSavedWorkflow','resumeWorkflowRun','amendWorkflowRunSettings','cancelBackgroundWork','sendText','sendGoalCommand','reorderQueueItem','setAutoDrain','setFollowupMode','pauseGoal','resumeGoal']);
        if(operation!=='submit'||!allowed.has(kind))throw fault('parity-command-denied');
        const snapshot=agent.conversation.state.snapshot;
        if(payload.baseLogEpoch!==snapshot.logEpoch||payload.baseRevision!==snapshot.revision)throw fault('parity-projection-stale');
        const input=['sendText','sendGoalCommand'].includes(kind);
        let heldQueue;
        if(input&&(snapshot.inputRouting.mode==='choice'||params.heldQueueDisposition!==undefined||payload.heldQueue!==undefined)){
          agent.assertHeldQueueCurrent(payload.heldQueue);
          heldQueue=structuredClone(payload.heldQueue);
          if(!['clearQueueAndSend','keepQueueAndSend'].includes(params.heldQueueDisposition)||
             !Array.isArray(params.expectedHeldQueueItemIds)||params.expectedHeldQueueItemIds.length!==heldQueue.items.length||
             !params.expectedHeldQueueItemIds.every((id,index)=>id===heldQueue.items[index].queueItemId))throw fault('held-queue-confirmation-stale');
        }
        const result=await agent.submitControl({type:kind,payload:params,baseRevision:payload.baseRevision,baseLogEpoch:payload.baseLogEpoch,heldQueue,signal});
        // submitControl uses the durable S04 receipt owner; ACK is never projected as execution.
        return result;
      }
      const methods={start:'attachmentStart',chunk:'attachmentChunk',commit:'attachmentCommit',abort:'attachmentAbort',read:'attachmentRead',stat:'conversationAttachmentStat',conversationRead:'conversationAttachmentRead',preview:'attachmentPreviewSource'};
      const method=methods[operation];if(method)return agent.conversation[method]({...params,signal});
    }
    throw fault('parity-operation-denied');
  }
  dispose(){for(const clients of this.clients.values()){clients.catalog.dispose();clients.insights.dispose();clients.automation.dispose()}this.clients.clear()}
}
