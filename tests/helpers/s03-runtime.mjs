import {ZCodeRuntime} from '../../packages/host/zcode-runtime.mjs';
import {MockPeer,tick} from './zcode-runtime-fixture.mjs';
export {tick};
export async function world({records=[],catalog}={}){
 const peer=new MockPeer(),agents=new Map(),sessions=new Map(),workspaces=new Map();let sequence=0;
 const ctx={sessions:{get:id=>sessions.get(id),prepare:(id,{meta,seed=[]})=>{const events=structuredClone(seed);return {id,header:meta,seq:events.length,snapshotEvents:()=>events,append(type,data,opts){const event={type,data,...opts,seq:this.seq++,time:0};events.push(event);return event}}},enter:session=>{sessions.set(session.id,session);return ()=>sessions.delete(session.id)},announce(){}},agents:{get:id=>agents.get(id),register:async agent=>{agents.set(agent.id,agent);return async()=>agents.delete(agent.id)}},workspaceRegistry:{get:id=>workspaces.get(id),resolveByPath:async path=>[...workspaces.values()].find(w=>w.path===path),create:async path=>{const workspace={id:'ws-'+sequence++,path,sessionIds:[],attachSession:async id=>{if(sessions.get(id).header.cwd!==path)throw Error('header-cwd mismatch');if(!workspace.sessionIds.includes(id))workspace.sessionIds.push(id)},detachSession:async id=>{workspace.sessionIds=workspace.sessionIds.filter(value=>value!==id)}};workspaces.set(workspace.id,workspace);return workspace;}}};
 let saves=0;const persisted=[];const store={records:new Map(records.map(record=>[record.id,record])),load:async()=>{},save:async()=>{saves++;persisted.push(structuredClone([...store.records.values()]))},writing:Promise.resolve()};
 const launcher={state:{phase:'ready',auth:'authenticated',executionWorkspace:'/execution'},subscribe:()=>()=>{},read:async operation=>operation==='models'?peer.listProviders():undefined};
 const host={launcher,status:{sessionAuthority:'official-host'},connect:async()=>{},...(catalog?{listSessions:catalog}:{}),taskUsage:async address=>({address,usage:{totalTokens:0}})};
 const runtime=new ZCodeRuntime(ctx,host,{store,peerFactory:()=>peer,createScope:(_ctx,key)=>({ctx:{key,inject(){}},dispose:async()=>{}}),agentEvents:()=>({emit(){},waterfall:()=>Promise.resolve('unavailable')})});
 return {runtime,ctx,host,store,peer,agents,sessions,workspaces,persisted,get saves(){return saves}};
}
export const catalogRow=(id='one',title='Official title',workspace='/execution')=>({address:{runtime:'zcode',authority:'official-host',workspace,sessionId:id},title,cwd:workspace});
export const directory=sessions=>({sessions,catalog:{complete:true}});
