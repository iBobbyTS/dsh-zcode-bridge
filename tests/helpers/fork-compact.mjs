import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {installDriver} from '../../packages/driver/factory.mjs';
import {DriverTransport} from '../../packages/driver/transport.mjs';
import {createExecutionRelay} from '../../packages/host/launcher/execution.mjs';
import {MockPeer,tick} from './zcode-runtime-fixture.mjs';
export {tick};
const npm=process.env.DSH_DRIVER_NPM_NODE_MODULES??'/private/tmp/dsh-local-npm-verify/npm/node_modules';
const cohort=['cordis','dsh-agent','dsh-session','dsh-session-projection','dsh-scope','dsh-typert-registry','dsh-api-session-controller','dsh-commands'];
const path=name=>join(npm,'@deepseek-ai',name,'lib/index.js');
export const real={skip:cohort.every(name=>existsSync(path(name)))?false:'requires rc.2 official npm artifacts'};
export const fixtureSnapshot=()=>structuredClone(JSON.parse(readFileSync(new URL('../fixtures/history-management/success.json',import.meta.url))).initial.frame.payload.snapshot);
/** Real Cordis/SessionController/SessionStore/CommandRuntime/DriverFactory. Only
 * persistence, query observations, workspace and Main remote service are doubles. */
export async function forkWorld(){
 const [{Context},{AgentRegistry,agentEvents},{SessionStore},{default:Projections},{createScope},{default:TypertRegistry},{SessionController},{CommandRuntime}]=await Promise.all(cohort.map(name=>import(pathToFileURL(path(name)))));
 const ctx=new Context();new AgentRegistry(ctx);new SessionStore(ctx);new Projections(ctx);new TypertRegistry(ctx);const commands=new CommandRuntime(ctx);
 ctx.provide('attachments',{imageLimits:{maxImageBytes:100,maxImagesPerMessage:1,maxMessageImageBytes:100,maxImagePixels:100,maxImageDimension:10,mediaTypes:['image/png']}});
 ctx.provide('fileUploads',{registerAgentResolver:()=>()=>{},retirePrompt(){}});
 ctx.provide('agentDefaultModel',{currentSelection:()=>({provider:'deepseek',model:'deepseek-flash'})});
 const workspace={id:'workspace',path:'/workspace',sessionIds:['source'],attachSession:async id=>{workspace.sessionIds.push(id)}};
 ctx.provide('workspaceRegistry',{list:()=>[workspace],get:id=>id===workspace.id?workspace:undefined});
 const stored=new Map();
 const handle=record=>({header:record.header,inheritedEventCount:record.count,read:async()=>({events:structuredClone(record.events),eventState:'detached'}),append:async events=>{record.events.push(...structuredClone(events))},close:async()=>{const session=ctx.sessions.get(record.header.id);if(session)record.events=structuredClone(session.snapshotEvents())}});
 ctx.provide('sessionPersistence',{create:async(header,{inheritedEventCount=0}={})=>{const record={header,count:inheritedEventCount,events:[]};stored.set(header.id,record);return handle(record)},open:async id=>handle(stored.get(id))});
 ctx.provide('sessionQuery',{observeSession:async id=>{const session=ctx.sessions.get(id),record=stored.get(id);if(!session&&!record)throw Error('missing source');return {header:session?.header??record.header,events:session?.snapshotEvents()??record.events,projections:{values:{}},[Symbol.dispose](){}}}});
 const controller=new SessionController(ctx,{nativeOpen:false}),official=new MockPeer(),calls=[],events=new Set(),states=new Set(),responses=new Map();
 const snapshot=fixtureSnapshot();snapshot.sessionId='parent';for(const row of snapshot.rows.window)if(row.kind==='assistantText')row.model=snapshot.config.model;official.snapshots.set('parent',snapshot);official.snapshot=snapshot;
 const names={helloConversationV4:'hello',initializeConversationV4:'initialize',subscribeConversationV4:'v4/conversation/subscribe',resyncConversationV4:'v4/conversation/resync',unsubscribeConversationV4:'v4/conversation/unsubscribe',queryConversationCommandsV4:'v4/commands/query'};let serial=0;
 const channel={listen:()=>()=>{},call:async(service,name,args=[])=>{
  calls.push({service,name,args:structuredClone(args)});const p=args[0];
  if(responses.has(name)){const value=responses.get(name);if(value instanceof Error)throw value;return typeof value==='function'?value(p):structuredClone(value)}
  if(name==='conversationRowsRangeV4'){const state=official.snapshots.get(p.sessionId);return {rows:structuredClone(state.rows.window),hasMore:false,atSeq:state.seq,atRevision:state.revision,atLogEpoch:state.logEpoch}}
  if(name==='sendConversationCommandV4'){
   const envelope=p.envelope;
   if(envelope.type==='forkAssistant'){
    const source=official.snapshots.get(envelope.sessionId),target=source.rows.window.find(row=>row.rowId===envelope.payload.target.rowId),turns=[];
    for(const row of source.rows.window){if(!turns.includes(row.turnId))turns.push(row.turnId);if(row.rowId===target.rowId)break}
    const child=structuredClone(source),index=++serial;child.sessionId='branch-'+index;child.logEpoch='branch-epoch-'+index;child.rows.window=child.rows.window.filter(row=>turns.includes(row.turnId));
    for(const row of child.rows.window){row.rowId+=index*100;row.entityId='branch-'+index+'-'+row.entityId;row.turnId='branch-'+index+'-'+row.turnId}
    child.rows.totalCount=child.rows.window.length;child.rows.firstRowId=child.rows.window[0]?.rowId??null;official.snapshots.set(child.sessionId,child);
    const ack={commandId:envelope.commandId,status:'accepted',revisionAtDecision:source.revision,result:{type:'forkAssistant',sessionId:child.sessionId}};official.acks.set(envelope.commandId,ack);return ack;
   }
   if(envelope.type==='createSelectionSideSession'){const ack={commandId:envelope.commandId,status:'accepted',revisionAtDecision:0,result:{type:'createSelectionSideSession',sessionId:'side'}};official.acks.set(envelope.commandId,ack);return ack}
   return official.request('v4/command',envelope);
  }
  if(names[name]){let params=p;const method=names[name];if(method==='v4/conversation/subscribe')params={topic:'conversation/'+p.sessionId};else if(method.includes('resync')||method.includes('unsubscribe'))params={...p,topic:[...official.subscriptions].find(([,id])=>id===p.subscriptionId)?.[0]};return official.request(method,params)}
  throw Error('Unexpected Main call '+name);
 }};
 const relay=createExecutionRelay({channel,workspacePath:'/workspace',emit:event=>{for(const listener of events)listener(event)}});
 official.onNotification(event=>{for(const listener of events)listener(event)});
 const launcher={state:{phase:'ready',auth:'authenticated',executionWorkspace:'/workspace'},subscribe:fn=>{states.add(fn);return ()=>states.delete(fn)},onExecutionEvent:fn=>{events.add(fn);return ()=>events.delete(fn)},execution:(method,params)=>relay.request(method,params)};
 const transport=new DriverTransport({launcher,connect:async()=>{},status:{sessionAuthority:'official-host'}});
 // The source is an existing imported conversation. Fork calls must never use
 // createSession/firstInput replay; source import is independent of the tested fork.
 transport.create=async({signal})=>{await transport.ready('/workspace',signal);return 'parent'};
 const handles=new Map();let driver;const provider=ctx.plugin({apply(owner){driver=installDriver(owner,{transport,createScope,agentEvents})}});await provider.await();
 const create=driver.factory.createAgent;driver.factory.createAgent=async function(...args){const handle=await create.apply(this,args);handles.set(handle.agent.id,handle);return handle};
 const sourceHandle=await ctx.agents.create({sessionId:'source',meta:{cwd:'/workspace'}}),source=sourceHandle.agent;await source.ready();await source.translator.tail;await tick();
 const publish=async(id,edit)=>{const state=structuredClone(official.snapshots.get(id));state.seq++;state.revision++;edit(state);official.publish(state);await tick();await ctx.agents.get(id==='parent'?'source':id)?.translator.tail;return state};
 return {ctx,handles,commands,controller,official,calls,responses,driver,provider,source,sourceHandle,stored,transport,relay,workspace,publish,async close(){await provider.dispose();relay.dispose();await ctx.fiber.dispose()}};
}
export const writes=w=>w.calls.filter(call=>call.name==='sendConversationCommandV4').map(call=>call.args[0].envelope);
