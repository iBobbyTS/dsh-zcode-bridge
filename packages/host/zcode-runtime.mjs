import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { CommandLifecycle } from './command-lifecycle.mjs';
import { installMirrorHistory } from './mirror-history.mjs';
import { installMirrorGuards } from './mirror-guards.mjs';
import { LauncherPeer } from './launcher/execution.mjs';
import { ZCodeAgent, SHARED_GUI_HINT } from './zcode-agent.mjs';
import { negotiatedClientHello, newCommandId } from './conversation.mjs';
import { commandAckSchema } from './vendor/zcode/v4.mjs';
const fault=code=>Object.assign(new Error(code),{code});

/** Only mirror identities/transcripts/operation IDs live here. Official app-server owns every
 * execution and configuration write. One atomic writer serializes local persistence. */
export class RuntimeStore {
  records=new Map();writing=Promise.resolve();
  constructor(root){this.file=join(root,'zcode-bridge','sessions.json')}
  async load(){try{const data=JSON.parse(await readFile(this.file,'utf8'));if(data.version!==1||!Array.isArray(data.records))throw fault('runtime-store-invalid');for(const record of data.records){if(typeof record.id!=='string'||typeof record.officialId!=='string'||typeof record.workspace!=='string')throw fault('runtime-store-invalid');this.records.set(record.id,record)}}catch(error){if(error.code!=='ENOENT')throw error}}
  save(){const bytes=JSON.stringify({version:1,records:[...this.records.values()]});this.writing=this.writing.then(async()=>{await mkdir(join(this.file,'..'),{recursive:true,mode:0o700});const temporary=this.file+'.tmp';await writeFile(temporary,bytes,{mode:0o600});await rename(temporary,this.file)});return this.writing}
}

export class ZCodeRuntime {
  agents=new Map();disposers=new Map();creating=new Map();disposed=false;persistError=null;historyListeners=new Map();
  constructor(ctx,host,{store=new RuntimeStore(process.env.DSH_HOME??join(homedir(),'.dsh')),createScope,agentEvents,peerFactory=launcher=>new LauncherPeer(launcher)}={}){Object.assign(this,{ctx,host,store,createScope,agentEvents,peerFactory})}
  persist(){const promise=this.store.save();void promise.catch(()=>{this.persistError='runtime-persistence-failed'});return promise}
  async start(){await this.store.load();for(const record of this.store.records.values()){if(record.officialId)await this.register(record);else record.error='create-outcome-unknown'}this.offRecovery=this.host.launcher?.subscribe(state=>{if(state.phase==='ready')void this.recoverAll().catch(()=>{})});if(this.host.launcher?.state.phase==='ready')await this.recoverAll()}
  async ensurePeer(){
    await this.host.connect();const state=this.host.launcher?.state;
    if(state?.phase!=='ready'||state.auth!=='authenticated'||!state.executionWorkspace)throw fault('execution-unavailable');
    this.peer??=this.peerFactory(this.host.launcher);
    this.handshake??=(async()=>{const hello=await this.peer.request('hello');await this.peer.request('initialize',negotiatedClientHello(hello,{clientId:'dsh-zcode-bridge',appVersion:'0.1.0'}))})();await this.handshake;
    return {peer:this.peer,workspace:state.executionWorkspace,authority:'official-host'};
  }
  async recoverAll(){
    if(this.recovering)return this.recovering;
    this.recovering=(async()=>{await this.ensurePeer();for(const record of this.store.records.values()){
      const commands=new CommandLifecycle(record);
      const operations=record.officialId?commands.recoverable():[{commandId:record.createCommandId}];
      for(const operation of operations){
        const commandId=operation.commandId;if(!commandId)continue;
        const response=await this.peer.request('v4/commands/query',{commands:[{sessionId:record.officialId||null,commandId}]});
        const result=response.results?.[0];if(!result||result.key.commandId!==commandId||result.key.sessionId!==(record.officialId||null))throw fault('command-query-mismatch');
        if(result.result==='unknown'){record.error=record.officialId?'send-outcome-unknown':'create-outcome-unknown';continue}
        const ack=commandAckSchema.parse(result.result);if(ack.commandId!==commandId)throw fault('command-query-mismatch');
        if(!record.officialId&&['accepted','duplicate'].includes(ack.status)&&ack.result?.sessionId){record.officialId=ack.result.sessionId;record.createAck=ack;record.error=null;await this.store.save();await this.register(record)}
        else if(record.officialId){commands.receipt(commandId,{commandId,ack,state:ack.status});record.error=null}
      }
    }await this.store.save()})().finally(()=>this.recovering=null);return this.recovering;
  }
  async register(record){
    if(this.agents.has(record.id))return this.agents.get(record.id);
    // Agent publication can succeed while the official executor is offline. Restored transcript
    // remains visible; writes fail closed until the executor reconnects.
    const peer=this.peer??(this.host.launcher?this.peerFactory(this.host.launcher):null);
    if(!peer)throw fault('launcher-unconfigured');
    this.peer??=peer;
    const session=this.ctx.sessions.prepare(record.id,{meta:{cwd:record.cwd??record.workspace},seed:record.events??[]});
    const releaseSession=this.ctx.sessions.enter(session);this.ctx.sessions.announce?.(session);
    let agent,releaseAgent;
    try{
      agent=new ZCodeAgent(this.ctx,session,record,{peer,createScope:this.createScope,agentEvents:this.agentEvents,onPersist:()=>this.persist(),onReplacement:snapshot=>{this.replace(record,snapshot)}});
      agent.projected=new Set(record.projected??[]);
      if(record.snapshot){agent.mirror.accept(record.snapshot);for(const row of record.snapshot.rows.window)agent.turnFor(row.turnId)}
      releaseAgent=await this.ctx.agents.register(agent);
      this.agents.set(record.id,agent);this.disposers.set(record.id,async()=>{await agent.dispose();await releaseAgent();releaseSession();this.agents.delete(record.id)});
      let workspace=record.workspaceId?this.ctx.workspaceRegistry.get(record.workspaceId):await this.ctx.workspaceRegistry.resolveByPath(record.cwd??record.workspace);
      workspace??=await this.ctx.workspaceRegistry.create(record.cwd??record.workspace,'ZCode');await workspace.attachSession(record.id);
      void agent.connect().catch(error=>{record.error=error.code??'execution-unavailable';this.persist()});
      return agent;
    }catch(error){await agent?.dispose();await releaseAgent?.();releaseSession();throw error}
  }
  subscribeHistory(id,listener){let listeners=this.historyListeners.get(id);if(!listeners)this.historyListeners.set(id,listeners=new Set());listeners.add(listener);return ()=>{listeners.delete(listener);if(!listeners.size)this.historyListeners.delete(id)}}
  replace(record,snapshot){const agent=this.agents.get(record.id);if(!agent)throw fault('mirror-agent-unavailable');agent.reconcile(snapshot);for(const listener of this.historyListeners.get(record.id)??[])listener();return this.persist()}
  async create({sessionId,workspaceId,cwd,selection,mode='build'}={}){
    const id=sessionId??'zcode-'+randomUUID();if(this.agents.has(id))return {sessionId:id,runtime:'zcode'};
    if(this.ctx.agents.get(id)||this.ctx.sessions.get(id))throw fault('runtime-identity-locked');
    if(this.creating.has(id))return this.creating.get(id);
    if(this.store.records.has(id)){await this.recoverAll();if(this.agents.has(id))return {sessionId:id,runtime:'zcode'};throw fault('create-outcome-unknown')}
    const task=this.createOwned(id,{workspaceId,cwd,selection,mode}).finally(()=>this.creating.delete(id));this.creating.set(id,task);return task;
  }
  async createOwned(id,{workspaceId,cwd,selection,mode}){
    const {peer,workspace,authority}=await this.ensurePeer();
    const commandId=newCommandId();const pending={id,workspace,authority,cwd:cwd??workspace,workspaceId,selection,mode,officialId:'',createCommandId:commandId};
    // Creation ACK can be lost. The command id is durable before dispatch; callers never retry
    // with a fresh id after ambiguity.
    this.store.records.set(id,pending);await this.store.save();
    const envelope={commandId,clientId:'dsh-zcode-bridge',sessionId:null,type:'createSession',issuedAt:Date.now(),payload:{workspaceId:workspace,config:{...(selection?{modelSelection:selection}:{}),mode}}};
    let ack;
    try{ack=commandAckSchema.parse(await peer.request('v4/command',envelope))}catch(error){pending.error='create-outcome-unknown';await this.store.save();throw fault('create-outcome-unknown')}
    if(!['accepted','duplicate'].includes(ack.status)||!ack.result?.sessionId){pending.error=ack.reasonCode??'create-rejected';await this.store.save();throw fault(pending.error)}
    pending.officialId=ack.result.sessionId;pending.createAck=ack;await this.store.save();await this.register(pending);return {sessionId:id,runtime:'zcode'};
  }
  info(id){const record=this.store.records.get(id);return record?{runtime:'zcode',locked:true,historyGeneration:record.historyGeneration??0,selection:record.selection??null,mode:record.mode,error:record.error??this.persistError,hint:SHARED_GUI_HINT,officialAddress:{runtime:'zcode',authority:this.host.status?.sessionAuthority??record.authority,workspace:record.workspace,sessionId:record.officialId},approval:record.approval??null,lastCommand:record.lastCommand??null}: {runtime:'native',locked:true}}
  async handle(payload){
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw fault('invalid-payload');
    const keys={create:['operation','sessionId','workspaceId','cwd','selection','mode'],info:['operation','sessionId'],select:['operation','sessionId','selection'],cancel:['operation','sessionId'],usage:['operation','sessionId']};
    if(!keys[payload.operation]||Object.keys(payload).some(key=>!keys[payload.operation].includes(key)))throw fault('invalid-payload');
    if(payload.operation==='create')return this.create(payload);
    if(typeof payload.sessionId!=='string')throw fault('invalid-payload');
    if(payload.operation==='info')return this.info(payload.sessionId);
    const agent=this.agents.get(payload.sessionId);if(!agent)throw fault('runtime-identity-locked');
    if(payload.operation==='usage')return this.host.taskUsage(this.info(payload.sessionId).officialAddress);
    if(payload.operation==='cancel'){agent.cancel();return {requested:true}}
    return agent.select(payload.selection);
  }
  async dispose(){this.disposed=true;this.offRecovery?.();await Promise.allSettled([...this.disposers.values()].map(dispose=>dispose()));this.peer?.close();await this.store.writing}
}

export async function installZCodeRuntime(ctx,host,options={}){
  const {createScope}=options.createScope?options:await import('@deepseek-ai/dsh-scope');
  const {agentEvents}=options.agentEvents?options:await import('@deepseek-ai/dsh-agent');
  const runtime=new ZCodeRuntime(ctx,host,{...options,createScope,agentEvents});
  await runtime.start();installMirrorGuards(ctx,runtime);installMirrorHistory(ctx,runtime);return runtime;
}
