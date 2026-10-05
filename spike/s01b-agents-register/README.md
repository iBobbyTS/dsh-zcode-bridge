# S01b agents.register probe

Throwaway probe bundle for the S01b continuation. **Not shipped in the bridge
package** (`spike/` is outside the bundle exports). It makes **no model call**.

## Question

Is `ctx.agents.register(agent)` the plugin-only per-session runtime coexistence
path in official DSH? — i.e. can a plugin publish a pre-constructed foreign
(here "zcode", static stub) Agent that coexists with the native agent-loop
runtime in the official sidebar and opens in the official session seat?

## What it does

The host half (`index.js`) runs inside a throwaway official DSH web instance:

1. creates a live Session `zcode-mock-0001` with a static stub transcript
   (`ctx.sessions.create`, no model call);
2. publishes a minimal mock zcode Agent over it via `ctx.agents.register`;
3. creates a real native-runtime session `native-mock-0001` through the owner
   `ctx.agents.create` flow (the single agent-loop factory) and gives it a
   marker transcript;
4. attaches both sessions to the workspace that owns the cwd
   (`workspaceRegistry.resolveByPath` + `attachSession`) — required because the
   sidebar renders `workspace.sessionIds`;
5. writes the observed contract facts to `S01B_SPIKE_RESULT`.

The browser half (`client.js`) only mounts an always-present `data-s01b-overlay`
marker. The DOM probe (`dom-probe.mjs`) drives a real Chromium and records the
sidebar rows by `data-row-key="session:<id>"`, clicks the zcode row, and checks
that the official session seat renders the `ZCODE-MOCK-STUB` transcript.

## Run

```sh
# official build copy at .agent-work/tmp/dsh-official (never reference/)
DSH_OFFICIAL_ROOT=/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/dsh-official \
  S01B_WEB_HOME=/tmp/dsh-s01b-web S01B_WEB_PORT=3200 \
  spike/s01b-agents-register/run-web.sh >/tmp/dsh-s01b-web-boot.log 2>&1 &
# boot log prints: dsh web: http://127.0.0.1:<port>/?token=<token>

S01B_WEB_URL='http://127.0.0.1:3200/?token=...' \
  node spike/s01b-agents-register/dom-probe.mjs /tmp/s01b-dom-probe
```

`dom-probe.mjs` uses the cached Playwright Chromium (`S01_CHROMIUM` overrides)
via `/tmp/s01-harness/node_modules/playwright-core`.
