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
Host uses DSH's authenticated `/zcode-bridge` dedicated RPC carrier. Missing App/helper/config,
protocol failure and missing official auth source have distinct status reasons.

Only App-owned Electron Node and cjs are launched, with the official bundled
provider config. Cleanup targets the owned child only and never session/close.
There is no attach, private credential parsing, model call, fallback agent,
native factory registration. The runtime source adapter exposes native references
unchanged and reads official ZCode summaries through `session/list`. It never
creates a DSH Agent Context for ZCode. ZCode creation and execution remain
unready; the connected status stays restricted. Creation defaults belong to
the UI settings owner and never reinterpret a saved runtime address.

The Client plugin is emitted as a DSH classic-script factory; its ESM artifact
is used only by Node/jsdom checks. `@dsh-zcode/bridge-client/sources` publishes the
`RuntimeSessions` types used by the next UI section. See the DSH
`docs/seam/zcode-runtime-source.md` reference for address and ownership rules.

Evidence and limits: [probes](docs/probes/S01-PROBES.md),
[carrier inventory](docs/probes/S01-CARRIERS.md),
[handoff](docs/handoff/S01-HANDOFF.md). The local workflow authority remains the
parent workspace's `.agent-work/PLAN-FULL.md` and bounded TASK files.

S03.A adds a bounded duplex NDJSON transport and scoped V4 projection/command
API for the next UI section. ACK/query outcomes remain distinct from execution
completion; recovery uses only an actually held baseline. Current Host admission
remains restricted. See [S03.A handoff](docs/handoff/S03A-HANDOFF.md) for the API,
source/licensing, reusable official draft fixtures, fault injection and limits.
Capture without model execution using `node scripts/capture-s03a.mjs`, then
`node scripts/make-s03a-fixtures.mjs`; replay checks with
`node scripts/check-s03a.mjs`.
