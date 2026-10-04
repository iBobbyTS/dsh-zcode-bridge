import { BridgeError } from './installation.mjs';
import * as schema from './vendor/zcode/v4.mjs';

// Official store/journal remain the only authority. All params are strict, then the
// owned workspace/session is added; the caller can never replace either identity.
const managed = Object.fromEntries(['List','Get','UpdateMeta','Delete','Move','Runs'].map(name => [
  name[0].toLowerCase()+name.slice(1),
  [`workflows/${name[0].toLowerCase()+name.slice(1)}`,schema[`zcodeWorkflows${name}ParamsSchema`],schema[`zcodeWorkflows${name}ResultSchema`]],
]));
const queries = Object.fromEntries(['Runs','RunEvents','RunArtifacts','RunArtifactData','RunArtifactRead','RunWorkspace','RunNodeResult'].map(name => [
  name[0].toLowerCase()+name.slice(1),
  [`v4/conversation/workflow${name}`,schema[`v4ConversationWorkflow${name}ParamsSchema`],schema[`v4ConversationWorkflow${name}ResultSchema`]],
]));
export const WORKFLOW_MANAGEMENT_WRITES = new Set(['updateMeta','delete','move']);
export const WORKFLOW_COMMANDS = new Set(['startSavedWorkflow','resumeWorkflowRun','amendWorkflowRunSettings']);
export const WORKFLOW_LIMITATIONS = Object.freeze({
  save: {allowed:false,reason:'save-tool-carrier-unavailable'},
  graph: {allowed:false,reason:'saved-graph-query-unavailable'},
  execution: {allowed:false,reason:'runtime-restricted'},
});

export async function requestWorkflow(peer, {kind,params={},workspace,sessionId,management=false}, {signal}={}) {
  const table=management?managed:queries;
  const carrier=Object.hasOwn(table,kind)?table[kind]:null;
  if(!carrier)throw new BridgeError('workflow-carrier-unavailable');
  if(!params||typeof params!=='object'||Array.isArray(params)||Object.hasOwn(params,'workspace')||Object.hasOwn(params,'sessionId'))throw new BridgeError('workflow-params-invalid');
  const parsed=carrier[1].safeParse({...params,...(management?{workspace}:{sessionId})});
  if(!parsed.success)throw new BridgeError('workflow-params-invalid');
  let raw;
  try { raw=await peer.request(carrier[0],parsed.data,{signal}) }
  catch(error){
    // An aborted waiter cannot cancel a store write. Sent timeout/EOF is uncertain;
    // never rewrite, resend or describe it as an official cancellation.
    if(management&&WORKFLOW_MANAGEMENT_WRITES.has(kind)&&error.sent!==false&&error.code!=='runtime-rejected'){
      const uncertain=new BridgeError('workflow-outcome-unknown');uncertain.cause=error;throw uncertain;
    }
    throw error;
  }
  const result=carrier[2].safeParse(raw);
  if(!result.success)throw new BridgeError(management&&WORKFLOW_MANAGEMENT_WRITES.has(kind)?'workflow-outcome-unknown':'workflow-result-invalid');
  if(management&&kind==='list'&&result.data.workflows.some(w=>w.scope!==(params.scope??'project')))throw new BridgeError('workflow-result-identity-mismatch');
  if(management&&kind==='get'&&result.data.ok&&(result.data.name!==params.name||result.data.scope!==(params.scope??'project')))throw new BridgeError('workflow-result-identity-mismatch');
  if(!management&&kind==='runArtifactRead'){
    const bytes=Buffer.from(result.data.dataBase64,'base64').length;
    if(bytes>parsed.data.limit||parsed.data.offset+bytes>result.data.totalBytes||result.data.nextOffset!==null&&result.data.nextOffset!==parsed.data.offset+bytes||result.data.nextOffset===null&&parsed.data.offset+bytes!==result.data.totalBytes)throw new BridgeError('workflow-result-invalid');
  }
  return result.data;
}
