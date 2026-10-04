import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ProtocolPeer } from '../packages/host/protocol.mjs';
import { HostTools } from '../packages/host/host-tools.mjs';
import { CatalogClient } from '../packages/host/catalog.mjs';
import { V4Conversation } from '../packages/host/conversation.mjs';
import { RemoteConversation } from '../packages/client/remote-conversation.mjs';
import { ZCodeHostToolResult } from '../packages/client/host-tools-view.jsx';
import { ZCodeConversationView, ZCodeHostToolsPanel, ZCodeRowsList } from '../packages/client/conversation-view.jsx';
import { inspectInstallation, runtimeEnv } from '../packages/host/installation.mjs';
import { stopOwned } from '../packages/host/runtime.mjs';
const lifecycle=JSON.parse(readFileSync('tests/fixtures/s11/lifecycle.json','utf8'));
const official=JSON.parse(readFileSync('tests/fixtures/s11/official.json','utf8'));
const workspace={workspacePath:'/fixture/s11-workspace',workspaceKey:'/fixture/s11-workspace'};
const tick=()=>new Promise(r=>setTimeout(r,10));
afterEach(cleanup);
function fixture(browserExecutor?:any,timeoutMs=200){
 const input=new PassThrough(),output=new PassThrough(),sent:any[]=[];
 output.on('data',b=>sent.push(JSON.parse(b.toString())));
 const peer=new ProtocolPeer(input,output,{timeoutMs}),catalog=new CatalogClient(peer,{workspace}),host=new HostTools(peer,{workspace,catalog,browserExecutor});
 const wire=(m:any)=>input.write(JSON.stringify(m)+'\n');
 const state=()=>({status:'live',workAdmission:{allowed:true},hostTools:host.snapshot('s11-session')});
 return {host,peer,sent,wire,state,dispose:()=>{host.dispose();catalog.dispose();peer.close()}};
}

describe('S11 host observation in the webui session area',()=>{
 it('renders validated official projection visual rows inside the existing conversation row consumer',()=>{
 render(React.createElement(ZCodeRowsList,{state:{snapshot:lifecycle.projection.frame.payload.snapshot},controller:{}}));expect(screen.getByTestId('zcode-host-tool-image')).not.toBeNull();expect(screen.getAllByTestId('zcode-host-tool-result')).toHaveLength(2);expect(screen.getByText('Fixture denied')).not.toBeNull();expect(screen.getByText(/artifact carrier unverified/)).not.toBeNull();
 });
 it('renders official node_repl app/screenshot and CUA denial metadata; artifact-only media stays gated',()=>{
 const first=render(React.createElement(ZCodeHostToolResult,{row:{display:{kind:'node_repl_images',images:[{mimeType:'image/png',base64:lifecycle.results.screenshot.image.base64}],app:{appKey:'fixture-app',displayName:'Fixture App'}}}}));expect(screen.getByTestId('zcode-host-tool-result').textContent).toContain('Fixture App');expect(screen.getByTestId('zcode-host-tool-image')).not.toBeNull();
 first.rerender(React.createElement(ZCodeHostToolResult,{row:{output:{text:'Denied',display:{kind:'cua',schemaVersion:1,toolName:'request_access',status:'failed',errorCode:'permission_denied',suggestedAction:'Use official helper onboarding',permissionStatus:lifecycle.notifications.permission.params.permissionStatus,media:[{mimeType:'image/png',artifactUri:'fixture-only://screenshot'}]}}}}));expect(screen.getByRole('alert').textContent).toContain('permission_denied');expect(screen.getByTestId('zcode-host-tool-result').textContent).toContain('accessibility denied');expect(screen.queryByTestId('zcode-host-tool-image')).toBeNull();expect(screen.getByText(/artifact carrier unverified/)).not.toBeNull();
 });

 it('shows a truthful gated empty state and never offers an execute/success control',async()=>{
 const f=fixture();try{render(React.createElement(ZCodeHostToolsPanel,{state:f.state(),controller:{}}));expect(screen.getByTestId('zcode-browser-host-state').textContent).toContain('gated');expect(screen.getByTestId('zcode-computer-host-state').textContent).toContain('permissions: unknown');expect(screen.getByTestId('zcode-host-tools-empty')).not.toBeNull();expect(screen.queryByText('Execute')).toBeNull();expect(screen.queryByText('available')).toBeNull()}finally{f.dispose()}
 });
 it('shows the same-id official fallback reason and discovery empty result',async()=>{
 const f=fixture();try{f.wire(lifecycle.requests.list);f.wire(lifecycle.requests.execute);await tick();render(React.createElement(ZCodeHostToolsPanel,{state:f.state(),controller:{}}));expect(screen.getByText('Discovered backends: none')).not.toBeNull();expect(screen.getAllByTestId('zcode-host-response')[1].textContent).toContain('backend_unavailable');expect(screen.getAllByTestId('zcode-host-response')[1].textContent).toContain('side effects: none');expect(screen.getByTestId('zcode-browser-host-state').textContent).toContain('gated')}finally{f.dispose()}
 });
 it('displays validated screenshot/actual target metadata without claiming execution verification',async()=>{
 const f=fixture({execute:async()=>lifecycle.results.screenshot});try{f.wire(lifecycle.requests.execute);await tick();render(React.createElement(ZCodeHostToolsPanel,{state:f.state(),controller:{}}));expect(screen.getByTestId('zcode-host-target').textContent).toContain('iab:fixture/7');expect(screen.getByTestId('zcode-host-target').textContent).toContain('tab-fixture');expect(screen.getByTestId('zcode-host-image').getAttribute('src')).toMatch(/^data:image\/png;base64,/);expect(screen.getByTestId('zcode-browser-host-state').textContent).toContain('executor-verification-required')}finally{f.dispose()}
 });
 it('shows B05 uncertain timeout and never replaces it with a late screenshot',async()=>{
 let resolve:any;const f=fixture({execute:()=>new Promise(r=>resolve=r)},20);try{f.wire(lifecycle.requests.execute);await new Promise(r=>setTimeout(r,40));const view=render(React.createElement(ZCodeHostToolsPanel,{state:f.state(),controller:{}}));expect(screen.getByTestId('zcode-host-response').textContent).toContain('outcome-unknown');expect(screen.getByRole('alert').textContent).toContain('will not be retried');resolve(lifecycle.results.screenshot);await tick();view.rerender(React.createElement(ZCodeHostToolsPanel,{state:f.state(),controller:{}}));expect(screen.queryByTestId('zcode-host-image')).toBeNull();expect(f.sent.length).toBe(1)}finally{f.dispose()}
 });
 it('displays CUA official marker, separate permissions and an unclassified operation envelope',async()=>{
 const f=fixture();try{Object.values(lifecycle.notifications).forEach(f.wire);await tick();render(React.createElement(ZCodeHostToolsPanel,{state:f.state(),controller:{}}));expect(screen.getByTestId('zcode-host-permissions').textContent).toContain('accessibility denied');expect(screen.getByTestId('zcode-host-permissions').textContent).toContain('screen recording unknown');expect(screen.getAllByTestId('zcode-host-computer-event')[0].textContent).toContain('Computer Use marked');expect(screen.getAllByTestId('zcode-host-computer-event')[1].textContent).toContain('not classified');expect(screen.getByTestId('zcode-computer-host-state').textContent).toContain('gated')}finally{f.dispose()}
 });
 it('fetches real registration on demand and does not reuse stale values after a failed read',async()=>{
 const f=fixture();try{const controller={hostRegistration:vi.fn().mockResolvedValueOnce({plugins:[{id:'browser-use@zcode-plugins-official',enabled:true,hostMcpServerNames:['node_repl'],mcpServerNames:[]}],mcpStatuses:{}}).mockRejectedValueOnce(Object.assign(new Error('request-timeout'),{code:'request-timeout'}))};render(React.createElement(ZCodeHostToolsPanel,{state:f.state(),controller}));await act(async()=>{fireEvent.click(screen.getByTestId('zcode-host-registration-refresh'));await tick()});expect(screen.getByTestId('zcode-host-registration').textContent).toContain('enabled: true');expect(screen.getByTestId('zcode-browser-host-state').textContent).toContain('gated');await act(async()=>{fireEvent.click(screen.getByTestId('zcode-host-registration-refresh'));await tick()});expect(screen.queryByTestId('zcode-host-registration')).toBeNull();expect(screen.getByRole('alert').textContent).toContain('request-timeout')}finally{f.dispose()}
 });
 it('aborts a departing view read and fences its late result from a replacement controller',async()=>{
 const f=fixture();try{let resolve:any,signal:any;const first={hostRegistration:vi.fn(({signal:s})=>{signal=s;return new Promise(r=>resolve=r)})};const second={hostRegistration:vi.fn().mockResolvedValue({plugins:[],mcpStatuses:{}})};const view=render(React.createElement(ZCodeHostToolsPanel,{state:f.state(),controller:first}));await act(async()=>{fireEvent.click(screen.getByTestId('zcode-host-registration-refresh'));await tick()});view.rerender(React.createElement(ZCodeHostToolsPanel,{state:f.state(),controller:second}));expect(signal.aborted).toBe(true);await act(async()=>{resolve({plugins:[{id:'stale',enabled:true,hostMcpServerNames:[],mcpServerNames:[]}],mcpStatuses:{}});await tick();fireEvent.click(screen.getByTestId('zcode-host-registration-refresh'));await tick()});expect(screen.queryByText('stale')).toBeNull();expect(second.hostRegistration).toHaveBeenCalledTimes(1)}finally{f.dispose()}
 });
 it('gates registration while observation/projection is unconfirmed',()=>{
 const controller={hostRegistration:vi.fn()};render(React.createElement(ZCodeHostToolsPanel,{state:{status:'idle',workAdmission:{allowed:false}},controller}));fireEvent.click(screen.getByTestId('zcode-host-registration-refresh'));expect(controller.hostRegistration).not.toHaveBeenCalled();expect(screen.getByTestId('zcode-host-registration-refresh').hasAttribute('disabled')).toBe(true);
 });
 it('remote consumer calls the scoped host registration endpoint without UI executor/workspace fields',async()=>{
 const rpc={call:vi.fn().mockResolvedValue({ok:true,value:{handle:'fixture-handle',state:{status:'live',commands:[]}}})};const address={runtime:'zcode',authority:'test',workspace:workspace.workspacePath,sessionId:'s11-session'};const remote=new RemoteConversation(rpc,address);try{await remote.connect();rpc.call.mockResolvedValue({ok:true,value:{plugins:[],mcpStatuses:{}}});await remote.hostRegistration();expect(rpc.call.mock.calls.at(-1)?.slice(0,3)).toEqual(['/zcode-bridge','conversation',{operation:'hostRegistration',handle:'fixture-handle'}])}finally{rpc.call.mockResolvedValue({ok:true,value:{released:true}});await remote.cancel()}
 });
 it('renders the real official headless registration and empty host observation through the S03.B seam, 0 models',async()=>{
 const path=await realpath(await mkdtemp(join(tmpdir(),'zcode-s11-oracle-'))),home=await mkdtemp(join(tmpdir(),'zcode-s11-home-'));
 let child:any,exited:any,peer:any,catalog:any,host:any,conversation:any;
 try{
 const installation=await inspectInstallation('/Applications/ZCode.app');expect(installation.sha256).toBe(official.provenance.sha256);expect(installation.verified).toBe(true);
 child=spawn(installation.launcher,[installation.cjs,'app-server','--stdio'],{cwd:path,env:{...runtimeEnv(installation.providerConfig),HOME:home},stdio:['pipe','pipe','pipe']});exited=new Promise(r=>child.once('close',r));child.stderr.on('data',()=>{});peer=new ProtocolPeer(child.stdout,child.stdin,{timeoutMs:15000});
 const ws={workspacePath:path,workspaceKey:path};catalog=new CatalogClient(peer,{workspace:ws});host=new HostTools(peer,{workspace:ws,catalog});
 const created=await peer.request('v4/command',{commandId:randomUUID(),clientId:'s11-oracle',sessionId:null,type:'createSession',payload:{workspaceId:path},issuedAt:Date.now()});const sessionId=created.result?.sessionId??created.ack?.result?.sessionId;expect(sessionId).toBeTruthy();
 conversation=new V4Conversation(peer,{address:{runtime:'zcode',authority:'s11-oracle',workspace:path,sessionId},workspace:ws,clientId:'s11-oracle',connectionId:'s11-oracle',hostTools:host});await conversation.connect();for(let i=0;i<300&&conversation.state.status!=='live';i++)await tick();expect(conversation.state.status).toBe('live');expect(conversation.state.admission.allowed).toBe(false);
 await act(async()=>{render(React.createElement(ZCodeConversationView,{conversation}))});
 await act(async()=>{fireEvent.click(screen.getByTestId('zcode-host-registration-refresh'))});
 await waitFor(()=>expect(screen.getByTestId('zcode-host-registration')).not.toBeNull(),{timeout:5000});expect(screen.getByTestId('zcode-host-registration').textContent).toContain('browser-use@zcode-plugins-official');expect(screen.getByTestId('zcode-host-tools-empty')).not.toBeNull();expect(screen.getByTestId('zcode-browser-host-state').textContent).toContain('gated');expect(screen.getByTestId('zcode-computer-host-state').textContent).toContain('gated');
 }finally{cleanup();await conversation?.cancel();host?.dispose();catalog?.dispose();peer?.close();if(child)await stopOwned(child,exited);await rm(path,{recursive:true,force:true});await rm(home,{recursive:true,force:true})}
 });
});
