// Derive S13 fixtures from the real capture. Empty/rejection facts stay real; the lifecycle, account
// and unknown fixtures are injected semantic fixtures validated against the vendored official schemas
// (no automation or off-peak task can be created under the 0-model isolation). Nothing here is
// presented as a live official value.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  zcodeAutomationListResultSchema, zcodeAutomationCreateResultSchema, zcodeAutomationUpdateResultSchema,
  zcodeAutomationDeleteResultSchema, zcodeAutomationCheckTaskBindingResultSchema,
  zcodeOffPeakListResultSchema, zcodeOffPeakCreateResultSchema, zcodeOffPeakTaskSnapshotSchema,
} from '../packages/host/vendor/zcode/v4.mjs';

const dir = resolve(process.argv[2] ?? 'tests/fixtures/s13');
const official = JSON.parse(await readFile(resolve(dir, 'official.json'), 'utf8'));
await mkdir(dir, { recursive: true });

// --- empty.json: strict real projection; nothing injected. ---
const empty = {
  provenance: { ...official.provenance, derivedFrom: 'official.json', injectedFields: [] },
  probes: official.probes,
  errorFacts: official.errorFacts,
  productionOracle: official.productionOracle,
};
await writeFile(resolve(dir, 'empty.json'), JSON.stringify(empty, null, 2) + '\n');

// --- projection.json: injected official lifecycle frames (validated) ---
const automation = {
  automationId: 's13-fixture-automation',
  title: 'Fixture scheduled task',
  cronExpr: '0 9 * * *',
  prompt: 's13 fixture prompt',
  enabled: true,
  lifecycleStatus: 'active',
  nextRunAt: 1_900_000_000_000,
  lastRunAt: 1_800_000_000_000,
  runCount: 3,
  recurring: true,
  scheduleRule: { unit: 'daily', interval: 1, hour: 9, minute: 0, anchorAt: 0 },
};
const offPeakTask = {
  offPeakTaskId: 's13-fixture-offpeak',
  title: 'Fixture off-peak task',
  status: 'queued',
  queuePosition: 2,
  sessionId: 's13-fixture-session',
  createdAt: 1_800_000_000_000,
};
const frames = {
  automationList: { automations: [automation] },
  automationCreate: { automation },
  automationUpdate: { automation: { ...automation, title: 'Fixture scheduled task (updated)', runCount: 4 } },
  automationDelete: { deleted: true },
  automationCheckTaskBinding: { bound: true },
  offPeakList: { tasks: [offPeakTask] },
  offPeakCreate: { ok: true, task: offPeakTask },
  offPeakCreateFailure: { ok: false, failureStage: 'ticket_request', errorCategory: 'eligibility_3101', errorCode: 'offpeak_eligibility_3101' },
};
// Validate the injected frames with the exact vendored official schemas; a mismatch aborts generation.
const validations = {
  automationList: zcodeAutomationListResultSchema,
  automationCreate: zcodeAutomationCreateResultSchema,
  automationUpdate: zcodeAutomationUpdateResultSchema,
  automationDelete: zcodeAutomationDeleteResultSchema,
  automationCheckTaskBinding: zcodeAutomationCheckTaskBindingResultSchema,
  offPeakList: zcodeOffPeakListResultSchema,
  offPeakCreate: zcodeOffPeakCreateResultSchema,
  offPeakCreateFailure: zcodeOffPeakCreateResultSchema,
};
for (const [name, schema] of Object.entries(validations)) {
  const parsed = schema.safeParse(frames[name]);
  if (!parsed.success) throw Error(`fixture frame ${name} rejected by the official schema: ${parsed.error.message}`);
}
zcodeOffPeakTaskSnapshotSchema.parse(offPeakTask);
const projection = {
  provenance: {
    kind: 'injected-semantic-fixture',
    note: 'Injected automation/off-peak lifecycle frames validated by the vendored official schemas. No live carrier exists: automation/* and offPeak/* are Host-consumed reverse methods (real probe: -32601). Never a run or task created by this bridge.',
    injectedFields: Object.keys(frames),
  },
  frames,
};
await writeFile(resolve(dir, 'projection.json'), JSON.stringify(projection, null, 2) + '\n');

// --- restricted.json: UNKNOWN account/entitlement + injected reverse-callback observations ---
const restricted = {
  provenance: {
    kind: 'injected-semantic-fixture',
    note: 'Account/off-peak entitlement are Host-service facts with no app-server carrier; reverse-callback records cannot be produced under 0-model isolation and are injected here as official-shaped observations. UNKNOWN is never resolved by guessing.',
    injectedFields: ['account', 'offPeakEntitlement', 'reverse'],
  },
  account: { state: 'unknown', reason: 'official-account-carrier-not-exposed', auth: 'unavailable' },
  offPeakEntitlement: { state: 'unknown', reason: 'off-peak-entitlement-is-host-service-only' },
  offPeakSupportUnsupported: { supported: false, reason: 'start_plan_not_supported' },
  reverse: {
    allowed: true,
    reason: 'official-host-consumed-reverse-carrier',
    records: [
      { id: 'fixture-reverse-1', method: 'automation/list', identity: null, status: 'rejected', outcome: 'rejected', protocolCode: -32601, reason: 'official-host-consumed-reverse-carrier' },
      { id: 'fixture-reverse-2', method: 'automation/delete', identity: { key: 'automationId', value: 's13-expired-automation' }, status: 'rejected', outcome: 'rejected', protocolCode: -32601, reason: 'official-host-consumed-reverse-carrier' },
    ],
  },
};
await writeFile(resolve(dir, 'restricted.json'), JSON.stringify(restricted, null, 2) + '\n');

// --- unknown.json: future/unknown shapes used for fail-safe coverage (NOT schema-valid on purpose) ---
const unknown = {
  provenance: {
    kind: 'injected-semantic-fixture',
    note: 'Deliberately unknown/future shapes so fail-safe handling is covered: an unknown value must never be turned into a created/succeeded claim.',
    injectedFields: ['automation', 'offPeakTask', 'offPeakFailure', 'unknownEntry'],
  },
  automation: { ...automation, lifecycleStatus: 'future_status', nextRunAt: 'not-a-timestamp' },
  offPeakTask: { ...offPeakTask, status: 'future_status' },
  offPeakFailure: { ok: false, failureStage: 'future_stage', errorCategory: 'future_category', errorCode: 'future_code' },
  unknownEntry: { kind: 'future-automation-entry', detail: { unexpected: true } },
};
await writeFile(resolve(dir, 'unknown.json'), JSON.stringify(unknown, null, 2) + '\n');

console.log(JSON.stringify({ empty: Object.keys(empty.probes).length, frames: Object.keys(frames).length, status: 'PASS' }));
