import React from 'react'
import {it,expect,vi,afterEach} from 'vitest'
import {act,cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react'
import {createSnapshotStore} from '@deepseek-ai/dsh-client-store'
import {runtimeSessionKey} from '@deepseek-ai/dsh-api-session-controller/client'
import {RuntimeSessions} from '../packages/client/sources.mjs'
import {RemoteConversation} from '../packages/client/remote-conversation.mjs'
import {ZCodeDirectory,ZCodeSessionPanel} from '../packages/client/directory-view.jsx'
import {BridgeHost} from '../packages/host/runtime.mjs'
import {controlledStore} from './fixtures/s04-store.mjs'
import {tmpdir} from 'node:os'
import {readFileSync} from 'node:fs'
import {B02} from './fixtures/b02.mjs'
const pages=JSON.parse(readFileSync('tests/fixtures/s04/pages.json','utf8'))
const conflicts=JSON.parse(readFileSync('tests/fixtures/s04/conflict.json','utf8'))
afterEach(cleanup)
async function setup(options={}){
 const store=controlledStore(options),host=new BridgeHost({workspacePath:tmpdir(),inspect:async()=>({verified:true,launcher:'fixture',cjs:'fixture',providerConfig:'fixture'}),spawnProcess:()=>store.child()});await host.connect()
 const rpc={call:vi.fn(async(_channel:string,endpoint:string,payload:any)=>{try{return {ok:true,value:endpoint==='sessions'?await host.listSessions(payload):payload.operation==='open'?await host.openConversation(payload.address):await host.conversationOperation(payload)}}catch(e:any){return {ok:false,error:{code:e.code??e.message}}}})}
 const native={list:createSnapshotStore({ids:['s0'],byId:{s0:{displayTitle:'native s0',running:false,cwd:'/native'}},phase:'ready'}),refresh:vi.fn(async()=>{}),create:vi.fn(),retain:vi.fn()}
 const make=()=>new RuntimeSessions({sessions:native as never,rpc:rpc as never,nativeAuthority:B02.D1.authority,settings:localStorage})
 const a=make(),b=make();await a.refresh();await b.refresh();const address=a.list.getSnapshot().find((r:any)=>r.address.runtime==='zcode')!.address
 return {store,host,rpc,native,a,b,address,close:async()=>{await a.dispose();await b.dispose();await host.dispose()}}
}
it('B02: directory search/pagination covers beyond 50; complete keys isolate native ids and local groups',async()=>{
 localStorage.clear();const f=await setup({seed:pages.sessions})
 try{
  expect(f.a.list.getSnapshot()).toHaveLength(66);f.a.setDirectory({pageSize:20,page:3});expect(f.a.directory.getSnapshot().rows).toHaveLength(5)
  f.a.setDirectory({query:'Title 64'});expect(f.a.directory.getSnapshot().total).toBe(1);expect(f.a.directory.getSnapshot().page).toBe(0)
  f.a.setGroup(f.address,'Local test');expect(JSON.parse(localStorage.getItem('dsh.zcode.local-groups')!)[runtimeSessionKey(f.address)]).toBe('Local test')
  f.a.setGroup({...f.address,authority:'other-bridge'},'Other group');expect(Object.keys(JSON.parse(localStorage.getItem('dsh.zcode.local-groups')!))).toHaveLength(2)
  f.a.setDirectory({query:''});expect(f.a.directory.getSnapshot().rows[0].group).toBe('Local test');expect(f.a.zcodeAvailability.getSnapshot().state).toBe('restricted');expect(f.native.retain).not.toHaveBeenCalled()
 }finally{await f.close()}
})
it('controlled two RuntimeSessions converge after alternating/concurrent official lifecycle decisions',async()=>{
 const f=await setup()
 try{await f.a.open(f.address);await f.b.open(f.address);await f.a.manage(f.address,'renameSession',{title:'left'});await f.b.refresh();expect(f.b.list.getSnapshot().find((r:any)=>r.address.runtime==='zcode')!.title).toBe('left')
  await Promise.all([f.a.manage(f.address,'renameSession',{title:'concurrent left'}),f.b.manage(f.address,'renameSession',{title:'concurrent right'})]);await f.a.refresh();await f.b.refresh();expect(f.a.list.getSnapshot()).toEqual(f.b.list.getSnapshot())
  await f.a.disconnect();expect(f.store.rows.size).toBe(1);await f.b.manage(f.address,'renameSession',{title:'while disconnected'});await f.a.open(f.address);expect(f.a.selection.getSnapshot()!.conversation.state.snapshot.meta.title).toBe('while disconnected')
  expect(f.store.requests.some((r:any)=>r.method==='session/close'||r.params.type==='sendText')).toBe(false)
 }finally{await f.close()}
})
it('deletion fences late frames/read replies and prunes groups in both clients by full key',async()=>{
 localStorage.clear();const f=await setup({holdFrames:true})
 try{
  await f.a.open(f.address);await f.b.open(f.address);f.a.setGroup(f.address,'Group A');f.b.setGroup(f.address,'Group B')
  const gate=Promise.withResolvers<any>(),old=await f.host.listSessions();let held=true;const original=f.rpc.call.getMockImplementation()!
  f.rpc.call.mockImplementation(async(...args:any[])=>{if(args[1]==='sessions'&&held){held=false;return gate.promise}return original(...args as [string,string,any])})
  const early=f.a.refresh();await f.b.manage(f.address,'renameSession',{title:'late'});await f.b.manage(f.address,'deleteSession',{});f.store.flush();await f.a.selection.getSnapshot()!.conversation.refresh()
  gate.resolve({ok:true,value:old});await early;expect(f.a.directory.getSnapshot().total).toBe(0);expect(f.b.directory.getSnapshot().total).toBe(0)
  expect(f.a.selection.getSnapshot()!.conversation.state.error).toBe('session-deleted');expect(JSON.parse(localStorage.getItem('dsh.zcode.local-groups')!)[runtimeSessionKey(f.address)]).toBeUndefined()
  await expect(f.a.open(f.address)).rejects.toMatchObject({code:'session-deleted'})
 }finally{await f.close()}
})
it('real captured rename failure is visible, keeps official title, and rolls back only the edit field',async()=>{
 const f=await setup({renameFailure:true})
 try{await f.a.open(f.address);render(React.createElement(ZCodeSessionPanel,{sources:f.a}));fireEvent.change(screen.getByRole('textbox',{name:'Session title'}),{target:{value:'Optimistic edit'}});fireEvent.click(screen.getByRole('button',{name:'Rename'}));await waitFor(()=>expect(screen.getAllByRole('status').some(node=>node.textContent?.includes(conflicts.rename.ack.reasonCode))).toBe(true))
  expect(f.a.directory.getSnapshot().rows[0].title).toBe('Title 0');expect((screen.getByRole('textbox',{name:'Session title'}) as HTMLInputElement).value).toBe('');expect((screen.getByRole('button',{name:'Archive'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.getAllByText(/unverified/).length).toBeGreaterThan(0)
 }finally{await f.close()}
})
it('directory UI searches, pages, opens with fixed address and labels scope/truncation truthfully',async()=>{
 const f=await setup({count:65});const onOpen=vi.fn()
 try{render(React.createElement(ZCodeDirectory,{sources:f.a,onOpen}));expect(screen.getByText('Official GUI shared sessions: unverified')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Next'}));expect(f.a.directory.getSnapshot().page).toBe(1);fireEvent.change(screen.getByLabelText('Search sessions'),{target:{value:'Title 64'}});expect(screen.getByRole('button',{name:'Title 64'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Title 64'}));await waitFor(()=>expect(onOpen).toHaveBeenCalledOnce());expect(f.a.selection.getSnapshot()!.address.sessionId).toBe('s64');expect(f.native.retain).not.toHaveBeenCalled()
 }finally{await act(()=>f.close())}
})
it('transient source failure preserves local groups and fixed identities until explicit same-store refresh',async()=>{
 localStorage.clear();const f=await setup()
 try{f.a.setGroup(f.address,'keep');await f.a.open(f.address);const original=f.rpc.call.getMockImplementation()!;f.rpc.call.mockResolvedValueOnce({ok:false,error:{code:'host-unreachable'}} as never);await f.a.refresh();expect(f.a.zcodeAvailability.getSnapshot().state).toBe('unavailable');expect(f.a.selection.getSnapshot()!.address).toEqual(f.address);f.rpc.call.mockImplementation(original);await f.a.refresh();expect(f.a.directory.getSnapshot().rows[0].group).toBe('keep');expect(f.store.requests.filter((r:any)=>r.method==='v4/command')).toHaveLength(0)
 }finally{await f.close()}
})
it('an open ACK arriving after view release cleans its handle and never deletes the official session',async()=>{
 const gate=Promise.withResolvers<any>(),rpc={call:vi.fn(async(_c:string,_e:string,p:any)=>p.operation==='open'?gate.promise:{ok:true,value:{released:true}})},remote=new RemoteConversation(rpc,B02.Z1)
 const opening=remote.connect(),closing=remote.cancel();gate.resolve({ok:true,value:{handle:'late-handle',state:{status:'live'}}});await Promise.all([opening,closing]);expect(rpc.call.mock.calls.at(-1)![2]).toEqual({operation:'release',handle:'late-handle'});expect(remote.state.status).toBe('connecting')
})

it('a lost Web reply converges from the confirmed Host ledger with the original id and no resend',async()=>{
 const f=await setup()
 try{await f.a.open(f.address);await f.b.open(f.address);const original=f.rpc.call.getMockImplementation()!;let lost=true
  f.rpc.call.mockImplementation(async(...args:any[])=>{const response=await original(...args as [string,string,any]);if(args[2].operation==='command'&&lost){lost=false;throw Error('injected-web-reply-loss')}return response})
  const result=await f.a.manage(f.address,'deleteSession',{});expect(result.ack.status).toBe('accepted');expect(result.commandId).toMatch(/^[0-9a-f-]{14}7/)
  const commands=f.store.requests.filter((r:any)=>r.method==='v4/command');expect(commands).toHaveLength(1);expect(commands[0].params.commandId).toBe(result.commandId)
  // ACK was observed by the Host before the Web reply was lost: the confirmed
  // closed projection can be read, but no synthetic resend/query is attempted.
  expect(f.a.selection.getSnapshot()!.conversation.state.error).toBe('session-deleted');expect(f.a.directory.getSnapshot().total).toBe(0);expect(f.store.requests.filter((r:any)=>r.method==='v4/command')).toHaveLength(1)
 }finally{await f.close()}
})
it('unknown command query uses the same client id and preserves unknown without retry',async()=>{
 let state:any={status:'live',commands:[],snapshot:{revision:0},admission:{allowed:false},managementAdmission:{allowed:true}}
 const rpc={call:vi.fn(async(_c:string,_e:string,p:any)=>{if(p.operation==='open')return {ok:true,value:{handle:'unknown-handle',state}};if(p.operation==='command')throw Error('network');if(p.operation==='state')return {ok:true,value:state};if(p.operation==='query')return {ok:true,value:{commandId:p.commandId,type:'renameSession',state:'outcome-unknown'}};return {ok:true,value:{released:true}}})}
 const remote=new RemoteConversation(rpc,B02.Z1)
 try{await remote.connect();const result=await remote.submit({type:'renameSession',payload:{title:'unknown'}});expect(result.state).toBe('outcome-unknown');await remote.queryCommand(result.commandId);expect(rpc.call.mock.calls.filter(c=>c[2].operation==='command')).toHaveLength(1);expect(rpc.call.mock.calls.find(c=>c[2].operation==='query')![2].commandId).toBe(result.commandId);expect(remote.state.commands[0].state).toBe('outcome-unknown')}
 finally{await remote.cancel()}
})
