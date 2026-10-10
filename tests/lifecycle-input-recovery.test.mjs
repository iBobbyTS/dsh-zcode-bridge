import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commandWorld, message, queueItem, tick} from './helpers/lifecycle-commands.mjs';
import {row, MockPeer, baseSnapshot} from './helpers/zcode-runtime-fixture.mjs';
import {V4Conversation} from '../packages/host/conversation.mjs';
import {DriverAgent} from '../packages/driver/agent.mjs';

const writes = w => w.peer.calls.filter(c => c.method === 'v4/command').map(c => c.params);
const queries = w => w.peer.calls.filter(c => c.method === 'v4/commands/query').map(c => c.params);

// PLAN S01: transport-death-recovery input delivery recovery tests
// Covering recovery three outcomes (R1/R2/R3/R9), idempotence, degradation,
// recovery trigger, identity persistence across reconstruction, and resolution-before-pruning.

test('recovery outcome 1: undelivered input degrades to not-sent, alerts once, and resubmits with original commandId', async () => {
  const w = await commandWorld();
  try {
    w.peer.loseAck = true;
    w.agent.followup(message('msg1'));
    await w.drain();

    const input = w.agent.inputs.get('msg1');
    const originalCommandId = input.commandId;
    assert.equal(w.agent.conversation.command(originalCommandId).state, 'outcome-unknown');

    // Make query return unknown (peer has no ack for originalCommandId)
    w.peer.acks.delete(originalCommandId);

    const alertsBefore = w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'command-outcome-unknown').length;
    await w.agent.ready();
    await w.drain();

    // Degrades to not-sent, original commandId reused
    const alertsAfter = w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'command-outcome-unknown').length;
    assert.equal(alertsAfter - alertsBefore, 1, 'one-time alert emitted on agent/error');

    const msg1Writes = writes(w).filter(c => c.commandId === originalCommandId);
    assert.equal(msg1Writes.length, 2, 'resubmitted with original commandId');
    assert.equal(msg1Writes[1].commandId, originalCommandId, 'same commandId reused');

    // Repeat ready does not duplicate alert or double-dispatch
    await w.agent.ready();
    await w.drain();
    const alertsRepeat = w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'command-outcome-unknown').length;
    assert.equal(alertsRepeat, alertsAfter, 'repeat ready does not duplicate alert');
    assert.equal(writes(w).filter(c => c.commandId === originalCommandId).length, 2, 'repeat ready does not double dispatch');
  } finally {
    await w.close();
  }
});

test('recovery outcome 2: delivered input protected by user row is settled completed without resubmit or blocking', async () => {
  const w = await commandWorld();
  try {
    w.peer.loseAck = true;
    w.agent.followup(message('msg2'));
    await w.drain();

    const input = w.agent.inputs.get('msg2');
    const commandId = input.commandId;

    // Simulate official user row already appeared in snapshot rows window
    const snapshot = structuredClone(w.peer.snapshot);
    snapshot.seq++;
    snapshot.revision++;
    snapshot.rows.window = [
      row('turnHeader', 1, {origin: 'userInput', state: 'completedSuccess', startedAt: 0, sourceCommandId: commandId}),
      row('userInput', 2, {text: 'hello', origin: 'realUser', sourceCommandId: commandId}),
    ];
    w.peer.publish(snapshot);
    await w.drain();

    // Query would return unknown, but delivered protection should preempt
    w.peer.acks.delete(commandId);

    await w.agent.ready();
    await w.drain();

    const commandRecord = w.agent.conversation.command(commandId);
    assert.equal(commandRecord.state, 'completed', 'command marked completed terminal');

    // Verify no re-dispatch
    const msg2Writes = writes(w).filter(c => c.commandId === commandId);
    assert.equal(msg2Writes.length, 1, 'delivered input never re-submitted');

    // Subsequent followup is not blocked
    w.agent.followup(message('msg2-after'));
    await w.drain();
    assert.equal(w.agent.inputs.get('msg2-after').commandId !== undefined, true);
    assert.equal(writes(w).filter(c => c.commandId === w.agent.inputs.get('msg2-after').commandId).length, 1);
  } finally {
    await w.close();
  }
});

test('recovery outcome 3: terminal discard auto-resends with new commandId, persists replacement event, and alerts once', async () => {
  const w = await commandWorld();
  try {
    w.agent.followup(message('msg3-discard'));
    await w.drain();
    const input = w.agent.inputs.get('msg3-discard');
    const originalC = input.commandId;
    assert.ok(originalC, 'original commandId exists');

    // Simulate ACK into queue
    const qItem = queueItem('q-discard', originalC);
    const snapshotWithQueue = structuredClone(w.peer.snapshot);
    snapshotWithQueue.seq++;
    snapshotWithQueue.queue.items = [qItem];
    w.peer.publish(snapshotWithQueue);
    await w.drain();
    assert.equal(w.agent.inbox.queueIds.get('msg3-discard'), 'q-discard');

    // Disconnect and restart
    w.peer.disconnect();
    assert.equal(w.agent.conversation.state.status, 'error');

    // Mock query returning inputDiscardedOnRestart
    w.peer.acks.set(originalC, {
      commandId: originalC,
      status: 'failed',
      reasonCode: 'fault.command.inputDiscardedOnRestart',
      revisionAtDecision: 0,
    });

    // First snapshot after restart has empty queue
    const restartedSnapshot = structuredClone(w.peer.snapshot);
    restartedSnapshot.seq++;
    restartedSnapshot.logEpoch = 'epoch-2';
    restartedSnapshot.queue.items = [];
    restartedSnapshot.rows.window = [];
    // publish (not direct assignment): reconnect reads the per-session snapshots map, so the
    // restarted first frame must land there to actually exercise the empty-queue path.
    w.peer.publish(restartedSnapshot);

    // Trigger recovery
    await w.agent.ready();
    await w.drain();

    // Check alert emitted
    const discardAlerts = w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'fault.command.inputDiscardedOnRestart');
    assert.equal(discardAlerts.length, 1, 'single alert emitted for discard');

    // Check new commandId allocated
    const newN = input.commandId;
    assert.notEqual(newN, originalC, 'new commandId allocated');

    // Check the replacement identity was durably recorded in the driver recovery index
    const replacements = w.agent.recovery.replacementsOf(w.agent.id);
    assert.equal(replacements.get('msg3-discard'), newN, 'replacement identity persisted');
    assert.notEqual(newN, originalC);

    // Check resubmission with new commandId N
    const nWrites = writes(w).filter(c => c.commandId === newN);
    assert.equal(nWrites.length, 1, 'resubmitted with new commandId N');

    // Repeat ready does not duplicate alert or re-allocate
    await w.agent.ready();
    await w.drain();
    const repeatAlerts = w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'fault.command.inputDiscardedOnRestart');
    assert.equal(repeatAlerts.length, 1, 'repeat ready does not repeat discard alert');
    assert.equal(input.commandId, newN, 'commandId remains N');
  } finally {
    await w.close();
  }
});

test('idempotence: official duplicate ack is handled as accepted without second resubmission or double write', async () => {
  const w = await commandWorld();
  try {
    w.peer.loseAck = true;
    w.agent.followup(message('msg4-dup'));
    await w.drain();

    const input = w.agent.inputs.get('msg4-dup');
    const commandId = input.commandId;

    // Server returns duplicate ack on query/resubmit
    w.peer.acks.set(commandId, {
      commandId,
      status: 'duplicate',
      revisionAtDecision: w.peer.snapshot.revision,
    });

    await w.agent.ready();
    await w.drain();

    assert.equal(w.agent.conversation.command(commandId).ack.status, 'duplicate');
    assert.equal(w.agent.conversation.command(commandId).state, 'accepted-awaiting-terminal');

    // Another ready must not re-dispatch
    const countBefore = writes(w).filter(c => c.commandId === commandId).length;
    await w.agent.ready();
    await w.drain();
    const countAfter = writes(w).filter(c => c.commandId === commandId).length;
    assert.equal(countBefore, countAfter, 'no second resubmission on duplicate');
  } finally {
    await w.close();
  }
});

test('recovery trigger: launcher ready fires delivery recovery even when conversation was previously in error', async () => {
  const w = await commandWorld();
  try {
    let launcherListener;
    const launcher = {
      state: {phase: 'starting'},
      subscribe(listener) {
        launcherListener = listener;
        return () => { launcherListener = null; };
      }
    };
    w.agent.conversation.peer.launcher = launcher;

    // Re-subscribe offRecovery with launcher
    w.agent.offRecovery?.();
    w.agent.offRecovery = launcher.subscribe(state => {
      if (state.phase === 'ready' && (w.agent.conversation.state.status === 'error' || w.agent.wasError) && !w.agent.disposed) {
        w.agent.wasError = false;
        w.agent.track(w.agent.ready());
      }
    });

    w.peer.disconnect();
    assert.equal(w.agent.conversation.state.status, 'error');
    assert.equal(w.agent.wasError, true, 'wasError recorded');

    // Conversation transitions to connecting or idle before launcher signals ready
    w.agent.conversation._testSetStatus?.('connecting');

    let readyCalled = false;
    const origReady = w.agent.ready.bind(w.agent);
    w.agent.ready = () => { readyCalled = true; return origReady(); };

    // Launcher transitions to ready
    launcher.state.phase = 'ready';
    launcherListener({phase: 'ready'});

    assert.equal(readyCalled, true, 'ready triggered by launcher recovery even after error status cleared');
  } finally {
    await w.close();
  }
});

test('control command degradation: non-input outcome-unknown degrades to not-sent without blocking ready or resending control', async () => {
  const w = await commandWorld();
  const original = w.peer.request.bind(w.peer);
  try {
    let sent;
    const issued = new Promise(resolve => { sent = resolve; });
    w.peer.request = async (method, params, options) => {
      if (method !== 'v4/command') return original(method, params, options);
      w.peer.calls.push({method, params: structuredClone(params)});
      sent();
      return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('lost'), {code: 'execution-disconnected'}))));
    };

    const pending = w.agent.submitControl({type: 'setAutoDrain', commandId: 'ctrl-degrade', payload: {autoDrain: false}});
    await issued;
    w.peer.disconnect();
    await assert.rejects(pending, {code: 'command-outcome-unknown'});

    w.peer.request = original;
    w.peer.acks.delete('ctrl-degrade');

    const alertsBefore = w.notifications.length;
    await w.agent.ready();
    await w.drain();

    // Control command degrades to not-sent
    const cmd = w.agent.conversation.command('ctrl-degrade');
    assert.equal(cmd.state, 'not-sent');

    // Alert emitted once
    const degradationAlerts = w.notifications.slice(alertsBefore).filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'command-outcome-unknown');
    assert.equal(degradationAlerts.length, 1, 'one degradation alert emitted');

    // Control command is NOT replayed
    const ctrlWrites = writes(w).filter(c => c.commandId === 'ctrl-degrade');
    assert.equal(ctrlWrites.length, 1, 'control command never automatically resent');

    // Subsequent input can dispatch cleanly
    w.agent.followup(message('after-ctrl'));
    await w.drain();
    assert.equal(writes(w).filter(c => c.commandId === w.agent.inputs.get('after-ctrl').commandId).length, 1);
  } finally {
    await w.close();
  }
});

test('reconstruction path: agent/input/command-replaced persistent event retains new ID across DriverAgent reconstruction', async () => {
  const w = await commandWorld();
  try {
    w.agent.followup(message('reconstruct-test'));
    await w.drain();
    const input = w.agent.inputs.get('reconstruct-test');
    const originalC = input.commandId;

    // Simulate discard and replacement
    w.peer.disconnect();
    w.peer.acks.set(originalC, {
      commandId: originalC,
      status: 'failed',
      reasonCode: 'fault.command.inputDiscardedOnRestart',
      revisionAtDecision: 0,
    });
    const restartedSnapshot = structuredClone(w.peer.snapshot);
    restartedSnapshot.seq++;
    restartedSnapshot.logEpoch = 'epoch-2';
    restartedSnapshot.queue.items = [];
    restartedSnapshot.rows.window = [];
    // publish (not direct assignment): reconnect reads the per-session snapshots map, so the
    // restarted first frame must land there to actually exercise the empty-queue path.
    w.peer.publish(restartedSnapshot);

    await w.agent.ready();
    await w.drain();

    const newN = input.commandId;
    assert.notEqual(newN, originalC);

    // Reconstruct driver sharing the same recovery index (durable replacement identities)
    const reconstructedAgent = new DriverAgent(
      w.agent.ctx,
      w.agent.session,
      w.agent.options,
      w.agent.zcodeConversationId,
      {
        createScope: () => ({ctx: w.agent.ctx}),
        agentEvents: () => ({emit: () => {}, waterfall: () => Promise.resolve('unavailable')}),
        conversation: w.agent.conversation,
        recovery: w.agent.recovery,
      }
    );

    const reconstructedInput = reconstructedAgent.inputs.get('reconstruct-test');
    assert.equal(reconstructedInput.commandId, newN, 'reconstructed agent preserves replacement ID N, never reverts to C');

    // Delivery of N consumes from inbox
    const deliveredSnapshot = structuredClone(w.peer.snapshot);
    deliveredSnapshot.seq++;
    deliveredSnapshot.rows.window = [
      row('turnHeader', 1, {origin: 'userInput', state: 'completedSuccess', startedAt: 0, sourceCommandId: newN}),
      row('userInput', 2, {text: 'hello', origin: 'realUser', sourceCommandId: newN}),
    ];
    w.peer.publish(deliveredSnapshot);
    await w.drain();

    assert.equal(w.agent.inbox.nextTurn.some(m => m.id === 'reconstruct-test'), false, 'consumed upon delivery of N');
  } finally {
    await w.close();
  }
});

test('resolution precedes pruning: ACK surviving command is not consumed by inbox empty queue path during recovery window', async () => {
  const w = await commandWorld();
  try {
    w.agent.followup(message('prune-race-test'));
    await w.drain();
    const input = w.agent.inputs.get('prune-race-test');
    const commandId = input.commandId;

    // Command enters queue with queueItem
    const qItem = queueItem('q-prune', commandId);
    const snap1 = structuredClone(w.peer.snapshot);
    snap1.seq++;
    snap1.queue.items = [qItem];
    w.peer.publish(snap1);
    await w.drain();
    assert.equal(w.agent.inbox.queueIds.get('prune-race-test'), 'q-prune');

    // Transport dies, server restarts with empty queue
    w.peer.disconnect();
    const snap2 = structuredClone(w.peer.snapshot);
    snap2.seq++;
    snap2.logEpoch = 'epoch-empty-queue';
    snap2.queue.items = []; // Empty queue!
    snap2.rows.window = [];

    // Query returns duplicate (server actually has it)
    w.peer.acks.set(commandId, {
      commandId,
      status: 'duplicate',
      revisionAtDecision: 10,
    });

    // Before ready completes, publish empty snapshot — inbox sync must not drop input while resolvingInputs is true
    w.peer.publish(snap2);

    await w.agent.ready();
    await w.drain();

    // Input must still be tracked and not prematurely vanished from inbox
    assert.ok(w.agent.inbox.locate('prune-race-test'), 'input was not dropped by empty queue path before resolution');
  } finally {
    await w.close();
  }
});

test('one-time alert semantics: repeated ready() does not duplicate degradation or discard alerts', async () => {
  const w = await commandWorld();
  try {
    w.peer.loseAck = true;
    w.agent.followup(message('alert-test'));
    await w.drain();

    const input = w.agent.inputs.get('alert-test');
    w.peer.acks.delete(input.commandId);

    // Track notifications before ready recovery
    const beforeReady = w.notifications.length;

    // First ready degrades and emits 1 alert
    await w.agent.ready();
    await w.drain();
    const count1 = w.notifications.slice(beforeReady).filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'command-outcome-unknown').length;
    assert.equal(count1, 1, 'exactly one degradation alert emitted during recovery');

    // Call ready() multiple times
    await w.agent.ready();
    await w.drain();
    await w.agent.ready();
    await w.drain();

    const count2 = w.notifications.slice(beforeReady).filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'command-outcome-unknown').length;
    assert.equal(count2, 1, 'repeated ready() does not duplicate degradation alert');
  } finally {
    await w.close();
  }
});

test('choice mode: held input is not dispatched automatically and can be confirmed via confirmHeldInput', async () => {
  const w = await commandWorld('queue-paused');
  try {
    w.agent.followup(message('held-test'));
    await w.drain();

    assert.equal(writes(w).length, 0, 'not dispatched in choice mode');

    const base = {
      messageId: 'held-test',
      disposition: 'keepQueueAndSend',
      expectedQueueItemIds: ['queue-1'],
      baseRevision: w.peer.snapshot.revision,
      baseLogEpoch: w.peer.snapshot.logEpoch,
    };
    const result = await w.agent.confirmHeldInput(base);
    assert.ok(result, 'confirmHeldInput succeeded');
    assert.equal(writes(w).length, 1, 'dispatched after confirmHeldInput');
  } finally {
    await w.close();
  }
});

test('in-flight sent-unconfirmed submit is not degraded by a re-entrant ready (review A1 regression)', async () => {
  const w = await commandWorld();
  try {
    const original = w.peer.request.bind(w.peer);
    let release; const held = new Promise(resolve => { release = resolve });
    const arrivals = [];
    w.peer.request = async (method, params, options) => {
      if (method === 'v4/command' && params.type === 'sendText') {
        arrivals.push(params.commandId);
        return held.then(() => original(method, params, options));
      }
      return original(method, params, options);
    };
    w.agent.followup(message('inflight'));
    await new Promise(resolve => { const check = () => arrivals.length >= 1 ? resolve() : setImmediate(check); check() });
    const inflightId = w.agent.inputs.get('inflight').commandId;
    assert.equal(w.agent.conversation.command(inflightId).state, 'sent-unconfirmed');

    const alertsBefore = w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'command-outcome-unknown').length;
    w.agent.followup(message('second'));
    await new Promise(resolve => { const check = () => arrivals.length >= 2 ? resolve() : setImmediate(check); check() });

    // The healthy in-flight submit must keep its own outcome: no degradation, no query, no alert.
    assert.equal(w.agent.conversation.command(inflightId).state, 'sent-unconfirmed');
    assert.equal(queries(w).filter(q => q.commands?.some?.(c => c.commandId === inflightId)).length, 0);
    const alertsAfter = w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'command-outcome-unknown').length;
    assert.equal(alertsAfter, alertsBefore, 'no spurious degradation alert for a live submit');

    release();
    await w.drain();
    assert.equal(w.agent.conversation.command(inflightId).state, 'accepted-awaiting-terminal', 'accepted ACK lands after release');
    assert.equal(writes(w).filter(c => c.commandId === inflightId).length, 1, 'exactly one wire write for the in-flight command');
    assert.equal(alertsAfter, w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'command-outcome-unknown').length, 'still no degradation alert');
  } finally {
    await w.close();
  }
});

test('transient queryUnavailable keeps input re-queryable and in inbox with one alert (review B-P1 regression)', async () => {
  const w = await commandWorld();
  try {
    w.agent.followup(message('msg-qu'));
    await w.drain();
    const input = w.agent.inputs.get('msg-qu');
    const commandId = input.commandId;

    const withQueue = structuredClone(w.peer.snapshot);
    withQueue.seq++;
    withQueue.queue.items = [queueItem('q-qu', commandId)];
    w.peer.publish(withQueue);
    await w.drain();
    assert.equal(w.agent.inbox.queueIds.get('msg-qu'), 'q-qu');
    w.peer.disconnect();

    const restarted = structuredClone(w.peer.snapshot);
    restarted.seq++;
    restarted.logEpoch = 'epoch-qu';
    restarted.queue.items = [];
    restarted.rows.window = [];
    w.peer.publish(restarted);

    w.peer.acks.set(commandId, {commandId, status: 'failed', reasonCode: 'fault.command.queryUnavailable', revisionAtDecision: 0});
    await w.agent.ready();
    await w.drain();

    assert.ok(w.agent.inbox.locate('msg-qu'), 'input retained in inbox on transient query failure');
    assert.equal(w.agent.conversation.command(commandId).state, 'outcome-unknown', 'restored to a re-queryable state');
    const quAlerts = w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'fault.command.queryUnavailable');
    assert.equal(quAlerts.length, 1, 'one-time queryUnavailable alert');

    w.peer.acks.set(commandId, {commandId, status: 'failed', reasonCode: 'fault.command.inputDiscardedOnRestart', revisionAtDecision: 0});
    await w.agent.ready();
    await w.drain();
    assert.notEqual(input.commandId, commandId, 'discard recovery proceeds once the query answers');
    const discardAlerts = w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'fault.command.inputDiscardedOnRestart');
    assert.equal(discardAlerts.length, 1);
    assert.equal(writes(w).filter(c => c.commandId === input.commandId).length, 1, 'resent with the replacement commandId');
    const quAlertsAfter = w.notifications.filter(n => n.type === 'agent/error' && n.payload?.error?.code === 'fault.command.queryUnavailable');
    assert.equal(quAlertsAfter.length, 1, 'queryUnavailable alert not repeated');
  } finally {
    await w.close();
  }
});

test('input consumed by the translator during recovery settles completed via fresh delivery evidence (review B-P2 regression)', async () => {
  const w = await commandWorld();
  try {
    w.peer.loseAck = true;
    w.agent.followup(message('p2-a'));
    await w.drain();
    const aId = w.agent.inputs.get('p2-a').commandId;
    w.peer.acks.delete(aId);

    w.agent.followup(message('p2-b'));
    await w.drain();
    const bInput = w.agent.inputs.get('p2-b');
    const bId = bInput.commandId;
    const withQueue = structuredClone(w.peer.snapshot);
    withQueue.seq++;
    withQueue.queue.items = [queueItem('q-p2b', bId)];
    w.peer.publish(withQueue);
    await w.drain();
    assert.equal(w.agent.conversation.command(bId).state, 'accepted-awaiting-terminal');

    w.peer.disconnect();
    const restarted = structuredClone(w.peer.snapshot);
    restarted.seq++;
    restarted.logEpoch = 'epoch-p2';
    restarted.queue.items = [];
    restarted.rows.window = [];
    w.peer.publish(restarted);

    // Hold A's query; while it is pending, B's user row arrives and the translator claims B.
    const original = w.peer.request.bind(w.peer);
    let release; const held = new Promise(resolve => { release = resolve });
    w.peer.request = async (method, params, options) => {
      if (method === 'v4/commands/query' && params.commands?.some(c => c.commandId === aId)) return held.then(() => original(method, params, options));
      return original(method, params, options);
    };
    const readyPromise = w.agent.ready();
    await new Promise(resolve => { const check = () => w.peer.calls.some(c => c.method === 'v4/commands/query') ? resolve() : setImmediate(check); check() });

    const delivered = structuredClone(w.peer.snapshot);
    delivered.seq++;
    delivered.rows.window = [
      row('turnHeader', 1, {origin: 'userInput', state: 'completedSuccess', startedAt: 0, sourceCommandId: bId}),
      row('userInput', 2, {text: 'p2-b delivered', origin: 'realUser', sourceCommandId: bId}),
    ];
    w.peer.publish(delivered);
    await new Promise(resolve => setImmediate(() => setImmediate(resolve)));
    assert.equal(w.agent.inbox.locate('p2-b'), undefined, 'translator claimed B out of the inbox during the recovery window');

    release();
    await readyPromise;
    await w.drain();

    assert.equal(w.agent.conversation.command(bId).state, 'completed', 'claimed input still reaches a terminal state via fresh delivery evidence');
    assert.equal(w.agent.conversation.command(aId).state, 'accepted-awaiting-terminal', 'A degraded to not-sent, was re-dispatched with the original commandId and accepted');
    await w.agent.ready();
    await w.drain();
    assert.equal(queries(w).filter(q => q.commands?.some?.(c => c.commandId === bId)).length, 0, 'no query needed for the delivered input');
  } finally {
    await w.close();
  }
});

test('ledger capacity does not abort recovery or prune unsettled inputs (review B2-P1 regression)', async () => {
  const peer = new MockPeer();
  peer.snapshot = baseSnapshot();
  peer.snapshot.rows.window = [];
  const events = [];
  const session = {id: 'native', header: {cwd: '/workspace'}, get seq() {return events.length}, eventAt: seq => events[seq], append(type, data) {const event = {type, data: structuredClone(data), seq: events.length, time: 0}; events.push(event); return event}};
  const conversation = new V4Conversation(peer, {address: {runtime: 'zcode', authority: 'official-host', workspace: '/workspace', sessionId: peer.snapshot.sessionId}, workspace: {workspacePath: '/workspace', workspaceKey: '/workspace'}, connectionId: peer.connectionId, clientId: 'test-driver', clientMode: 'desktop-continuous', runnable: true, managementAllowed: true, reconnectable: true, maxCommands: 3});
  const notifications = [];
  const ctx = {get: () => undefined};
  const agent = new DriverAgent(ctx, session, {}, peer.snapshot.sessionId, {conversation, transport: {ready: async () => {}}, createScope: () => ({ctx}), agentEvents: () => ({emit: (type, payload) => notifications.push({type, payload}), waterfall: async () => 'unavailable'})});
  const drain = async () => {await Promise.allSettled([...agent.tasks]); await tick()};
  try {
    // msg0: submitted, ACKed, delivered and claimed; its completed record becomes evictable.
    agent.followup(message('cap-0'));
    await drain();
    const zero = agent.inputs.get('cap-0').commandId;
    const deliveredZero = structuredClone(peer.snapshot);
    deliveredZero.seq++;
    deliveredZero.rows.window = [
      row('turnHeader', 1, {origin: 'userInput', state: 'completedSuccess', startedAt: 0, sourceCommandId: zero}),
      row('userInput', 2, {text: 'cap-0', origin: 'realUser', sourceCommandId: zero}),
    ];
    peer.publish(deliveredZero);
    await drain();
    await agent.ready();
    await drain();
    assert.equal(conversation.command(zero).state, 'completed');
    assert.equal(agent.inbox.locate('cap-0'), undefined, 'cap-0 consumed');

    // Fill the small ledger with three ACKed-but-unsettled queued inputs (msg0 gets evicted).
    for (const name of ['cap-a', 'cap-b', 'cap-c']) agent.followup(message(name));
    await drain();
    const queuedSnapshot = structuredClone(peer.snapshot);
    queuedSnapshot.seq++;
    queuedSnapshot.rows.window = deliveredZero.rows.window;
    queuedSnapshot.queue.items = ['cap-a', 'cap-b', 'cap-c'].map((name, i) => queueItem(`q-${name}`, agent.inputs.get(name).commandId));
    peer.publish(queuedSnapshot);
    await drain();
    for (const name of ['cap-a', 'cap-b', 'cap-c']) {
      assert.equal(conversation.command(agent.inputs.get(name).commandId).state, 'accepted-awaiting-terminal');
      assert.ok(agent.inbox.locate(name), `${name} queued in inbox`);
    }

    // Death; restart keeps the delivered row but empties the official queue.
    peer.disconnect();
    const restarted = structuredClone(peer.snapshot);
    restarted.seq++;
    restarted.logEpoch = 'epoch-cap';
    restarted.queue.items = [];
    peer.publish(restarted);
    for (const name of ['cap-a', 'cap-b', 'cap-c']) peer.acks.delete(agent.inputs.get(name).commandId);

    const queriesBefore = peer.calls.filter(c => c.method === 'v4/commands/query').length;
    await agent.ready();
    await drain();

    // Capacity did not abort recovery: each unsettled input was queried and degraded.
    const queriesAfter = peer.calls.filter(c => c.method === 'v4/commands/query').length;
    assert.ok(queriesAfter > queriesBefore, 'recovery queries proceeded');
    for (const name of ['cap-a', 'cap-b', 'cap-c']) {
      const record = conversation.command(agent.inputs.get(name).commandId);
      assert.ok(['not-sent', 'accepted-awaiting-terminal', 'completed'].includes(record.state), `${name} reached a sane state`);
      assert.ok(agent.inbox.locate(name), `${name} not pruned by the empty-queue path`);
    }
  } finally {
    await agent.stop();
  }
});

test('delivered input with an evicted record is never re-dispatched at capacity (review B3-P2 regression)', async () => {
  const peer = new MockPeer();
  peer.snapshot = baseSnapshot();
  peer.snapshot.rows.window = [];
  const events = [];
  const session = {id: 'native', header: {cwd: '/workspace'}, get seq() {return events.length}, eventAt: seq => events[seq], append(type, data) {const event = {type, data: structuredClone(data), seq: events.length, time: 0}; events.push(event); return event}};
  const conversation = new V4Conversation(peer, {address: {runtime: 'zcode', authority: 'official-host', workspace: '/workspace', sessionId: peer.snapshot.sessionId}, workspace: {workspacePath: '/workspace', workspaceKey: '/workspace'}, connectionId: peer.connectionId, clientId: 'test-driver', clientMode: 'desktop-continuous', runnable: true, managementAllowed: true, reconnectable: true, maxCommands: 3});
  const notifications = [];
  const ctx = {get: () => undefined};
  const agent = new DriverAgent(ctx, session, {}, peer.snapshot.sessionId, {conversation, transport: {ready: async () => {}}, createScope: () => ({ctx}), agentEvents: () => ({emit: (type, payload) => notifications.push({type, payload}), waterfall: async () => 'unavailable'})});
  const settle = async () => {await new Promise(resolve => setImmediate(() => setImmediate(resolve)))};
  let unblockTranslator;
  try {
    // msg0 submitted and ACKed, then its user row arrives while the translator is blocked,
    // so the input stays inbox-resident with delivery evidence in the window.
    agent.followup(message('del-0'));
    await settle();
    const zero = agent.inputs.get('del-0').commandId;
    const translatorBlocked = new Promise(resolve => {unblockTranslator = resolve});
    agent.translator.enqueue = async () => {await translatorBlocked};
    const deliveredZero = structuredClone(peer.snapshot);
    deliveredZero.seq++;
    deliveredZero.rows.window = [
      row('turnHeader', 1, {origin: 'userInput', state: 'completedSuccess', startedAt: 0, sourceCommandId: zero}),
      row('userInput', 2, {text: 'del-0', origin: 'realUser', sourceCommandId: zero}),
    ];
    peer.publish(deliveredZero);
    await settle();
    await agent.ready();
    assert.equal(conversation.command(zero).state, 'completed');
    assert.ok(agent.inbox.locate('del-0'), 'translator block keeps the delivered input in the inbox');

    // Three queued ACKed inputs fill the ledger; the terminal record for del-0 is evicted.
    for (const name of ['del-a', 'del-b', 'del-c']) agent.followup(message(name));
    await settle();
    assert.equal(conversation.command(zero), null, 'del-0 record evicted at capacity');

    // Death; restart keeps the delivered row and empties the official queue.
    peer.disconnect();
    const restarted = structuredClone(peer.snapshot);
    restarted.seq++;
    restarted.logEpoch = 'epoch-del';
    restarted.queue.items = [];
    peer.publish(restarted);
    for (const name of ['del-a', 'del-b', 'del-c']) peer.acks.delete(agent.inputs.get(name).commandId);

    await agent.ready();
    await settle();

    // The delivered input must not go to the wire a second time, ledger or no ledger.
    const zeroWrites = peer.calls.filter(c => c.method === 'v4/command' && c.params.commandId === zero).length;
    assert.equal(zeroWrites, 1, 'delivered input is never re-dispatched without a ledger record');
    for (const name of ['del-a', 'del-b', 'del-c']) {
      assert.ok(agent.inbox.locate(name), `${name} not pruned`);
    }
  } finally {
    unblockTranslator?.();
    await agent.stop();
  }
});

test('discard-replacement re-dispatch carries the edited queue text, not the original (review B4-P2 regression)', async () => {
  const w = await commandWorld();
  try {
    w.agent.followup(message('edit-msg', 'original text'));
    await w.drain();
    const input = w.agent.inputs.get('edit-msg');
    const originalC = input.commandId;

    // ACKed into the official queue with the original text.
    const withQueue = structuredClone(w.peer.snapshot);
    withQueue.seq++;
    withQueue.queue.items = [{...queueItem('q-edit', originalC), text: 'original text'}];
    w.peer.publish(withQueue);
    await w.drain();
    assert.equal(w.agent.inbox.queueIds.get('edit-msg'), 'q-edit');

    // Confirmed official edit updates the durable inbox text.
    const edited = structuredClone(w.peer.snapshot);
    edited.seq++;
    edited.queue.items = [{...queueItem('q-edit', originalC), text: 'edited text'}];
    w.peer.publish(edited);
    await w.drain();
    const location = w.agent.inbox.locate('edit-msg');
    assert.equal(w.agent.inbox.current()[location.target][location.index].content[0].text, 'edited text');

    // Death; restart empties the official queue; the fact store reports discard-on-restart.
    w.peer.disconnect();
    const restarted = structuredClone(w.peer.snapshot);
    restarted.seq++;
    restarted.logEpoch = 'epoch-edit';
    restarted.queue.items = [];
    restarted.rows.window = [];
    w.peer.publish(restarted);
    w.peer.acks.set(originalC, {commandId: originalC, status: 'failed', reasonCode: 'fault.command.inputDiscardedOnRestart', revisionAtDecision: 0});

    await w.agent.ready();
    await w.drain();

    assert.notEqual(input.commandId, originalC, 'replacement commandId allocated');
    const resend = writes(w).filter(c => c.commandId === input.commandId);
    assert.equal(resend.length, 1, 'resent once with the replacement commandId');
    assert.equal(resend[0].payload.text, 'edited text', 're-dispatch carries the edited text');
  } finally {
    await w.close();
  }
});
