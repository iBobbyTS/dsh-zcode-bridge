import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { conversationTopicFrameSchema } from '../packages/host/vendor/zcode/v4.mjs';
const source = JSON.parse(await readFile('tests/fixtures/s03a/success.json', 'utf8'));
const busy = structuredClone(source.initial);
const snapshot = busy.frame.payload.snapshot;
snapshot.control = { ...snapshot.control, phase: 'running', canStop: true, activeWorks: [{ kind: 'primaryTurn', foregroundExecutionId: 'execution-old', startedAt: 1 }] };
snapshot.inputRouting = { mode: 'enqueue' };
for (const key of ['queueEdit', 'sendQueuedNow', 'switchModelConfig', 'setFollowupMode', 'pauseGoal', 'resumeGoal']) snapshot.availability[key] = { allowed: true };
snapshot.config = { ...snapshot.config, provider: 'fixture-provider', model: 'model-old', thought: 'high', thoughtLevels: ['low', 'high'], modelSelection: { providerId: 'fixture-provider', modelId: 'model-old', options: { reasoningLevel: 'high' } }, mode: 'build', planEnabled: false };
function item(id, text, seq) {
  return { sourceCommandId: `command-${id}`, queueItemId: id, clientId: 'fixture-client', kind: 'sendText', text, attachments: [], modelSelection: structuredClone(snapshot.config.modelSelection), mode: 'build', planEnabled: false, delivery: { requested: 'queue', admitted: 'queue' }, order: { admissionSeq: seq, queuePosition: seq - 1 }, steer: { state: 'notRequested' }, dispatch: { state: 'queued' }, admittedAt: seq };
}
snapshot.queue = { items: [item('input-a', 'ALPHA: first queued task', 1), item('input-b', 'BETA: second queued task', 2)], autoDrain: true };
snapshot.rows = { window: [
  { kind: 'turnHeader', rowId: 1, turnId: 'turn-old', createdAt: 1, createdAtSeq: 0, origin: 'userInput', state: 'running', startedAt: 1, sourceCommandId: 'command-running' },
  { kind: 'assistantText', rowId: 2, turnId: 'turn-old', createdAt: 1, createdAtSeq: 0, text: 'Injected busy response', state: 'streaming', model: 'model-old' },
], totalCount: 2, firstRowId: 1 };
snapshot.goal = { objective: 'Fixture goal', status: 'active', iteration: 1, verifications: [] };
const held = structuredClone(busy);
held.frame.payload.snapshot.control = { ...snapshot.control, phase: 'completedInterrupted', canStop: false, activeWorks: [] };
held.frame.payload.snapshot.inputRouting = { mode: 'choice' };
held.frame.payload.snapshot.queue.autoDrain = false;
held.frame.payload.snapshot.queue.pauseReason = 'stopped';
held.frame.payload.snapshot.rows.window[0].state = 'completedInterrupted';
held.frame.payload.snapshot.rows.window[1].state = 'interrupted';
const inserted = structuredClone(held);
inserted.frame.payload.snapshot.queue.items.push(item('input-other', 'GAMMA: inserted by another client', 3));
const switched = structuredClone(busy);
switched.frame.payload.snapshot.config = { ...snapshot.config, model: 'model-next', thought: 'low', modelSelection: { providerId: 'fixture-provider', modelId: 'model-next', options: { reasoningLevel: 'low' } }, mode: 'edit' };
const reordered = structuredClone(busy);
reordered.frame.payload.snapshot.queue.items.reverse();
const guided = structuredClone(busy);
guided.frame.payload.snapshot.inputRouting = { mode: 'guide' };
guided.frame.payload.snapshot.queue.items[1].delivery = { requested: 'guide', admitted: 'queue', fallbackReasonCode: 'guide.attachmentsUnsupported' };
guided.frame.payload.snapshot.queue.items[1].steer = { state: 'fellBack', reasonCode: 'guide.attachmentsUnsupported' };
await mkdir('tests/fixtures/s06', { recursive: true });
for (const [name, initial] of Object.entries({ busy, held, inserted, switched, reordered, guided })) {
  conversationTopicFrameSchema.parse(initial.frame);
  await writeFile(`tests/fixtures/s06/${name}.json`, JSON.stringify({ provenance: { kind: 'injected-from-official-capture', source: 'tests/fixtures/s03a/success.json', runtimeSha256: source.provenance.runtimeSha256, paidModelCalls: 0, changes: ['control, inputRouting, availability, config, queue, rows, goal are explicitly injected; not a live busy/model oracle'] }, ack: source.ack, initial }, null, 2) + '\n');
}
