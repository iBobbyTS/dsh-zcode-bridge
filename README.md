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

S06 adds official Queue/Guide/Start now input, queue editing and disposition,
session selection changes, follow-up and goal commands. Each input freezes the
official session selection; queued inputs keep their admitted model and mode.
Current response models remain distinct from subsequent selections. Workspace
presentation and explicit preference updates use scoped official carriers,
without a second configuration store. Preference current-value reads and the
Host model catalog remain unavailable. All execution controls remain auth-gated
on the restricted Host. See [S06 handoff](docs/handoff/S06-HANDOFF.md) for verified
payloads, fixture provenance and real non-model capture results. Reproduce that
capture with `node scripts/capture-s06.mjs /Applications/ZCode.app` and derive
busy fixtures with `node scripts/make-s06-fixtures.mjs`.

S08 adds official history branching, side-session creation, edit/retry, feedback,
file diffs and rewind previews, and context compaction. Editing defaults to
preserving workspace files; combined rewind is explicit. Retry starts a new
execution and may repeat prior tool effects; uncertain delivery is recovered
only by querying the original command ID. File writes remain owned by ZCode.
Historical targets and previews retain their observed revision and epoch.
The official compact carrier queues during busy/held work and rejects duplicate
compaction, following the current projection admission. Model operations remain
auth-gated; no successful live history/file-rewind oracle is claimed from empty
drafts. See [S08 handoff](docs/handoff/S08-HANDOFF.md). Safe real probing and fixture
replay: `node scripts/capture-s08.mjs`, `node scripts/make-s08-fixtures.mjs`.

S11 adds the official browser reverse callback responder and a Browser / Computer
Use observation panel in the existing session area. Missing browser executors
return empty discovery or `backend_unavailable`; Computer Use helper connections
remain unverified. Enabled plugins never imply executable host capabilities.
The panel shows scoped replies, errors, uncertain timeouts, permissions and
projected screenshots without launching Desktop or a substitute executor.
See [S11 handoff](docs/handoff/S11-HANDOFF.md) for the source/probe decision table,
real SDK self-check, injected fixtures and limitations. Reproduce with
`node scripts/capture-s11.mjs /Applications/ZCode.app` and
`node scripts/make-s11-fixtures.mjs`.

S14 exposes official account honesty, workspace/session usage and process diagnostics,
plus the gated auxiliary-generation surfaces. There is no official account/subscription
carrier: account state is reported UNKNOWN and sign-in is not offered, never guessed.
Usage/diagnostics read the real official app-server (`usage/stats`, `session/usage`,
`process/childProcesses`); model-executing generate/cancel/connectivity carriers are
presented gated and never invoked. See [S14 handoff](docs/handoff/S14-HANDOFF.md).
Reproduce with `node scripts/capture-s14.mjs /Applications/ZCode.app` and
`node scripts/make-s14-fixtures.mjs`.

S15 adds remote workspace/session status to the existing session sidebar. Remote
connections, workspace inventories and remote sessions remain unavailable on this
local app-server connection: official Desktop Main and independent-server carriers
are not NDJSON methods. Unreadable remote inventories stay UNKNOWN; a real empty
local list is not presented as an empty remote list. SSH, WSL and Docker retain
separate reasons; local WSL discovery requires a Windows Host. Remote identities
cannot launch a local runtime. The read-only `remote {operation:'state'}` endpoint
accepts no targets, session identities or credentials and creates no second store.
See [S15 handoff](docs/handoff/S15-HANDOFF.md) for the three-way source/probe
classification, legacy/v4 checks and limits. Reproduce the isolated 0-model capture
with `node scripts/capture-s15.mjs /Applications/ZCode.app`, then
`node scripts/make-s15-fixtures.mjs`.
