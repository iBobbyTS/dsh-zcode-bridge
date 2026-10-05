/**
 * S01b agents.register probe — DOM probe.
 *
 * Drives the running official DSH web instance with a real Chromium (no model
 * call) and records whether the native-runtime session and the registered mock
 * zcode session coexist in the official sidebar, and whether the zcode one
 * opens in the official session seat with its stub transcript.
 *
 * Usage:
 *   S01B_WEB_URL='http://127.0.0.1:3200/?token=...' node dom-probe.mjs [outDir]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '/tmp/s01-harness/node_modules/playwright-core/index.mjs';

const EXECUTABLE = process.env.S01_CHROMIUM
  ?? '/Users/ibobby/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const url = process.env.S01B_WEB_URL;
if (!url) throw new Error('S01B_WEB_URL is required');
const outDir = process.argv[2] ?? '/tmp/s01b-dom-probe';
const hostProbePath = process.env.S01B_HOST_PROBE ?? '/tmp/dsh-s01b-web/spike-host.json';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push('pageerror: ' + String(error?.message ?? error)));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('[data-s01b-overlay]', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);
for (const name of [/继续|Continue/, /稍后配置|Later|稍后|Configure later/]) {
  const button = page.getByRole('button', { name });
  if (await button.count().catch(() => 0) > 0) {
    await button.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
  }
}

const readRows = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-row-key^="session:"]')];
  return rows.map(row => ({
    key: row.getAttribute('data-row-key'),
    text: (row.innerText ?? '').replace(/\s+/g, ' ').trim(),
  }));
});

// The sidebar stream is live; give api-session/added a moment to land.
let rows = [];
for (let attempt = 0; attempt < 10; attempt++) {
  rows = await readRows();
  if (rows.some(row => row.key === 'session:zcode-mock-0001')
    && rows.some(row => row.key === 'session:native-mock-0001')) break;
  await page.waitForTimeout(700);
}
const hasZcode = rows.some(row => row.key === 'session:zcode-mock-0001');
const hasNative = rows.some(row => row.key === 'session:native-mock-0001');

// Coexistence snapshot: both rows present before any click.
await page.screenshot({ path: join(outDir, 's01b-coexist.png'), fullPage: false }).catch(() => {});

// Open the zcode session in the official seat by clicking its sidebar row.
let seat = { clicked: false, opened: false, stubVisible: false, conversationText: null };
const zcodeRow = page.locator('[data-row-key="session:zcode-mock-0001"]').first();
if (await zcodeRow.count().catch(() => 0) > 0) {
  await zcodeRow.click({ timeout: 5000 }).catch(() => {});
  seat.clicked = true;
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.waitForTimeout(600);
    const bodyText = await page.evaluate(() => document.body.innerText ?? '');
    if (bodyText.includes('ZCODE-MOCK-STUB')) {
      seat.opened = true;
      seat.stubVisible = true;
      seat.conversationText = bodyText.slice(0, 1200);
      break;
    }
    seat.conversationText = bodyText.slice(0, 800);
  }
}

let hostProbe = null;
try { hostProbe = JSON.parse(readFileSync(hostProbePath, 'utf8')); } catch { /* optional */ }

const report = {
  url,
  executable: EXECUTABLE,
  mounted: await page.evaluate(() => document.documentElement.dataset.s01bSpikeMounted ?? null),
  sidebarRows: rows,
  hasZcodeRow: hasZcode,
  hasNativeRow: hasNative,
  coexistInSidebar: hasZcode && hasNative,
  seat,
  hostProbe,
  consoleErrors,
};
writeFileSync(join(outDir, 'dom-probe.json'), JSON.stringify(report, null, 2));
await page.screenshot({ path: join(outDir, 's01b-spike.png'), fullPage: false }).catch(() => {});
await browser.close();
console.log(JSON.stringify(report, null, 2));

// Success predicate: the coexistence + seat claims are only evidence when every
// expected observation is present. Exit non-zero on any absence.
const missing = [];
if (report.mounted !== '1') missing.push('client half not mounted (data-s01b-spike-mounted)');
if (!hasZcode) missing.push('zcode-mock-0001 session row missing from sidebar');
if (!hasNative) missing.push('native-mock-0001 session row missing from sidebar');
if (!report.coexistInSidebar) missing.push('native + zcode rows did not coexist');
if (!seat.stubVisible) missing.push('zcode stub transcript not visible in the official session seat');
if (missing.length > 0) {
  console.error('dom-probe FAILED: ' + missing.join('; '));
  process.exitCode = 1;
}
