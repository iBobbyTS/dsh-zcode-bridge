/**
 * S16 real-carrier self-install / update / uninstall round trip.
 *
 * Uses DSH's own plugin-manager `runProfilePnpm` against a dedicated temporary profile. The bridge
 * repository itself is never modified and no real user profile is touched. Output feeds
 * tests/fixtures/s16/profile-roundtrip.json for deterministic consumption by the S16 checks.
 *
 * Run: node ../dsh/node_modules/tsx/dist/cli.mjs --tsconfig ../dsh/tsconfig.base.json scripts/capture-s16.ts
 */
import { runProfilePnpm } from '../../dsh/packages/boot/plugin-manager/src/operations.ts';
import { cp, mkdir, mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = resolve('.');
const anchor = resolve('../dsh/apps/cli/package.json');
const bridgeVersion = JSON.parse(await readFile(resolve(repo, 'package.json'), 'utf8')).version;

const source = await mkdtemp(resolve(tmpdir(), 's16-source-'));
const profile = await mkdtemp(resolve(tmpdir(), 's16-profile-'));
const result: Record<string, any> = { oracle: 's16-profile-roundtrip', bridgeVersion, steps: {} };

const exists = async (path: string) => { try { await access(path, constants.F_OK); return true } catch { return false } };
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const context = { profile: 's16-probe', dir: profile, installAnchor: anchor, cwd: repo };

async function run(args: string[]) {
  const out = await runProfilePnpm(context as never, args as never, { execution: 'service', outputBytes: 8000, idleTimeoutMs: 120000 } as never);
  return { exitCode: out.exitCode, truncated: out.truncated };
}

try {
  await cp(resolve(repo, 'packages'), resolve(source, 'packages'), { recursive: true, filter: path => !path.includes('node_modules') && !path.endsWith('.DS_Store') });
  for (const file of ['package.json', 'cordis.patch.yml', 'bridge-bundle.json']) await cp(resolve(repo, file), resolve(source, file));
  await writeFile(resolve(profile, 'package.json'), JSON.stringify({ name: 's16-probe-profile', private: true, packageManager: 'pnpm@11.7.0', dsh: { profile: { bundles: [] } } }));

  // The bundle root plus its two plugin packages, exactly as the S01 real-carrier install modeled
  // them; the root's own file: dependencies cannot be resolved from an installed location.
  const specs = ['file:' + source, 'file:' + resolve(source, 'packages/host'), 'file:' + resolve(source, 'packages/client')];
  result.steps.install = await run(['add', '--ignore-scripts', ...specs]);
  const installedRoot = resolve(profile, 'node_modules/@dsh-zcode/bridge/package.json');
  const installedBundle = resolve(profile, 'node_modules/@dsh-zcode/bridge/bridge-bundle.json');
  result.steps.install.installed = {
    root: await exists(installedRoot) ? (await readJson(installedRoot)).version : null,
    hostEntry: await exists(resolve(profile, 'node_modules/@dsh-zcode/host/index.mjs')),
    clientArtifact: await exists(resolve(profile, 'node_modules/@dsh-zcode/bridge-client/lib/client.js')),
    bundleMetadata: await exists(installedBundle) ? (await readJson(installedBundle)).version : null,
    bundles: (await readJson(resolve(profile, 'package.json'))).dsh?.profile?.bundles ?? [],
  };

  // Update: bump the copied bundle to 0.1.1 and re-install the same spec. The running bridge
  // constant stays 0.1.0, which is exactly the "installed but not active" case the UI must flag.
  for (const relative of ['package.json', 'packages/host/package.json', 'packages/client/package.json', 'bridge-bundle.json']) {
    const path = resolve(source, relative);
    const text = await readFile(path, 'utf8');
    await writeFile(path, text.replace(/"version": "0\.1\.0"/g, '"version": "0.1.1"'));
  }
  result.steps.update = await run(['add', '--ignore-scripts', ...specs]);
  result.steps.update.installed = {
    root: await exists(installedRoot) ? (await readJson(installedRoot)).version : null,
    bundleMetadata: await exists(installedBundle) ? (await readJson(installedBundle)).version : null,
  };
  const running = (await import(pathToFileURL(resolve(repo, 'packages/host/compatibility.mjs')).href)).BRIDGE_VERSION;
  result.steps.update.restartRequired = result.steps.update.installed.root !== running;

  result.steps.uninstall = await run(['remove', '@dsh-zcode/bridge', '@dsh-zcode/host', '@dsh-zcode/bridge-client']);
  result.steps.uninstall.remaining = {
    host: await exists(resolve(profile, 'node_modules/@dsh-zcode/host')),
    client: await exists(resolve(profile, 'node_modules/@dsh-zcode/bridge-client')),
    root: await exists(resolve(profile, 'node_modules/@dsh-zcode/bridge')),
    bundles: (await readJson(resolve(profile, 'package.json'))).dsh?.profile?.bundles ?? [],
  };

  result.pass = result.steps.install.exitCode === 0 && result.steps.install.installed.root === '0.1.0'
    && result.steps.install.installed.hostEntry && result.steps.install.installed.clientArtifact
    && result.steps.install.installed.bundleMetadata === '0.1.0'
    && result.steps.update.exitCode === 0 && result.steps.update.installed.root === '0.1.1'
    && result.steps.update.restartRequired === true
    && result.steps.uninstall.exitCode === 0
    && result.steps.uninstall.remaining.root === false
    && result.steps.uninstall.remaining.host === false
    && result.steps.uninstall.remaining.client === false;
  await mkdir(resolve(repo, 'tests/fixtures/s16'), { recursive: true });
  await writeFile(resolve(repo, 'tests/fixtures/s16/profile-roundtrip.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  if (!result.pass) process.exitCode = 1;
} finally {
  await rm(source, { recursive: true, force: true });
  await rm(profile, { recursive: true, force: true });
}
