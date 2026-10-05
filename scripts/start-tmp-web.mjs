// One-key temp DSH web instance. The temp root is FIXED (same directory every run, reset by
// deleting it); the bridge plugin is installed into that temp profile through the real plugin
// manager (`dsh plugin --profile web add file:...`), never symlinked, and the shipped web
// template's base/web-app bundles resolve from the dsh installation itself. Only the official
// Host ever touches the real HOME (Route B, pinned to the audited operator verdicts).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyRouteBArtifacts } from '../packages/host/launcher/route-b.mjs';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url))), parent = resolve(repo, '..');
// DSH_TMP_ROOT / DSH_TMP_PORT override the fixed temp location and port; DSH_TMP_SKIP_INSTALL=1
// skips the pnpm re-install (file: copies code, so the default re-installs every launch).
const tmpRoot = process.env.DSH_TMP_ROOT ?? '/private/tmp/dsh-zcode-web';
const port = process.env.DSH_TMP_PORT ?? '3092';
const dshHome = join(tmpRoot, 'dsh-home'), profile = join(dshHome, 'profiles/web'), workspace = join(tmpRoot, 'workspace');
const cli = join(parent, 'dsh/apps/cli/lib/bin.js');

// Fail loudly on an occupied port instead of dying inside app boot.
const holder = spawnSync('lsof', ['-ti', 'tcp:' + port], { encoding: 'utf8' });
if (holder.stdout.trim()) { console.error('port ' + port + ' already used by pid ' + holder.stdout.trim() + '; kill it or set DSH_TMP_PORT'); process.exit(1) }

const must = p => { if (!existsSync(p)) throw Error('missing prerequisite: ' + p); return p };
const sha256 = p => createHash('sha256').update(readFileSync(p)).digest('hex');
// The plan ledger moved into the phase-2 archive; accept the pre-archive location too.
const planCandidates = [join(parent, '.agent-work/archive/20261004-2200_dsh-zcode-bridge-p2/PLAN-PHASE2.md'), join(parent, '.agent-work/PLAN-PHASE2.md')];
const plan = planCandidates.find(existsSync);
if (!plan) throw Error('PLAN-PHASE2.md not found; looked in: ' + planCandidates.join(', '));
const base = join(parent, '.agent-work/tmp/host-reuse-probe');
const artifacts = Object.fromEntries(Object.entries({ s01: must(join(repo, 'docs/probes/AUTH-PHASE2-S01.md')), plan: must(plan) }).map(([k, path]) => [k, { path, sha256: sha256(path) }]));
verifyRouteBArtifacts(artifacts);
// The launcher socket must stay under the 103-byte macOS sockaddr_un limit:
// <root>/runs/<runId>/tmp/znr-<uuid>.sock. Instance tmpRoot names are too long for that, so the
// scratch root is a short dedicated directory (real path, no symlinks: landings reject them).
// DSH_TMP_SCRATCH overrides it (e.g. to reproduce the too-long failure path).
const scratchRoot = process.env.DSH_TMP_SCRATCH ?? '/private/tmp/dshw/ls';
const launcher = {
  mode: 'route-b', routeBArtifacts: artifacts, scratchRoot, runId: 'web-' + Date.now().toString(36),
  artifactRoot: must(join(base, 'official-extracted')),
  electronPath: must(join(base, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')),
  builtinConfig: must('/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json'),
};

mkdirSync(workspace, { recursive: true }); mkdirSync(profile, { recursive: true });
if (process.env.DSH_TMP_SKIP_INSTALL !== '1') {
  const install = spawnSync(process.execPath, [cli, 'plugin', '--profile', 'web', 'add', '--ignore-scripts', 'file:' + repo, 'file:' + join(repo, 'packages/host'), 'file:' + join(repo, 'packages/client')], { env: { ...process.env, DSH_HOME: dshHome }, stdio: 'inherit' });
  if (install.status !== 0) { console.error('plugin install failed (exit ' + install.status + ')'); process.exit(install.status ?? 1) }
}
// JSON is valid YAML; ids merge into the owning plugins, no second native agent.
writeFileSync(join(profile, 'cordis.patch.yml'), JSON.stringify([
  { id: 'zcode-bridge-host', config: { authorityMode: 'host-backed', launcher } },
  { id: 'ui-settings-general', name: '@deepseek-ai/dsh-client-ui-settings-general', config: { welcomeNoticeVersion: '2026-09-28.1' } },
], null, 2));

console.log(JSON.stringify({ tmpRoot, dshHome, profile, cwd: workspace, baseURL: 'http://127.0.0.1:' + port, HOME: process.env.HOME, bundles: ['@deepseek-ai/dsh-base (resolved from the dsh installation)', '@deepseek-ai/dsh-web-app (resolved from the dsh installation)', '@dsh-zcode/bridge (real plugin add file:)'], zcode: 'route-b read-only; auto-starts on open, errors show in the status card' }));
const child = spawn(process.execPath, [cli, 'web', '--no-open', '--port', port], { cwd: workspace, env: { ...process.env, DSH_HOME: dshHome }, stdio: 'inherit' });
writeFileSync(join(tmpRoot, 'server-pid.json'), JSON.stringify({ supervisorPid: process.pid, cliPid: child.pid, baseURL: 'http://127.0.0.1:' + port, profile, launcherScratch: launcher.scratchRoot, launcherRunId: launcher.runId }, null, 2));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
