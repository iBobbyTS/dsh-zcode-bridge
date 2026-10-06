import {it,expect,vi} from 'vitest'
import {render,screen,waitFor,cleanup,fireEvent} from '@testing-library/react'
import React from 'react'
import {createSnapshotStore} from '@deepseek-ai/dsh-client-store'
import {RuntimeSessions} from '../packages/client/sources.mjs'
import {ZCodeDirectory} from '../packages/client/lib/client-test.mjs'

const address={runtime:'zcode',authority:'official-host:1',workspace:'/real-project',sessionId:'mine-1'}
function catalog(){return {ok:true,value:{sessions:[{address,title:'Shared task',cwd:address.workspace,sharedTask:{status:'completed'}}],scope:{authority:address.authority,workspace:'official-task-catalog'},catalog:{complete:true,truncated:false,sharedGui:'shared-task-store',readOnly:true,multiWorkspace:true,deleted:[]},availability:{state:'restricted',reason:'live-http-authenticated-read-only',capabilities:{create:false,open:false,nativeAgent:false}}}}}
function makeSources(calls:string[]){
  const rpc={call:vi.fn(async(_channel:string,method:string,payload:any)=>{
    calls.push(method)
    if(method==='sessions')return catalog()
    if(method==='ownTurn'){
      expect(payload).toEqual({})
      return {ok:true,value:{taskId:'mine-1',workspacePath:'/private/tmp/s4web/workspace',prompt:'Reply with exactly: ok',traceId:'t1',usageBefore:{totalTokens:100,inputTokens:60,outputTokens:40,totalSessions:2,totalTurns:2,toolCallCount:1,requestCount:7},tasksBefore:[],calls:['zcode-task.createTask','zcode-task.sendPrompt'],at:1,address}}
    }
    if(method==='writePreflight')return {ok:true,value:{decision:'active',allowed:false,reason:'own-turn-busy',owner:'ours'}}
    if(method==='taskUsage'){
      expect(payload).toEqual({address})
      return {ok:true,value:{address,usage:{totalTokens:42,inputTokens:30,outputTokens:12,reasoningTokens:0,cacheCreationTokens:0,cacheReadTokens:0,modelRequestCount:2,modelErrorCount:0}}}
    }
    throw Error('unexpected RPC '+method)
  })}
  const sessions={list:createSnapshotStore({ids:[],byId:{},phase:'ready'}),refresh:async()=>{},retain:vi.fn(),create:vi.fn()}
  return new RuntimeSessions({sessions,rpc,nativeAuthority:'native'})
}

it('Sidebar control starts the bridge-owned turn through the official endpoint and shows the own gate',async()=>{
 const calls:string[]=[];const sources=makeSources(calls)
 try{
  await sources.refresh();render(React.createElement(ZCodeDirectory,{sources}))
  const details=screen.getByText(/Bridge-owned minimal turn/).closest('details')!
  fireEvent.click(details.querySelector('summary')!)
  fireEvent.click(screen.getByRole('button',{name:'Create session and send one prompt'}))
  await waitFor(()=>expect(document.querySelector('[data-own-turn="started"]')).toBeTruthy())
  expect(document.querySelector('[data-own-turn-task]')?.textContent).toBe('mine-1')
  expect(document.querySelector('[data-own-turn="started"]')?.textContent).toContain('Reply with exactly: ok')
  expect(document.querySelector('[data-own-turn="started"]')?.textContent).toContain('zcode-task.createTask')
  expect(document.querySelector('[data-own-turn="started"]')?.textContent).toContain('zcode-task.sendPrompt')
  await waitFor(()=>expect(document.querySelector('[data-own-turn-gate]')?.textContent).toBe('active · own-turn-busy · ours'))
  await waitFor(()=>expect(document.querySelector('[data-own-turn-usage]')?.textContent).toBe('2 requests · 42 tokens'))
  const preflight=calls.filter(m=>m==='writePreflight').length
  expect(preflight).toBe(1)
  expect(calls.filter(m=>m==='ownTurn')).toHaveLength(1)
  expect(calls.filter(m=>m==='taskUsage')).toHaveLength(1)
 }finally{cleanup();await sources.dispose()}
})
