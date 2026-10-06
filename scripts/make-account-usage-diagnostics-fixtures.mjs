// Derives reusable account-usage-diagnostics fixtures from the real capture. Real official frames stay verbatim; every
// injected case is validated by the official schema and listed in provenance, and is never
// presented as a live success. No model was invoked to produce any of these values.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {
  zcodeUsageStatsResultSchema, zcodeTaskTokenUsageResultSchema,
  zcodeProcessChildProcessesResultSchema, zcodeProcessResourceSampleSchema,
} from '../packages/host/vendor/zcode/v4.mjs';

const official = JSON.parse(await readFile('tests/fixtures/account-usage-diagnostics/official.json', 'utf8'));
const out = 'tests/fixtures/account-usage-diagnostics';
await mkdir(out, { recursive: true });
const write = (name, data) => writeFile(`${out}/${name}`, JSON.stringify(data, null, 2) + '\n');
const probe = name => official.probes[name]?.result ?? null;

// 1) Real usage/diagnostic reads plus schema-validated non-empty projections (the 0-model capture
//    can only observe an empty isolated store; the non-empty shape is injected, not measured).
const emptyUsage = probe('usageStats30d');
const nonEmptyUsage = zcodeUsageStatsResultSchema.parse({
  ...emptyUsage,
  summary: {
    ...emptyUsage.summary,
    totalTokens: 123456, inputTokens: 100000, outputTokens: 23456, reasoningTokens: 4096,
    cacheCreationTokens: 8000, cacheReadTokens: 30000, cacheHitRate: 0.3,
    totalSessions: 7, totalTurns: 42, toolCallCount: 88, toolErrorRate: 0.01,
    modelErrorRate: 0.02, activeDays: 3, currentStreakDays: 2, peakDayTokens: 70000,
    favoriteModel: { modelId: 'glm-4.6', totalTokens: 90000, share: 0.73 },
  },
});
const emptySessionUsage = probe('sessionUsage');
const nonEmptySessionUsage = zcodeTaskTokenUsageResultSchema.parse({
  ...emptySessionUsage, totalTokens: 4200, inputTokens: 3600, outputTokens: 600,
  reasoningTokens: 120, modelRequestCount: 3, modelErrorCount: 0, inputBaselineBySource: { main: 3600 },
});
const childProcesses = zcodeProcessChildProcessesResultSchema.parse(probe('childProcesses') ?? { processes: [] });
const childProcessesNonEmpty = zcodeProcessChildProcessesResultSchema.parse({
  processes: [
    { pid: 4242, serverName: 'diagnostics-demo', mcpSource: 'plugin', pluginName: 'browser-use' },
    { pid: 4243, serverName: 'diagnostics-custom', mcpSource: 'custom' },
  ],
});
const resourceSample = zcodeProcessResourceSampleSchema.parse({
  platform: 'darwin', arch: 'arm64', logicalCpuCount: 8, intervalMs: 60000,
  cpuCores: 0.5, cpuPercent: 6.25, rssKb: 123456, heapUsedKb: 40000,
  uptimeMinutes: 12, totalMemoryGb: 16, instanceToken: 'diagnostics-fixture-token-01',
});

await write('usage.json', {
  provenance: {
    kind: 'real-capture-derived',
    source: 'official.json',
    capturedAt: official.provenance.capturedAt,
    paidModelCalls: 0,
    real: ['usageStats30d', 'sessionUsage', 'childProcesses (empty)', 'cancelGenerateTextUnknown'],
    injected: ['nonEmptyUsage', 'nonEmptySessionUsage', 'childProcessesNonEmpty', 'resourceSample'],
    note: 'injected cases are official-schema validated; the isolated 0-model capture only observes an empty store',
  },
  emptyUsage,
  nonEmptyUsage,
  emptySessionUsage,
  nonEmptySessionUsage,
  childProcesses,
  childProcessesNonEmpty,
  resourceSample,
  cancelGenerateTextUnknown: probe('cancelGenerateTextUnknown'),
});

// 2) Honest account projection + gated model surfaces, taken from the real production client.
await write('account.json', {
  provenance: {
    kind: 'real-production-oracle',
    source: 'official.json productionOracle',
    paidModelCalls: 0,
    note: 'account/status returned the official -32601; no account carrier exists, so state stays UNKNOWN',
  },
  account: official.productionOracle.account,
  gated: official.productionOracle.gated,
  accountStatusProbe: official.probes.accountStatusAbsent,
});

// 3) Unknown/future entries fail safe instead of crashing or claiming a fact.
await write('unknown.json', {
  provenance: { kind: 'injected-from-official-schema', injected: ['unknown read kind', 'future account state'] },
  readError: { code: 'insights-read-unknown' },
  accountUnknown: {
    state: 'future_state', reason: 'future-reason', auth: 'unconfirmed',
    query: { available: false, reason: 'future-reason' }, login: { available: false, reason: 'future-reason' },
  },
});

console.log(JSON.stringify({
  usage: Object.keys(probe('usageStats30d') ?? {}).length,
  realUsageTokens: emptyUsage.summary.totalTokens,
  injectedUsageTokens: nonEmptyUsage.summary.totalTokens,
  childProcesses: childProcesses.processes.length,
}));
