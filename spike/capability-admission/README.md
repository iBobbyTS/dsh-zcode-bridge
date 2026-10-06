# Capability admission spike

Throwaway probe bundle for the capability admission gate. **Not shipped in the bridge
package** (`spike/` is outside the bundle exports). No model call is made; the
host half only probes the single Agent factory slot and the browser half only
renders plugin slot contributions plus one mock approval button.

## What it proves

| Item | Probe |
|---|---|
| ① | `index.js` records whether `ctx.agents.setFactory` accepts or rejects a second factory (`CAPABILITY_ADMISSION_SPIKE_RESULT`). |
| ② | `client.js` shadows the single `conversation.input.model` seat with a runtime selector (`data-capability-admission-runtime-select`, default `zcode`). |
| ③ | `client.js` registers `sidebar.session.row.leading` and `sidebar.workspaces.session.row.action` (visible only with a non-blank session row / on hover). |
| ④ | `client.js` takes over the `conversation.composer` chain with a mock approval panel (`data-capability-admission-mock-approval`); `approval-bridge.test.mjs` exercises the four closed outcomes and late-answer idempotency. |
| ⑦ | `client.js` registers an additive `settings.section` (`Zcode Bridge`) and a `shell.overlay` load marker. |

## Build the official DSH copy (once)

The official reference checkout is read-only; build a runnable copy under the
workspace tmp dir.

```sh
REF=/Users/ibobby/Projects/dsh-zcode-acp/reference/deepseek-harness
DST=/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/dsh-official
git clone --local "$REF" "$DST" && cd "$DST" && git checkout -q 5badb15009
# postinstall writes the user's global git hooks unless overridden; --ignore-scripts
# avoids that and the later build does not need the hooks.
DSH_LEFTHOOK_ALLOW_HOOKS_PATH_OVERRIDE=1 pnpm install --frozen-lockfile
DSH_LEFTHOOK_ALLOW_HOOKS_PATH_OVERRIDE=1 pnpm run build   # native + lib + web
```

## Run the instance with the spike

```sh
DSH_OFFICIAL_ROOT="$DST" CAPABILITY_ADMISSION_WEB_PORT=3199 \
  spike/capability-admission/run-web.sh >/tmp/dsh-capability-admission-web-boot.log 2>&1 &
# boot log prints: dsh web: http://127.0.0.1:<port>/?token=<one-time token>
```

`run-web.sh` resets `$CAPABILITY_ADMISSION_WEB_HOME` (default `/tmp/dsh-capability-admission-web`), installs this
package into the throwaway `web` profile with the real plugin manager, and boots
`dsh web --no-open`.

## Probe the DOM

`dom-probe.mjs` needs a Playwright-compatible Chromium. It uses the cached
Playwright browser by default (`CAPABILITY_ADMISSION_CHROMIUM` overrides):

```sh
CAPABILITY_ADMISSION_WEB_URL='http://127.0.0.1:3199/?token=...' \
  node spike/capability-admission/dom-probe.mjs /tmp/capability-admission-dom-probe
```

## Translation unit checks

```sh
node --test spike/capability-admission/approval-bridge.test.mjs
```
