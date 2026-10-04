// Isolated webui only; real local scope/unreadable remote inventory; no official GUI/remote action.
import { build } from 'esbuild';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const { chromium } = createRequire(resolve('../dsh/apps/web/package.json'))('playwright');
const dir = await mkdtemp(join(tmpdir(), 's15-visual-')); let browser;
try {
  const fixture = JSON.parse(await readFile('tests/fixtures/s15/empty.json', 'utf8'));
  const result = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {RemoteStore} from '${resolve('packages/client/remote.mjs')}';import {ZCodeRemotePanel,remoteLocales} from '${resolve('packages/client/remote-view.jsx')}';
    const store=new RemoteStore({call:async()=>({ok:true,value:${JSON.stringify(fixture.remote)}})});
    createRoot(document.getElementById('root')).render(React.createElement(ZCodeRemotePanel,{sources:store,t:key=>remoteLocales.zh[key]}));`, loader: 'jsx', resolveDir: process.cwd() }, bundle: true, format: 'iife', platform: 'browser', write: false });
  await writeFile(join(dir, 'render.html'), `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body,#root{margin:0;width:100%;font-family:system-ui}button{max-width:100%}</style><div id="root"></div><script>${result.outputFiles[0].text}</script>`);
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const checks = [];
  for (const [name, width, height] of [['wide', 1100, 1000], ['narrow', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } }), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://'+join(dir, 'render.html')); await page.locator('[data-local-scope]').waitFor(); await page.locator('summary').click();
    await page.screenshot({ path: `docs/probes/checks/s15-${name}.png`, fullPage: true });
    checks.push({ name, width, errors, ...await page.evaluate(() => ({ horizontalOverflow: document.documentElement.scrollWidth > innerWidth, remoteAvailableClaims: document.querySelectorAll('[data-remote-available="true"]').length })) }); await page.close();
  }
  await writeFile('docs/probes/checks/s15-visual.json', JSON.stringify({ kind: 'official-local-scope-with-unreadable-remote-inventory', checks }, null, 2)+'\n'); console.log(JSON.stringify(checks));
  if (checks.some(c => c.errors.length || c.horizontalOverflow || c.remoteAvailableClaims)) process.exitCode = 1;
} finally { await browser?.close(); await rm(dir, { recursive: true, force: true }); }
