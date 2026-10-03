import {Context} from '@deepseek-ai/cordis'
import {createSnapshotStore} from '@deepseek-ai/dsh-client-store'
import {parseRuntimeSessionAddress,parseRuntimeSessionKey,runtimeSessionKey} from '@deepseek-ai/dsh-api-session-controller/client'
import {it,expect,vi} from 'vitest'
import {RuntimeSessions,installRuntimeSessions} from '../packages/client/sources.mjs'
import {BridgeHost} from '../packages/host/runtime.mjs'
import {apply as hostApply,inject as hostInject} from '../packages/host/index.mjs'
import {B02} from './fixtures/b02.mjs'
import * as sourceContract from '@deepseek-ai/dsh-api-session-controller/client'
import * as clientStore from '@deepseek-ai/dsh-client-store'
import * as React from 'react'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import {createClientModuleSystem} from '@deepseek-ai/dsh-client-modules/client'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {batchFaultInstallation} from './fixtures/batch-fault.mjs'
import {EventEmitter} from 'node:events'
import {PassThrough} from 'node:stream'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'

function nativeFixture(){
  const list=createSnapshotStore({ids:['same-id'],byId:{'same-id':{displayTitle:'D1',running:false,cwd:'/native'}},phase:'ready'})
  const hook=vi.fn(),tool=vi.fn(),prompt=vi.fn(),release=vi.fn()
  const binding={sessionId:'same-id',ctx:{nativeOnly:true},session:{prompt}}
  const retain=vi.fn(()=>{hook();return {sessionId:'same-id',binding,ready:Promise.resolve(binding),release}})
  return {sessions:{list,retain,create:vi.fn(async()=> 'same-id'),refresh:vi.fn(async()=>{})},hook,tool,prompt,release}
}
function zcodeCatalog(address=B02.Z1){return {ok:true,value:{sessions:[{address,title:'Z1',cwd:address.workspace}],scope:{authority:address.authority,workspace:address.workspace},availability:{state:'restricted',reason:'official-auth-source-missing',capabilities:{create:false,open:false,nativeAgent:false}}}}}

it('B02: same id, fixed reopen, creation default, unknown binding, and native hook isolation',async()=>{
  const native=nativeFixture(),rpc={call:vi.fn(async()=>zcodeCatalog())}
  const sources=new RuntimeSessions({sessions:native.sessions as never,rpc:rpc as never,nativeAuthority:B02.D1.authority})
  try{
    await sources.refresh()
    expect(sources.list.getSnapshot().map(row=>row.key)).toHaveLength(2)
    expect(runtimeSessionKey(parseRuntimeSessionAddress(B02.D1))).not.toBe(runtimeSessionKey(parseRuntimeSessionAddress(B02.Z1)))
    let creationDefault:string=B02.initialDefault
    await expect(sources.create({runtime:creationDefault as never})).rejects.toMatchObject({code:'zcode-source-not-ready'})
    expect(native.sessions.create).not.toHaveBeenCalled()
    const fixed=parseRuntimeSessionAddress(B02.Z1),saved=runtimeSessionKey(fixed)
    const z1=sources.retain(fixed,{source:'mainView'});expect(z1.runtime).toBe('zcode')
    expect('native' in z1).toBe(false);expect('ctx' in z1).toBe(false)
    creationDefault=B02.newDefault
    const d1=await sources.create({runtime:creationDefault as never})
    expect(d1).toEqual(B02.D1)
    z1.release()
    const reopened=sources.retain(parseRuntimeSessionKey(saved),{source:'mainView'})
    expect(reopened.address).toEqual(B02.Z1)
    await sources.refreshAddress(reopened.address)
    expect(rpc.call.mock.calls.at(-1)?.[0]).toBe('/zcode-bridge')
    expect(rpc.call.mock.calls.at(-1)?.[1]).toBe('sessions')
    expect(rpc.call.mock.calls.at(-1)?.[2]).toEqual({address:B02.Z1})
    expect(native.hook).toHaveBeenCalledTimes(0);expect(native.tool).toHaveBeenCalledTimes(0);expect(native.prompt).toHaveBeenCalledTimes(0);expect(native.sessions.retain).toHaveBeenCalledTimes(0)
    reopened.release()
    expect(()=>sources.retain(B02.unknown as never,{source:'mainView'})).toThrow()
    await expect(sources.create({runtime:'unknown' as never})).rejects.toMatchObject({code:'unknown-runtime'})
    expect(sources.legacyAddress('same-id' as never)).toEqual(B02.D1)
    const before=rpc.call.mock.calls.length
    const nativeRef=sources.retain(d1,{source:'mainView'})
    expect(nativeRef.runtime).toBe('native');expect(native.hook).toHaveBeenCalledOnce()
    expect(rpc.call).toHaveBeenCalledTimes(before)
    nativeRef.release()
    expect(Object.isFrozen(reopened.address)).toBe(true)
    expect(sources.zcodeAvailability.getSnapshot().state).toBe('restricted')
  }finally{await sources.dispose()}
})

it('references and adapter unload withdraw subscriptions, cancel reads, and discard late results',async()=>{
  const native=nativeFixture(),generation=createSnapshotStore({id:1}),gate=Promise.withResolvers<any>()
  let signal:AbortSignal|undefined
  const rpc={call:vi.fn(async(_channel:any,_endpoint:any,_payload:any,next:AbortSignal)=>{signal=next;return gate.promise})}
  const sources=new RuntimeSessions({sessions:native.sessions as never,rpc:rpc as never,connectionGeneration:generation as never,nativeAuthority:B02.D1.authority})
  const changed=vi.fn(),z1=sources.retain(parseRuntimeSessionAddress(B02.Z1),{source:'mainView'})
  if(z1.runtime!=='zcode')throw Error('fixture runtime')
  z1.summary.subscribe(changed);z1.availability.subscribe(changed);z1.release()
  native.sessions.list.set({...native.sessions.list.getSnapshot()})
  expect(changed).not.toHaveBeenCalled()
  const pending=sources.refresh()
  generation.set({id:2});expect(signal!.aborted).toBe(true)
  const disposing=sources.dispose();gate.resolve(zcodeCatalog());await Promise.all([pending,disposing])
  expect(sources.list.getSnapshot()).toEqual([]);expect(z1.summary.getSnapshot()).toBeUndefined()
  expect(z1.availability.getSnapshot()).toBe(z1.availability.getSnapshot())
  expect(sources.zcodeAvailability.getSnapshot().reason).toBe('disposed')
  native.sessions.list.set({...native.sessions.list.getSnapshot()});expect(changed).not.toHaveBeenCalled()
  expect(()=>sources.retain(parseRuntimeSessionAddress(B02.Z1),{source:'mainView'})).toThrow('disposed')
})

it('later official reads fence earlier replies and retain the original authority after a process change',async()=>{
  const native=nativeFixture(),first=Promise.withResolvers<any>(),second=Promise.withResolvers<any>(),signals:AbortSignal[]=[]
  let call=0
  const rpc={call:vi.fn((_channel:any,_endpoint:any,_payload:any,signal:AbortSignal)=>{signals.push(signal);return call++===0?first.promise:second.promise})}
  const sources=new RuntimeSessions({sessions:native.sessions as never,rpc:rpc as never,nativeAuthority:B02.D1.authority})
  try{
    const old=sources.retain(parseRuntimeSessionAddress(B02.Z1),{source:'mainView'})
    const early=sources.refresh(),later=sources.refreshAddress(parseRuntimeSessionAddress(B02.Z1))
    expect(signals[0].aborted).toBe(true)
    second.resolve(zcodeCatalog());await later
    first.resolve({ok:false,error:{code:'old-failure'}});await early
    expect(sources.zcodeAvailability.getSnapshot().state).toBe('restricted')
    expect(sources.list.getSnapshot().some(row=>row.address.runtime==='zcode')).toBe(true)
    const current={...B02.Z1,authority:'official-headless:next-process'}
    rpc.call.mockImplementation(async()=>zcodeCatalog(current))
    await sources.refresh()
    expect(old.address).toEqual(B02.Z1)
    if(old.runtime!=='zcode')throw Error('fixture runtime')
    expect(old.summary.getSnapshot()).toBeUndefined()
    expect(old.availability.getSnapshot().reason).toBe('source-address-mismatch')
    expect(old.availability.getSnapshot()).toBe(old.availability.getSnapshot())
    expect(native.hook).not.toHaveBeenCalled()
    sources.retain(parseRuntimeSessionAddress(B02.D1),{source:'mainView'})
    await sources.dispose();expect(native.release).toHaveBeenCalledOnce()
  }finally{await sources.dispose()}
})

it('a foreign authority is rejected, and failed or malformed source responses cannot restore old rows',async()=>{
  const native=nativeFixture(),rpc={call:vi.fn(async()=>zcodeCatalog())}
  const sources=new RuntimeSessions({sessions:native.sessions as never,rpc:rpc as never,nativeAuthority:B02.D1.authority})
  try{
    await sources.refresh()
    const foreign=parseRuntimeSessionAddress({...B02.D1,authority:'another-host'})
    expect(()=>sources.retain(foreign,{source:'mainView'})).toThrow('does not belong')
    const wrong=zcodeCatalog({...B02.Z1,sessionId:'other'});rpc.call.mockResolvedValue(wrong)
    await expect(sources.refreshAddress(parseRuntimeSessionAddress(B02.Z1))).rejects.toMatchObject({code:'source-address-mismatch'})
    expect(sources.list.getSnapshot()).toHaveLength(1)
    rpc.call.mockResolvedValue({ok:true,value:{sessions:[],availability:{state:'available'}}} as never)
    await sources.refresh();expect(sources.zcodeAvailability.getSnapshot().reason).toBe('sessions-invalid')
    expect(native.hook).not.toHaveBeenCalled()
  }finally{await sources.dispose()}
})

it('Cordis native-controller injection and fiber release own the source adapter',async()=>{
  const ctx=new Context(),native=nativeFixture()
  ctx.provide('connection',{rpc:{call:async()=>zcodeCatalog()}})
  const fiber=ctx.plugin({apply(scope:Context){scope.effect(()=>installRuntimeSessions(scope))}})
  try{
    await fiber.await();expect(ctx.get('runtimeSessions')).toBeUndefined()
    ctx.provide('sessions',native.sessions)
    await new Promise(resolve=>setTimeout(resolve,0))
    const sources=ctx.get('runtimeSessions')!;expect(sources).toBeTruthy()
    const changed=vi.fn();sources.list.subscribe(changed)
    await fiber.dispose();expect(ctx.get('runtimeSessions')).toBeUndefined()
    native.sessions.list.set({...native.sessions.list.getSnapshot()});expect(changed).not.toHaveBeenCalled()
    expect(sources.list.getSnapshot()).toEqual([])
  }finally{await ctx.fiber.dispose()}
})

it('the shipped classic-script artifact mounts and unloads through DSH ClientModuleSystem and Loader',async()=>{
  const ctx=new Context(),native=nativeFixture();let pages=0
  ctx.provide('sessions',native.sessions)
  ctx.provide('connection',{rpc:{call:async()=>zcodeCatalog()}})
  ctx.provide('slots',{inject:(_name:any,apply:any)=>apply(),register:()=>{pages++;return ()=>{pages--}}})
  ctx.provide('locale',{register:()=>()=>{}})
  const target:any={mode:'queue',pendingQueue:[],load:()=>{},create:(options:any)=>createClientModuleSystem(target,{id:'bootstrap',exports:{}},options)}
  const row={id:'@dsh-zcode/bridge-client',rev:'s02a',url:'/plugins/??@dsh-zcode/bridge-client/client.js&rev=s02a'}
  const graph={rev:'s02a',entries:[row],batches:[{phase:'application',url:'/batch',rev:'s02a',entries:[row.id]}]}
  const modules=target.create({boot:graph,staticModules:{react:React,'@deepseek-ai/dsh-client-store':clientStore,'@deepseek-ai/dsh-api-session-controller/client':sourceContract},loadBundle:async()=>{
    runInNewContext(readFileSync('packages/client/lib/client.js','utf8'),{window:{__ModuleLoader__:target},location:{origin:B02.D1.authority},AbortController})
  }})
  try{
    await ctx.plugin(Loader);ctx.loader.internal=modules as never
    await modules.entries.start(ctx.loader,modules.manifest)
    expect(modules.entries.state.getSnapshot().failures).toEqual([])
    expect(pages).toBe(1)
    const sources=ctx.get('runtimeSessions')!;expect(sources).toBeTruthy()
    await sources.refresh();expect(sources.list.getSnapshot()).toHaveLength(2)
    expect(native.hook).not.toHaveBeenCalled()
    await modules.entries.sync({rev:'empty',entries:[],batches:[]})
    expect(pages).toBe(0);expect(ctx.get('runtimeSessions')).toBeUndefined()
    expect(sources.list.getSnapshot()).toEqual([])
  }finally{await ctx.fiber.dispose();await ctx.fiber.await()}
})

/** In-process protocol fixture with an explicit EOF/close barrier; never claims official storage. */
function protocolFixture(){
  const child=new EventEmitter() as any;child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough()
  const requests:any[]=[]
  child.stdin.on('data',(data:Buffer)=>{
    const request=JSON.parse(data.toString());requests.push(request)
    const workspace=request.params.workspace?.workspacePath??tmpdir()
    const result=request.method==='runtime/capabilities'?{independentPlanState:true}:{sessions:[{sessionId:'same-id',title:'Z1',workspace:{workspacePath:workspace,workspaceKey:workspace},status:'idle'}]}
    child.stdout.write(JSON.stringify({id:request.id,result})+'\n')
  })
  child.stdin.once('finish',()=>{child.stdout.end();child.stderr.end();child.emit('close',0)})
  child.kill=()=>{throw Error('must finish by EOF')}
  return {child,requests}
}

it('Host queries only the exact official process/workspace and rejects cross-runtime resumes',async()=>{
  const fixture=protocolFixture(),host=new BridgeHost({workspacePath:tmpdir(),inspect:async()=>batchFaultInstallation,spawnProcess:()=>fixture.child})
  try{
    const status=await host.connect(),value=await host.listSessions(),address=value.sessions[0].address
    expect(address.authority).toBe(status.sessionAuthority)
    await host.listSessions({address})
    expect(fixture.requests.at(-1).params.sessionIds).toEqual(['same-id'])
    const count=fixture.requests.length
    for(const wrong of [{...address,runtime:'native'},{...address,authority:'old-process'},{...address,workspace:'/foreign'}])await expect(host.listSessions({address:wrong})).rejects.toMatchObject({code:'source-address-mismatch'})
    expect(fixture.requests).toHaveLength(count)
    expect(fixture.requests.some(request=>/prompt|send|resume|create|close/.test(request.method))).toBe(false)
  }finally{await host.dispose()}
})

it('official catalog travels through the existing Host RPC and runtime source without native hooks',async()=>{
  const ctx=new Context(),native=nativeFixture();let dispatch:any
  ctx.provide('webServer',{})
  ctx.provide('connection',{rpc:{handle:(_channel:any,handler:any)=>{dispatch=handler;return ()=>{}},call:async(_channel:any,endpoint:any,payload:any,signal:any)=>dispatch(endpoint,payload,signal)}})
  const hostFiber=ctx.plugin({inject:hostInject,apply:hostApply},{workspacePath:resolve('../.agent-work/tmp/s01-probe/zcode-test-workspace')})
  let sources:RuntimeSessions|undefined
  try{
    await hostFiber.await()
    const connected=await dispatch('connect',{},new AbortController().signal)
    expect(connected.value.connected).toBe(true)
    sources=new RuntimeSessions({sessions:native.sessions as never,rpc:ctx.get('connection')!.rpc,nativeAuthority:B02.D1.authority})
    await sources.refresh()
    expect(sources.zcodeAvailability.getSnapshot().state).toBe('restricted')
    expect(sources.zcodeAvailability.getSnapshot().capabilities).toEqual({create:false,open:false,nativeAgent:false})
    expect(native.hook).not.toHaveBeenCalled()
    const wrong=await dispatch('sessions',{address:B02.D1},new AbortController().signal)
    expect(wrong.error.code).toBe('source-address-mismatch')
    expect((await dispatch('sessions',{command:'session/create'},new AbortController().signal)).ok).toBe(false)
    console.log(JSON.stringify({oracle:'official-session-list-to-source',state:sources.zcodeAvailability.getSnapshot().state,paidModelCalls:0,sharedSessions:connected.value.sharedSessions,nativeHookCalls:native.hook.mock.calls.length}))
  }finally{await sources?.dispose();await ctx.fiber.dispose()}
})
