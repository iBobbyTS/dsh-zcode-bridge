# dsh-zcode-bridge

Official ZCode runtime + DSH Host/Client bundle. S01 delivers a macOS headless
protocol connection and a status card on the bundle's existing Plugins detail
page. **S01 is PARTIAL:** account execution and shared official GUI sessions are
unverified. Protocol connection displays restricted, never account-ready.

Build with `npm ci --ignore-scripts && npm run build`; run boundary checks with
`npm test`. With the sibling DSH checkout prepared, run its existing test engine:

```sh
node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs
node ../dsh/node_modules/tsx/dist/cli.mjs --tsconfig ../dsh/tsconfig.base.json scripts/install-probe.ts
npm run probe -- /absolute/dedicated/workspace
```

Install the local bundle plus its internal Host/Client packages through DSH's
plugin manager into a dedicated web profile. Configure `zcode-bridge-host` with
`workspacePath` and optionally `appPath`; see the configuration-only example in
`../dsh/apps/cli/config/examples/zcode-bridge`. No runtime starts until Connect.
Host uses DSH's authenticated `/api` RPC carrier. Missing App/helper/config,
protocol failure and missing official auth source have distinct status reasons.

Only App-owned Electron Node and cjs are launched, with the official bundled
provider config. Cleanup targets the owned child only and never session/close.
There is no attach, private credential parsing, model call, fallback agent,
native factory registration or session seam patch in this slice.

Evidence and limits: [probes](docs/probes/S01-PROBES.md),
[carrier inventory](docs/probes/S01-CARRIERS.md),
[handoff](docs/handoff/S01-HANDOFF.md). The local workflow authority remains the
parent workspace's `.agent-work/PLAN-FULL.md` and S01 TASK.
