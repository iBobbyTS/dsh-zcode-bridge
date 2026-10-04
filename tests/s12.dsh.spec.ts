import {describe,it,expect,vi,afterEach} from 'vitest';
import React from 'react';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {ZCodeWorkflowPanel,ZCodeWorkflowGraph} from '../packages/client/workflow-view.jsx';
import {ConversationController} from '../packages/client/conversation-view.jsx';
const fixture=JSON.parse(readFileSync('tests/fixtures/s12/lifecycle.json','utf8'));
const empty=JSON.parse(readFileSync('tests/fixtures/s12/empty.json','utf8'));
const official=JSON.parse(readFileSync('tests/fixtures/s12/official.json','utf8'));
afterEach(cleanup);
const tick=()=>new Promise(r=>setTimeout(r,5));
function setup({runs=[] as any[],readResult=empty.artifacts,manageResult=empty.directory}={}){
 const controller={workflowManage:vi.fn(async()=>manageResult),workflowRead:vi.fn(async()=>readResult),submitWorkflowCommand:vi.fn(async()=>({state:'outcome-unknown'}))};
 const state={status:'live',admission:{allowed:false,reason:'runtime-restricted'},workAdmission:{allowed:true},workflowAdmission:{reads:{allowed:true},writes:{allowed:true}},snapshot:{workflowRuns:{runs},rows:{window:[] as any[]}}};
 return {controller,state};
}
async function click(name:string){await act(async()=>{fireEvent.click(screen.getByRole('button',{name,exact:true}));await tick()})}
describe('S12 workflow session UI',()=>{
 it('renders captured official empty state and keeps save/run/resume gated',async()=>{
  const f=setup();render(React.createElement(ZCodeWorkflowPanel,f));expect(screen.getByTestId('zcode-workflow-gate').textContent).toContain('entitlement unknown');
  await click('List project workflows');expect(screen.getByText('No saved project workflow.')).toBeTruthy();expect(screen.getByTestId('zcode-workflow-empty')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Save new definition · unavailable'}).hasAttribute('disabled')).toBe(true);
  expect(official.productionOracle.startSavedWorkflow).toEqual({gated:'runtime-restricted'});
 });
 it('isolates global/project same names, opens formal script and saves metadata only',async()=>{
  const f=setup({manageResult:fixture.directory});f.controller.workflowManage.mockImplementation(async(kind:any,params:any)=>kind==='list'?{...fixture.directory,workflows:fixture.directory.workflows.filter((w:any)=>w.scope===params.scope)}:kind==='get'?{...fixture.definition,scope:params.scope}:{ok:true,path:'/fixture/saved'});
  render(React.createElement(ZCodeWorkflowPanel,f));await click('List project workflows');await click('review · project');await click('Open official definition');
  expect(screen.getByText(fixture.definition.script)).toBeTruthy();fireEvent.change(screen.getByRole('textbox',{name:'Description'}),{target:{value:'Edited metadata'}});await click('Save metadata');
  expect(f.controller.workflowManage).toHaveBeenCalledWith('updateMeta',{name:'review',scope:'project',meta:{description:'Edited metadata'}},expect.anything());
  await act(async()=>{fireEvent.change(screen.getByRole('combobox',{name:'Definition scope'}),{target:{value:'global'}})});expect(screen.queryByTestId('zcode-workflow-saved')).toBeNull();await click('List global workflows');await click('review · global');await click('Open official definition');
  expect(f.controller.workflowManage).toHaveBeenCalledWith('get',{name:'review',scope:'global'},expect.anything());expect(screen.getByRole('button',{name:'Run · gated'}).hasAttribute('disabled')).toBe(true);
 });
 it('surfaces stale identity official rejection and removes the old definition on reread failure',async()=>{
  const f=setup({manageResult:fixture.directory});f.controller.workflowManage.mockResolvedValueOnce(fixture.directory).mockResolvedValueOnce(fixture.definition).mockResolvedValueOnce({ok:false,reason:'not_found'});
  render(React.createElement(ZCodeWorkflowPanel,f));await click('List project workflows');await click('review · project');await click('Open official definition');expect(screen.getByText(fixture.definition.script)).toBeTruthy();await click('Open official definition');expect(screen.getByRole('alert').textContent).toContain('not_found');expect(screen.queryByText(fixture.definition.script)).toBeNull();
 });
 it('shows authoritative phases/actor ownership, incomplete graph, and published artifact text separately from engine return',async()=>{
  const f=setup({runs:[fixture.completed],readResult:fixture.artifacts});f.state.snapshot.rows.window=[{workflowLaunch:{runId:'fixture-run',display:fixture.display}}];
  f.controller.workflowRead.mockImplementation(async(kind:any)=>kind==='runArtifacts'?fixture.artifacts:fixture.content);
  render(React.createElement(ZCodeWorkflowPanel,f));await click('fixture-run · completed');expect(screen.getByTestId('zcode-workflow-graph')).toBeTruthy();expect(screen.getByText(/Engine return preview/).textContent).toContain('engine return only');expect(screen.getByText(/Official graph truncated/)).toBeTruthy();expect(screen.getByText(/Actor Researcher/).textContent).toContain('fixture-child-1');
  await click('Read published artifacts');expect(screen.getByTestId('zcode-workflow-artifact')).toBeTruthy();await click('Read content chunk');expect(screen.getByText('hello report')).toBeTruthy();expect(f.controller.workflowRead).toHaveBeenLastCalledWith('runArtifactRead',{runId:'fixture-run',artifactId:'report',version:1,offset:0,limit:65536},expect.anything());
 });
 it('cancel ACK uncertainty remains visible without fabricating a run outcome',async()=>{
  const f=setup({runs:[fixture.running]});render(React.createElement(ZCodeWorkflowPanel,f));await click('fixture-run · running');await click('Cancel official run');expect(f.controller.submitWorkflowCommand).toHaveBeenCalledWith({type:'cancelBackgroundWork',payload:{workId:'fixture-run'}},expect.anything());expect(screen.getByText(/Cancel outcome-unknown/)).toBeTruthy();expect(screen.getByRole('heading',{name:'fixture-run · running'})).toBeTruthy();
 });
 it('stopped resumability comes from official field, while failed nodes and gates remain honest',async()=>{
  const f=setup({runs:[fixture.stopped,fixture.errored]});render(React.createElement(ZCodeWorkflowPanel,f));await click('fixture-run · stopped');expect(screen.getByText(/Resume: officially resumable/)).toBeTruthy();expect(screen.getByRole('button',{name:'Resume · gated'}).hasAttribute('disabled')).toBe(true);await click('fixture-errored · errored');expect(screen.getByText(/not confirmed resumable/)).toBeTruthy();expect(screen.getByText(/Script failed/)).toBeTruthy();
 });
 it('reads workspace nodes by exact site/ordinal and displays truncated node result',async()=>{
  const f=setup({runs:[fixture.running]});f.controller.workflowRead.mockImplementation(async(kind:any)=>kind==='runWorkspace'?fixture.workspace:fixture.nodeResult);
  render(React.createElement(ZCodeWorkflowPanel,f));await click('fixture-run · running');await click('Read run workspace');expect(screen.getByText('Workspace list truncated.')).toBeTruthy();await click('Read node result');expect(f.controller.workflowRead).toHaveBeenLastCalledWith('runNodeResult',{runId:'fixture-run',siteId:'read#1',ordinal:0},expect.anything());expect(screen.getByText(/Node completed · 100000 bytes · truncated/)).toBeTruthy();expect(screen.getByText(fixture.nodeResult.result)).toBeTruthy();
 });
 it('unknown journal events are fail-safe, paginated reads use journal sequence',async()=>{
  const f=setup({runs:[fixture.running],readResult:fixture.events});render(React.createElement(ZCodeWorkflowPanel,f));await click('fixture-run · running');await click('Read event page');expect(screen.getByText(/unknown event type · detail unavailable/)).toBeTruthy();await click('Select next event page');await click('Read event page');expect(f.controller.workflowRead).toHaveBeenLastCalledWith('runEvents',{runId:'fixture-run',afterSequence:2,limit:100},expect.anything());
 });
 it('late directory reply after scope change is discarded',async()=>{
  let resolve:any;const f=setup();f.controller.workflowManage.mockImplementation(()=>new Promise(r=>{resolve=r}));render(React.createElement(ZCodeWorkflowPanel,f));await click('List project workflows');await act(async()=>{fireEvent.change(screen.getByRole('combobox',{name:'Definition scope'}),{target:{value:'global'}});resolve(fixture.directory);await tick()});expect(screen.queryByRole('button',{name:'review · project'})).toBeNull();
 });
 it('owner replacement fences artifact read and prevents stale content in successor run',async()=>{
  const f=setup({runs:[fixture.completed,fixture.successor]});let resolve:any;f.controller.workflowRead.mockResolvedValueOnce(fixture.artifacts).mockImplementationOnce(()=>new Promise(r=>{resolve=r}));render(React.createElement(ZCodeWorkflowPanel,f));await click('fixture-run · completed');await click('Read published artifacts');await click('Read content chunk');await click('fixture-successor · running');await act(async()=>{resolve(fixture.content);await tick()});expect(screen.queryByText('hello report')).toBeNull();expect(screen.getByText(/resumed from fixture-run/)).toBeTruthy();
 });
 it('read errors clear old artifacts, cross-run unauthorized refusal is visible',async()=>{
  const f=setup({runs:[fixture.running]});f.controller.workflowRead.mockResolvedValueOnce(fixture.artifacts).mockRejectedValueOnce(Object.assign(new Error('runtime-rejected'),{code:'runtime-rejected'}));render(React.createElement(ZCodeWorkflowPanel,f));await click('fixture-run · running');await click('Read published artifacts');expect(screen.getByTestId('zcode-workflow-artifact')).toBeTruthy();await click('Read published artifacts');expect(screen.queryByTestId('zcode-workflow-artifact')).toBeNull();expect(screen.getByRole('alert').textContent).toContain('runtime-rejected');
 });
 it('controller forwards official workflow methods and execution command options',async()=>{
  const conversation={state:{status:'live'},workflowRead:vi.fn(),workflowManage:vi.fn(),submit:vi.fn()};const c=new ConversationController(conversation);const opts={signal:new AbortController().signal};c.workflowRead('runs',{},opts);c.workflowManage('list',{scope:'global'},opts);c.submitWorkflowCommand({type:'resumeWorkflowRun',payload:{workId:'r'}},opts);expect(conversation.workflowManage).toHaveBeenCalledWith('list',{scope:'global'},opts);expect(conversation.submit).toHaveBeenCalledWith({type:'resumeWorkflowRun',payload:{workId:'r'}},opts);c.dispose();expect(()=>c.workflowRead('runs',{})).toThrow('disposed');
 });
 it('published data pages preserve cursor and visibly remain partial',async()=>{
  const f=setup({runs:[fixture.running]});f.controller.workflowRead.mockImplementation(async(kind:any)=>kind==='runArtifacts'?{artifacts:[fixture.artifactKinds.table]}:fixture.data);render(React.createElement(ZCodeWorkflowPanel,f));await click('fixture-run · running');await click('Read published artifacts');await click('Read published data page');expect(screen.getByRole('columnheader',{name:'score'})).toBeTruthy();expect(screen.getByText('Partial data page · more available')).toBeTruthy();await click('Select next data page');await click('Read published data page');expect(f.controller.workflowRead).toHaveBeenLastCalledWith('runArtifactData',{runId:'fixture-run',artifactId:'table',afterSequence:2,limit:100},expect.anything());
 });
 it('binary file previews and workspace navigation remain unavailable',async()=>{
  const f=setup({runs:[fixture.running]});f.controller.workflowRead.mockImplementation(async(kind:any)=>kind==='runArtifacts'?{artifacts:[fixture.artifactKinds.file]}:{...fixture.content,mediaType:'application/octet-stream'});render(React.createElement(ZCodeWorkflowPanel,f));await click('fixture-run · running');await click('Read published artifacts');expect(screen.getByText(/workspace navigation carrier unverified/)).toBeTruthy();await click('Read content chunk');expect(screen.getByText(/Binary content read · preview unavailable/)).toBeTruthy();expect(screen.queryByText('hello report')).toBeNull();
 });
 it('graph absent/unknown displays remain unavailable and do not analyze saved scripts',()=>{
  render(React.createElement(ZCodeWorkflowGraph,{display:{kind:'future-graph',script:'anything'}}));expect(screen.queryByRole('img')).toBeNull();expect(screen.getByText(/Graph unavailable/)).toBeTruthy();
 });
 it('CB13-1: coexisting phase edges and participant handoffs both render, and a lone handoff survives phases',()=>{
  const graph=fixture.display.causalityGraph;const view=render(React.createElement(ZCodeWorkflowGraph,{display:fixture.display}));
  expect(view.container.querySelectorAll('path[data-edge="phase"]').length).toBe(graph.phaseEdges.length);
  expect(view.container.querySelectorAll('path[data-edge="handoff"]').length).toBe(graph.handoffs.length);
  expect(screen.getByTestId('zcode-workflow-handoffs').textContent).toContain('handoff · Researcher → Reviewer · markdown');
  expect(screen.getByTestId('zcode-workflow-graph-legend').textContent).toContain('participant handoff');
  cleanup();
  const single={kind:'create_workflow',ok:true,errorCount:0,diagnostics:[],causalityGraph:{steps:[{id:'ask#1',kind:'ask',label:'Research',lane:'actor#1',phase:'p1'},{id:'ask#2',kind:'ask',label:'Review',lane:'actor#2',phase:'p1'}],lanes:[{id:'actor#1',name:'Researcher'},{id:'actor#2',name:'Reviewer'}],participants:[{id:'a1',phase:'p1',lane:'actor#1',steps:['ask#1']},{id:'a2',phase:'p1',lane:'actor#2',steps:['ask#2']}],handoffs:[{from:'a1',to:'a2',types:['markdown']}],phases:[{id:'p1',name:'Solo'}]}};
  const one=render(React.createElement(ZCodeWorkflowGraph,{display:single}));
  expect(one.container.querySelectorAll('path[data-edge="handoff"]').length).toBe(1);
  expect(one.container.querySelector('path[data-edge="handoff"]').getAttribute('stroke-dasharray')).toBe('6 3');
  expect(screen.getByTestId('zcode-workflow-handoffs').textContent).toContain('markdown');
  expect(screen.queryByTestId('zcode-workflow-phase-edges')).toBeNull();
 });
});
