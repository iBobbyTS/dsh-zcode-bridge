import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DriverAgent} from '../packages/driver/agent.mjs';
import {
  FORWARD_PRESET_MAP,
  REVERSE_MODE_MAP,
  REVERSE_BUNDLE_MAP,
  mapPreset,
  mapMode,
  presetBundle,
  modeBundle,
} from '../packages/driver/permission-map.mjs';
import {
  installPermissionModeSeam,
  installPermissionModeSeams,
  owned,
  isInitializing,
  getAgentBaseline,
  isInFlight,
} from '../packages/driver/permission-mode-seam.mjs';

function createFakeEnv() {
  const listeners = new Map();
  const unregisterCalls = [];
  const warnings = [];
  const agents = new Map();
  const transport = Symbol('fake-transport');
  const factory = {transport};

  const ctx = {
    on(name, fn) {
      let list = listeners.get(name);
      if (!list) {
        list = new Set();
        listeners.set(name, list);
      }
      list.add(fn);
      const off = () => {
        unregisterCalls.push(name);
        list.delete(fn);
      };
      return off;
    },
    effect(fn) {
      return fn();
    },
    logger: {
      warn(msg) {
        warnings.push(msg);
      },
    },
    agents: {
      get(id) {
        return agents.get(id);
      },
    },
  };

  function createFakeAgent(id, options = {}) {
    const {
      agentTransport = transport,
      mode = 'edit',
      hasConversation = true,
      initializing = false,
      submitControl = null,
      isDriverAgent = true,
    } = options;
    const snapshot = 'snapshot' in options
      ? options.snapshot
      : (mode !== undefined ? {config: {mode}} : undefined);
    const proto = isDriverAgent ? DriverAgent.prototype : Object.prototype;
    const agent = Object.create(proto);
    const submissions = [];
    agent.id = id;
    agent.transport = agentTransport;
    agent.initializing = initializing;
    if (hasConversation) {
      agent.conversation = {
        state: snapshot !== undefined ? {snapshot} : {},
      };
    } else {
      agent.conversation = undefined;
    }
    agent.submissions = submissions;
    agent.submitControl = submitControl || (async (cmd) => {
      submissions.push(cmd);
      return {ok: true};
    });
    agents.set(id, agent);
    return agent;
  }

  function emitSessionEvent(session, event) {
    const list = listeners.get('session/event');
    if (!list) return undefined;
    let lastResult;
    for (const fn of Array.from(list)) {
      lastResult = fn(session, event);
    }
    return lastResult;
  }

  return {
    ctx,
    factory,
    agents,
    warnings,
    listeners,
    unregisterCalls,
    createFakeAgent,
    emitSessionEvent,
  };
}

// ============================================================================
// AC1 映射穷举（纯函数）
// ============================================================================

test('AC1.1: mapPreset maps standard presets and returns undefined for custom/auto/plan/unknown', () => {
  // Standard forward mappings
  assert.equal(mapPreset('read-only'), 'build');
  assert.equal(mapPreset('workspace-write'), 'edit');
  assert.equal(mapPreset('danger-full-access'), 'yolo');

  // Unmapped values must yield undefined
  assert.equal(mapPreset('custom'), undefined);
  assert.equal(mapPreset('auto'), undefined);
  assert.equal(mapPreset('plan'), undefined);
  assert.equal(mapPreset(undefined), undefined);
  assert.equal(mapPreset(null), undefined);
  assert.equal(mapPreset(''), undefined);
  assert.equal(mapPreset('unknown-preset'), undefined);

  // Prototype properties must yield undefined
  assert.equal(mapPreset('constructor'), undefined);
  assert.equal(mapPreset('__proto__'), undefined);
  assert.equal(mapPreset('toString'), undefined);
  assert.equal(mapPreset('hasOwnProperty'), undefined);
});

test('AC1.2: mapMode maps standard modes and returns undefined for plan/auto/custom/unknown', () => {
  // Standard reverse mappings
  assert.equal(mapMode('build'), 'read-only');
  assert.equal(mapMode('edit'), 'workspace-write');
  assert.equal(mapMode('yolo'), 'danger-full-access');

  // Unmapped values must yield undefined
  assert.equal(mapMode('plan'), undefined);
  assert.equal(mapMode('auto'), undefined);
  assert.equal(mapMode('custom'), undefined);
  assert.equal(mapMode(undefined), undefined);
  assert.equal(mapMode(null), undefined);
  assert.equal(mapMode(''), undefined);
  assert.equal(mapMode('unknown-mode'), undefined);

  // Prototype properties must yield undefined
  assert.equal(mapMode('constructor'), undefined);
  assert.equal(mapMode('__proto__'), undefined);
  assert.equal(mapMode('toString'), undefined);
  assert.equal(mapMode('hasOwnProperty'), undefined);
});

test('AC1.3: presetBundle returns correct sandbox and approval bundles, undefined for others', () => {
  assert.deepEqual(presetBundle('read-only'), {sandbox: 'read-only', approval: 'ask'});
  assert.deepEqual(presetBundle('workspace-write'), {sandbox: 'workspace-write', approval: 'ask'});
  assert.deepEqual(presetBundle('danger-full-access'), {sandbox: 'danger-full-access', approval: 'never'});

  assert.equal(presetBundle('custom'), undefined);
  assert.equal(presetBundle('auto'), undefined);
  assert.equal(presetBundle('plan'), undefined);
  assert.equal(presetBundle(undefined), undefined);
  assert.equal(presetBundle('unknown-preset'), undefined);

  // Prototype properties must yield undefined
  assert.equal(presetBundle('constructor'), undefined);
  assert.equal(presetBundle('__proto__'), undefined);
  assert.equal(presetBundle('toString'), undefined);
  assert.equal(presetBundle('hasOwnProperty'), undefined);
});

test('AC1.4: modeBundle returns correct bundle for standard modes, undefined for plan/auto/unknown', () => {
  assert.deepEqual(modeBundle('build'), {sandbox: 'read-only', approval: 'ask'});
  assert.deepEqual(modeBundle('edit'), {sandbox: 'workspace-write', approval: 'ask'});
  assert.deepEqual(modeBundle('yolo'), {sandbox: 'danger-full-access', approval: 'never'});

  assert.equal(modeBundle('plan'), undefined);
  assert.equal(modeBundle('auto'), undefined);
  assert.equal(modeBundle('custom'), undefined);
  assert.equal(modeBundle(undefined), undefined);
  assert.equal(modeBundle('unknown-mode'), undefined);

  // Prototype properties must yield undefined
  assert.equal(modeBundle('constructor'), undefined);
  assert.equal(modeBundle('__proto__'), undefined);
  assert.equal(modeBundle('toString'), undefined);
  assert.equal(modeBundle('hasOwnProperty'), undefined);
});

test('AC1.5: FORWARD_PRESET_MAP, REVERSE_MODE_MAP and REVERSE_BUNDLE_MAP are frozen', () => {
  assert.ok(Object.isFrozen(FORWARD_PRESET_MAP));
  assert.ok(Object.isFrozen(REVERSE_MODE_MAP));
  assert.ok(Object.isFrozen(REVERSE_BUNDLE_MAP));
  assert.ok(Object.isFrozen(REVERSE_BUNDLE_MAP['read-only']));
  assert.ok(Object.isFrozen(REVERSE_BUNDLE_MAP['workspace-write']));
  assert.ok(Object.isFrozen(REVERSE_BUNDLE_MAP['danger-full-access']));
});

test('AC1.6: prototype property names (constructor, __proto__, toString, hasOwnProperty) return undefined for mapPreset, mapMode, presetBundle, and modeBundle', () => {
  const protoKeys = ['constructor', '__proto__', 'toString', 'hasOwnProperty'];
  for (const key of protoKeys) {
    assert.equal(mapPreset(key), undefined, `mapPreset must return undefined for prototype property "${key}"`);
    assert.equal(mapMode(key), undefined, `mapMode must return undefined for prototype property "${key}"`);
    assert.equal(presetBundle(key), undefined, `presetBundle must return undefined for prototype property "${key}"`);
    assert.equal(modeBundle(key), undefined, `modeBundle must return undefined for prototype property "${key}"`);
  }
});

// ============================================================================
// AC2 seam 路由（installPermissionModeSeam + 假 ctx/agent/factory）
// ============================================================================

test('AC2 helper functions: owned and isInitializing respect prototype and transport boundaries', () => {
  const env = createFakeEnv();
  const validAgent = env.createFakeAgent('sess-valid');
  assert.equal(owned(validAgent, env.factory), true);

  const mismatchedTransportAgent = env.createFakeAgent('sess-bad-transport', {
    agentTransport: Symbol('mismatched'),
  });
  assert.equal(owned(mismatchedTransportAgent, env.factory), false);

  const plainObjectAgent = env.createFakeAgent('sess-plain', {
    isDriverAgent: false,
  });
  assert.equal(owned(plainObjectAgent, env.factory), false);

  assert.equal(owned(null, env.factory), false);
  assert.equal(owned(undefined, env.factory), false);

  assert.equal(isInitializing({initializing: true}), true);
  assert.equal(isInitializing({initializing: false}), false);
  assert.equal(isInitializing({}), false);
  assert.equal(isInitializing(null), false);
});

test('AC2.1: preset event dispatches switchCollaborationMode command with mapped mode', async () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);
  // Agent starts at 'edit'
  const agent = env.createFakeAgent('sess-1', {mode: 'edit'});

  // 1. read-only -> build
  env.emitSessionEvent({id: 'sess-1'}, {type: 'permission/preset', data: {preset: 'read-only'}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(agent.submissions.length, 1);
  assert.deepEqual(agent.submissions[0], {
    type: 'switchCollaborationMode',
    payload: {mode: 'build'},
  });
  agent.conversation.state.snapshot.config.mode = 'build';

  // 2. workspace-write -> edit
  env.emitSessionEvent({id: 'sess-1'}, {type: 'permission/preset', data: {preset: 'workspace-write'}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(agent.submissions.length, 2);
  assert.deepEqual(agent.submissions[1], {
    type: 'switchCollaborationMode',
    payload: {mode: 'edit'},
  });
  agent.conversation.state.snapshot.config.mode = 'edit';

  // 3. danger-full-access -> yolo (using top-level event.preset format)
  env.emitSessionEvent({id: 'sess-1'}, {type: 'permission/preset', preset: 'danger-full-access'});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(agent.submissions.length, 3);
  assert.deepEqual(agent.submissions[2], {
    type: 'switchCollaborationMode',
    payload: {mode: 'yolo'},
  });
});

test('AC2.2: same-value mode without in-flight operation skips command and does not set in-flight', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);
  const agent = env.createFakeAgent('sess-1', {mode: 'build'});

  assert.equal(isInFlight(agent), false);
  env.emitSessionEvent({id: 'sess-1'}, {type: 'permission/preset', data: {preset: 'read-only'}});

  assert.equal(agent.submissions.length, 0, 'must not submit command when snapshot mode equals target mode');
  assert.equal(isInFlight(agent), false, 'must not set in-flight flag on skipped command');
});

test('AC2.3: OD1(b) same-value mode during in-flight operation submits command directly', async () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  let resolveFirst;
  const pFirst = new Promise(resolve => { resolveFirst = resolve; });
  let callCount = 0;

  const agent = env.createFakeAgent('sess-1', {
    mode: 'build',
    submitControl: async (cmd) => {
      callCount++;
      agent.submissions.push(cmd);
      if (callCount === 1) return pFirst;
      return {ok: true};
    },
  });

  // Operation 1: target 'edit' triggers submission and stays in flight
  env.emitSessionEvent({id: 'sess-1'}, {type: 'permission/preset', data: {preset: 'workspace-write'}});
  assert.equal(isInFlight(agent), true, 'first operation must set inFlight');
  assert.equal(agent.submissions.length, 1);
  assert.deepEqual(agent.submissions[0], {
    type: 'switchCollaborationMode',
    payload: {mode: 'edit'},
  });

  // Operation 2: snapshot mode is 'build', target is 'read-only' -> 'build'.
  // Even though currentMode === mode ('build'), inFlight is true, so OD1(b) requires direct submission!
  env.emitSessionEvent({id: 'sess-1'}, {type: 'permission/preset', data: {preset: 'read-only'}});
  assert.equal(agent.submissions.length, 2, 'same-value preset while in-flight must submit directly without skip');
  assert.deepEqual(agent.submissions[1], {
    type: 'switchCollaborationMode',
    payload: {mode: 'build'},
  });

  // Cleanup
  resolveFirst();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(isInFlight(agent), false);
});

test('AC2.4: E5 path missing snapshot submits command directly', async () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // Subcase A: state exists but snapshot is undefined
  const agentA = env.createFakeAgent('sess-no-snapshot', {
    hasConversation: true,
    snapshot: undefined,
  });
  assert.equal(agentA.conversation.state.snapshot, undefined, 'agentA snapshot must be undefined');
  assert.equal(isInFlight(agentA), false, 'agentA must not be in-flight before event');

  env.emitSessionEvent({id: 'sess-no-snapshot'}, {type: 'permission/preset', data: {preset: 'read-only'}});
  assert.equal(isInFlight(agentA), true, 'agentA must be in-flight synchronously after event');
  assert.equal(agentA.submissions.length, 1, 'agentA must submit command directly on missing snapshot');
  assert.deepEqual(agentA.submissions[0], {
    type: 'switchCollaborationMode',
    payload: {mode: 'build'},
  });

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(isInFlight(agentA), false, 'agentA in-flight flag must clear after settling');

  // Subcase B: conversation itself is undefined
  const agentB = env.createFakeAgent('sess-no-conv', {
    hasConversation: false,
  });
  assert.equal(agentB.conversation, undefined, 'agentB conversation must be undefined');
  assert.equal(isInFlight(agentB), false, 'agentB must not be in-flight before event');

  env.emitSessionEvent({id: 'sess-no-conv'}, {type: 'permission/preset', data: {preset: 'workspace-write'}});
  assert.equal(isInFlight(agentB), true, 'agentB must be in-flight synchronously after event');
  assert.equal(agentB.submissions.length, 1, 'agentB must submit command directly on missing conversation');
  assert.deepEqual(agentB.submissions[0], {
    type: 'switchCollaborationMode',
    payload: {mode: 'edit'},
  });

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(isInFlight(agentB), false, 'agentB in-flight flag must clear after settling');
});

test('AC2.5: agent.initializing=true (announce window pin) does not submit and records baseline', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  const agent = env.createFakeAgent('sess-pin', {
    mode: 'yolo',
    initializing: true,
  });

  env.emitSessionEvent({id: 'sess-pin'}, {type: 'permission/preset', data: {preset: 'workspace-write'}});

  assert.equal(agent.submissions.length, 0, 'must not submit command during announce initialization window');
  assert.equal(isInFlight(agent), false, 'must not set in-flight flag during announce window');
  assert.equal(getAgentBaseline(agent), 'workspace-write', 'must record preset baseline');
});

test('AC2.6: non-owned agent (wrong prototype, mismatched transport, missing agent) produces zero action', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // Wrong prototype
  const plainAgent = env.createFakeAgent('sess-plain', {
    isDriverAgent: false,
    mode: 'edit',
  });
  env.emitSessionEvent({id: 'sess-plain'}, {type: 'permission/preset', data: {preset: 'read-only'}});
  assert.equal(plainAgent.submissions.length, 0);

  // Mismatched transport
  const diffTransportAgent = env.createFakeAgent('sess-other-transport', {
    agentTransport: Symbol('different-transport'),
    mode: 'edit',
  });
  env.emitSessionEvent({id: 'sess-other-transport'}, {type: 'permission/preset', data: {preset: 'read-only'}});
  assert.equal(diffTransportAgent.submissions.length, 0);

  // Missing agent in ctx.agents
  assert.doesNotThrow(() => {
    env.emitSessionEvent({id: 'sess-non-existent'}, {type: 'permission/preset', data: {preset: 'read-only'}});
  });
});

test('AC2.7: unmapped preset (custom/auto/unknown/non-preset event) produces zero action', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);
  const agent = env.createFakeAgent('sess-1', {mode: 'edit'});

  const unmappedPresets = ['custom', 'auto', 'plan', 'unknown-val', undefined, null];
  for (const preset of unmappedPresets) {
    env.emitSessionEvent({id: 'sess-1'}, {type: 'permission/preset', data: {preset}});
    assert.equal(agent.submissions.length, 0);
    assert.equal(isInFlight(agent), false);
  }

  // Non-preset event type
  env.emitSessionEvent({id: 'sess-1'}, {type: 'session/message', data: {preset: 'read-only'}});
  assert.equal(agent.submissions.length, 0);
  assert.equal(isInFlight(agent), false);
});

test('AC2.8: submitControl reject logs warning with sessionId and mode without throwing', async () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  let rejectControl;
  const pReject = new Promise((_, reject) => { rejectControl = reject; });

  const agent = env.createFakeAgent('sess-failing', {
    mode: 'edit',
    submitControl: async () => pReject,
  });

  let returnVal;
  assert.doesNotThrow(() => {
    returnVal = env.emitSessionEvent(
      {id: 'sess-failing'},
      {type: 'permission/preset', data: {preset: 'read-only'}}
    );
  });
  assert.equal(returnVal, undefined, 'listener must return undefined synchronously');
  assert.equal(isInFlight(agent), true, 'must be in-flight while promise is pending');

  // Trigger rejection
  rejectControl(new Error('rpc-timeout-simulated'));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(isInFlight(agent), false, 'in-flight flag must clear after rejection settles');
  assert.equal(env.warnings.length, 1);
  assert.match(env.warnings[0], /sess-failing/);
  assert.match(env.warnings[0], /build/);
  assert.match(env.warnings[0], /rpc-timeout-simulated/);
});

test('AC2.9: in-flight flag lifecycle sets synchronously before submission and clears per operation on settle', async () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  let resolveOp1, resolveOp2;
  const p1 = new Promise(resolve => { resolveOp1 = resolve; });
  const p2 = new Promise(resolve => { resolveOp2 = resolve; });
  let calls = 0;

  const agent = env.createFakeAgent('sess-lifecycle', {
    mode: 'build',
    submitControl: async (cmd) => {
      calls++;
      agent.submissions.push(cmd);
      if (calls === 1) return p1;
      return p2;
    },
  });

  assert.equal(isInFlight(agent), false);

  // Operation 1 triggers
  env.emitSessionEvent({id: 'sess-lifecycle'}, {type: 'permission/preset', data: {preset: 'workspace-write'}});
  assert.equal(isInFlight(agent), true, 'must be in-flight synchronously after event');
  assert.equal(agent.submissions.length, 1);

  // Operation 2 triggers concurrently
  env.emitSessionEvent({id: 'sess-lifecycle'}, {type: 'permission/preset', data: {preset: 'danger-full-access'}});
  assert.equal(isInFlight(agent), true, 'must remain in-flight with two active operations');
  assert.equal(agent.submissions.length, 2);

  // Settle operation 1 only
  resolveOp1();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(isInFlight(agent), true, 'settling operation 1 must not clear operation 2 in-flight token');

  // Settle operation 2
  resolveOp2();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(isInFlight(agent), false, 'in-flight must be false when all operations settle');
});

test('AC2.10: cleanup function returned by effect unregisters session/event listener', () => {
  const env = createFakeEnv();
  const cleanup = installPermissionModeSeam(env.ctx, env.factory);
  const agent = env.createFakeAgent('sess-1', {mode: 'edit'});

  assert.equal(env.unregisterCalls.length, 0);

  // Execute cleanup
  cleanup();
  assert.equal(env.unregisterCalls.includes('session/event'), true);

  // Emit event after cleanup: must have no effect
  env.emitSessionEvent({id: 'sess-1'}, {type: 'permission/preset', data: {preset: 'read-only'}});
  assert.equal(agent.submissions.length, 0);
});

test('AC2 alias: installPermissionModeSeams is exported and identical to installPermissionModeSeam', () => {
  assert.equal(typeof installPermissionModeSeam, 'function');
  assert.equal(installPermissionModeSeams, installPermissionModeSeam);
});

test('AC2.11: prototype property preset events ("constructor", "__proto__") produce zero action and do not submit command', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);
  const agent = env.createFakeAgent('sess-proto', {mode: 'edit'});

  const protoKeys = ['constructor', '__proto__', 'toString', 'hasOwnProperty'];
  for (const key of protoKeys) {
    env.emitSessionEvent({id: 'sess-proto'}, {type: 'permission/preset', data: {preset: key}});
    assert.equal(agent.submissions.length, 0, `preset event with "${key}" must not trigger submissions`);
    assert.equal(isInFlight(agent), false, `preset event with "${key}" must not set inFlight`);
  }
});

// ============================================================================
// AC3 create 默认值（DriverFactory.create 路径表达式语义与源码冻结）
// ============================================================================

test('AC3.1: create mode resolution expression maps defaultPreset from ctx.get("permissionPresets")', () => {
  const evaluateMode = (ctx, options = {}) =>
    options.mode ?? options.agentOptions?.mode ?? mapPreset(ctx.get?.('permissionPresets')?.defaultPreset);

  // workspace-write -> edit
  assert.equal(evaluateMode({
    get: service => service === 'permissionPresets' ? {defaultPreset: 'workspace-write'} : undefined,
  }), 'edit');

  // danger-full-access -> yolo
  assert.equal(evaluateMode({
    get: service => service === 'permissionPresets' ? {defaultPreset: 'danger-full-access'} : undefined,
  }), 'yolo');

  // read-only -> build
  assert.equal(evaluateMode({
    get: service => service === 'permissionPresets' ? {defaultPreset: 'read-only'} : undefined,
  }), 'build');

  // defaultPreset undefined
  assert.equal(evaluateMode({
    get: service => service === 'permissionPresets' ? {defaultPreset: undefined} : undefined,
  }), undefined);

  // defaultPreset custom (unmapped)
  assert.equal(evaluateMode({
    get: service => service === 'permissionPresets' ? {defaultPreset: 'custom'} : undefined,
  }), undefined);

  // permissionPresets service absent
  assert.equal(evaluateMode({
    get: () => undefined,
  }), undefined);

  // ctx.get absent
  assert.equal(evaluateMode({}), undefined);
});

test('AC3.2: create mode resolution prioritizes explicit options.mode and options.agentOptions.mode', () => {
  const evaluateMode = (ctx, options = {}) =>
    options.mode ?? options.agentOptions?.mode ?? mapPreset(ctx.get?.('permissionPresets')?.defaultPreset);

  const ctxWithDefault = {
    get: service => service === 'permissionPresets' ? {defaultPreset: 'workspace-write'} : undefined,
  };

  // options.mode takes highest precedence
  assert.equal(evaluateMode(ctxWithDefault, {mode: 'yolo'}), 'yolo');

  // options.agentOptions.mode takes precedence over defaultPreset
  assert.equal(evaluateMode(ctxWithDefault, {agentOptions: {mode: 'build'}}), 'build');

  // options.mode takes precedence over options.agentOptions.mode
  assert.equal(evaluateMode(ctxWithDefault, {mode: 'build', agentOptions: {mode: 'yolo'}}), 'build');
});

test('AC3.3: factory create payload passes mode when resolved and leaves it undefined when absent', () => {
  const resolveMode = (ctx, options = {}) =>
    options.mode ?? options.agentOptions?.mode ?? mapPreset(ctx.get?.('permissionPresets')?.defaultPreset);

  const buildCreatePayload = (ctx, options = {}, cwd = '/test/workspace') => ({
    cwd,
    mode: resolveMode(ctx, options),
  });

  const payloadWithPreset = buildCreatePayload({
    get: () => ({defaultPreset: 'danger-full-access'}),
  });
  assert.equal(payloadWithPreset.mode, 'yolo');

  const payloadWithoutPreset = buildCreatePayload({
    get: () => undefined,
  });
  assert.equal(payloadWithoutPreset.mode, undefined);
  assert.equal('mode' in payloadWithoutPreset, true);
  assert.equal(payloadWithoutPreset.mode === undefined, true);
});

test('AC3.4: factory.mjs source code retains exact defaultPreset mapping expression and announce pin pattern', () => {
  const factoryPath = new URL('../packages/driver/factory.mjs', import.meta.url);
  const factorySource = readFileSync(factoryPath, 'utf8');

  // Assert mapPreset import
  assert.ok(
    factorySource.includes("import {mapPreset} from './permission-map.mjs';"),
    'factory.mjs must import mapPreset from permission-map.mjs'
  );

  // Assert exact expression in create method
  const expectedExpression = "mode:options.mode??options.agentOptions?.mode??mapPreset(this.ctx.get?.('permissionPresets')?.defaultPreset)";
  assert.ok(
    factorySource.includes(expectedExpression),
    `factory.mjs must contain exact create mode resolution expression: ${expectedExpression}`
  );

  // Assert announce pin window pattern: agent.initializing = true inside try/finally around announce
  assert.ok(
    factorySource.includes("agent.initializing=true;") &&
    factorySource.includes("try{agent.ctx.sessions.announce(session)}finally{agent.initializing=false}"),
    'factory.mjs must set agent.initializing=true and clear it in finally around announce(session)'
  );
});
