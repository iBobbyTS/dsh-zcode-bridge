import {test} from 'node:test';import assert from 'node:assert/strict';
import {world,tick} from './helpers/s03-runtime.mjs';
import {RuntimeControls} from '../packages/client/runtime.mjs';
import {projectModels} from '../packages/host/launcher/models.mjs';
import {createExecutionRelay} from '../packages/host/launcher/execution.mjs';
const message=(text,id)=>({source:{kind:'user',rpcId:id},content:[{type:'text',text}]});
const settle=async agent=>{await tick();await Promise.all([...agent.dispatches]);await tick()};

test('S03 B6 restores stale ID and conflicting cwd before native prepare and persists canonical binding',async()=>{
 for(const conflict of [false,true]){const record={id:'old',officialId:'official',workspace:'/execution',cwd:conflict?'/picked':'/execution',workspaceId:'stale',authority:'official-host'};const w=await world({records:[record]});try{await w.runtime.register(record);assert.equal(w.sessions.get('old').header.cwd,'/execution');assert.equal(record.workspaceId,[...w.workspaces.keys()][0]);assert.ok(w.persisted.some(rows=>rows[0].cwd==='/execution'&&rows[0].workspaceId===record.workspaceId));assert.equal(record.officialId,'official')}finally{await w.runtime.dispose()}}
});
test('S03 B7 deleted cached workspace is re-resolved and create returns the mounted ID',async()=>{
 const w=await world();try{const first=await w.runtime.create();w.workspaces.delete(first.workspaceId);const second=await w.runtime.create();assert.notEqual(second.workspaceId,first.workspaceId);assert.ok(w.workspaces.get(second.workspaceId).sessionIds.includes(second.sessionId));assert.equal(w.store.records.get(second.sessionId).workspaceId,second.workspaceId)}finally{await w.runtime.dispose()}
});
test('S03 B7 client recognizes official SessionCreateError.rpcError.code',async()=>{
 const attempts=[];const controls=new RuntimeControls({call:async(_c,_e,p)=>({ok:true,value:p.operation==='create'?{sessionId:'z',workspaceId:'stale',workspacePath:'/execution'}:{runtime:'zcode'}})});
 const sessions={list:{getSnapshot:()=>({byId:{}})},create:async options=>{attempts.push(options);if(options.workspaceId)throw {rpcError:{code:'workspace/not-found'}};return options.sessionId}};
 controls.install(sessions);assert.equal(await sessions.create({cwd:'/picked',workspaceId:'picked'}),'z');assert.deepEqual(attempts[1],{sessionId:'z',cwd:'/execution'});controls.dispose();
});
test('S03 Hero is local-only; first input carries selection/mode, adopts ACK identity, then sends use sendText',async()=>{
 const w=await world();try{const created=await w.runtime.create();const agent=w.runtime.agents.get(created.sessionId);assert.equal(w.peer.calls.filter(call=>call.method==='v4/command').length,0);assert.equal(agent.conversation,null);assert.deepEqual(agent.record.selection,{providerId:'A',modelId:'model_a',options:{reasoningLevel:'medium'}});assert.ok(agent.record.events.some(event=>event.type==='model/selection'&&event.data.model==='A/model_a'));
 await w.runtime.selectSession(created.sessionId,{provider:'zcode',model:'A/model_a',reasoningEffort:'high'});assert.equal(w.peer.calls.filter(call=>call.method==='v4/command').length,0);
 agent.followup(message('first','rpc-first'));await settle(agent);const record=agent.record,create=w.peer.calls.find(call=>call.params?.type==='createSession');assert.equal(create.params.sessionId,null);assert.deepEqual(create.params.payload.firstInput,{text:'first',modelSelection:{providerId:'A',modelId:'model_a',options:{reasoningLevel:'high'}},mode:'build'});assert.equal(record.officialId,w.peer.acks.get(create.params.commandId).result.sessionId);assert.equal(agent.conversation.state.status,'live');assert.ok(record.events.some(event=>event.type==='user/message'&&event.data.source.rpcId==='rpc-first'));
 agent.followup(message('later','rpc-later'));await settle(agent);const send=w.peer.calls.find(call=>call.params?.type==='sendText');assert.equal(send.params.sessionId,record.officialId);assert.equal(w.peer.calls.filter(call=>call.params?.type==='createSession').length,1);agent.followup(message('first','rpc-first'));await settle(agent);assert.equal(w.peer.calls.filter(call=>call.params?.type==='createSession').length,1);
 }finally{await w.runtime.dispose()}
});
test('S03 first create lost ACK persists original identity; recovery queries global bucket and never resends',async()=>{
 const w=await world();try{const {sessionId}=await w.runtime.create();const agent=w.runtime.agents.get(sessionId);w.peer.loseAck=true;agent.followup(message('once','rpc-one'));await settle(agent);assert.equal(agent.record.error,'create-outcome-unknown');assert.equal(agent.record.officialId,'');await w.runtime.recoverAll();await tick();assert.ok(agent.record.officialId);assert.equal(agent.conversation.state.status,'live');const query=w.peer.calls.find(call=>call.method==='v4/commands/query');assert.equal(query.params.commands[0].sessionId,null);assert.equal(w.peer.calls.filter(call=>call.params?.type==='createSession').length,1);
 }finally{await w.runtime.dispose()}
});
test('S03 model projection exports executable identities/efforts without provider secrets; default discovery uses launcher',async()=>{
 const view={providers:[{providerId:'account:real',enabled:true,executable:true,secret:'DO NOT EXPORT',models:[{modelId:'real',executable:true,selectable:true,effectiveConfig:{apiKey:'SECRET',optionSpecs:{reasoningLevel:{values:['low','high'],default:'low'}}}},{modelId:'disabled',executable:false}]},{providerId:'unavailable',executable:false,models:[]}]};
 assert.deepEqual(projectModels(view),[{id:'account:real',models:[{id:'real',reasoningLevels:['low','high'],defaultReasoningLevel:'high'}]}]);const w=await world();try{assert.equal((await w.runtime.modelProviders())[0].id,'A')}finally{await w.runtime.dispose()}
});
test('S03 imported execution is catalog-bound; caller paths and deletion are refused',async()=>{
 const calls=[];const relay=createExecutionRelay({workspacePath:'/execution',workspaceIdentity:'/execution',resolveWorkspace:async path=>path==='/known'?{workspaceIdentity:'known-identity'}:null,emit(){},channel:{call:async(s,m,args)=>{calls.push({m,args});return {}},listen:()=>()=>{}}});
 await relay.request('v4/commands/query',{workspace:{workspacePath:'/known',workspaceKey:'/known'},commands:[]});assert.equal(calls[0].args[0].workspaceIdentity,'known-identity');await assert.rejects(relay.request('v4/commands/query',{workspace:{workspacePath:'/arbitrary',workspaceKey:'/arbitrary'},commands:[]}),{code:'execution-workspace-denied'});assert.equal(calls.length,1);relay.dispose();
});
