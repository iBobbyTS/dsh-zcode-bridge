// Real headless browser render of explicitly injected history, never a live/GUI runtime oracle.
import { build } from 'esbuild';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const {chromium}=createRequire(resolve('../dsh/apps/web/package.json'))('playwright');
const dir=await mkdtemp(join(tmpdir(),'history-visual-'));
let browser;
try {
  const fixture=JSON.parse(await readFile('tests/fixtures/history-management/success.json','utf8'));
  const result=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {ZCodeConversationView} from '${resolve('packages/client/conversation-view.jsx')}';
const listeners=new Set();let state={status:'live',snapshot:${JSON.stringify(fixture.initial.frame.payload.snapshot)},commands:[],profile:'replayable',admission:{allowed:false,reason:'runtime-restricted'},managementAdmission:{allowed:true},attachmentAdmission:{allowed:true}};
const c={address:{runtime:'zcode',authority:'visual-history',workspace:'/fixture/workspace',sessionId:'fixture-session'},get state(){return state},subscribe:f=>{listeners.add(f);return()=>listeners.delete(f)},submit:async x=>({type:x.type,state:'failed',ack:{reasonCode:'fixture-only'}}),historyQuery:async x=>({...x,result:${JSON.stringify(fixture.preview)}})};
createRoot(document.getElementById('root')).render(React.createElement(ZCodeConversationView,{conversation:c}));`,loader:'jsx',resolveDir:process.cwd()},bundle:true,format:'iife',platform:'browser',write:false});
  await writeFile(join(dir,'render.html'),`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body,#root{margin:0;height:100%;width:100%;font-family:system-ui}button,textarea,select{max-width:100%}pre{overflow:auto}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`);
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const checks=[];
  for(const [name,width,height] of [['wide',1100,900],['narrow',390,844]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('file://'+join(dir,'render.html'));await page.getByText('History, branches and workspace files').click();
    await page.getByTestId('zcode-history-4').getByText('Preview file rewind').click();await page.getByTestId('zcode-rewind-preview').waitFor();await page.getByTestId('zcode-rewind-preview').scrollIntoViewIfNeeded();
    await page.screenshot({path:`docs/probes/checks/history-management-${name}.png`,fullPage:true});
    const dimensions=await page.evaluate(()=>({horizontalOverflow:document.documentElement.scrollWidth>innerWidth,bodyOverflow:document.documentElement.scrollHeight>innerHeight,historyScrollable:(()=>{const e=document.querySelector('[data-testid="zcode-history-controls"]');return e.scrollHeight>e.clientHeight})()}));
    checks.push({name,width,errors,...dimensions});await page.close();
  }
  await writeFile('docs/probes/checks/history-management-visual.json',JSON.stringify({kind:'injected-visual-fixture',notLiveRuntime:true,checks},null,2)+'\n');
  console.log(JSON.stringify(checks));if(checks.some(c=>c.errors.length||c.horizontalOverflow||c.bodyOverflow))process.exitCode=1;
}finally{await browser?.close();await rm(dir,{recursive:true,force:true});}
