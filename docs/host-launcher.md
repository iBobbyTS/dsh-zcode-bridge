# Scratch Host launcher

The existing Host plugin accepts `authorityMode: 'host-backed'` and a `launcher` configuration. It starts a bridge-owned Electron Main, which forks the unmodified official Host and owns the transferred Channel port. The default `restricted-cli` mode remains available. Host-backed scratch mode exposes lifecycle and state services only: it never starts a second CLI authority, opens a session, sends a command, or enables login.

```js
{
  authorityMode: 'host-backed',
  launcher: {
    scratchRoot: '/absolute/canonical/scratch/host-reuse-probe',
    artifactRoot: '/absolute/canonical/scratch/host-reuse-probe/official-extracted',
    electronPath: '/absolute/canonical/scratch/host-reuse-probe/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    builtinConfig: '/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json'
  }
}
```

Prerequisites are the S01 read-only extraction layout, its sibling `bundled-resources/glm` reference to the official resources, and Electron **41.0.3**. The official Host subtree and CLI hashes are pinned. This section reuses that verified runtime installation; it does not ship or edit the official app, automatically download Electron, or create a separate account system. Missing prerequisites fail with an explicit reason. `runId` defaults to a fresh UUID; an existing run directory is rejected because InitLocal can migrate settings/databases and warm existing tasks. Scratch runs are retained for inspection and are never merged into official GUI storage.

On `/zcode-bridge`, `connect` starts the configured launcher. The `launcher` endpoint accepts only:

- `{operation: 'state'}`: lifecycle, landing assertions, database startup, Channel availability and execution restrictions.
- `{operation: 'services'}`: verified state services and the projection revision.
- `{operation: 'watch', afterRevision: number}`: one cancellable long poll; repeat using the returned revision.

`oauth`, `provider-settings`, and `setting` are verified by five status RPCs. Runtime/session/task service names are separately marked as static topology. Login, session/command execution, database retry control and shared official-Main authority stay disabled. Provider-request budget dispatch has synthetic tests but **is not installed into the packaged Host**; `enforceable=false` remains an explicit limitation; S04 follows the separately authorized observation-based budget in PLAN-PHASE2, and S03 remains zero-model.

The scratch-mode macOS outer sandbox permits writes only inside the fresh run, denies network and Keychain services, and permits only the required code/dependency read roots inside the real home. Electron writable paths, both process environments and cwd are bound to scratch. A CJS bootstrap registers error handlers before loading any application dependencies; import failures and uncaught errors produce a structured nonzero exit. The supervisor owns only its detached process group, sends Host disposal, and reaps that group. It never signals a process discovered by name.

Checks from the bridge checkout:

```sh
npm test
node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs
node scripts/check-p2-bootstrap.mjs
node ../dsh/node_modules/tsx/dist/cli.mjs --tsconfig ../dsh/tsconfig.base.json scripts/capture-p2-launcher.ts
npm run build
```

The installation check uses a new DSH profile and explicitly binds installer HOME/XDG/npm configuration/cache/pnpm store to scratch. It verifies the installed Host's own zod dependency, launches the installed package, consumes its state through the real DSH HTTP carrier, disposes it, and uninstalls the bundle. The bootstrap check traps and counts native dialog calls in its scratch fault fixtures, so a regression cannot itself display a dialog to the user. Its three real Electron cases are missing zod, uncaught exception and unhandled rejection.

## Route B: official account reuse and configuration validation

`mode: 'route-b'` uses ordinary launcher configuration validation. Q6 removed the SHA-pinned operator-document gate: `AUTH-PHASE2-S01.md` and `PLAN-PHASE2.md` are not read or required, and old `routeBArtifacts` options are ignored. Invalid configuration fails explicitly before spawning; it does not silently change to scratch mode. Required paths/run IDs, the desktop HOME override and prohibited shared-database/custom-cipher options are checked. Missing Electron/provider/CLI/Host installations report `helper-missing`, `provider-config-missing`, `runtime-missing` or `official-host-missing`. The official runtime digest/subtree checks remain fail-closed with `official-artifact-mismatch` / `official-host-subtree-mismatch`; removing operator documents does not admit an incompatible runtime.

Use a short scratch root and run ID, for example `scratchRoot: '/private/tmp/s3', runId: 'observation-1'`. macOS rejects the official CLI startup broker's long Unix socket path; Route B now rejects it before starting the Host. Real HOME is retained; `ZCODE_DESKTOP_HOME_DIR`, when present, remains the official settings override. DATA_BASE points to real HOME, and session DB is pinned to `~/.zcode/cli/db/db.sqlite`. Electron paths and cwd remain scratch. A custom credential-secret environment override is unsupported and refused by presence, without reading its value. Network is enabled; Keychain file access and securityd are denied by Seatbelt.

The Host decrypts its own material. Only safe auth/provider facts, task metadata, persistent session-list verification and official usage counters leave Main. No credential/profile values are exported. The Main has no scheduler spawn/wake/settlement/dispatch callbacks or workspace warmup target. Authenticated session commands/events use the explicit execution allowlists; no deletion entry is exposed. Auth failure, credential recovery, or a read failure stops it; a launcher that has never reached authenticated ready retains the initial Route-B retry guard. After an authenticated ready owner exits, conversation recovery may restart it with a fresh run ID within the 103-byte broker socket-path budget and the same validated configuration/sandbox/HOME boundaries; uncertain commands are queried by their original IDs, never replayed. Request interception remains unavailable: zero-model evidence is the fixed RPC allowlist plus the bounded official usage/tasks observation, not the synthetic request-gate counter.

`/zcode-bridge/launcher` also accepts `{operation: 'observation'}` in an authenticated Route-B ready instance, returning official usage/task counters for the triple-evidence harness. `/zcode-bridge/sessions` returns a read-only multi-workspace task catalog. Opening a sidebar row displays metadata without activating or resuming the session. `/zcode-bridge/writePreflight` refreshes official task metadata per event. D4-a permits sending while the official GUI may be running the same session, including when our own Main holds a lease. `active`, terminal `unverifiable`, and unknown liveness describe observation only; they do not block sending or require operator confirmation. The concurrency warning is explicit, and terminal metadata never claims idle. Only official-authority guards reject: unavailable/stale metadata, a missing/deleted task or an address mismatch. Automation bindings still warn. Preflight neither samples usage nor waits for an activity window. Legacy `activityWindowMs` remains a validated configuration option for existing profiles but does not delay admission. An allowed preflight is not an official acceptance receipt: S04 separately renders accepted, queued, rejected and outcome-unknown results, and never automatically resends unknown commands. Cross-Main arbitration remains unproven; Q3 settlement remains `assumed-single-answerer`.

For an isolated official DSH web profile, from the bridge repository run:

```sh
node scripts/start-official-web.mjs
```

The script uses the unmodified official build copy at `../.agent-work/tmp/dsh-official/apps/cli/lib/bin.js` for intermediate verification and the real plugin manager to install the bridge. It is not S08's npm-installed final acceptance. Defaults: isolated `DSH_HOME=/private/tmp/dsh-zcode-real/dsh-home`, scratch workspace, port 3205 and short launcher scratch root `/private/tmp/dshw/ls`. `DSH_TMP_ROOT`, `DSH_TMP_PORT`, `DSH_TMP_SCRATCH` and `DSH_TMP_SKIP_INSTALL=1` override those choices. It validates the launcher before profile writes/installation, retains `ZCODE_DESKTOP_HOME_DIR`, and issues no prompt. Open the process-token URL printed at startup. `server-pid.json` identifies the owned supervisor/CLI; stop only those processes. Tokens change on restart and are not committed.

`start-tmp-web.mjs` and `start-s03-web.mjs` are compatibility entries to the same official launcher, preserving their former profile/port defaults. Their obsolete fork CLI, symlink installation and document-ledger setup have been retired. Existing live instances are not migrated by editing these scripts.
