// Workflow reachability capture: empty reads and rejected unknown identities.
// 0 model calls. All sessions live under an isolated HOME/workspace; the real user
// storage is never touched because HOME is redirected before spawn. No workflow engine
// is started here: only the real empty state and the official
// rejection of unknown identities are captured.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';

const destination = resolve(process.argv[3] ?? 'tests/fixtures/workflow-management');
const workspacePath = await realpath(await mkdtemp(join(tmpdir(), 'zcode-workflow-ws-')));
const home = await mkdtemp(join(tmpdir(), 'zcode-workflow-home-'));
const evidence = {
  provenance: {
    kind: 'official-runtime-capture',
    capturedAt: new Date().toISOString(),
    paidModelCalls: 0,
    isolation: 'dedicated tmp HOME + workspace; real user storage untouched',
    sanitization: 'tmp paths aliased; stderr counted only',
    note: 'no script saved or engine started; formal save/graph RPC absent, empty state and unknown-id rejection only',
  },
  probes: {},
  errorFacts: [],
};
let child, peer, exited, conversation;
const workspace = { workspacePath, workspaceKey: workspacePath };
let sessionAliases = [];

function sanitize(value) {
  let json = JSON.stringify(value, null, 2);
  json = json.split(home).join('/fixture/workflow-home').split(workspacePath).join('/fixture/workflow-workspace');
  for (const id of sessionAliases) json = json.split(id).join('/fixture/workflow-session');
  return JSON.parse(json);
}
async function probe(name, method, params) {
  try {
    const result = await peer.request(method, params, { timeoutMs: 20000 });
    evidence.probes[name] = { method, result: sanitize(result) };
    return result;
  } catch (error) {
    evidence.errorFacts.push({ name, method, code: error.code, protocolCode: error.protocolCode, name2: error.name });
    evidence.probes[name] = { method, error: { code: error.code, protocolCode: error.protocolCode, message: String(error.message).split('\n')[0] } };
    return undefined;
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  const installation = await inspectInstallation(process.argv[2] ?? '/Applications/ZCode.app');
  if (!installation.verified) throw Error('installation-unverified');
  Object.assign(evidence.provenance, { version: installation.version, build: installation.build, sha256: installation.sha256 });

  const env = { ...runtimeEnv(installation.providerConfig), HOME: home };
  child = spawn(installation.launcher, [installation.cjs, 'app-server', '--stdio'], { cwd: workspacePath, env, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise(resolve => child.once('close', resolve));
  evidence.provenance.stderrBytes = 0;
  child.stderr.on('data', b => { evidence.provenance.stderrBytes += b.length; });
  peer = new ProtocolPeer(child.stdout, child.stdin, { timeoutMs: 20000 });

  evidence.probes.capabilities = await probe('capabilities', 'runtime/capabilities', {});

  // A dedicated v4 draft has no firstInput and cannot initiate model execution.
  const created = await peer.request('v4/command', { commandId: randomUUID(), clientId: 'workflow-capture', sessionId: null, type: 'createSession', payload: { workspaceId: workspacePath }, issuedAt: Date.now() });
  const v4SessionId = created.result?.sessionId ?? created.ack?.result?.sessionId;
  if (!v4SessionId) throw Error('v4-create-session-missing');
  sessionAliases = [v4SessionId];
  evidence.provenance.parentCreated = true;

  conversation = new V4Conversation(peer, {
    address: { runtime: 'zcode', authority: 'workflow-capture', workspace: workspacePath, sessionId: v4SessionId },
    workspace, connectionId: `workflow-${randomUUID()}`, clientId: 'workflow-capture', clientMode: 'web-remote-replayable',
  });
  await conversation.connect({ forceSnapshot: true });
  for (let i = 0; i < 500 && conversation.state.status !== 'live'; i++) await sleep(10);
  const snapshot = conversation.state.snapshot;
  evidence.probes.conversationProjection = {
    method: 'v4/conversation/subscribe',
    result: sanitize({
      status: conversation.state.status,
      backgroundWorks: snapshot?.backgroundWorks ?? null,
      subagents: snapshot?.subagents ?? null,
      activeWorks: snapshot?.control?.activeWorks ?? null,
      canStop: snapshot?.control?.canStop ?? null,
    }),
  };

  await probe('listProject', 'workflows/list', { workspace, scope: 'project' });
  await probe('listGlobal', 'workflows/list', { workspace, scope: 'global' });
  await probe('getUnknown', 'workflows/get', { workspace, name: 'workflow-never-created', scope: 'project' });
  await probe('metaUnknown', 'workflows/updateMeta', { workspace, name: 'workflow-never-created', scope: 'project', meta: {description: 'Workflow probe'} });
  await probe('deleteUnknown', 'workflows/delete', { workspace, name: 'workflow-never-created', scope: 'project' });
  await probe('moveUnknown', 'workflows/move', { workspace, name: 'workflow-never-created' });
  await probe('runsEmpty', 'workflows/runs', { workspace, scope: 'project', limit: 50 });
  await probe('saveCarrierAbsent', 'workflows/save', { workspace });
  await probe('graphCarrierAbsent', 'workflows/graph', { workspace, name: 'workflow-never-created' });
  for (const suffix of ['Runs','RunEvents','RunArtifacts','RunArtifactData','RunArtifactRead','RunWorkspace','RunNodeResult']) {
    const params = {sessionId: v4SessionId};
    if (suffix !== 'Runs') params.runId = 'workflow-never-created';
    if (suffix === 'RunArtifactData' || suffix === 'RunArtifactRead') params.artifactId = 'workflow-never-created';
    if (suffix === 'RunNodeResult') Object.assign(params,{siteId:'workflow-never-created',ordinal:0});
    if (suffix === 'RunArtifactRead') Object.assign(params,{version:1,offset:0,limit:1024});
    await probe('read'+suffix, 'v4/conversation/workflow'+suffix, params);
  }
  // Missing identities are rejected before compilation/submission (source verified); no saved script
  // is installed and therefore none of these calls can reach an engine or model.
  for (const [type,payload] of [
    ['startSavedWorkflow',{name:'workflow-never-created',scope:'project'}],
    ['resumeWorkflowRun',{workId:'workflow-never-created'}],
    ['amendWorkflowRunSettings',{workId:'workflow-never-created',maxConcurrency:1}],
    ['cancelBackgroundWork',{workId:'workflow-never-created'}],
  ]) await probe(type, 'v4/command', {commandId:randomUUID(),clientId:'workflow-capture',sessionId:v4SessionId,type,payload,issuedAt:Date.now()});
  evidence.probes.workflowProjection = { method:'v4/conversation/subscribe', result:sanitize({workflowRuns:snapshot?.workflowRuns,rows:snapshot?.rows}) };
  // Production bridge path: same official peer, scoped owner, genuine empty reads and local gates.
  const production={};
  for(const [kind,params] of [['list',{scope:'project'}],['list',{scope:'global'}],['get',{name:'workflow-never-created',scope:'project'}],['runs',{scope:'project',limit:50}]]) production[kind+(params.scope??'')]=await conversation.workflowManage(kind,params);
  for(const [kind,params] of [['runs',{}],['runArtifacts',{runId:'workflow-never-created'}],['runEvents',{runId:'workflow-never-created'}],['runWorkspace',{runId:'workflow-never-created'}]]) production[kind]=await conversation.workflowRead(kind,params);
  for(const [type,payload] of [['startSavedWorkflow',{name:'workflow-never-created',scope:'project'}],['resumeWorkflowRun',{workId:'workflow-never-created'}],['amendWorkflowRunSettings',{workId:'workflow-never-created',maxConcurrency:1}]]){
    try{await conversation.submit({type,payload});throw Error('restricted-command-was-admitted')}
    catch(e){if(e.code!=='runtime-restricted')throw e;production[type]={gated:e.code}}
  }
  evidence.productionOracle=sanitize(production);
  evidence.status = 'PASS';
} catch (error) {
  evidence.status = 'NOT_RUN';
  evidence.reason = error.code ?? error.message;
} finally {
  if (conversation) await conversation.cancel().catch(() => {});
  peer?.close();
  if (child) await stopOwned(child, exited);
  await rm(workspacePath, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
}

await mkdir(destination, { recursive: true });
await writeFile(join(destination, 'official.json'), JSON.stringify(evidence, null, 2) + '\n');
const summarize = {};
for (const [name, entry] of Object.entries(evidence.probes)) summarize[name] = entry.error ? `ERR ${entry.error.code}(${entry.error.protocolCode ?? '-'})` : entry.result?.status ? `ACK ${entry.result.status} ${entry.result.reasonCode??''}` : entry.result?.ok===false ? `REJECT ${entry.result.reason}` : 'OK';
console.log(JSON.stringify({ status: evidence.status, reason: evidence.reason, paidModelCalls: 0, probes: summarize, errorFacts: evidence.errorFacts.slice(0, 12) }, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 1;
