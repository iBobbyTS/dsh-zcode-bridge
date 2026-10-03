import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { apply, inject, StatusCard } from '../packages/client/lib/client-test.mjs'
import { apply as hostApply, inject as hostInject } from '../packages/host/index.mjs'
import { BridgeHost } from '../packages/host/runtime.mjs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { batchFaultChild, batchFaultInstallation } from './fixtures/batch-fault.mjs'

describe('S01 DSH existing slots and lifecycle',()=>{
 it('registers the bundle page and removes it with the Cordis fiber',async()=>{
  const ctx=new Context();await ctx.plugin(SlotRegistry).await();const locale=new LocaleRuntime(ctx);locale.setLocale('zh');ctx.provide('locale',locale);
  ctx.provide('connection',{rpc:{call:async()=>({ok:true,value:{}})},state:{subscribe:()=>()=>{}}});
  const slots=ctx.get('slots') as SlotRegistry;
  slots.register({name:'root',children:{'plugins.bundle.config':{kind:'keyed',scope:'root'}}} as never,()=>null);
  const fiber=ctx.plugin({inject,apply});await fiber.await();
  expect(slots.entries('plugins.bundle.config')).toHaveLength(1);
  expect(slots.entries('plugins.bundle.config')[0].options.key).toBe('@dsh-zcode/bridge');
  await fiber.dispose();expect(slots.entries('plugins.bundle.config')).toHaveLength(0);await ctx.fiber.dispose();
 });
 it('Host uses the dedicated authenticated RPC channel and unloads without launch',async()=>{
  const ctx=new Context();let handler:any,unregistered=false;
  ctx.provide('webServer',{});
  ctx.provide('connection',{rpc:{handle:(channel:string,fn:any)=>{expect(channel).toBe('/zcode-bridge');handler=fn;return async()=>{unregistered=true}}}});
  const fiber=ctx.plugin({inject:hostInject,apply:hostApply});await fiber.await();
  expect((await handler('status',{},new AbortController().signal)).value.reason).toBe('not-connected');
  expect((await handler('connect',{method:'session/send'},new AbortController().signal)).ok).toBe(false);
  expect((await handler('session/send',{},new AbortController().signal)).ok).toBe(false);
  await fiber.dispose();expect(unregistered).toBe(true);await ctx.fiber.dispose();
 });
 it('Host registers dedicated /zcode-bridge RPC channel and coexists with /api interceptor',async()=>{
  const ctx=new Context();
  const interceptors=new Map<string,any>();
  const handlers=new Map<string,any>();
  ctx.provide('connection',{
    rpc:{
      intercept:(channel:string,_matches:any,fn:any)=>{
        if(interceptors.has(channel))throw new Error(`connection: shared RPC channel "${channel}" already has an interceptor`);
        interceptors.set(channel,fn);
        return async()=>{interceptors.delete(channel)};
      },
      handle:(channel:string,fn:any)=>{
        if(handlers.has(channel))throw new Error(`duplicate route ${channel}`);
        handlers.set(channel,fn);
        return async()=>{handlers.delete(channel)};
      },
    },
  });
  ctx.provide('webServer',{});
  ctx.connection.rpc.intercept('/api',()=>true,async()=>({ok:true,value:{gateway:true}}));
  const fiber=ctx.plugin({inject:hostInject,apply:hostApply});
  await fiber.await();
  expect(handlers.has('/zcode-bridge')).toBe(true);
  const statusRes=await handlers.get('/zcode-bridge')('status',{},new AbortController().signal);
  expect(statusRes.ok).toBe(true);
  expect(statusRes.value.reason).toBe('not-connected');
  await fiber.dispose();
  expect(handlers.has('/zcode-bridge')).toBe(false);
  expect(interceptors.has('/api')).toBe(true);
  await ctx.fiber.dispose();
 });
 it('official headless round trip is rendered as restricted in the same StatusCard',async()=>{
  const workspacePath=resolve('../.agent-work/tmp/s01-probe/zcode-test-workspace');
  const host=new BridgeHost({workspacePath});
  try {
   const state=await host.connect();expect(state.connected).toBe(true);expect(state.auth).toBe('unavailable');
   render(React.createElement(StatusCard,{view:'page',rpc:{call:async()=>({ok:true,value:host.status})}}));
   await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Restricted: protocol connected'));
   expect(screen.getByText(state.installation.appPath)).toBeTruthy();
   expect(screen.getByText(/Official session\/list response validated/)).toBeTruthy();
   console.log(JSON.stringify({oracle:'official-runtime-to-StatusCard',version:state.installation.version,sha256:state.installation.sha256,launcher:state.installation.launcher,roundTrip:state.roundTrip,state:state.state,auth:state.auth,paidModelCalls:0}));
  }finally{cleanup();await host.dispose()}
 });
})

import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { loadOverlayPatches, composeEntries } from '@deepseek-ai/dsh-app-boot'
import { readFileSync } from 'node:fs'
it('official response travels through Host RPC and DSH production slot renderer',async()=>{
 const runtime=await SlotTestRuntime.create();const locale=new LocaleRuntime(runtime.ctx);locale.setLocale('en');runtime.ctx.provide('locale',locale);runtime.slots.installLocale(locale);
 let dispatch:any;
 runtime.ctx.provide('connection',{
   rpc:{handle:(_channel:any,handler:any)=>{dispatch=handler;return async()=>{}},call:async(_channel:any,endpoint:any,payload:any,signal:any)=>dispatch(endpoint,payload,signal??new AbortController().signal)},
   state:{subscribe:()=>()=>{}},
 });
 runtime.ctx.provide('webServer',{});
 try{
  const fiber=runtime.ctx.plugin({inject:hostInject,apply:hostApply},{workspacePath:resolve('../.agent-work/tmp/s01-probe/zcode-test-workspace')});await fiber.await();
  await dispatch('connect',{},new AbortController().signal);
  await runtime.declare({'plugins.bundle.config':{kind:'keyed',scope:'root'}} as never);await runtime.mount({inject,apply});
  const view=runtime.renderSlot('plugins.bundle.config' as never,{view:'page'} as never,{entryKey:'@dsh-zcode/bridge'} as never);
  await waitFor(()=>expect(view.view.getByRole('status').textContent).toContain('Restricted: protocol connected'));
  expect(view.view.getByText(/Official session\/list response validated/)).toBeTruthy();
 }finally{await runtime.dispose()}
});
it('bundle and DSH config overlay compose via existing include machinery',()=>{
 const manifest=JSON.parse(readFileSync('package.json','utf8'));
 const patches=loadOverlayPatches('dsh',resolve(manifest.dsh.bundle.patch));
 const entries=composeEntries([patches]);
 expect(entries.map((x:any)=>x.id)).toEqual(['zcode-bridge-host','zcode-bridge-client']);
 const overlay=loadOverlayPatches('dsh',resolve('../dsh/apps/cli/config/examples/zcode-bridge/cordis.patch.yml'));
 expect(composeEntries([patches,overlay])[0].config.workspacePath).toContain('zcode-test-workspace');
});

it('CB-1: same-batch list response and bad frame leave the status card reconnect button enabled',async()=>{
 const fixture=batchFaultChild();
 const host=new BridgeHost({workspacePath:tmpdir(),inspect:async()=>batchFaultInstallation,spawnProcess:()=>fixture.child});
 const connecting=host.connect();
 try{
  await fixture.eof;fixture.finishClose();
  const result=await connecting;
  expect(result.connected).toBe(false);expect(result.reason).toBe('protocol-invalid');
  render(React.createElement(StatusCard,{view:'page',rpc:{call:async()=>({ok:true,value:host.status})}}));
  await waitFor(()=>expect(screen.getByRole('status').textContent).toBe('Official protocol frame was invalid'));
  expect((screen.getByRole('button',{name:'Connect official runtime'}) as HTMLButtonElement).disabled).toBe(false);
 }finally{cleanup();fixture.finishClose();await connecting;await host.dispose()}
});
