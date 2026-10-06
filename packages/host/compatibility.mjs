/**
 * ZCode version compatibility truth table for the bridge.
 *
 * This module owns the bridge's own verified-version record. It is deliberately NOT derived from
 * the ZCode source version: a tuple only enters `VERIFIED_VERSIONS` after that exact official
 * App version/build/cjs digest was actually observed running (see UPGRADE-COMPATIBILITY.md).
 * The highest verified version is computed from this record, never auto-filled.
 *
 * It contains no Node built-ins so the pure classification can also be exercised from plain
 * fixtures without a running official runtime.
 */

/** Bridge bundle version. Kept in sync with package.json / bridge-bundle.json by the bundle checks. */
export const BRIDGE_VERSION = '0.1.0';
export const BRIDGE_PLUGIN_VERSIONS = Object.freeze({ host: '0.1.0', client: '0.1.0' });

/**
 * Actually verified official ZCode tuples. The first entry is the official runtime install measured baseline:
 * App 3.14.4 / build 3.14.4.7912, cjs SHA-256 fad4c35c…6275f, launched through the App's own
 * Helper in restricted headless mode (auth source unavailable). Scope is recorded honestly;
 * this is not a claim of full runtime parity.
 */
export const VERIFIED_VERSIONS = Object.freeze([
  Object.freeze({
    id: 'zcode-3.14.4-7912',
    version: '3.14.4',
    build: '3.14.4.7912',
    bundleSha256: 'fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f',
    verifiedAt: '2026-10-02',
    evidence: 'Official headless capture: PlistBundler version/build + cjs SHA-256 + Helper launch',
    scope: 'restricted: official session/list read only; official auth source unavailable',
  }),
]);

/** The three R19 dismiss modes. `once` is display-session only; the other two persist. */
export const DISMISS_MODES = Object.freeze(['once', 'this-version', 'new-next-version']);

/** Parse a dotted numeric version (up to four components) or return null. */
export function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0), Number(match[4] ?? 0)];
}

/** Numeric dotted comparison, or null when either side is not a comparable version. */
export function compareVersions(a, b) {
  const left = parseVersion(a), right = parseVersion(b);
  if (!left || !right) return null;
  for (let index = 0; index < 4; index++) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

export function highestVerifiedVersion(verified = VERIFIED_VERSIONS) {
  let best = null;
  for (const tuple of verified) {
    if (parseVersion(tuple?.version) === null) continue;
    if (best === null || compareVersions(tuple.version, best) > 0) best = tuple.version;
  }
  return best;
}

/**
 * Classify an observed installation against the verified record.
 *
 * States and their fail-safe intent (R19/R20):
 *  - verified:            exact version+build+digest tuple. No banner; verified behavior.
 *  - newer-unverified:    actual version > highest verified. Warning banner; still connects,
 *                         version alone never blocks; per-capability fail-safe still applies.
 *  - identity-mismatch:   same version, different build/digest. Old support evidence is NOT reused;
 *                         identity is shown as inconsistent. No "newer" banner.
 *  - other-unverified:    comparable version inside/below the verified set but not an exact tuple.
 *  - unknown:             version undeterminable. Neutral: no banner, no compatibility claim,
 *                         restricted proven-core path only.
 */
export function classifyInstallation(installation, { verified = VERIFIED_VERSIONS } = {}) {
  const highest = highestVerifiedVersion(verified);
  const actual = {
    version: typeof installation?.version === 'string' && installation.version ? installation.version : null,
    build: typeof installation?.build === 'string' && installation.build ? installation.build : null,
    sha256: typeof installation?.sha256 === 'string' && installation.sha256 ? installation.sha256 : null,
  };
  const base = {
    actual,
    highestVerified: highest,
    verifiedTuples: verified.map(tuple => ({ version: tuple.version, build: tuple.build, id: tuple.id })),
  };
  if (parseVersion(actual.version) === null) {
    return { ...base, state: 'unknown', reason: 'version-undetermined', verified: false, digestMatches: false, incompatible: false, failSafe: 'neutral' };
  }
  const matched = verified.find(tuple => tuple.version === actual.version && tuple.build === actual.build && tuple.bundleSha256 === actual.sha256);
  if (matched) {
    return { ...base, state: 'verified', reason: 'exact-verified-tuple', matchedTuple: matched.id, verified: true, digestMatches: true, incompatible: false, failSafe: 'verified' };
  }
  if (verified.some(tuple => tuple.version === actual.version)) {
    return { ...base, state: 'identity-mismatch', reason: 'same-version-different-identity', verified: false, digestMatches: false, incompatible: false, failSafe: 'non-core' };
  }
  const comparison = highest === null ? null : compareVersions(actual.version, highest);
  if (comparison !== null && comparison > 0) {
    return { ...base, state: 'newer-unverified', reason: 'newer-than-highest-verified', verified: false, digestMatches: false, incompatible: false, failSafe: 'non-core' };
  }
  return { ...base, state: 'other-unverified', reason: 'version-outside-verified-set', verified: false, digestMatches: false, incompatible: false, failSafe: 'non-core' };
}

/** True only for the state that mandates a warning banner. Unknown/older/drift stay neutral. */
export function bannerRequired(classification) {
  return classification?.state === 'newer-unverified';
}

/** Bounded projection stored on the host status. No secret material. */
export function compatibilityProjection(installation) {
  const classification = classifyInstallation(installation);
  return {
    ...classification,
    bannerRequired: bannerRequired(classification),
    bridge: { version: BRIDGE_VERSION, plugins: BRIDGE_PLUGIN_VERSIONS },
  };
}
