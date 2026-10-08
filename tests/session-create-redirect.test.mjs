import {test} from 'node:test';import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {installSessionCommandSeams} from '../packages/driver/session-commands.mjs';

// Unit coverage for the driver-occupied create seam: a picked foreign workspace is redirected
// to the launcher execution workspace instead of faulting driver-workspace-mismatch at the
// factory. End-to-end behavior of both sidebar New Session entries was verified live on
// 2026-10-08 before this file was written; here the official controller is a stub, so the
// assertions pin exactly the request the original create receives.
const root=process.env.DSH_DRIVER_NPM_NODE_MODULES??'/private/tmp/dsh-local-npm-verify/npm/node_modules';
const cordis=join(root,'@deepseek-ai/cordis/lib/index.js');
const real={skip:existsSync(cordis)?false:'requires rc.2 npm artifacts; set DSH_DRIVER_NPM_NODE_MODULES'};

async function seamWorld({execution='/execution/workspace',readyError=null}={}){
  const [{Context}]=await Promise.all([import(pathToFileURL(cordis))]);
  const ctx=new Context();
  const rows=new Map([['ws-foreign',{id:'ws-foreign',path:'/project/foreign'}]]);
  const createdRows=[],readyCalls=[];
  ctx.provide('workspaceRegistry',{
    get:id=>rows.get(id),
    resolveByPath:path=>[...rows.values()].find(row=>row.path===path),
    create:async(path,owner)=>{const row={id:'ws-exec-'+createdRows.length,path};createdRows.push({path,owner});rows.set(row.id,row);return row},
  });
  const received=[];
  const commands={create:async request=>{received.push(request);return {sessionId:'session-created'}},rename:async()=>{},updateQueue:async()=>{},cancel:()=>{}};
  ctx.provide('sessionController',{commands,resolveAgent:async()=>({error:null,agent:undefined})});
  ctx.provide('sessionTitle',{config:{maxTitleBytes:120}});
  ctx.provide('agents',{get:()=>undefined});
  const originalRequest=Object.freeze({create:{workspaceId:'ws-foreign'}});
  const factory={accepting:true,transport:{async ready(cwd){readyCalls.push(cwd);
    if(readyError)throw Object.assign(new Error(readyError),{code:readyError});
    if(cwd!==undefined&&cwd!==execution)throw Object.assign(new Error('driver-workspace-mismatch'),{code:'driver-workspace-mismatch'});
    return execution}}};
  const release=installSessionCommandSeams(ctx,factory,{normalizeSessionTitle:title=>title,RemoteError:class extends Error{}});
  return {ctx,commands,received,createdRows,readyCalls,factory,release,
    async close(){release();await ctx.fiber.dispose()}};
}

test('create seam redirects a picked foreign workspace to the launcher execution workspace',real,async()=>{
  const w=await seamWorld();
  try{
    assert.deepEqual(await w.commands.create({workspaceId:'ws-foreign'}),{sessionId:'session-created'});
    assert.deepEqual(w.received,[{workspaceId:'ws-exec-0'}],'the original create sees the execution workspace row only');
    assert.deepEqual(w.createdRows,[{path:'/execution/workspace',owner:'ZCode'}]);
    assert.deepEqual(w.readyCalls,[undefined],'readiness is probed without asserting a foreign cwd');
  }finally{await w.close()}
});

test('create seam drops a foreign blank-reuse sessionId instead of adopting it under the picked cwd',real,async()=>{
  const w=await seamWorld();
  try{
    await w.commands.create({workspaceId:'ws-foreign',sessionId:'session-blank'});
    assert.deepEqual(w.received,[{workspaceId:'ws-exec-0'}],'the blank id never reaches the official create');
  }finally{await w.close()}
});

test('create seam keeps a request that already targets the execution workspace untouched',real,async()=>{
  const w=await seamWorld();
  try{
    await w.commands.create({cwd:'/execution/workspace'});
    assert.deepEqual(w.received,[{cwd:'/execution/workspace'}]);
    assert.deepEqual(w.createdRows,[],'no workspace row is minted for the fast path');
  }finally{await w.close()}
});

test('create seam passes through unchanged when the launcher is unavailable',real,async()=>{
  const w=await seamWorld({readyError:'execution-unavailable'});
  try{
    await w.commands.create({workspaceId:'ws-foreign',sessionId:'session-live'});
    assert.deepEqual(w.received,[{workspaceId:'ws-foreign',sessionId:'session-live'}],'the original fault surfaces from the untouched create');
    assert.deepEqual(w.createdRows,[]);
  }finally{await w.close()}
});

test('create seam passes through when the driver factory is not accepting',real,async()=>{
  const w=await seamWorld();
  try{
    w.factory.accepting=false;
    await w.commands.create({workspaceId:'ws-foreign'});
    assert.deepEqual(w.received,[{workspaceId:'ws-foreign'}]);
    assert.deepEqual(w.readyCalls,[],'an inactive driver never probes the launcher');
  }finally{await w.close()}
});

test('create seam passes through an unknown workspaceId so workspace/not-found still surfaces',real,async()=>{
  const w=await seamWorld();
  try{
    await w.commands.create({workspaceId:'ws-missing'});
    assert.deepEqual(w.received,[{workspaceId:'ws-missing'}]);
    assert.deepEqual(w.createdRows,[]);
  }finally{await w.close()}
});

test('create seam is restored on release',real,async()=>{
  const w=await seamWorld();
  const wrapped=w.commands.create;
  await w.close();
  assert.notEqual(w.commands.create,wrapped);
  assert.equal(typeof w.commands.create,'function');
});
