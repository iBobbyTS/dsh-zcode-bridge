import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {ProtocolPeer} from '../packages/host/protocol.mjs';
function fixture(){const input=new PassThrough(),output=new PassThrough();const sent=[];output.on('data',b=>sent.push(JSON.parse(b)));const peer=new ProtocolPeer(input,output,{timeoutMs:30});return {input,output,peer,sent}}
test('B01: legacy shape, split UTF-8, strict response identity and error attribution',async()=>{
 const f=fixture();const request=f.peer.request('runtime/capabilities',{});assert.deepEqual(Object.keys(f.sent[0]),['id','method','params']);
 const buf=Buffer.from(JSON.stringify({id:f.sent[0].id,result:{label:'你好'}})+'\n');const i=buf.indexOf(Buffer.from('好'));f.input.write(buf.subarray(0,i+1));f.input.write(buf.subarray(i+1));assert.deepEqual(await request,{label:'你好'});
 const bad=f.peer.request('session/list',{});f.input.write(JSON.stringify({id:f.sent[1].id,error:{code:-32602,message:'rejected'}})+'\n');await assert.rejects(bad,e=>e.protocolCode===-32602);f.peer.close();
});
test('B01: numeric id cannot settle a string id, foreign and malformed responses fail closed',async()=>{
 for(const response of [{id:1,result:{}},{id:'foreign',result:{}},{id:null,result:{}},{id:'foreign',result:{},error:{code:0,message:''}}]){const f=fixture();const p=f.peer.request('runtime/capabilities',{});f.input.write(JSON.stringify(response)+'\n');await assert.rejects(p,{code:'protocol-invalid'});assert.equal(f.peer.pendingCount,0)}
});
test('B05: reverse auth failure is immediate, cancellation has no pending host auth',async()=>{
 const f=fixture();const p=f.peer.request('fixture/block',{});const params={requestId:'auth-1',sessionId:'s',providerId:'account',modelSelection:{providerId:'account',modelId:'m'},workspace:{workspacePath:'/test',workspaceKey:'/test'}};
 f.input.write(JSON.stringify({id:'auth-id',method:'interaction/requestProviderRuntimeHeaders',params})+'\n');
 assert.deepEqual(f.sent[1],{id:'auth-id',result:{headersApplied:false,errorMessage:'Provider request auth is unavailable'}});
 f.input.write(JSON.stringify({method:'interaction/providerRuntimeHeadersCancelled',params:{requestId:'auth-1'}})+'\n');f.peer.close();await assert.rejects(p,{code:'disposed'});assert.equal(f.peer.pendingCount,0);
});
test('B06: dispose rejects owned requests and sends no session/close on borrowed streams',async()=>{
 const f=fixture();const p=f.peer.request('session/list',{});f.peer.close();await assert.rejects(p,{code:'disposed'});assert.equal(f.sent.length,1);assert.equal(f.output.destroyed,false);await assert.rejects(f.peer.request('session/close',{}),{code:'session-close-forbidden'});
});
test('EOF, invalid JSON, timeout, abort and late response clean pending',async()=>{
 for(const mode of ['eof','parse','timeout','cancel']){const f=fixture(),abort=new AbortController();const p=f.peer.request('session/list',{}, {signal:abort.signal});if(mode==='eof')f.input.end();if(mode==='parse')f.input.write('broken\n');if(mode==='cancel')abort.abort();await assert.rejects(p);assert.equal(f.peer.pendingCount,0);if(mode==='timeout'||mode==='cancel'){f.input.write(JSON.stringify({id:f.sent[0].id,result:{}})+'\n');assert.equal(f.peer.closed,false)}f.peer.close();}
});
