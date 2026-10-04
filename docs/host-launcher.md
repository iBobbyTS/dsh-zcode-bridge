# Scratch Host launcher

The existing Host plugin accepts `authorityMode: 'host-backed'` and a `launcher` configuration. It starts a bridge-owned Electron Main, which forks the unmodified official Host and owns the transferred Channel port. The default `restricted-cli` mode remains available. Host-backed mode currently exposes lifecycle and state services only: it never starts a second CLI authority, opens a session, sends a command, or enables login.

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

`oauth`, `provider-settings`, and `setting` are verified by five status RPCs. Runtime/session/task service names are separately marked as static topology. Login, session/command execution, database retry control and shared official-Main authority stay disabled. Provider-request budget dispatch has synthetic tests but **is not installed into the packaged Host**; `enforceable=false` means S04 must remain `NOT_RUN(cannot-enforce)`.

The macOS outer sandbox permits writes only inside the fresh run, denies network and Keychain services, and permits only the required code/dependency read roots inside the real home. Electron writable paths, both process environments and cwd are bound to scratch. A CJS bootstrap registers error handlers before loading any application dependencies; import failures and uncaught errors produce a structured nonzero exit. The supervisor owns only its detached process group, sends Host disposal, and reaps that group. It never signals a process discovered by name.

Checks from the bridge checkout:

```sh
npm test
node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs
node scripts/check-p2-bootstrap.mjs
node ../dsh/node_modules/tsx/dist/cli.mjs --tsconfig ../dsh/tsconfig.base.json scripts/capture-p2-launcher.ts
npm run build
```

The installation check uses a new DSH profile and explicitly binds installer HOME/XDG/npm configuration/cache/pnpm store to scratch. It verifies the installed Host's own zod dependency, launches the installed package, consumes its state through the real DSH HTTP carrier, disposes it, and uninstalls the bundle. The bootstrap check traps and counts native dialog calls in its scratch fault fixtures, so a regression cannot itself display a dialog to the user. Its three real Electron cases are missing zod, uncaught exception and unhandled rejection.
