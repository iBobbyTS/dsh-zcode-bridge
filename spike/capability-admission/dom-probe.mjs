/**
 * Capability admission spike — DOM probe.
 *
 * Drives the running official DSH web instance with a real Chromium (no model
 * call) and records which spike slot contributions actually render. Usage:
 *   CAPABILITY_ADMISSION_WEB_URL='http://127.0.0.1:3199/?token=...' node dom-probe.mjs [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '/tmp/capability-admission-harness/node_modules/playwright-core/index.mjs';

const EXECUTABLE = process.env.CAPABILITY_ADMISSION_CHROMIUM
  ?? '/Users/ibobby/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const url = process.env.CAPABILITY_ADMISSION_WEB_URL;
if (!url) throw new Error('CAPABILITY_ADMISSION_WEB_URL is required');
const outDir = process.argv[2] ?? '/tmp/capability-admission-dom-probe';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push('pageerror: ' + String(error?.message ?? error)));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('[data-capability-admission-overlay]', { timeout: 20000 }).catch(() => {});
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
    mounted: document.documentElement.dataset.capabilityAdmissionSpikeMounted ?? null,
    approvalOutcome: document.documentElement.dataset.capabilityAdmissionApproval ?? null,
    overlay: count('[data-capability-admission-overlay]'),
    runtimeSeat: count('[data-capability-admission-runtime-seat]'),
    runtimeSelectExists: Boolean(q('[data-capability-admission-runtime-select]')),
    runtimeSelectValue: q('[data-capability-admission-runtime-select]')?.value ?? null,
    mockApproval: count('[data-capability-admission-mock-approval]'),
    approveButton: count('[data-capability-admission-approve]'),
    leading: count('[data-capability-admission-leading]'),
    trailing: count('[data-capability-admission-trailing]'),
    settingsSection: count('[data-capability-admission-settings]'),
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
    await page.locator('[data-capability-admission-approve]').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(300);
    mockApprovalAfterClick = await page.evaluate(() => document.documentElement.dataset.capabilityAdmissionApproval ?? null);
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
    settingsProbe.section = await page.locator('[data-capability-admission-settings]').count();
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
await page.screenshot({ path: join(outDir, 'capability-admission-spike.png'), fullPage: false }).catch(() => {});
await browser.close();
console.log(JSON.stringify(report, null, 2));

// Success predicate: every observation this probe is cited for must be present,
// otherwise exit non-zero — an absent probe must never read as evidence.
const missing = [];
if (before.mounted !== '1') missing.push('client half not mounted (data-capability-admission-spike-mounted)');
if (before.overlay < 1) missing.push('shell.overlay entry missing');
if (before.runtimeSeat < 1) missing.push('runtime seat not rendered (conversation.input.model)');
if (before.runtimeSelectValue !== 'zcode') missing.push('runtime select missing or not defaulting to zcode');
if (before.mockApproval < 1) missing.push('mock approval panel not rendered (conversation.composer)');
if (mockApprovalAfterClick !== 'allowed-once') missing.push('approve click did not record allowed-once');
if (settingsProbe.section < 1) missing.push('Zcode Bridge settings.section not rendered');
if (missing.length > 0) {
  console.error('dom-probe FAILED: ' + missing.join('; '));
  process.exitCode = 1;
}
