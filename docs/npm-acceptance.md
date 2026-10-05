# Isolated npm acceptance environment (S08 support)

Run from this bridge checkout, with its dependencies already installed:

```sh
node scripts/start-npm-acceptance.mjs --port 3208
```

The builder creates a new temporary root, installs `@deepseek-ai/dsh@latest` with `npm install --prefix <root>/npm`, builds the bridge, and invokes that installed CLI's **real plugin manager** with `plugin --profile web add --ignore-scripts file:<bridge> file:<host> file:<client>`. It creates an isolated `DSH_HOME`, profile, workspace, npm/pnpm caches, then starts `dsh web --no-open`. There is no global installation, source-copy CLI fallback, reference/package modification, or official mutation/model request. `HOME` and the bridge's sandbox/Route-B landing rules are unchanged. Automatic native session-title generation is disabled in this isolated profile to preserve the zero-call boundary.

Options:

- `--root /absolute/new/path`: preserve evidence at a chosen **new** root. Existing roots are refused rather than overwritten.
- `--port 3208`: refuses occupied ports; never stops another instance.
- `--prepare-only`: install/configure without starting the web server.
- `--smoke`: boot the web UI, perform its normal local token/cookie authentication and read-only bridge `status`, then stop only the owned child. This is an HTTP/environment smoke, not parent browser acceptance.
- `--diagnose-version-seams`: only after the real manager rejects the host's declared version range, grant its **exact host-version / exact DSH-version** exemption using `dsh plugin allow-version ... --accept-risk`, within this isolated profile, then retry the real `file:` installation. This diagnostic permission neither changes shipped peer ranges nor establishes compatibility/acceptance. Default runs retain the version rejection.

Local outputs: `environment-result.json`, `npm-install.log`, `bridge-build.log`, `plugin-install.log`, optional diagnostic-install logs, and `web.log`. `web.log` contains the temporary browser launch token; keep it local. JSON summaries contain no token or official credentials. Exit 0 means prepared/HTTP smoke completed; exit 1 means setup/boot failure; exit 2 means the boot/status probe observed plugin seam errors. Parent must inspect the recorded version exemption and runtime state even after exit 0.

Launcher prerequisites reuse the previously prepared read-only official Host artifact and Electron under `../.agent-work/tmp/host-reuse-probe`. `DSH_ACCEPTANCE_ARTIFACT` and `DSH_ACCEPTANCE_ELECTRON` can point at equivalent existing prerequisites; production artifact hashes, HOME/socket/sandbox checks still apply. The default scratch root is `/private/tmp/dshw/n8`, with a fresh short run ID. The builder never extracts/replaces official artifacts or relaxes those validators.

## Measured npm/source difference

Registry latest measured 2026-10-05 is **0.2.0-rc.2**. Development source copy is **0.2.1-alpha.1** (reference revision `5badb150`). `@dsh-zcode/host@0.1.0` declares optional peers `@deepseek-ai/dsh-scope` and `@deepseek-ai/dsh-agent` as `^0.2.1-alpha.1`. The npm release's real plugin manager rejects installation against `0.2.0-rc.2` and reports “nothing was installed.” This is a confirmed version-gate seam, not evidence that the underlying registration APIs are absent. No peer range was broadened and no reference/npm package was edited.

Evidence from the initial default run is `/private/tmp/dsh-s08-npm-environment/{environment-result.json,plugin-install.log}`. Diagnostic runs and final HTTP/status outcome are recorded in [S08 worker handoff](s08-worker-handoff.md). The early diagnostic HTTP probes followed redirects without retaining the authentication cookie and incorrectly reported boot failure; the corrected probe performs the npm release's token → signed-cookie exchange explicitly. Those failures are preserved, not counted as successful acceptance or missing APIs.

The parent owns read-only browser verification, the human write checklist, per-entry evidence, independent review, and final requirement-level disposition. A source-built instance or diagnostic version exemption must not silently replace npm acceptance. If the npm version gate or a required runtime seam remains unresolved, record the constraint and keep acceptance blocked rather than patching the official application.
