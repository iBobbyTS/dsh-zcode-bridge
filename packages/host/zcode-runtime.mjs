import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { MirrorState } from './mirror-state.mjs';
import { randomUUID } from 'node:crypto';
import { CommandLifecycle } from './command-lifecycle.mjs';
import { installMirrorHistory } from './mirror-history.mjs';
import { installMirrorGuards } from './mirror-guards.mjs';
import { installZCodeLlm } from './zcode-llm.mjs';
import { officialSelection, resolveDiscovered, selectionFailure } from './model-selection.mjs';
import { LauncherPeer } from './launcher/execution.mjs';
import { ZCodeAgent, SHARED_GUI_HINT } from './zcode-agent.mjs';
import { negotiatedClientHello } from './conversation.mjs';
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
  agents=new Map();disposers=new Map();creating=new Map();absent=new Set();disposed=false;persistError=null;historyListeners=new Map();
  executionWorkspace=null;directory=new MirrorState();directoryRead=0;directoryTail=Promise.resolve();
  constructor(ctx,host,{store=new RuntimeStore(process.env.DSH_HOME??join(homedir(),'.dsh')),createScope,agentEvents,peerFactory=launcher=>new LauncherPeer(launcher),discoverModels}={}){Object.assign(this,{ctx,host,store,createScope,agentEvents,peerFactory,discoverModels:discoverModels??(async()=>{await this.ensurePeer();return typeof this.host.launcher.read==='function'?this.host.launcher.read('models'):[]})})}
  /** Register-or-resolve the launcher's execution workspace in DSH so a mirror Session's cwd can
   * match the official Agent header. The official executor owns the run workspace; DSH only needs
   * a proper workspace row to attach/present it. */
  async ensureExecutionWorkspace(path){
    if(this.executionWorkspace?.path===path&&this.ctx.workspaceRegistry.get?.(this.executionWorkspace.id)===this.executionWorkspace.owner)return this.executionWorkspace;
    try{
      let workspace=await this.ctx.workspaceRegistry.resolveByPath(path);
      workspace??=await this.ctx.workspaceRegistry.create(path,'ZCode');
      this.executionWorkspace={...workspace,id:workspace.id,path:workspace.path??path,owner:workspace};
    }catch(error){this.executionWorkspace={id:undefined,path,error:error.code??'workspace-unavailable'}}
    return this.executionWorkspace;
  }
  /** Discovered executable official account provider/model groups, projected by launcher Main. */
  modelProviders(){return this.discoverModels()}
  persist(){const promise=this.store.save();void promise.catch(()=>{this.persistError='runtime-persistence-failed'});return promise}
  async start(){await this.store.load();for(const record of this.store.records.values()){if(record.catalogSeen&&this.host.listSessions)continue;if(record.officialId||record.localDraft)await this.register(record);else record.error='create-outcome-unknown'}this.offRecovery=this.host.launcher?.subscribe(state=>{if(state.phase==='ready')void this.recoverAll().catch(()=>{})});if(this.host.launcher?.state.phase==='ready')await this.recoverAll();if(this.host.listSessions){await this.refreshDirectory();this.directoryTimer=setInterval(()=>{void this.refreshDirectory().catch(()=>{})},5000);this.directoryTimer.unref?.()}}
  async ensurePeer(){
    await this.host.connect();const state=this.host.launcher?.state;
    if(state?.phase!=='ready'||state.auth!=='authenticated'||!state.executionWorkspace)throw fault('execution-unavailable');
    this.peer??=this.peerFactory(this.host.launcher);
    this.handshake??=(async()=>{const hello=await this.peer.request('hello');await this.peer.request('initialize',negotiatedClientHello(hello,{clientId:'dsh-zcode-bridge',appVersion:'0.1.0'}))})();await this.handshake;
    const execution=await this.ensureExecutionWorkspace(state.executionWorkspace);
    return {peer:this.peer,workspace:execution.path??state.executionWorkspace,workspaceId:execution.id,authority:'official-host'};
  }
  async recoverAll(){
    if(this.recovering)return this.recovering;
    this.recovering=(async()=>{await this.ensurePeer();for(const record of this.store.records.values()){
      const commands=new CommandLifecycle(record);
      const operations=record.officialId?commands.recoverable():record.createCommandId?[{commandId:record.createCommandId}]:[];
      for(const operation of operations){
        const commandId=operation.commandId;if(!commandId)continue;
        const response=await this.peer.request('v4/commands/query',{workspace:{workspacePath:record.workspace,workspaceKey:record.workspace},commands:[{sessionId:operation.type==='createSession'||commandId===record.createCommandId?null:record.officialId||null,commandId}]});
        const result=response.results?.[0];if(!result||result.key.commandId!==commandId||result.key.sessionId!==(operation.type==='createSession'||commandId===record.createCommandId?null:record.officialId||null))throw fault('command-query-mismatch');
        if(result.result==='unknown'){record.error=record.officialId?'send-outcome-unknown':'create-outcome-unknown';continue}
        const ack=commandAckSchema.parse(result.result);if(ack.commandId!==commandId)throw fault('command-query-mismatch');
        if(!record.officialId&&['accepted','duplicate'].includes(ack.status)&&ack.result?.sessionId){record.officialId=ack.result.sessionId;record.createAck=ack;record.error=null;record.localDraft=false;commands.receipt(commandId,{commandId,ack,state:ack.status});await this.store.save();const agent=await this.register(record);if(!agent.conversation){agent.bindConversation();await agent.connect()}}
        else if(record.officialId){commands.receipt(commandId,{commandId,ack,state:ack.status});record.error=null}
      }
    }await this.store.save()})().finally(()=>this.recovering=null);return this.recovering;
  }
  async register(record){
    if(this.agents.has(record.id))return this.agents.get(record.id);
    // Agent publication can succeed while the official executor is offline. Restored transcript
    // remains visible; writes fail closed until the executor reconnects.
    const basePeer=this.peer??(this.host.launcher?this.peerFactory(this.host.launcher):null);
    if(!basePeer)throw fault('launcher-unconfigured');
    this.peer??=basePeer;
    const peer={request:(method,params,options)=>basePeer.request(method,params?{...params,workspace:{workspacePath:record.workspace,workspaceKey:record.workspace}}:params,options),connectionId:basePeer.connectionId,launcher:basePeer.launcher,onNotification:listener=>basePeer.onNotification(listener),onClosed:listener=>basePeer.onClosed(listener)};
    const workspace=await this.normalizeRecord(record);
    const session=this.ctx.sessions.prepare(record.id,{meta:{cwd:record.cwd??record.workspace},seed:record.events??[]});
    if(record.localDraft&&record.selection&&!record.events?.some(event=>event.type==='model/selection')){session.append('model/selection',{provider:'zcode',model:`${record.selection.providerId}/${record.selection.modelId}`,...(record.selection.options?.reasoningLevel?{reasoningEffort:record.selection.options.reasoningLevel}:{})});record.events=session.snapshotEvents?.()??record.events;}
    const releaseSession=this.ctx.sessions.enter(session);this.ctx.sessions.announce?.(session);
    let agent,releaseAgent;
    try{
      agent=new ZCodeAgent(this.ctx,session,record,{peer,createScope:this.createScope,agentEvents:this.agentEvents,onPersist:()=>this.persist(),onFirstInput:(agent,operation,text)=>this.firstInput(agent,operation,text),onReplacement:snapshot=>{this.replace(record,snapshot)}});
      agent.projected=new Set(record.projected??[]);
      if(record.snapshot){agent.mirror.accept(record.snapshot);for(const row of record.snapshot.rows.window)agent.turnFor(row.turnId)}
      releaseAgent=await this.ctx.agents.register(agent);
      this.agents.set(record.id,agent);this.disposers.set(record.id,async()=>{await agent.dispose();await releaseAgent();releaseSession();this.agents.delete(record.id)});
      await workspace?.attachSession(record.id);
      if(record.officialId&&!record.imported)void agent.connect().catch(error=>{record.error=error.code??'execution-unavailable';this.persist()});
      if(record.title!==undefined||record.localDraft)this.projectTitle(record,record.title??'New session');
      return agent;
    }catch(error){this.agents.delete(record.id);this.disposers.delete(record.id);await agent?.dispose();await releaseAgent?.();releaseSession();throw error}
  }
  async normalizeRecord(record){
    // Resolve the path, never the persisted ID, before native Session construction.
    let workspace;
    try{workspace=await this.ctx.workspaceRegistry.resolveByPath(record.workspace);workspace??=await this.ctx.workspaceRegistry.create(record.workspace,record.imported?undefined:'ZCode');}
    catch(error){if(!record.imported)throw error;record.cwd=record.workspace;record.workspaceId=undefined;record.workspaceUnavailable=true;record.error='session/workspace-unavailable';record.bindingHint='The official workspace directory is unavailable. Restore it before opening this session.';await this.store.save();return null;}
    if(record.workspaceUnavailable){delete record.workspaceUnavailable;record.error=null;record.bindingHint=null;}
    record.workspace=workspace.path??record.workspace;record.cwd=record.workspace;record.workspaceId=workspace.id;
    await this.store.save();return workspace;
  }
  projectTitle(record,title){
    const text='🅩 '+String(title).replace(/^(?:🅩\s*)+/, '').trim();
    record.title=String(title).replace(/^(?:🅩\s*)+/, '').trim();
    const agent=this.agents.get(record.id);if(!agent)return;
    const events=agent.session.snapshotEvents?.()??record.events??[];
    if([...events].reverse().find(event=>event.type==='session/title')?.data.title!==text)agent.append('session/title',{title:text,messageSeqs:[],source:{kind:'user'}});
    return text;
  }
  async firstInput(agent,operation,text){
    const record=agent.record;
    await this.ensurePeer();operation.type='createSession';agent.commands.mark(operation.commandId,'dispatching');await this.store.save();
    let ack;
    try{ack=commandAckSchema.parse(await this.peer.request('v4/command',{commandId:operation.commandId,clientId:'dsh-zcode-bridge',sessionId:null,type:'createSession',issuedAt:Date.now(),workspace:{workspacePath:record.workspace,workspaceKey:record.workspace},payload:{workspaceId:record.workspace,firstInput:{text,...(record.selection?{modelSelection:record.selection}:{}),mode:record.mode??'build'},config:{...(record.selection?{modelSelection:record.selection}:{}),mode:record.mode??'build'}}}));}
    catch(error){record.error='create-outcome-unknown';await this.store.save();throw fault('create-outcome-unknown')}
    if(ack.commandId!==operation.commandId)throw fault('command-receipt-mismatch');
    agent.commands.receipt(operation.commandId,{commandId:operation.commandId,ack,state:ack.status});
    if(!['accepted','duplicate'].includes(ack.status)||!ack.result?.sessionId){record.error=ack.reasonCode??'create-rejected';await this.store.save();return {commandId:operation.commandId,ack,state:ack.status};}
    record.officialId=ack.result.sessionId;record.localDraft=false;record.createAck=ack;record.error=null;
    await this.store.save();agent.bindConversation();await agent.connect();
    return {commandId:operation.commandId,ack,state:ack.status};
  }
  async refreshDirectory(){
    if(!this.host.listSessions)return;
    await this.ensurePeer();const generation=++this.directoryRead;
    const response=await this.host.listSessions();
    if(response.catalog?.complete!==true)throw fault('catalog-incomplete');
    const rows=response.sessions.map(row=>({...row,sessionId:JSON.stringify([row.address.workspace,row.address.sessionId])}));
    // Serialize publication, but leave reads concurrent: a delayed older read cannot revive a row.
    const apply=this.directoryTail.then(async()=>{
      if(this.disposed||!this.directory.acceptDirectory(generation,rows))return;
      for(const row of rows){
        let record=[...this.store.records.values()].find(record=>record.workspace===row.address.workspace&&record.officialId===row.address.sessionId);
        if(!record){record={id:'zcode-'+randomUUID(),officialId:row.address.sessionId,workspace:row.address.workspace,authority:row.address.authority,mode:'build',imported:true,title:row.title};this.store.records.set(record.id,record)}
        record.catalogSeen=true;this.absent.delete(record.id);record.title=row.title;try{await this.register(record);this.projectTitle(record,row.title)}catch(error){record.error=error.code??'import-workspace-unavailable'}
      }
      for(const record of this.store.records.values())if(record.catalogSeen&&!this.directory.hasSession(JSON.stringify([record.workspace,record.officialId]))){
        this.absent.add(record.id);
        const workspace=await this.ctx.workspaceRegistry.resolveByPath(record.workspace);await workspace?.detachSession?.(record.id);
        await this.disposers.get(record.id)?.();this.disposers.delete(record.id);
      }
      await this.store.save();await this.publishDirectory?.();
    });this.directoryTail=apply.catch(()=>{});await apply;
  }
  async open(id){
    let record=this.store.records.get(id);if(!record)throw fault('runtime-identity-locked');
    if(record.officialId&&this.host.listSessions){await this.refreshDirectory();if(!this.directory.hasSession(JSON.stringify([record.workspace,record.officialId])))throw fault('session/not-found')}
    if(this.absent.has(record.id))throw fault('session/not-found');
    const workspace=await this.normalizeRecord(record);if(!workspace)throw Object.assign(fault('session/workspace-unavailable'),{isDSHRemoteError:true});
    const agent=await this.register(record);await workspace.attachSession(record.id);await agent.connect();return this.info(id);
  }
  async rename(id,title){
    const record=this.store.records.get(id);if(!record?.officialId)throw fault('session/official-route-unavailable');
    await this.open(id);const agent=this.agents.get(id);if(!await agent.whenProjectionReady())throw fault('projection-unconfirmed');
    const officialTitle=String(title).replace(/^(?:🅩\s*)+/, '').trim();if(!officialTitle)throw fault('session/title-invalid');
    const result=await agent.conversation.submit({type:'renameSession',payload:{title:officialTitle}});
    if(!['accepted','duplicate'].includes(result.ack?.status))throw fault(result.ack?.reasonCode??'rename-outcome-unknown');
    // Read the authoritative task title instead of assuming the submitted title won.
    if(this.host.listSessions)await this.refreshDirectory();else this.projectTitle(record,officialTitle);
    return {title:'🅩 '+record.title,seq:agent.session.seq-1};
  }
  subscribeHistory(id,listener){let listeners=this.historyListeners.get(id);if(!listeners)this.historyListeners.set(id,listeners=new Set());listeners.add(listener);return ()=>{listeners.delete(listener);if(!listeners.size)this.historyListeners.delete(id)}}
  replace(record,snapshot){const agent=this.agents.get(record.id);if(!agent)throw fault('mirror-agent-unavailable');agent.reconcile(snapshot);for(const listener of this.historyListeners.get(record.id)??[])listener();return this.persist()}
  async create({sessionId,workspaceId,cwd,selection,mode='build'}={}){
    const id=sessionId??'zcode-'+randomUUID();if(this.agents.has(id)){const record=this.store.records.get(id);await this.normalizeRecord(record);return {sessionId:id,runtime:'zcode',workspaceId:record.workspaceId,workspacePath:record.workspace};}
    if(this.ctx.agents.get(id)||this.ctx.sessions.get(id))throw fault('runtime-identity-locked');
    if(this.creating.has(id))return this.creating.get(id);
    if(this.store.records.has(id)){await this.recoverAll();if(this.agents.has(id)){const record=this.store.records.get(id);await this.normalizeRecord(record);return {sessionId:id,runtime:'zcode',workspaceId:record.workspaceId,workspacePath:record.workspace};}throw fault('create-outcome-unknown')}
    const task=this.createOwned(id,{workspaceId,cwd,selection,mode}).finally(()=>this.creating.delete(id));this.creating.set(id,task);return task;
  }
  async createOwned(id,{workspaceId,cwd,selection,mode}){
    const {peer,workspace,workspaceId:executionWorkspaceId,authority}=await this.ensurePeer();
    // The official session is always created in the launcher execution workspace. A picker choice
    // only governs native sessions; a mismatch is surfaced as an inline hint, never a conflict.
    const mismatch=(workspaceId!==undefined&&executionWorkspaceId!==undefined&&workspaceId!==executionWorkspaceId)||(workspaceId===undefined&&cwd!==undefined&&cwd!==workspace);
    const providers=await this.modelProviders();const first=providers[0]?.models?.[0];
    const resolved=selection?resolveDiscovered(selection,providers):first?resolveDiscovered({provider:'zcode',model:`${providers[0].id}/${first.id}`,reasoningEffort:first.defaultReasoningLevel},providers):null;
    selection=resolved?officialSelection(resolved.official):undefined;
    const pending={id,workspace,authority,cwd:workspace,workspaceId:executionWorkspaceId,selection,mode,officialId:'',localDraft:true,bindingHint:mismatch?'Session created in the ZCode execution workspace; the picked workspace applies to native sessions only.':null};
    this.store.records.set(id,pending);await this.store.save();const agent=await this.register(pending);if(resolved)agent.confirmSelection(resolved);await this.publishDirectory?.();
    return {sessionId:id,runtime:'zcode',workspaceId:pending.workspaceId,workspacePath:pending.workspace,hint:pending.bindingHint};
  }
  info(id){const record=this.store.records.get(id);return record?{runtime:'zcode',locked:true,historyGeneration:record.historyGeneration??0,selection:record.selection??null,mode:record.mode,error:record.error??this.persistError,hint:SHARED_GUI_HINT,bindingHint:record.bindingHint??null,officialAddress:{runtime:'zcode',authority:this.host.status?.sessionAuthority??record.authority,workspace:record.workspace,sessionId:record.officialId},approval:record.approval??null,lastCommand:record.lastCommand??null}: {runtime:'native',locked:true}}
  async handle(payload){
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw fault('invalid-payload');
    const keys={create:['operation','sessionId','workspaceId','cwd','selection','mode'],info:['operation','sessionId'],select:['operation','sessionId','selection'],cancel:['operation','sessionId'],usage:['operation','sessionId'],open:['operation','sessionId']};
    if(!keys[payload.operation]||Object.keys(payload).some(key=>!keys[payload.operation].includes(key)))throw fault('invalid-payload');
    if(payload.operation==='create')return this.create(payload);
    if(typeof payload.sessionId!=='string')throw fault('invalid-payload');
    if(payload.operation==='info')return this.info(payload.sessionId);
    if(payload.operation==='open')return this.open(payload.sessionId);
    const agent=this.agents.get(payload.sessionId);if(!agent)throw fault('runtime-identity-locked');
    if(payload.operation==='usage')return this.host.taskUsage(this.info(payload.sessionId).officialAddress);
    if(payload.operation==='cancel'){agent.cancel();return {requested:true}}
    return this.selectSession(payload.sessionId,payload.selection,agent);
  }
  /** Legacy bridge selection entry: same identity translation/outcome contract as the official
   * selectModel guard. Confirmed choices commit the durable presentation projection. */
  async selectSession(id,request,agent=this.agents.get(id)){
    if(!agent)throw fault('runtime-identity-locked');
    const resolved=resolveDiscovered(request,await this.modelProviders());
    let outcome;
    try{outcome=await agent.select(officialSelection(resolved.official))}
    catch(error){if(error?.isDSHRemoteError)throw error;throw selectionFailure({outcome:'failed',ack:{reasonCode:error?.code??'selection-failed'}})}
    if(outcome.outcome!=='confirmed'&&outcome.outcome!=='unchanged')throw selectionFailure(outcome);
    agent.confirmSelection(resolved);
    return {selected:{...resolved.display}};
  }
  async dispose(){this.disposed=true;clearInterval(this.directoryTimer);this.offRecovery?.();await Promise.allSettled([...this.disposers.values()].map(dispose=>dispose()));this.peer?.close();await this.store.writing}
}

export async function installZCodeRuntime(ctx,host,options={}){
  const {createScope}=options.createScope?options:await import('@deepseek-ai/dsh-scope');
  const {agentEvents}=options.agentEvents?options:await import('@deepseek-ai/dsh-agent');
  const runtime=new ZCodeRuntime(ctx,host,{...options,createScope,agentEvents});
  await runtime.start();installMirrorGuards(ctx,runtime);installMirrorHistory(ctx,runtime);installZCodeLlm(ctx,{discover:()=>runtime.modelProviders()});return runtime;
}
