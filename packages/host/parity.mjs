import { CatalogClient } from './catalog.mjs';
import { InsightsClient } from './insights.mjs';
import { AutomationClient } from './automation.mjs';
import { requestWorkflow } from './workflow.mjs';
const fault=code=>Object.assign(new Error(code),{code,sent:false});
const deletion=new Set(['delete','uninstall','marketplaceRemove']);
/** S06 routing owner. Rebuild clients after each transport generation, retaining no unknown
 * capability denial. Workspace/session addresses are resolved from registered mirror records. */
export class ParityService {
  clients=new Map();
  constructor(runtime){this.runtime=runtime}
  async handle(payload,signal){
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(key=>!['domain','operation','kind','params','sessionId','operationId','baseRevision','baseLogEpoch'].includes(key)))throw fault('invalid-payload');
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
      return requestWorkflow(peer,{kind,params,workspace,sessionId:record?.officialId,management:operation==='manage'},{signal});
    }
    if(domain==='preferences'&&['read','update'].includes(operation))return peer.request('bridge/preferences/'+operation,{...params,workspace},{signal});
    // Conversation resources/control stay with S04's projection, target admission and command ledger.
    if(['command','attachment','snapshot'].includes(domain)){
      const agent=this.runtime.agents.get(sessionId);if(!agent||!record?.officialId)throw fault('official-session-required');
      agent.touch();await agent.connect();if(!await agent.whenProjectionReady())throw fault('projection-unconfirmed');
      if(domain==='snapshot')return agent.conversation.state;
      if(domain==='command'){
        const allowed=new Set(['setAssistantFeedback','startSavedWorkflow','resumeWorkflowRun','amendWorkflowRunSettings','cancelBackgroundWork','sendText','sendGoalCommand','reorderQueueItem','setAutoDrain','setFollowupMode','pauseGoal','resumeGoal']);
        if(operation!=='submit'||!allowed.has(kind))throw fault('parity-command-denied');
        const snapshot=agent.conversation.state.snapshot;
        if(payload.baseLogEpoch!==snapshot.logEpoch||payload.baseRevision!==snapshot.revision)throw fault('parity-projection-stale');
        const result=await agent.submitControl({type:kind,payload:params,baseRevision:payload.baseRevision,baseLogEpoch:payload.baseLogEpoch});
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
