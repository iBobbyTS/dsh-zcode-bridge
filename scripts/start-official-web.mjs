// Real-acceptance DSH web instance: OFFICIAL build copy (never reference/), real bridge plugin
// via the real plugin manager, live-http launcher against the installed ZCode app (3.14.4).
// Only the official Host touches the real HOME; the 103-byte socket rule keeps the short root.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createLauncherConfig } from '../packages/host/launcher/config.mjs';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url))), parent = resolve(repo, '..');
const tmpRoot = process.env.DSH_TMP_ROOT ?? '/private/tmp/dsh-zcode-real';
const port = process.env.DSH_TMP_PORT ?? '3205';
const dshHome = join(tmpRoot, 'dsh-home'), profile = join(dshHome, 'profiles/web'), workspace = join(tmpRoot, 'workspace');
const cli = process.env.DSH_OFFICIAL_CLI ?? join(parent, '.agent-work/tmp/dsh-official/apps/cli/lib/bin.js');
const selfManaged = process.argv.includes('--self-managed');
const dryRun = process.argv.includes('--dry-run') || process.env.DSH_TMP_DRY_RUN === '1';

if (!dryRun) {
  if (!existsSync(cli)) throw Error('official build copy missing: ' + cli);
  const holder = spawnSync('lsof', ['-ti', 'tcp:' + port], { encoding: 'utf8' });
  if (holder.stdout.trim()) { console.error('port ' + port + ' in use by pid ' + holder.stdout.trim()); process.exit(1) }
}

let launcher;
if (!selfManaged) {
  const must = p => { if (!existsSync(p)) throw Error('missing prerequisite: ' + p); return p };
  const base = existsSync(join(repo, '.agent-work/tmp/host-reuse-probe')) ? join(repo, '.agent-work/tmp/host-reuse-probe') : join(parent, '.agent-work/tmp/host-reuse-probe');
  const scratchRoot = process.env.DSH_TMP_SCRATCH ?? '/private/tmp/dshw/ls';
  launcher = {
    mode: 'live-http', scratchRoot, runId: 'web-' + Date.now().toString(36),
    artifactRoot: must(join(base, 'official-extracted')),
    electronPath: must(join(base, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')),
    builtinConfig: must('/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json'),
  };

  // Validate configuration/socket/HOME boundaries before profile writes or plugin installation.
  createLauncherConfig(launcher);
}

const config = selfManaged
  ? { authorityMode: 'self-managed', appPath: '/Applications/ZCode.app' }
  : { authorityMode: 'host-backed', launcher };

if (dryRun) {
  console.log(JSON.stringify({ tmpRoot, profile, selfManaged, dryRun: true, config }));
  process.exit(0);
}

mkdirSync(workspace, { recursive: true }); mkdirSync(profile, { recursive: true });
if (process.env.DSH_TMP_SKIP_INSTALL !== '1') {
  const install = spawnSync(process.execPath, [cli, 'plugin', '--profile', 'web', 'add', '--ignore-scripts', 'file:' + repo, 'file:' + join(repo, 'packages/host'), 'file:' + join(repo, 'packages/client')], { env: { ...process.env, DSH_HOME: dshHome }, stdio: 'inherit' });
  if (install.status !== 0) { console.error('plugin install failed'); process.exit(install.status ?? 1) }
}
writeFileSync(join(profile, 'cordis.patch.yml'), JSON.stringify([
  { id: 'zcode-bridge-host', config },
], null, 2));

console.log(JSON.stringify({ tmpRoot, profile, baseURL: 'http://127.0.0.1:' + port, note: 'official live-http runtime; isolated DSH profile; startup issues no prompts' }));
const child = spawn(process.execPath, [cli, 'web', '--no-open', '--port', port], { cwd: workspace, env: { ...process.env, DSH_HOME: dshHome }, stdio: 'inherit' });
writeFileSync(join(tmpRoot, 'server-pid.json'), JSON.stringify({
  supervisorPid: process.pid,
  cliPid: child.pid,
  baseURL: 'http://127.0.0.1:' + port,
  ...(selfManaged ? {} : { launcherScratch: launcher.scratchRoot, launcherRunId: launcher.runId })
}, null, 2));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
