// Regression test for CB13-1: the official create_workflow causality graph contains
// phases + participants + handoffs. Phase edges (phaseEdges) and participant handoffs
// (handoffs) are separate official edge sources; when both are present both must render
// (SVG arrows and text lists) with distinct styles. A handoff must never silently vanish
// just because phases exist.

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {toolCallCreateWorkflowDisplaySchema} from '../packages/host/vendor/zcode/v4.mjs';

const repo=process.cwd();
const require=createRequire(pathToFileURL(resolve(repo,'package.json')));
const {buildSync}=require('esbuild');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

const code=buildSync({entryPoints:[resolve(repo,'packages/client/workflow-view.jsx')],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text;
const mod={exports:{}};
vm.runInThisContext('(function(require,module,exports){'+code+'\n})')(require,mod,mod.exports);
const {ZCodeWorkflowGraph}=mod.exports;

const count=(html,re)=>[...html.matchAll(re)].length;
// Every synthetic projection is admitted by the official schema before rendering, so the
// test asserts against an official-valid graph rather than a hand-shaped payload.
const official=graph=>toolCallCreateWorkflowDisplaySchema.parse({kind:'create_workflow',ok:true,errorCount:0,diagnostics:[],causalityGraph:graph});
const render=display=>renderToStaticMarkup(React.createElement(ZCodeWorkflowGraph,{display}));

test('CB13-1: single-phase dual-actor handoff renders a handoff edge and its artifact type',()=>{
  const display=official({
    steps:[{id:'ask#1',kind:'ask',label:'Research',lane:'actor#1',phase:'p1'},{id:'ask#2',kind:'ask',label:'Review',lane:'actor#2',phase:'p1'}],
    lanes:[{id:'actor#1',name:'Researcher'},{id:'actor#2',name:'Reviewer'}],
    participants:[{id:'a1',phase:'p1',lane:'actor#1',steps:['ask#1']},{id:'a2',phase:'p1',lane:'actor#2',steps:['ask#2']}],
    handoffs:[{from:'a1',to:'a2',types:['markdown']}],
    phases:[{id:'p1',name:'Solo'}],
  });
  const html=render(display);
  assert.match(html,/data-testid="zcode-workflow-handoffs"/);
  assert.match(html,/handoff · Researcher → Reviewer · markdown/);
  assert.equal(count(html,/<path[^>]*data-edge="handoff"/g),1,'official a1→a2 handoff arrow must render');
  assert.equal(count(html,/<path[^>]*data-edge="phase"/g),0,'no phase edge was projected');
  assert.match(html,/purple dashed arrow · participant handoff/,'legend must explain the handoff style');
  assert.doesNotMatch(html,/zcode-workflow-phase-edges/,'empty phase edge list must not be fabricated');
});

test('CB13-1: phases and handoffs coexist and both render with distinct styles',()=>{
  const fixture=JSON.parse(readFileSync(resolve(repo,'tests/fixtures/workflow-management/lifecycle.json'),'utf8'));
  const display=toolCallCreateWorkflowDisplaySchema.parse(fixture.display);
  const graph=display.causalityGraph;
  const html=render(display);
  assert.equal(count(html,/<path[^>]*data-edge="phase"/g),graph.phaseEdges.length,'every official phase edge arrow renders');
  assert.equal(count(html,/<path[^>]*data-edge="handoff"/g),graph.handoffs.length,'every official handoff arrow renders');
  const phaseList=html.match(/data-testid="zcode-workflow-phase-edges"[\s\S]*?<\/ul>/)[0];
  assert.equal(count(phaseList,/<li>/g),graph.phaseEdges.length);
  const handoffList=html.match(/data-testid="zcode-workflow-handoffs"[\s\S]*?<\/ul>/)[0];
  assert.equal(count(handoffList,/<li>/g),graph.handoffs.length);
  assert.match(handoffList,/handoff · Researcher → Reviewer · markdown/,'handoff type must survive alongside phases');
  assert.match(html,/stroke="#7c3aed"[^>]*stroke-dasharray="6 3"/,'handoff edges use a distinct dashed purple style');
  assert.match(html,/<path[^>]*data-edge="phase"[^>]*stroke="currentColor"/,'phase edges keep the solid default style');
});

test('CB13-1: a pure-phases graph still renders phase edges and no handoff section',()=>{
  const display=official({steps:[],lanes:[],participants:[],handoffs:[],phases:[{id:'phase-1',name:'Start'},{id:'phase-2',name:'End'}],phaseEdges:[{from:'phase-1',to:'phase-2'}],exits:['phase-2']});
  const html=render(display);
  assert.equal(count(html,/<path[^>]*data-edge="phase"/g),1);
  assert.equal(count(html,/<path[^>]*data-edge="handoff"/g),0);
  assert.match(html,/data-testid="zcode-workflow-phase-edges"/);
  assert.match(html,/phase · Start → End/);
  assert.doesNotMatch(html,/zcode-workflow-handoffs/);
});

test('CB13-1: a pure-handoffs graph still renders handoffs and no phase edge section',()=>{
  const display=official({
    steps:[{id:'ask#1',kind:'ask',label:'Ask',lane:'actor#1'},{id:'ask#2',kind:'ask',label:'Reply',lane:'actor#2'}],
    lanes:[{id:'actor#1',name:'Alpha'},{id:'actor#2',name:'Beta'}],
    participants:[{id:'a1',phase:'phase-1',lane:'actor#1',steps:['ask#1']},{id:'a2',phase:'phase-2',lane:'actor#2',steps:['ask#2']}],
    handoffs:[{from:'a1',to:'a2',types:['json']}],
  });
  const html=render(display);
  assert.equal(count(html,/<path[^>]*data-edge="handoff"/g),1);
  assert.equal(count(html,/<path[^>]*data-edge="phase"/g),0);
  assert.match(html,/handoff · Alpha → Beta · json/);
  assert.doesNotMatch(html,/zcode-workflow-phase-edges/);
});
