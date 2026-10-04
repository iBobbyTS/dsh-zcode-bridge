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

## Route B (S03): explicit official account reuse, read-only observation

`mode: 'route-b'` additionally requires `routeBArtifacts: {s01: {path, sha256}, plan: {path, sha256}}`.
The public files must be named `AUTH-PHASE2-S01.md` and `PLAN-PHASE2.md`; the launcher verifies both hashes and S01 verdict / P20–P22 CLEAN+user choice / P24 backup / P25 bounded GO records before fork. Missing, stale or incomplete artifacts select scratch with an explicit refusal reason. No credential file is an authorization artifact.

Use a short scratch root and run ID, for example `scratchRoot: '/private/tmp/s3', runId: 'observation-1'`. macOS rejects the official CLI startup broker's long Unix socket path; Route B now rejects it before starting the Host. Real HOME is retained; `ZCODE_DESKTOP_HOME_DIR`, when present, remains the official settings override. DATA_BASE points to real HOME, and session DB is pinned to `~/.zcode/cli/db/db.sqlite`. Electron paths and cwd remain scratch. A custom credential-secret environment override is unsupported and refused by presence, without reading its value. Network is enabled; Keychain file access and securityd are denied by Seatbelt.

The Host decrypts its own material. Only safe auth/provider facts, task metadata, persistent session-list verification and official usage counters leave Main. No credential/profile values are exported. The Main has no scheduler spawn/wake/settlement/dispatch callbacks, no workspace warmup target, and no task-execution/close RPC entry. Auth failure, credential recovery, or a read failure stops it; automatic Route-B retry is disabled for that launcher instance. Request interception remains unavailable: zero-model evidence is the fixed RPC allowlist plus the bounded official usage/tasks observation, not the synthetic request-gate counter.

`/zcode-bridge/launcher` also accepts `{operation: 'observation'}` in an authenticated Route-B ready instance, returning official usage/task counters for the triple-evidence harness. `/zcode-bridge/sessions` returns a read-only multi-workspace task catalog. Opening a sidebar row displays metadata without activating or resuming the session. `/zcode-bridge/writePreflight` refreshes official task metadata per event; own Main lease memory takes precedence, fresh other running blocks, missing/stale signals block, and automation bindings warn. A terminal shared task (`completed`/`error`) is **not** promoted to idle: the official tasks-index omits the live turn of a resumed session, so the fourth state `unverifiable` (blind spot `cross-host-live-turn-undetectable`) is returned with `allowed:false, requiresConfirmation:true`. A bounded usage/`updatedAt` window (default 5000 ms, configurable 2000–15000 ms via `activityWindowMs`; only `zcode-agent.getTaskTokenUsage` is added to the read allowlist) is an auxiliary heuristic: movement inside the window is `active`, stationary usage proves nothing and stays `unverifiable`. `idle` requires an explicit per-view operator confirmation (or our own lease). The UI polls the decision, retains a draft, presents the one-time blind-spot confirmation and never enables Send in S03. No cross-Main arbitration or CAS proof is claimed.

For a persistent, isolated DSH web profile, from the bridge repository run:

```sh
HOME=/Users/ibobby node scripts/start-s03-web.mjs
```

The script sets `DSH_HOME=../.agent-work/tmp/s03-p2-web/dsh-home`, uses its `profiles/web` and scratch workspace, pins public evidence, and starts `web --no-open --port 3092`. It preserves any existing `ZCODE_DESKTOP_HOME_DIR`. Open the process-token URL printed at startup, then Connect and Refresh the ZCode sidebar. It does not automatically start the official Host. `server-pid.json` under the scratch root identifies the owned supervisor/CLI; stop only those owned processes. Tokens change on restart and are not committed.
