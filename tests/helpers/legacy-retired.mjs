// S01 item ⑩ — test-baseline repair, shared skip annotations.
//
// Two distinct classes are recorded here so a later section can tell them apart:
//
//  * RESTORABLE (see tests/s05-cb6-state-regression.test.mjs): the suite bundles only
//    packages/client/conversation-view.jsx (React + local modules) and needed nothing
//    from the deleted fork checkout except jsdom. jsdom is now a devDependency of this
//    repository, so the coverage is live again.
//
//  * RETIRED_TEMP_SKIP (below): the suite exercises the fork-era Client foreign-source
//    layer (packages/client/sources.mjs) or a fork-only DSH UI path (../dsh/packages/
//    client/ui-session/...). sources.mjs imports symbols that do not exist in official
//    DSH (@deepseek-ai/dsh-api-session-controller/client has no createNativeSessionSource,
//    parseRuntimeSessionAddress, parseRuntimeSessionKey or runtimeSessionKey), and the
//    ../dsh checkout that supplied both jsdom and the fork tsconfig was deleted.
//
//    These suites are NOT deleted: their bodies stay intact. Coverage is re-established
//    by S02/S03 when the retired fork client layer is replaced by the official
//    runtime-source seam, at which point the bodies must be rebound (not restored
//    verbatim) and this skip removed.
export const RETIRED_TEMP_SKIP =
  'RETIRED_TEMP_SKIP (S01 ⑩): fork-era client layer (sources.mjs or ../dsh UI path) is not loadable against official DSH; coverage re-established by S02/S03 rebind';
