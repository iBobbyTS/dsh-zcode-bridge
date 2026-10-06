import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Real-carrier evidence captured by profile capture script against an isolated temporary profile.
const fixture = JSON.parse(await readFile(new URL('./fixtures/installable-bundle/profile-roundtrip.json', import.meta.url), 'utf8'));

test('real plugin-manager profile self-install carries both plugin artifacts and bundle metadata', () => {
  assert.equal(fixture.oracle, 'installable-bundle-profile-roundtrip');
  const install = fixture.steps.install;
  assert.equal(install.exitCode, 0);
  assert.equal(install.installed.root, fixture.bridgeVersion);
  assert.equal(install.installed.bundleMetadata, fixture.bridgeVersion);
  assert.equal(install.installed.hostEntry, true, 'installed host entry is present');
  assert.equal(install.installed.clientArtifact, true, 'installed client artifact is present');
  assert.deepEqual(install.installed.bundles, ['@dsh-zcode/bridge']);
});

test('update installs the new bundle version and flags that a restart is required', () => {
  assert.equal(fixture.steps.update.exitCode, 0);
  assert.equal(fixture.steps.update.installed.root, '0.1.1');
  assert.equal(fixture.steps.update.installed.bundleMetadata, '0.1.1');
  assert.equal(fixture.steps.update.restartRequired, true, 'running 0.1.0 must not claim 0.1.1 is active');
});

test('uninstall leaves no plugin artifact or bundle registration behind', () => {
  assert.equal(fixture.steps.uninstall.exitCode, 0);
  assert.deepEqual(fixture.steps.uninstall.remaining, { host: false, client: false, root: false, bundles: [] });
  assert.equal(fixture.pass, true);
});
