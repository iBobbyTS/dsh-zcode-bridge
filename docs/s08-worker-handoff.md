# S08 worker-support handoff

Base `c151d76da9d6c37cbb791d098d37fb05df090389`; branch `feat/official-dsh-runtime-mirror`. This is supporting implementation/evidence, not final S08 acceptance. Parent owns browser-use read-only verification, the manual-write checklist, per-entry acceptance results, independent review and plan archival. No subagents or independent reviewers were dispatched here. No push.

## Delivered

- [npm builder and measured constraint](npm-acceptance.md): `scripts/start-npm-acceptance.mjs`, isolated npm installation, isolated `DSH_HOME`, real `file:` plugin-manager install, original Route-B validators and web boot. Default version rejection remains enforced. Optional diagnostic-only exact-version exemption is recorded explicitly.
- Five mandatory declaration rows closed: `session/setMode` (functional equivalent via v4), `switchCollaborationMode`, `v4/conversation/plans`, `v4/conversation/fileChanges`, `v4/conversation/fileRewindPreview`. Production registered-session owner → typed resource/durable command owner → active nonce-bound Host relay → session dock consumer. Mode remains official snapshot state after ACK and controls subsequent inputs/persistence. File reads retain existing target/revision/epoch admission; stale/replaced responses cannot become current UI data. Rewind preview has no apply/delete control.
- [28-row successor handoff](s08-gap-handoff.md): 26 partial + 2 unimplemented. Counts by successor group: history hydration 4; background work 4; session diagnostics 1; automation fields 2; interaction mapping 3; hook trust 5; history mutations 9. Original mandatory/approved-owner columns stay unchanged. No full-parity completion or requirement waiver is claimed.
- S01⑩ temporary skips were already restored in accepted S02/S03. Confirmed active CB4/CB5/CB6/CB14 rebinds and zero active skip declarations; replaced the unused obsolete skip constant with restoration evidence annotations. No previously live test was disabled or discarded.
- [Residual NIT ledger](s08-residual-nits.md), with historical details explicitly unverified where absent.
- [150-entry report skeleton](s08-entry-report.md), generated from status-annotated PROTOCOL-COVERAGE by `scripts/generate-s08-report.mjs`. All five table counts, original names, mandatory flags and approved owners are retained. Both browser evidence columns are empty. Bridge/root coverage copies remain identical. Current mandatory implementation totals: **82 implemented / 26 partial / 2 unimplemented**.

## npm run outcome

**Seam difference found: version metadata gate.** Registry latest **0.2.0-rc.2** differs from development source **0.2.1-alpha.1**. Host peers require `^0.2.1-alpha.1`; the real npm plugin manager rejects the default installation and says nothing was installed. Neither official package/reference files nor shipped peer ranges were changed.

Final diagnostic evidence root: `/private/tmp/dsh-s08-npm-verified`. `environment-result.json` records:

- isolated npm install exit 0; initial plugin-install exit 1 (peer-range gate);
- exact `@dsh-zcode/host@0.1.0` / `dsh 0.2.0-rc.2` diagnostic exemption exit 0, real plugin-install retry exit 0;
- local token/cookie exchange HTTP **303**, authenticated web index **200**, bridge read-only status **200**;
- bridge `state=authenticated`, `reason=route-b-authenticated-read-only`, launcher `phase=ready`, `runtimeReady=true`, no plugin errors in the captured server log;
- outcome `web-booted-with-diagnostic-exemption`; smoke stopped only its owned web child, exit 0.

This proves npm web boot, installed bridge RPC reachability and launcher readiness under the diagnostic exemption. It does not prove every client/runtime seam, browser rendering, or real writes. No missing registration/adapter API was established by this smoke. Parent must retain the default-install compatibility constraint when deciding acceptance. A new builder invocation creates a fresh environment/run ID; do not reuse a stopped profile's consumed launcher run ID.

Preserved prior attempts: `/private/tmp/dsh-s08-npm-environment` (honest default version rejection); `/private/tmp/dsh-s08-npm-diagnostic` and `-v2` (HTTP-probe redirect/cookie handling errors, corrected in the delivered builder); `/private/tmp/dsh-s08-npm-final` (HTTP/status success sampled while launcher still starting). These are not full acceptance passes. Local npm metadata pre-probe is `/private/tmp/dsh-s08-npm-probe`. No launch tokens are included in this handoff.

## Verification and boundaries

- Full suite: **449 tests / 449 pass / 0 fail / 0 skipped / 0 cancelled**. Five new behavior tests: active history read/identity/denial, late-result/schema rejection, durable mode projection/subsequent input, actual mode picker, actual history panel. Targeted neighboring UI/integration set: **15/15 pass**.
- Build PASS. Pack dry-run and actual tarball PASS: **59 files**, all archive members byte-equal current source/build, no workflow/test/script/spike payload. Script syntax, generated row/count/blank-evidence invariants, coverage identity/owner preservation, root equality, diff whitespace and no-deleted-path checks PASS.
- Logs remain local under `../.agent-work/tmp/s08-{targeted,full-suite,build,pack,npm}*`; final suite `s08-full-suite-final.log`. Initial targeted late-epoch test expected a stale-epoch error; the old subscription correctly failed projection admission first. The corrected oracle asserts that explicit fail-closed result. No production admission guard was relaxed.
- A later full run recorded **448/449**, with unchanged B01 ID-ownership test timing out after 44ms under its fixture's arbitrary 40ms wall-clock deadline. Counterfactual `s08-timer-counterfactual.log`: a delayed harness fails with the real timer and preserves both ID owners/responses with a controlled timer (**2/2**). The ownership test now freezes `setTimeout` while crossing event-loop barriers, then advances after disposal to assert cleanup. Neighboring actual timeout coverage remains live; production timeout policy is unchanged. Failed full evidence is `s08-full-suite-timeout.log`; corrected identity oracle repeated **10/10**, all transport boundary tests **7/7**, final original `npm test` **449/449**.
- **Real model calls issued: 0. Official mutation/execution requests issued: 0.** Only startup and read-only `status` were exercised on the live npm instance. No create/send/delete/rename/stop/queue edit/feedback/attachment upload/hook/configuration mutation was invoked against the official app. The isolated DSH plugin/profile installation and diagnostic permission were the authorized local environment setup.
- Both reference repositories' final porcelain is empty. Sandbox/HOME/credential/process-isolation owners are unchanged. No deletion entries, `.agent-work` commits, push or plan acceptance/archival.

Residual acceptance constraints: default npm version gate, 28 mandatory successor gaps, cross-process queue arbitration/approval winner detection. They remain explicit constraints rather than NITs or completed parity. Parent must fill live browser evidence and resolve requirement-level closure before final acceptance.
