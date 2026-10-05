/**
 * S01 capability-admission spike — DOM probe.
 *
 * Drives the running official DSH web instance with a real Chromium (no model
 * call) and records which spike slot contributions actually render. Usage:
 *   S01_WEB_URL='http://127.0.0.1:3199/?token=...' node dom-probe.mjs [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '/tmp/s01-harness/node_modules/playwright-core/index.mjs';

const EXECUTABLE = process.env.S01_CHROMIUM
  ?? '/Users/ibobby/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const url = process.env.S01_WEB_URL;
if (!url) throw new Error('S01_WEB_URL is required');
const outDir = process.argv[2] ?? '/tmp/s01-dom-probe';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push('pageerror: ' + String(error?.message ?? error)));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('[data-s01-overlay]', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);
// A fresh profile shows the preview notice modal first; dismiss it so the
// sidebar/settings/composer below are clickable.
// Onboarding modals (preview notice, then "configure an API key later") stack
// on a fresh profile; dismiss them without entering any credential.
for (const name of [/继续|Continue/, /稍后配置|Later|稍后|Configure later/]) {
  const button = page.getByRole('button', { name });
  if (await button.count().catch(() => 0) > 0) {
    await button.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
  }
}

const snapshot = async () => page.evaluate(() => {
  const q = selector => document.querySelector(selector);
  const count = selector => document.querySelectorAll(selector).length;
  return {
    mounted: document.documentElement.dataset.s01SpikeMounted ?? null,
    approvalOutcome: document.documentElement.dataset.s01Approval ?? null,
    overlay: count('[data-s01-overlay]'),
    runtimeSeat: count('[data-s01-runtime-seat]'),
    runtimeSelectExists: Boolean(q('[data-s01-runtime-select]')),
    runtimeSelectValue: q('[data-s01-runtime-select]')?.value ?? null,
    mockApproval: count('[data-s01-mock-approval]'),
    approveButton: count('[data-s01-approve]'),
    leading: count('[data-s01-leading]'),
    trailing: count('[data-s01-trailing]'),
    settingsSection: count('[data-s01-settings]'),
    // Generic context the harness needs to explain absence:
    sessionRows: count('[class*="sessionRow"]'),
    composers: count('[data-composer-dock]'),
    bodyText: (document.body.innerText ?? '').slice(0, 400),
  };
});

const before = await snapshot();
let mockApprovalAfterClick = null;
let approveClickError = null;
if (before.approveButton > 0) {
  try {
    await page.locator('[data-s01-approve]').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(300);
    mockApprovalAfterClick = await page.evaluate(() => document.documentElement.dataset.s01Approval ?? null);
  } catch (error) {
    approveClickError = String(error?.message ?? error);
  }
}

// Open settings (sidebar foot) and look for the additive Zcode Bridge section.
let settingsProbe = { opened: false, section: 0, navText: null };
try {
  const candidates = [
    page.getByRole('button', { name: /设置|Settings/ }),
    page.locator('button:has-text("设置")'),
  ];
  for (const trigger of candidates) {
    const count = await trigger.count().catch(() => 0);
    if (count === 0) continue;
    await trigger.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(900);
    settingsProbe.opened = true;
    // The section label appears in the settings nav; the page body mounts only
    // when that nav entry is active, so click it by its registrant label.
    const navEntry = page.getByText('Zcode Bridge', { exact: true });
    if (await navEntry.count() > 0) {
      await navEntry.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    settingsProbe.section = await page.locator('[data-s01-settings]').count();
    settingsProbe.navText = await page.evaluate(() => {
      const root = document.querySelector('[role="dialog"]') ?? document.body;
      return (root.innerText ?? '').slice(0, 900);
    });
    if (settingsProbe.section > 0) break;
  }
  if (!settingsProbe.opened) settingsProbe.error = 'settings trigger not found';
} catch (error) {
  settingsProbe.error = String(error?.message ?? error);
}

const report = { url, executable: EXECUTABLE, snapshot: before, mockApprovalAfterClick, approveClickError, settingsProbe, consoleErrors };
writeFileSync(join(outDir, 'dom-probe.json'), JSON.stringify(report, null, 2));
await page.screenshot({ path: join(outDir, 's01-spike.png'), fullPage: false }).catch(() => {});
await browser.close();
console.log(JSON.stringify(report, null, 2));
