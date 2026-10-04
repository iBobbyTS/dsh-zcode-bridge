import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { conversationTopicFrameSchema } from '../packages/host/vendor/zcode/v4.mjs';
const source = JSON.parse(await readFile('tests/fixtures/s03a/success.json', 'utf8'));
const initial = structuredClone(source.initial), s = initial.frame.payload.snapshot;
s.control = { ...s.control, phase: 'completedSuccess', canStop: false, activeWorks: [] };
s.inputRouting = { mode: 'startNow' }; s.queue = { items: [], autoDrain: true };
s.availability.compact = { allowed: true }; s.availability.fork = { allowed: true };
s.revision = 8; s.seq = 8; initial.frame.toSeq = 8;
s.rows = { window: [], totalCount: 6, firstRowId: 1 };
for (let turn = 1; turn <= 2; turn++) {
  const base = { turnId: `turn-${turn}`, createdAt: turn, createdAtSeq: turn, productTurnId: `product-${turn}` };
  s.rows.window.push(
    { ...base, kind: 'turnHeader', rowId: turn * 3 - 2, entityId: `header-${turn}`, origin: 'userInput', state: 'completedSuccess', startedAt: turn, fileChanges: { files: 1, additions: 1, deletions: 1, state: 'active' }, actions: { canRewindFiles: true }, sourceCommandId: `original-${turn}` },
    { ...base, kind: 'userInput', rowId: turn * 3 - 1, entityId: `input-${turn}`, origin: 'realUser', text: `Write version ${turn}`, sourceCommandId: `original-${turn}`, ...(turn === 2 ? { actions: { canEdit: true, editDisposition: 'rewind' } } : {}) },
    { ...base, kind: 'assistantText', rowId: turn * 3, entityId: `reply-${turn}`, text: `Wrote version ${turn}`, state: 'complete', actions: { canFork: true, ...(turn === 2 ? { canRetry: true } : {}) } },
  );
}
const fileChanges = { files: 1, additions: 1, deletions: 1, state: 'active', items: [{ path: 'sample.txt', additions: 1, deletions: 1, writeCount: 1, toolNames: ['Write'], patches: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-version 1', '+version 2'] }] }] };
const preview = { canApply: true, safeFiles: [{ action: 'restore', path: 'sample.txt', operationCount: 1, toolNames: ['Write'] }], unsafeFiles: [], ignoredFiles: [] };
const busy = structuredClone(initial); busy.frame.payload.snapshot.control.phase = 'running'; busy.frame.payload.snapshot.control.activeWorks = [{ kind: 'primaryTurn', foregroundExecutionId: 'busy-turn', startedAt: 3 }]; busy.frame.payload.snapshot.inputRouting = { mode: 'enqueue' };
const held = structuredClone(initial); held.frame.payload.snapshot.inputRouting = { mode: 'choice' }; held.frame.payload.snapshot.queue.autoDrain = false;
const locked = structuredClone(busy); locked.frame.payload.snapshot.control.activeWorks = [{ kind: 'compact', startedAt: 3 }]; locked.frame.payload.snapshot.availability.compact = { allowed: false, reasonCode: 'compactOperationLock' };
const unsafe = { canApply: false, safeFiles: [], unsafeFiles: [{ path: 'sample.txt', operationCount: 1, toolNames: ['Write'], reason: 'external_modified', currentHash: 'new', expectedHash: 'old' }], ignoredFiles: [] };
await mkdir('tests/fixtures/s08', { recursive: true });
for (const [name, frame] of Object.entries({ success: initial, busy, held, locked })) {
  conversationTopicFrameSchema.parse(frame.frame);
  await writeFile(`tests/fixtures/s08/${name}.json`, JSON.stringify({ provenance: { kind: 'injected-from-official-capture', source: 'tests/fixtures/s03a/success.json', paidModelCalls: 0, changes: ['two-turn rows, identity/actions, revision, file diffs/checkpoints and compact admission are injected; not real model output or official file mutation'] }, ack: source.ack, initial: frame, fileChanges, preview, unsafe }, null, 2) + '\n');
}
