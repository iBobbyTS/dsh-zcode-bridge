// Derive background-subagents fixtures from already-real evidence.
//
// - empty.json is a strict projection of the real headless capture (real empty state and real
//   official unknown-id rejections). No field is invented.
// - lifecycle.json starts from the real official transport-v4 snapshot/ACK envelope and injects only the
//   backgroundWorks/subagents state keys. It is explicitly marked as injected because the task
//   forbids starting a real model task or subagent (0 model calls).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const official = JSON.parse(await readFile(resolve(root, 'tests/fixtures/background-subagents/official.json'), 'utf8'));
const success = JSON.parse(await readFile(resolve(root, 'tests/fixtures/transport-v4/success.json'), 'utf8'));
const destination = resolve(root, 'tests/fixtures/background-subagents');
await mkdir(destination, { recursive: true });

const pick = (entry, keys) => Object.fromEntries(keys.filter(key => entry?.[key] !== undefined).map(key => [key, entry[key]]));

// ── empty.json: everything below comes from the real capture ──
const empty = {
  provenance: {
    kind: 'derived-from-official-capture',
    source: 'tests/fixtures/background-subagents/official.json',
    capturedAt: official.provenance.capturedAt,
    officialVersion: official.provenance.version,
    officialSha256: official.provenance.sha256,
    paidModelCalls: 0,
    injection: 'none',
  },
  projection: official.probes.conversationProjection?.result ?? null,
  subagentsEmpty: official.probes.subagentsEmpty?.result ?? null,
  rejections: {
    subagentsDraft: pick(official.probes.subagentsDraft, ['error']),
    subagentsUnknownSession: pick(official.probes.subagentsUnknownSession, ['error']),
    cancelUnknownTaskLegacy: pick(official.probes.cancelUnknownTaskLegacy, ['result']),
    cancelUnknownSessionLegacy: pick(official.probes.cancelUnknownSessionLegacy, ['error']),
    bashOutputUnknown: pick(official.probes.bashOutputUnknown, ['result']),
    cancelUnknownWorkCommand: pick(official.probes.cancelUnknownWorkCommand, ['result']),
    cancelUnknownWorkSession: pick(official.probes.cancelUnknownWorkSession, ['result']),
  },
};
if (!empty.projection || empty.projection.backgroundWorks?.length !== 0 || empty.projection.status !== 'live') throw Error('background-subagents-empty-capture-shape');

const clone = structuredClone;
const ack = success.ack;
const startedAt = 1735689600000;
const bashWork = { workId: 'subagents-work-bash', kind: 'bash', title: 'background bash', status: 'running', startedAt, cancellable: true, blocked: false, anchorRowId: null };
const subagentWork = { workId: 'subagents-work-subagent', kind: 'subagent', title: 'background subagent', status: 'running', startedAt, cancellable: true, blocked: false, anchorRowId: null, childSessionId: 'subagents-child-session' };
const subagentRunning = { childSessionId: 'subagents-child-session', agentId: 'subagents-agent', toolCallId: 'subagents-tool-call', subagentType: 'general', title: 'background subagent', status: 'running', startedAt };

const initial = clone(success.initial);
initial.logicalFrameId = 'subagents-initial';
initial.logicalFrameOrdinal = 1;
initial.frame.payload.snapshot.backgroundWorks = [bashWork, subagentWork];
initial.frame.payload.snapshot.subagents = { revision: initial.frame.payload.snapshot.revision, childSessionIds: ['subagents-child-session'], running: [subagentRunning], endedTotal: 0 };

function stateFrame(id, ordinal, fromSeq, toSeq, patch) {
  const frame = clone(success.online);
  frame.logicalFrameId = id;
  frame.logicalFrameOrdinal = ordinal;
  frame.frame.fromSeq = fromSeq;
  frame.frame.toSeq = toSeq;
  frame.frame.payload.deltas = [{ op: 'state.updated', patch }];
  return frame;
}

// The bash work is cancelled; the subagent keeps running.
const bashCancelled = { ...bashWork, status: 'cancelled', endedAt: startedAt + 1000, cancellable: false };
const cancelled = stateFrame('subagents-bash-cancelled', 2, 0, 1, { backgroundWorks: [bashCancelled, subagentWork] });
// The subagent work finishes (its result is pending), then a brand-new unrelated work starts.
const subagentResultPending = { ...subagentWork, status: 'resultPending', cancellable: false, endedAt: startedAt + 2000 };
const subagentSettled = stateFrame('subagents-settled', 3, 1, 2, {
  backgroundWorks: [bashCancelled, subagentResultPending],
  subagents: { revision: initial.frame.payload.snapshot.revision + 1, childSessionIds: ['subagents-child-session'], running: [], endedTotal: 1 },
});
const newWork = { workId: 'subagents-work-new', kind: 'bash', title: 'later unrelated work', status: 'running', startedAt: startedAt + 3000, cancellable: true, blocked: false, anchorRowId: null };
const laterWorkStarted = stateFrame('subagents-later-work', 4, 2, 3, { backgroundWorks: [bashCancelled, subagentResultPending, newWork] });

const lifecycle = {
  provenance: {
    kind: 'official-envelope-with-injected-work-keys',
    envelopeSource: 'tests/fixtures/transport-v4/success.json (real official snapshot/ACK)',
    injection: 'backgroundWorks and subagents state keys are injected; no real background task or subagent was started (0 model calls)',
    officialVersion: official.provenance.version,
    officialSha256: official.provenance.sha256,
  },
  ack,
  initial,
  cancelled,
  subagentSettled,
  laterWorkStarted,
  works: { bashWork, subagentWork, bashCancelled, subagentResultPending, newWork },
  subagents: { running: subagentRunning },
};

await writeFile(resolve(destination, 'empty.json'), JSON.stringify(empty, null, 2) + '\n');
await writeFile(resolve(destination, 'lifecycle.json'), JSON.stringify(lifecycle, null, 2) + '\n');
console.log(JSON.stringify({ empty: Object.keys(empty), lifecycle: { frames: ['initial', 'cancelled', 'subagentSettled', 'laterWorkStarted'], injected: true } }));
