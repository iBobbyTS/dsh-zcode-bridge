// Isolated webui render. Synthetic lifecycle is labelled; no workflow is executed.
import {build} from 'esbuild';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const {chromium}=createRequire(resolve('../dsh/apps/web/package.json'))('playwright');
const dir=await mkdtemp(join(tmpdir(),'s12-visual-'));let browser;
try{
 const fixture=JSON.parse(await readFile('tests/fixtures/s12/lifecycle.json','utf8'));
 const official=JSON.parse(await readFile('tests/fixtures/s12/official.json','utf8'));
 const result=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {ZCodeWorkflowPanel} from '${resolve('packages/client/workflow-view.jsx')}';
 const fixture=${JSON.stringify(fixture)},official=${JSON.stringify(official)};
 const state={status:'live',admission:{allowed:false},workAdmission:{allowed:true},workflowAdmission:{reads:{allowed:true},writes:{allowed:true}},snapshot:{workflowRuns:{runs:[fixture.completed]},rows:{window:[{workflowLaunch:{runId:'fixture-run',display:fixture.display}}]}}};
 const controller={workflowManage:async(kind,params)=>kind==='list'?official.productionOracle.listproject:fixture.definition,workflowRead:async(kind)=>kind==='runArtifacts'?fixture.artifacts:kind==='runArtifactRead'?fixture.content:kind==='runWorkspace'?fixture.workspace:fixture.events,submitWorkflowCommand:async()=>({state:'outcome-unknown'})};
 createRoot(document.getElementById('root')).render(React.createElement(ZCodeWorkflowPanel,{state,controller}));`,loader:'jsx',resolveDir:process.cwd()},bundle:true,format:'iife',platform:'browser',write:false});
 await writeFile(join(dir,'render.html'),`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body,#root{margin:0;width:100%;font-family:system-ui}button{max-width:100%}p,pre{overflow-wrap:anywhere}td{padding:6px}</style><p style="padding:0 16px">S12 injected fixture preview · real empty directory · no model calls</p><div id="root"></div><script>${result.outputFiles[0].text}</script>`);
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const checks=[];
 for(const [name,width,height] of [['wide',1100,1000],['narrow',390,844]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+join(dir,'render.html'));await page.locator('summary').first().click();await page.getByRole('button',{name:'List project workflows',exact:true}).click();await page.getByText('No saved project workflow.').waitFor();await page.getByRole('button',{name:'fixture-run · completed',exact:true}).click();await page.getByRole('button',{name:'Read published artifacts',exact:true}).click();await page.getByTestId('zcode-workflow-artifact').waitFor();await page.getByRole('button',{name:'Read content chunk',exact:true}).click();await page.getByText('hello report',{exact:true}).waitFor();await page.screenshot({path:`docs/probes/checks/s12-${name}.png`,fullPage:true});
 const dimensions=await page.evaluate(()=>({horizontalOverflow:document.documentElement.scrollWidth>innerWidth}));checks.push({name,width,errors,...dimensions});await page.close();
 }
 await writeFile('docs/probes/checks/s12-visual.json',JSON.stringify({kind:'injected-lifecycle-with-real-empty-directory',noLiveExecution:true,checks},null,2)+'\n');console.log(JSON.stringify(checks));if(checks.some(c=>c.errors.length||c.horizontalOverflow))process.exitCode=1;
}finally{await browser?.close();await rm(dir,{recursive:true,force:true})}
