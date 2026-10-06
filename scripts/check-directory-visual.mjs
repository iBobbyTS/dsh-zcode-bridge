// Existing read-only web viewer only. No Connect, native prompt, or official GUI action.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const {chromium}=createRequire(resolve('../dsh/apps/web/package.json'))('playwright');
const out=resolve(process.env.DIRECTORY_VISUAL_OUTPUT??'docs/probes/checks/launcher-recovery-resume/visual');mkdirSync(out,{recursive:true});
const url=readFileSync('/private/tmp/conversation-web-server-final.log','utf8').match(/dsh web: (http:\/\/127\.0\.0\.1:3092\/\?token=[^\s]+)/)?.[1];
if(!url)throw Error('web-url-unavailable');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}),checks=[];
try{
 for(const width of [1360,1100]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  const directory=page.locator('section').filter({has:page.getByRole('heading',{name:'ZCode · ZCode 会话',exact:true})}).first();
  await directory.waitFor();await page.waitForTimeout(1000);
  const later=page.getByRole('button',{name:'稍后配置'});if(await later.isVisible())await later.click();
  await directory.getByRole('button',{name:'刷新',exact:true}).click();
  await directory.locator('[data-session-key]').first().waitFor();
  const initial=await directory.evaluate(section=>({rowCount:section.querySelectorAll('[data-session-key]').length,workspaceSections:section.querySelectorAll('[data-workspace]').length,groupInputs:section.querySelectorAll('li input').length,directoryWidth:section.getBoundingClientRect().width,horizontalOverflow:section.scrollWidth>section.clientWidth,archiveVisible:!!Array.from(section.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent==='已归档')?.getBoundingClientRect().height,archiveCollapsed:!Array.from(section.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent==='已归档')?.open,titleSources:[...new Set(Array.from(section.querySelectorAll('[data-title-source]'),n=>n.getAttribute('data-title-source')))]}));
  await page.screenshot({path:join(out,`web-${width}.png`),fullPage:true});
  const firstKey=await directory.locator('[data-session-key]').first().getAttribute('data-session-key');
  await directory.getByRole('button',{name:'下一页',exact:true}).click();
  const nextKey=await directory.locator('[data-session-key]').first().getAttribute('data-session-key');
  await directory.getByRole('button',{name:'上一页',exact:true}).click();
  await directory.locator('[data-session-key] button').first().click();
  const panel=page.getByRole('region',{name:'ZCode read-only session'});await panel.waitFor();
  const sendDisabled=await panel.getByRole('button',{name:'Send',exact:true}).isDisabled();
  checks.push({width,errors,...initial,pageChanged:firstKey!==nextKey,sendDisabled});await page.close();
 }
 writeFileSync(join(out,'result.json'),JSON.stringify({kind:'restored-real-web-read-only-directory',checks},null,2)+'\n');console.log(JSON.stringify(checks));
 if(checks.some(c=>c.errors.length||c.rowCount!==20||c.groupInputs||c.horizontalOverflow||!c.archiveCollapsed||!c.pageChanged||!c.sendDisabled))process.exitCode=1;
}finally{await browser.close()}
