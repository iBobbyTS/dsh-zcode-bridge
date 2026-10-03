import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(options={}){
 const input=new PassThrough(),output=new PassThrough(),sent=[];
 output.on('data',b=>sent.push(JSON.parse(b)));const peer=new ProtocolPeer(input,output,{timeoutMs:40,...options});
 return {input,output,sent,peer,receive:m=>input.write(JSON.stringify(m)+'\n')};
}
test('B01 coalesced batch exceeds per-line budget but each line and bytewise UTF-8 remain valid',async()=>{
 const f=fixture({maxFrameBytes:160});const a=f.peer.request('a',{}),b=f.peer.request('b',{});
 const lines=f.sent.map(x=>JSON.stringify({id:x.id,result:'你好'.repeat(10)})+'\n').join('');assert.ok(Buffer.byteLength(lines)>160);
 for(const byte of Buffer.from(lines))f.input.write(Buffer.from([byte]));assert.equal(await a,'你好'.repeat(10));await b;
 f.peer.close();
});
test('B01 invalid UTF-8, partial EOF and buffer limit are distinct terminal failures',async()=>{
 for(const [bytes,code,end] of [[Buffer.from([123,34,0xff,34,58,49,125,10]),'protocol-invalid'],[Buffer.from('{'),'protocol-truncated',true],[Buffer.alloc(300,120),'protocol-buffer-limit']]){
  const f=fixture({maxFrameBytes:256});const p=f.peer.request('a',{});f.input.write(bytes);if(end)f.input.end();await assert.rejects(p,{code});assert.equal(f.peer.pendingCount,0);
 }
});
test('B01 reverse server-N and identical outbound id have independent ownership',async()=>{
 let done;const f=fixture({onRequest:()=>new Promise(r=>done=r)});const p=f.peer.request('a',{});const id=f.sent[0].id;
 f.receive({id,method:'host/request',params:{}});await tick();assert.equal(f.peer.pendingCount,1);assert.equal(f.peer.reversePendingCount,1);
 f.receive({id,result:'outbound'});assert.equal(await p,'outbound');done('reverse');await tick();assert.deepEqual(f.sent[1],{id,result:'reverse'});
 f.receive({id:'server-2',method:'host/request',params:{}});await tick();f.peer.close();assert.equal(f.peer.reversePendingCount,0);done('too-late');await tick();assert.equal(f.sent.length,2);
});
test('B01 duplicate in-flight reverse request fails closed, callback abort and timeout clean up',async()=>{
 let signal;const f=fixture({onRequest:(_m,c)=>{signal=c.signal;return new Promise(()=>{})}});
 f.receive({id:'server-1',method:'host/request',params:{}});await tick();f.receive({id:'server-1',method:'host/request',params:{}});assert.equal(f.peer.closed,true);assert.equal(signal.aborted,true);
 const g=fixture({timeoutMs:10,onRequest:(_m,c)=>{signal=c.signal;return new Promise(()=>{})}});g.receive({id:'server-1',method:'host/request',params:{}});await new Promise(r=>setTimeout(r,20));assert.equal(g.peer.reversePendingCount,0);assert.equal(signal.aborted,true);assert.equal(g.sent[0].error.code,-32000);g.peer.close();
});
test('B01 backpressure waits for drain; abort removes unsent work and queue budget closes peer',async()=>{
 const input=new PassThrough(),output=new EventEmitter(),sent=[];output.write=line=>{sent.push(JSON.parse(line));return false};
 const peer=new ProtocolPeer(input,output,{maxQueueBytes:200,timeoutMs:100});
 const a=peer.request('a',{}),controller=new AbortController(),b=peer.request('b',{}, {signal:controller.signal});
 assert.equal(sent.length,1);assert.ok(peer.queuedBytes>0);controller.abort();await assert.rejects(b,e=>e.code==='cancelled'&&e.sent===false);assert.equal(peer.queuedBytes,0);
 const c=peer.request('c',{});output.emit('drain');assert.equal(sent.length,2);
 input.write(sent.map(x=>JSON.stringify({id:x.id,result:{}})+'\n').join(''));await a;await c;peer.close();
 const out=new EventEmitter();out.write=()=>false;const p=new ProtocolPeer(new PassThrough(),out,{maxQueueBytes:100,timeoutMs:100});
 const first=p.request('a',{}),second=p.request('b',{}),third=p.request('c',{});
 await assert.rejects(third,{code:'transport-backpressure-limit'});await assert.rejects(first);await assert.rejects(second);assert.equal(p.pendingCount,0);assert.equal(p.queuedBytes,0);
});
test('B01 bounded pending table, notification does not settle request, retired duplicate is ignored',async()=>{
 const f=fixture({maxPending:1});const p=f.peer.request('a',{});await assert.rejects(f.peer.request('b',{}),{code:'transport-pending-limit'});
 f.receive({method:'diagnostic',params:{id:f.sent[0].id}});assert.equal(f.peer.pendingCount,1);f.receive({id:f.sent[0].id,result:1});assert.equal(await p,1);f.receive({id:f.sent[0].id,result:2});assert.equal(f.peer.closed,false);f.peer.close();
});
