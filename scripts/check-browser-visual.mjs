// Isolated browser renders of real empty observation + explicitly injected reply/timeout fixtures.
// This verifies the webui presentation, never official browser/CUA execution.
import { build } from 'esbuild';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const {chromium}=createRequire(resolve('../dsh/apps/web/package.json'))('playwright');
const dir=await mkdtemp(join(tmpdir(),'browser-visual-'));let browser;
try{
 const fixture=JSON.parse(await readFile('tests/fixtures/browser-computer-use/lifecycle.json','utf8'));
 const official=JSON.parse(await readFile('tests/fixtures/browser-computer-use/empty.json','utf8'));
 const host={observation:{allowed:true},browser:{state:'gated',reason:'official-browser-executor-missing'},computer:{state:'gated',reason:'official-cua-helper-connection-unverified'},records:[{id:'fixture-reply',requestId:'fixture-only',sessionId:'browser-session',kind:'browser',method:'screenshot',browserId:'iab:fixture',browserGeneration:7,status:'responded',result:fixture.results.screenshot},{id:'fixture-timeout',requestId:'fixture-timeout',sessionId:'browser-session',kind:'browser',method:'navigate',browserId:'iab:fixture',browserGeneration:7,status:'outcome-unknown',reason:'Host callback timed out',sideEffect:'uncertain'},{id:'fixture-permission',kind:'computer-permission',event:fixture.notifications.permission.params}]};
 const registration={plugins:official.plugins.plugins.filter(p=>/browser-use|node-repl-host|zcode-cua/.test(p.id)).map(p=>({id:p.id,enabled:p.enabled,hostMcpServerNames:p.hostMcpServerNames??[],mcpServerNames:p.mcpServerNames??[]})),mcpStatuses:official.mcpStatus.statuses};
 const result=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {ZCodeHostToolsPanel} from '${resolve('packages/client/host-tools-view.jsx')}';
const state={status:'live',workAdmission:{allowed:true},hostTools:${JSON.stringify(host)}};const controller={hostRegistration:async()=>(${JSON.stringify(registration)})};
createRoot(document.getElementById('root')).render(React.createElement(ZCodeHostToolsPanel,{state,controller}));`,loader:'jsx',resolveDir:process.cwd()},bundle:true,format:'iife',platform:'browser',write:false});
 await writeFile(join(dir,'render.html'),`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body,#root{margin:0;width:100%;font-family:system-ui}button{max-width:100%}</style></head><body><p style="padding:0 16px">Browser fixture preview · observation only</p><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`);
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const checks=[];
 for(const [name,width,height] of [['wide',1100,900],['narrow',390,844]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+join(dir,'render.html'));await page.locator('summary').click();await page.getByTestId('zcode-host-registration-refresh').click();await page.getByTestId('zcode-host-registration').waitFor();await page.screenshot({path:`docs/probes/checks/browser-computer-use-${name}.png`,fullPage:true});
 const dimensions=await page.evaluate(()=>({horizontalOverflow:document.documentElement.scrollWidth>innerWidth}));checks.push({name,width,errors,...dimensions});await page.close();
 }
 await writeFile('docs/probes/checks/browser-computer-use-visual.json',JSON.stringify({kind:'injected-visual-fixture-with-real-registration',notLiveExecutor:true,checks},null,2)+'\n');console.log(JSON.stringify(checks));if(checks.some(c=>c.errors.length||c.horizontalOverflow))process.exitCode=1;
}finally{await browser?.close();await rm(dir,{recursive:true,force:true})}
