import {it,expect,vi} from 'vitest'
import {render,screen,waitFor,cleanup,act,fireEvent} from '@testing-library/react'
import React from 'react'
import {createSnapshotStore} from '@deepseek-ai/dsh-client-store'
import {RuntimeSessions} from '../packages/client/sources.mjs'
import {ZCodeDirectory,ZCodeSessionPanel,StatusCard} from '../packages/client/lib/client-test.mjs'
it('official multi-workspace sidebar opens metadata read-only; foreign busy gate retains view and makes zero commands',async()=>{
 const addr={runtime:'zcode',authority:'official-host:1',workspace:'/real-project',sessionId:'real-session'}
 const sessions={list:createSnapshotStore({ids:[],byId:{},phase:'ready'}),refresh:async()=>{},retain:vi.fn(),create:vi.fn()}
 const rpc={call:vi.fn(async(_channel:string,method:string)=>{
  if(method==='writePreflight')return {ok:true,value:{decision:'active',allowed:false,reason:'official-gui-active-turn',warning:'automation-bound-session-may-run-in-background'}}
  if(method==='sessions')return {ok:true,value:{sessions:[{address:addr,title:'Real shared task',cwd:addr.workspace,sharedTask:{status:'running'}}],scope:{authority:addr.authority,workspace:'official-task-catalog'},catalog:{complete:true,truncated:false,sharedGui:'shared-task-store',readOnly:true,multiWorkspace:true,deleted:[]},availability:{state:'restricted',reason:'route-b-read-only-zero-model-requests',capabilities:{create:false,open:false,nativeAgent:false}}}}
  throw Error('unexpected RPC '+method)
 })}
 const sources=new RuntimeSessions({sessions,rpc,nativeAuthority:'native'})
 try{
  await sources.refresh();render(React.createElement(ZCodeDirectory,{sources}));expect(screen.getByText('Real shared task')).toBeTruthy();cleanup()
  await sources.open(addr);render(React.createElement(ZCodeSessionPanel,{sources}));
  await waitFor(()=>expect(screen.getByTestId('zcode-shared-write-gate').textContent).toContain('official-gui-active-turn'))
  expect((screen.getByRole('button',{name:'Send'}) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByLabelText('Shared session draft') as HTMLTextAreaElement).disabled).toBe(true)
  expect(screen.getByRole('alert').textContent).toContain('automation');expect(sessions.retain).not.toHaveBeenCalled()
  expect(rpc.call.mock.calls.every(c=>['sessions','writePreflight'].includes(c[1]))).toBe(true)
  await sources.disconnect()
 }finally{cleanup();await sources.dispose()}
})
it('status card presents authenticated official Host while S03 execution stays explicitly disabled',async()=>{
 const rpc={call:async()=>({ok:true,value:{state:'authenticated',auth:'authenticated',connected:true,reason:'route-b-authenticated-read-only'}})}
 render(React.createElement(StatusCard,{rpc}))
 try{await waitFor(()=>expect(screen.getByText('Account: Authenticated by official Host')).toBeTruthy());expect(screen.getByText('Model requests are disabled for the S03 observation window.')).toBeTruthy()}finally{cleanup()}
})

it('shared UI refreshes three decisions automatically while preserving the draft and zero send capability',async()=>{
 vi.useFakeTimers()
 const address={runtime:'zcode',authority:'official-host:1',workspace:'/project',sessionId:'one'}
 let decision={decision:'idle',allowed:true,reason:'shared-task-confirmed-idle'}
 const sources={selection:createSnapshotStore({readOnly:true,address,row:{title:'One'}}),rpc:{call:vi.fn(async()=>({ok:true,value:decision}))},disconnect:vi.fn()}
 try{
  render(React.createElement(ZCodeSessionPanel,{sources}))
  await act(async()=>{await Promise.resolve()})
  const draft=screen.getByLabelText('Shared session draft') as HTMLTextAreaElement
  expect(draft.disabled).toBe(false);fireEvent.change(draft,{target:{value:'retained draft'}})
  decision={decision:'active',allowed:false,reason:'official-gui-active-turn'}
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000)})
  expect(draft.disabled).toBe(true);expect(draft.value).toBe('retained draft')
  decision={decision:'unknown',allowed:false,reason:'shared-task-signal-unavailable-or-stale'}
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000)})
  expect(screen.getByTestId('zcode-shared-write-gate').textContent).toContain('unknown')
  decision={decision:'idle',allowed:true,reason:'shared-task-confirmed-idle'}
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000)})
  expect(draft.disabled).toBe(false);expect(draft.value).toBe('retained draft');expect((screen.getByRole('button',{name:'Send'}) as HTMLButtonElement).disabled).toBe(true)
 }finally{cleanup();vi.useRealTimers()}
})

it('U1: 318 shared tasks paginate after sorting, partition workspace/pinned rows and keep display controls read-only',async()=>{
 const address={runtime:'zcode',authority:'official-host:1',workspace:'/one',sessionId:'0'}
 const rows=Array.from({length:318},(_,i)=>({address:{...address,workspace:i%2?'/one':'/two',sessionId:String(i)},title:'Task '+i,cwd:i%2?'/one':'/two',sharedTask:{lastActivityAt:i,pinned:i===1,titleSource:i===1?'custom':i===317?'generated':i===316?'default':'unknown'}}))
 rows.push({...rows[0],address:{...address,sessionId:'deleted'},cwd:address.workspace,title:'Hidden deleted',sharedTask:{deleted:true}} as any)
 rows.push({...rows[0],address:{...address,sessionId:'archived'},cwd:address.workspace,title:'Hidden archived',sharedTask:{archived:true}} as any)
 const rpc={call:vi.fn(async()=>({ok:true,value:{sessions:rows,scope:{authority:address.authority,workspace:'official-task-catalog'},catalog:{complete:true,truncated:false,sharedGui:'shared-task-store',readOnly:true,multiWorkspace:true,deleted:[]},availability:{state:'restricted',reason:'read-only',capabilities:{create:false,open:false,nativeAgent:false}}}}))}
 const native={list:createSnapshotStore({ids:[],byId:{},phase:'ready'}),refresh:async()=>{},retain:vi.fn(),create:vi.fn()}
 const sources=new RuntimeSessions({sessions:native,rpc,nativeAuthority:'native'})
 try{
  await sources.refresh();render(React.createElement(ZCodeDirectory,{sources}))
  const state=sources.directory.getSnapshot();expect(state.total).toBe(318);expect(state.rows).toHaveLength(20)
  expect(state.rows.slice(0,3).map((r:any)=>r.address.sessionId)).toEqual(['1','317','316'])
  expect(document.querySelectorAll('[data-session-key]')).toHaveLength(20)
  expect(screen.queryByText('Hidden deleted')).toBeNull();expect(screen.queryByText('Hidden archived')).toBeNull()
  expect(screen.queryByLabelText(/DSH-only group/)).toBeNull()
  expect(document.querySelector('[data-title-source="custom"]')).toBeTruthy();expect(document.querySelector('[data-title-source="generated"]')).toBeTruthy();expect(document.querySelector('[data-title-source="default"]')).toBeTruthy()
  const title=screen.getByText('Task 317');expect(title.style.textOverflow).toBe('ellipsis');expect(title.closest('button')?.title).toBe('Task 317')
  expect(document.querySelectorAll('[data-workspace]')).toHaveLength(3)
  expect(screen.getByText('Archived').closest('details')?.open).toBe(false)
  fireEvent.click(screen.getByRole('button',{name:'Next'}));expect(sources.directory.getSnapshot().page).toBe(1)
  fireEvent.change(screen.getByLabelText('Search sessions'),{target:{value:'/two'}});expect(sources.directory.getSnapshot().page).toBe(0);expect(sources.directory.getSnapshot().total).toBe(159)
  expect(rpc.call.mock.calls.every((c:any)=>c[1]==='sessions')).toBe(true);expect(native.retain).not.toHaveBeenCalled()
 }finally{cleanup();await sources.dispose()}
})
