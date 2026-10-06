import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BRIDGE_VERSION, BRIDGE_PLUGIN_VERSIONS, VERIFIED_VERSIONS, DISMISS_MODES,
  compareVersions, highestVerifiedVersion, classifyInstallation, bannerRequired,
} from '../packages/host/compatibility.mjs';
import { VERIFIED } from '../packages/host/installation.mjs';
import {
  parseDismissState, serializeDismissState, dismissBanner, bannerDecision,
  restartRequired, CLIENT_PLUGIN_VERSION,
} from '../packages/client/compatibility.mjs';

const readJson = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const baseline = VERIFIED_VERSIONS[0];
const tuple = (overrides = {}) => ({ version: baseline.version, build: baseline.build, sha256: baseline.bundleSha256, ...overrides });

test('verified-version record starts with the official measured tuple and drives the installation gate', () => {
  assert.equal(VERIFIED.version, baseline.version);
  assert.equal(VERIFIED.build, baseline.build);
  assert.equal(VERIFIED.sha256, baseline.bundleSha256);
  assert.equal(baseline.version, '3.14.4');
  assert.equal(baseline.build, '3.14.4.7912');
  assert.equal(baseline.bundleSha256, 'fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f');
  assert.equal(highestVerifiedVersion(), '3.14.4');
  // The record is data-driven: an injected higher tuple raises the highest verified version.
  assert.equal(highestVerifiedVersion([baseline, { version: '3.15.0', build: 'x', bundleSha256: 'y', id: 'z' }]), '3.15.0');
});

test('installation classification distinguishes verified, newer, identity drift and unknown', () => {
  assert.equal(classifyInstallation(tuple()).state, 'verified');
  assert.equal(classifyInstallation(tuple()).verified, true);
  const newer = classifyInstallation(tuple({ version: '3.15.0', build: '3.15.0.1' }));
  assert.equal(newer.state, 'newer-unverified');
  assert.equal(bannerRequired(newer), true);
  assert.equal(newer.incompatible, false, 'a newer version is a warning, never a hard refusal');
  const drift = classifyInstallation(tuple({ sha256: 'different' }));
  assert.equal(drift.state, 'identity-mismatch');
  assert.equal(drift.digestMatches, false);
  assert.equal(bannerRequired(drift), false, 'same-version drift is not the newer-version banner');
  const older = classifyInstallation(tuple({ version: '3.13.0', build: '3.13.0.1' }));
  assert.equal(older.state, 'other-unverified');
  for (const unknown of [null, {}, { version: 'not-a-version' }]) {
    const classified = classifyInstallation(unknown);
    assert.equal(classified.state, 'unknown');
    assert.equal(classified.failSafe, 'neutral');
    assert.equal(bannerRequired(classified), false);
  }
  assert.equal(compareVersions('3.15.0', '3.14.4'), 1);
  assert.equal(compareVersions('3.14.4', '3.14.4'), 0);
  assert.equal(compareVersions('3.14.4', '3.14.10'), -1);
  assert.equal(compareVersions('bad', '3.14.4'), null);
});

const classificationOf = version => classifyInstallation(tuple({ version, build: `${version}.1` }));

test('once dismisses only the current display session and is never persisted', () => {
  const { state, persisted } = dismissBanner(parseDismissState(''), 'once', '3.15.0');
  assert.equal(persisted, false);
  assert.equal(bannerDecision(state, classificationOf('3.15.0')).visible, false);
  const serialized = serializeDismissState(state);
  assert.equal(serialized.includes('once'), false, 'once is never written to storage');
  const reloaded = parseDismissState(serialized);
  assert.equal(reloaded.once.length, 0, 'once must not survive a reload');
  assert.equal(bannerDecision(reloaded, classificationOf('3.15.0')).visible, true);
});

test('this-version dismiss persists and re-reminds on a higher version', () => {
  const first = dismissBanner(parseDismissState(''), 'this-version', '3.15.0');
  assert.equal(first.persisted, true);
  const reloaded = parseDismissState(serializeDismissState(first.state));
  assert.equal(bannerDecision(reloaded, classificationOf('3.15.0')).visible, false);
  assert.equal(bannerDecision(reloaded, classificationOf('3.15.1')).visible, true, 'a later version re-reminds');
});

test('new-next-version skips one upgrade only and re-reminds on the next', () => {
  const dismissed = dismissBanner(parseDismissState(''), 'new-next-version', '3.15.0');
  const reloaded = parseDismissState(serializeDismissState(dismissed.state));
  assert.equal(bannerDecision(reloaded, classificationOf('3.15.0')).visible, false);
  const skip = bannerDecision(reloaded, classificationOf('3.15.1'));
  assert.equal(skip.visible, false, 'the immediately next version is skipped once');
  assert.equal(skip.persisted, true);
  const persisted = parseDismissState(serializeDismissState(skip.state));
  assert.equal(bannerDecision(persisted, classificationOf('3.15.1')).visible, false);
  assert.equal(bannerDecision(persisted, classificationOf('3.15.2')).visible, true, 'a subsequent version re-reminds');
  assert.equal(bannerDecision(persisted, classificationOf('3.16.0')).visible, true);
});

test('banner is only visible for newer-unverified and dismiss storage is a separate preference', () => {
  const cases = [
    classifyInstallation(tuple()),
    classifyInstallation(tuple({ sha256: 'different' })),
    classifyInstallation(tuple({ version: '3.13.0', build: '3.13.0.1' })),
    classifyInstallation({ version: 'nope' }),
  ];
  for (const classification of cases) {
    assert.equal(bannerDecision(parseDismissState(''), classification).visible, false, `${classification.state} must not show the newer-version banner`);
  }
  assert.deepEqual([...DISMISS_MODES], ['once', 'this-version', 'new-next-version']);
  const malformed = parseDismissState('{"thisVersion":"not-an-array","newNextVersion":[null,{"from":"bad"}]}');
  assert.deepEqual(malformed, { once: [], thisVersion: [], newNextVersion: [] });
});

test('host/client plugin versions must agree or a restart is required', () => {
  assert.equal(restartRequired(undefined), false);
  assert.equal(restartRequired({ bridge: { version: CLIENT_PLUGIN_VERSION } }), false);
  assert.equal(restartRequired({ bridge: { version: '0.0.9' } }), true);
  assert.equal(restartRequired({ bridge: { version: '0.2.0' } }), true);
});

test('bundle install metadata is internally consistent with both plugin packages', async () => {
  const root = await readJson('../package.json');
  const host = await readJson('../packages/host/package.json');
  const client = await readJson('../packages/client/package.json');
  const driver = await readJson('../packages/driver/package.json');
  const bundle = await readJson('../bridge-bundle.json');
  assert.equal(bundle.bundleId, root.name);
  assert.equal(bundle.version, root.version);
  assert.equal(bundle.version, BRIDGE_VERSION);
  assert.equal(host.version, BRIDGE_PLUGIN_VERSIONS.host);
  assert.equal(client.version, BRIDGE_PLUGIN_VERSIONS.client);
  assert.deepEqual(bundle.plugins.map(plugin => plugin.package).sort(), [host.name, driver.name, client.name].sort());
  for (const plugin of bundle.plugins) {
    assert.equal(plugin.version, plugin.kind === 'host' ? host.version : client.version);
  }
  assert.equal(bundle.compatibility.zcode.highestVerified, highestVerifiedVersion());
  assert.equal(bundle.compatibility.zcode.verifiedTuples[0].id, baseline.id);
  assert.equal(bundle.activation.restartRequiredOnVersionChange, true);
  // The profile patch must reference exactly the declared plugin packages.
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  const names = [...patch.matchAll(/name:\s*'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(names.sort(), bundle.plugins.map(plugin => plugin.package).sort());
});
