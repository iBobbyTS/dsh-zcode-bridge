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

class FakeConversation {
  constructor(initialState = {}) {
    this.subscribers = new Set();
    this.state = initialState;
  }
  subscribe(fn) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }
  pushState(newState) {
    this.state = {...this.state, ...newState};
    for (const fn of Array.from(this.subscribers)) {
      fn(this.state);
    }
  }
}

function createFakeEnv() {
  const listeners = new Map();
  const unregisterCalls = [];
  const warnings = [];
  const agents = new Map();
  const permissionsMap = new Map();
  const services = new Map();
  const transport = Symbol('fake-transport');
  const factory = {transport, accepting: true};
  let stateOfCalls = 0;

  const defaultProjections = {
    stateOf(session, name) {
      stateOfCalls++;
      if (name === 'permissions') {
        return permissionsMap.get(session) ?? null;
      }
      return null;
    },
  };
  services.set('sessionProjections', defaultProjections);

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
      list() {
        return Array.from(agents.values());
      },
    },
    get(name) {
      return services.get(name);
    },
  };

  function emit(name, ...args) {
    const list = listeners.get(name);
    if (!list) return undefined;
    let lastResult;
    for (const fn of Array.from(list)) {
      lastResult = fn(...args);
    }
    return lastResult;
  }

  function emitSessionEvent(session, event) {
    return emit('session/event', session, event);
  }

  function createFakeAgent(id, options = {}) {
    const {
      agentTransport = transport,
      mode = 'edit',
      hasConversation = true,
      status = 'live',
      conversationState = null,
      initializing = false,
      submitControl = null,
      isDriverAgent = true,
      disposed = false,
      foldedPreset = 'workspace-write',
      emitOnAppend = false,
    } = options;
    const snapshot = 'snapshot' in options
      ? options.snapshot
      : (mode !== undefined ? {config: {mode}} : undefined);
    const proto = isDriverAgent ? DriverAgent.prototype : Object.prototype;
    const agent = Object.create(proto);
    const submissions = [];
    const appends = [];
    agent.id = id;
    agent.transport = agentTransport;
    agent.initializing = initializing;
    agent.disposed = disposed;

    if (hasConversation) {
      if (options.conversation) {
        agent.conversation = options.conversation;
      } else {
        const initial = conversationState ?? (
          snapshot !== undefined ? {status, snapshot} : {status}
        );
        agent.conversation = new FakeConversation(initial);
      }
    } else {
      agent.conversation = undefined;
    }

    const session = options.session ?? {
      id,
      append(type, data) {
        appends.push({type, data});
        const cur = permissionsMap.get(session);
        if (cur) {
          if (type === 'permission/preset') cur.preset = data.preset;
          if (type === 'sandbox/mode') cur.sandbox = data.mode;
          if (type === 'approval/policy') cur.approval = data.policy;
        }
        if (agent.onAppend) {
          agent.onAppend(type, data);
        }
        if (agent.emitOnAppend) {
          emitSessionEvent(session, {type, data});
        }
      },
    };
    agent.session = session;
    agent.appends = appends;
    agent.emitOnAppend = emitOnAppend;
    agent.submissions = submissions;
    agent.submitControl = submitControl || (async (cmd) => {
      submissions.push(cmd);
      return {ok: true};
    });

    if (foldedPreset) {
      const bundle = REVERSE_BUNDLE_MAP[foldedPreset] ?? {sandbox: 'workspace-write', approval: 'ask'};
      permissionsMap.set(session, {
        preset: foldedPreset,
        sandbox: bundle.sandbox,
        approval: bundle.approval,
        seeded: true,
      });
    } else if (foldedPreset === null) {
      permissionsMap.set(session, null);
    }

    agents.set(id, agent);
    return agent;
  }

  return {
    ctx,
    factory,
    agents,
    warnings,
    listeners,
    services,
    permissionsMap,
    unregisterCalls,
    createFakeAgent,
    emit,
    emitSessionEvent,
    emitAgentCreated: (agent) => emit('agent/created', {agent}),
    emitAgentDisposed: (agent) => emit('agent/disposed', {agent}),
    setSessionPermissions: (session, proj) => {
      if (proj === null) permissionsMap.set(session, null);
      else permissionsMap.set(session, {...proj});
    },
    getStateOfCalls: () => stateOfCalls,
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

// ============================================================================
// AC4 逆向映射与捆绑（三元组与冻结断言）
// ============================================================================

test('AC4.1: modeBundle returns frozen triplets for valid modes and undefined for plan/auto/custom/unknown', () => {
  const buildBundle = modeBundle('build');
  assert.deepEqual(buildBundle, {sandbox: 'read-only', approval: 'ask'});
  assert.ok(Object.isFrozen(buildBundle), 'build mode bundle must be frozen');

  const editBundle = modeBundle('edit');
  assert.deepEqual(editBundle, {sandbox: 'workspace-write', approval: 'ask'});
  assert.ok(Object.isFrozen(editBundle), 'edit mode bundle must be frozen');

  const yoloBundle = modeBundle('yolo');
  assert.deepEqual(yoloBundle, {sandbox: 'danger-full-access', approval: 'never'});
  assert.ok(Object.isFrozen(yoloBundle), 'yolo mode bundle must be frozen');

  assert.equal(modeBundle('plan'), undefined);
  assert.equal(modeBundle('auto'), undefined);
  assert.equal(modeBundle('custom'), undefined);
  assert.equal(modeBundle(undefined), undefined);
  assert.equal(modeBundle('unknown-mode'), undefined);
});

// ============================================================================
// AC5 两个对齐时机
// ============================================================================

test('AC5.1: Timing (a) initial read on attach: agent/created with live yolo snapshot and workspace-write folded state appends triplet in exact order', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // Subcase 1: via agent/created event
  const agent = env.createFakeAgent('sess-initial-created', {
    mode: 'yolo',
    status: 'live',
    foldedPreset: 'workspace-write',
  });
  env.emitAgentCreated(agent);

  assert.equal(agent.appends.length, 3, 'initial read must append exactly 3 events');
  assert.deepEqual(agent.appends, [
    {type: 'permission/preset', data: {preset: 'danger-full-access'}},
    {type: 'sandbox/mode', data: {mode: 'danger-full-access'}},
    {type: 'approval/policy', data: {policy: 'never'}},
  ]);

  // Subcase 2: pre-existing agent in factory before seam install
  const env2 = createFakeEnv();
  const preAgent = env2.createFakeAgent('sess-initial-pre', {
    mode: 'yolo',
    status: 'live',
    foldedPreset: 'workspace-write',
  });
  installPermissionModeSeam(env2.ctx, env2.factory);

  assert.equal(preAgent.appends.length, 3, 'seam install must attach pre-existing agents from factory');
  assert.deepEqual(preAgent.appends, [
    {type: 'permission/preset', data: {preset: 'danger-full-access'}},
    {type: 'sandbox/mode', data: {mode: 'danger-full-access'}},
    {type: 'approval/policy', data: {policy: 'never'}},
  ]);
});

test('AC5.2: subscribe does not replay: attaching during connecting status does not align, subsequent transition to live aligns on first observation', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  const agent = env.createFakeAgent('sess-connecting', {
    mode: 'yolo',
    status: 'connecting',
    foldedPreset: 'workspace-write',
  });

  env.emitAgentCreated(agent);
  assert.equal(agent.appends.length, 0, 'connecting status must produce zero appends on attach');

  // Push transition to live with snapshot mode yolo
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });

  assert.equal(agent.appends.length, 3, 'first observation after becoming live counts as transition');
  assert.deepEqual(agent.appends, [
    {type: 'permission/preset', data: {preset: 'danger-full-access'}},
    {type: 'sandbox/mode', data: {mode: 'danger-full-access'}},
    {type: 'approval/policy', data: {policy: 'never'}},
  ]);
});

test('AC5.3: Timing (b) value transition: live push build->yolo appends triplet, same value re-push produces zero appends', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  const agent = env.createFakeAgent('sess-transition', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
  });
  env.emitAgentCreated(agent);
  assert.equal(agent.appends.length, 0, 'initial matching state produces zero appends');

  // Push mode transition build -> yolo
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agent.appends.length, 3, 'mode transition must append yolo triplet');
  assert.deepEqual(agent.appends, [
    {type: 'permission/preset', data: {preset: 'danger-full-access'}},
    {type: 'sandbox/mode', data: {mode: 'danger-full-access'}},
    {type: 'approval/policy', data: {policy: 'never'}},
  ]);

  // Same value re-push
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agent.appends.length, 3, 're-pushing same value mode must produce zero additional appends');
});

test('AC5.4: unmapped mode (plan, auto, undefined, custom, unknown) produces zero evaluation and zero appends', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  for (const mode of ['plan', 'auto', undefined, 'custom', 'unknown-val']) {
    const agent = env.createFakeAgent(`sess-unmapped-${mode}`, {
      mode,
      status: 'live',
      foldedPreset: 'workspace-write',
    });
    env.emitAgentCreated(agent);
    assert.equal(agent.appends.length, 0, `initial read for mode "${mode}" must produce zero appends`);

    agent.conversation.pushState({
      status: 'live',
      snapshot: {config: {mode}},
    });
    assert.equal(agent.appends.length, 0, `pushing unmapped mode "${mode}" must produce zero appends`);
  }
});

// ============================================================================
// AC6 回环序列
// ============================================================================

test('AC6.1: E2 zcode mode transition alone triggers 3 appends and forward seam same-value echo guard produces zero submitControl calls', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  const agent = env.createFakeAgent('sess-e2', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);
  assert.equal(agent.appends.length, 0);
  assert.equal(agent.submissions.length, 0);

  // ZCode pushes mode transition to edit
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'edit'}},
  });

  // Reverse seam appends 3 events, and forward seam same-value guard absorbs the echo preset event
  assert.equal(agent.appends.length, 3);
  assert.deepEqual(agent.appends, [
    {type: 'permission/preset', data: {preset: 'workspace-write'}},
    {type: 'sandbox/mode', data: {mode: 'workspace-write'}},
    {type: 'approval/policy', data: {policy: 'ask'}},
  ]);
  assert.equal(agent.submissions.length, 0, 'echo preset event must be swallowed by same-value guard with 0 commands');
});

test('AC6.2: E1->E2->E1 interleaved sequence asserts exact per-segment commands and appends totals', async () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // Agent starts at 'edit', folded state 'workspace-write'
  const agent = env.createFakeAgent('sess-interleaved', {
    mode: 'edit',
    status: 'live',
    foldedPreset: 'workspace-write',
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);

  // Segment 1 (E1): User triggers read-only event -> 1 command, 0 appends (snapshot advances to build)
  env.emitSessionEvent(agent.session, {type: 'permission/preset', data: {preset: 'read-only'}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(agent.submissions.length, 1, 'Segment 1 must produce exactly 1 command');
  assert.deepEqual(agent.submissions[0], {
    type: 'switchCollaborationMode',
    payload: {mode: 'build'},
  });
  assert.equal(agent.appends.length, 0, 'Segment 1 must produce 0 appends');
  // User selection updates DSH folded state to read-only; snapshot advances to build
  env.setSessionPermissions(agent.session, {preset: 'read-only', sandbox: 'read-only', approval: 'ask', seeded: true});
  agent.conversation.pushState({status: 'live', snapshot: {config: {mode: 'build'}}});
  assert.equal(agent.appends.length, 0, 'Segment 1 snapshot matching user choice must produce 0 appends');

  // Segment 2 (E2): ZCode side pushes mode edit (folded read-only) -> 3 appends, 0 commands (snapshot advances to edit)
  agent.conversation.pushState({status: 'live', snapshot: {config: {mode: 'edit'}}});
  assert.equal(agent.appends.length, 3, 'Segment 2 must produce exactly 3 appends');
  assert.deepEqual(agent.appends, [
    {type: 'permission/preset', data: {preset: 'workspace-write'}},
    {type: 'sandbox/mode', data: {mode: 'workspace-write'}},
    {type: 'approval/policy', data: {policy: 'ask'}},
  ]);
  assert.equal(agent.submissions.length, 1, 'Segment 2 must produce 0 additional commands');

  // Segment 3 (E1): User triggers danger-full-access event -> 1 command, 0 appends (snapshot advances to yolo)
  env.setSessionPermissions(agent.session, {preset: 'danger-full-access', sandbox: 'danger-full-access', approval: 'never', seeded: true});
  env.emitSessionEvent(agent.session, {type: 'permission/preset', data: {preset: 'danger-full-access'}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(agent.submissions.length, 2, 'Segment 3 must produce exactly 1 additional command');
  assert.deepEqual(agent.submissions[1], {
    type: 'switchCollaborationMode',
    payload: {mode: 'yolo'},
  });
  assert.equal(agent.appends.length, 3, 'Segment 3 must produce 0 additional appends');
  agent.conversation.pushState({status: 'live', snapshot: {config: {mode: 'yolo'}}});

  // Final exact totals: 2 commands, 3 appends
  assert.equal(agent.submissions.length, 2, 'Total submissions must be exactly 2');
  assert.equal(agent.appends.length, 3, 'Total appends must be exactly 3');
});

test('AC6.3: E2p mode plan transition produces 0 events and 0 commands', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  const agent = env.createFakeAgent('sess-e2p', {
    mode: 'edit',
    status: 'live',
    foldedPreset: 'workspace-write',
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);

  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'plan'}},
  });

  assert.equal(agent.appends.length, 0, 'mode plan must produce 0 appends');
  assert.equal(agent.submissions.length, 0, 'mode plan must produce 0 commands');
});

test('AC6.4: E3c cold recovery: error->live re-evaluates even with same mode; misaligned folded state appends, matching folded state produces zero appends', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // Subcase A: Misaligned folded state (zcode yolo, DSH defaulted to workspace-write)
  const agentA = env.createFakeAgent('sess-e3c-misaligned', {
    mode: 'yolo',
    status: 'error',
    foldedPreset: 'workspace-write',
    emitOnAppend: true,
  });
  env.emitAgentCreated(agentA);
  assert.equal(agentA.appends.length, 0, 'initial error status produces 0 appends');

  // Recovery: status becomes live with mode yolo (same mode re-evaluated)
  agentA.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agentA.appends.length, 3, 'cold recovery with misaligned folded state must append triplet');
  assert.deepEqual(agentA.appends, [
    {type: 'permission/preset', data: {preset: 'danger-full-access'}},
    {type: 'sandbox/mode', data: {mode: 'danger-full-access'}},
    {type: 'approval/policy', data: {policy: 'never'}},
  ]);
  assert.equal(agentA.submissions.length, 0, 'echo guard prevents commands on recovery');

  // Subcase B: Matching folded state (zcode yolo, DSH already danger-full-access)
  const agentB = env.createFakeAgent('sess-e3c-matching', {
    mode: 'yolo',
    status: 'error',
    foldedPreset: 'danger-full-access',
    emitOnAppend: true,
  });
  env.emitAgentCreated(agentB);
  assert.equal(agentB.appends.length, 0);

  // Recovery: status becomes live with mode yolo
  agentB.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agentB.appends.length, 0, 'cold recovery with matching folded state must produce zero appends');
  assert.equal(agentB.submissions.length, 0);
});

test('AC6.5: E5 residual variant: user event before initial snapshot submits command; snapshot arrival during in-flight is suppressed with zero release compensation', async () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  let resolveCommand;
  const pCommand = new Promise(resolve => { resolveCommand = resolve; });

  const agent = env.createFakeAgent('sess-e5', {
    hasConversation: true,
    snapshot: undefined,
    foldedPreset: 'workspace-write',
    submitControl: async (cmd) => {
      agent.submissions.push(cmd);
      return pCommand;
    },
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);

  // Step 1: User triggers read-only before first snapshot -> 1 command queued, in-flight set
  env.emitSessionEvent(agent.session, {type: 'permission/preset', data: {preset: 'read-only'}});
  assert.equal(agent.submissions.length, 1);
  assert.deepEqual(agent.submissions[0], {
    type: 'switchCollaborationMode',
    payload: {mode: 'build'},
  });
  assert.equal(isInFlight(agent), true);

  // Step 2: First snapshot arrives during in-flight with mode yolo (differs from user choice build)
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agent.appends.length, 0, 'snapshot during in-flight must be suppressed (zero appends)');

  // Step 3: Command settles
  resolveCommand({ok: true});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(isInFlight(agent), false);
  assert.equal(agent.appends.length, 0, 'command settling must not trigger release compensation (zero appends, zero rewrites)');
  assert.equal(agent.submissions.length, 1);
});

// ============================================================================
// R7 抑制与生命周期
// ============================================================================

test('R7.1: Mode transition during in-flight is suppressed; settling does not replay, same value re-push produces zero appends, different value appends', async () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  let resolveFirst;
  const pFirst = new Promise(resolve => { resolveFirst = resolve; });

  const agent = env.createFakeAgent('sess-r7-inflight', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
    submitControl: async (cmd) => {
      agent.submissions.push(cmd);
      return pFirst;
    },
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);

  // Trigger forward switch to put seam in flight
  env.emitSessionEvent(agent.session, {type: 'permission/preset', data: {preset: 'workspace-write'}});
  assert.equal(isInFlight(agent), true);

  // Push mode transition to yolo while in flight
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agent.appends.length, 0, 'mode transition during in-flight must produce zero appends');

  // Command settles
  resolveFirst({ok: true});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(isInFlight(agent), false);
  assert.equal(agent.appends.length, 0, 'settling command must not replay suppressed observation');

  // Re-push same value yolo: observation was already consumed, must not replay
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agent.appends.length, 0, 're-pushing same value yolo must produce zero appends');

  // Push different value edit: must align
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'edit'}},
  });
  assert.equal(agent.appends.length, 3, 'different value edit must append triplet');
  assert.deepEqual(agent.appends, [
    {type: 'permission/preset', data: {preset: 'workspace-write'}},
    {type: 'sandbox/mode', data: {mode: 'workspace-write'}},
    {type: 'approval/policy', data: {policy: 'ask'}},
  ]);
});

test('R7.2: Lifecycle and ownership boundaries: disposed agent and seam cleanup detach subscription; owner replacement produces zero appends for old agent', () => {
  const env = createFakeEnv();
  const cleanup = installPermissionModeSeam(env.ctx, env.factory);

  // Subcase A: agent/disposed detaches
  const agentDisposed = env.createFakeAgent('sess-disposed', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
  });
  env.emitAgentCreated(agentDisposed);
  env.emitAgentDisposed(agentDisposed);

  agentDisposed.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agentDisposed.appends.length, 0, 'disposed agent must produce zero appends');

  // Subcase B: seam cleanup unsubscribes active agents
  const agentCleanup = env.createFakeAgent('sess-cleanup', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
  });
  env.emitAgentCreated(agentCleanup);
  cleanup();

  agentCleanup.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agentCleanup.appends.length, 0, 'seam cleanup must produce zero appends on subsequent push');

  // Subcase C: owner replacement: ctx.agents.get returns new agent, old callback produces zero appends
  const env2 = createFakeEnv();
  installPermissionModeSeam(env2.ctx, env2.factory);

  const oldAgent = env2.createFakeAgent('sess-replaced', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
  });
  env2.emitAgentCreated(oldAgent);

  // Replace owner in ctx.agents
  const newAgent = env2.createFakeAgent('sess-replaced', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
  });
  assert.equal(env2.ctx.agents.get('sess-replaced'), newAgent);

  // Old agent receives state update
  oldAgent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(oldAgent.appends.length, 0, 'replaced owner callback must produce zero appends');
});

test('R7.3: Error boundaries: missing projections logs warning with zero appends; session.append failure logs warning without retrying', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // Subcase A: sessionProjections service missing
  env.services.delete('sessionProjections');
  const agentNoProj = env.createFakeAgent('sess-no-proj', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
  });
  env.emitAgentCreated(agentNoProj);

  agentNoProj.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agentNoProj.appends.length, 0);
  assert.ok(env.warnings.some(w => w.includes('permissions-projection-unavailable')));

  // Subcase B: stateOf returns null
  env.services.set('sessionProjections', {stateOf: () => null});
  const agentNullState = env.createFakeAgent('sess-null-state', {
    mode: 'build',
    status: 'live',
    foldedPreset: null,
  });
  env.emitAgentCreated(agentNullState);

  agentNullState.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agentNullState.appends.length, 0);
  assert.ok(env.warnings.some(w => w.includes('permissions-projection-unavailable')));

  // Subcase C: session.append throws
  const env2 = createFakeEnv();
  installPermissionModeSeam(env2.ctx, env2.factory);

  let appendCalls = 0;
  const agentThrowing = env2.createFakeAgent('sess-throwing', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
    session: {
      id: 'sess-throwing',
      append() {
        appendCalls++;
        throw new Error('disk-full-simulated');
      },
    },
  });
  env2.emitAgentCreated(agentThrowing);

  assert.doesNotThrow(() => {
    agentThrowing.conversation.pushState({
      status: 'live',
      snapshot: {config: {mode: 'yolo'}},
    });
  });

  assert.equal(appendCalls, 1, 'must attempt append once and not retry on failure');
  assert.ok(env2.warnings.some(w => w.includes('permission alignment failed') && w.includes('disk-full-simulated')));
});

test('R7.4: User switch interrupting triplet append: in-flight set on first append stops subsequent appends', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  const agent = env.createFakeAgent('sess-interrupt', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
  });

  agent.onAppend = (type) => {
    if (type === 'permission/preset') {
      // Simulate user switch arriving synchronously during the first append
      env.emitSessionEvent(agent.session, {type: 'permission/preset', data: {preset: 'workspace-write'}});
    }
  };

  env.emitAgentCreated(agent);

  // Push mode transition build -> yolo
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });

  // Exactly 1 append must have succeeded before the loop was interrupted by in-flight
  assert.equal(agent.appends.length, 1, 'must abort subsequent appends when interrupted by in-flight');
  assert.equal(agent.appends[0].type, 'permission/preset');
  assert.deepEqual(agent.appends[0].data, {preset: 'danger-full-access'});
});

// ============================================================================
// AC7 导入游标与原生事件安全
// ============================================================================

test('AC7.1: Cursor safety: reverse sync appended events are strictly DSH native events without zcode rowId or turn tracking fields', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  const agent = env.createFakeAgent('sess-cursor', {
    mode: 'yolo',
    status: 'live',
    foldedPreset: 'workspace-write',
  });
  env.emitAgentCreated(agent);

  assert.equal(agent.appends.length, 3);
  const allowedTypes = new Set(['permission/preset', 'sandbox/mode', 'approval/policy']);
  for (const event of agent.appends) {
    assert.ok(allowedTypes.has(event.type), `event type "${event.type}" must be a standard DSH permission type`);
    assert.equal('rowId' in event.data, false, 'must not attach rowId');
    assert.equal('turnId' in event.data, false, 'must not attach turnId');
    assert.equal('stepId' in event.data, false, 'must not attach stepId');
    assert.equal('cursor' in event.data, false, 'must not attach cursor');
  }
});

// ============================================================================
// S02 评审修复波2（B1 resync 误判 + B2 组合轨迹 + NIT 三元组判错力）
// ============================================================================

test('Repair 1 (B1): resync same-value produces zero release compensation and zero evaluation', async () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  let resolveCommand;
  const pCommand = new Promise(resolve => { resolveCommand = resolve; });

  // 1. live(build, fold read-only 一致)
  const agent = env.createFakeAgent('sess-repair-b1', {
    mode: 'build',
    status: 'live',
    foldedPreset: 'read-only',
    submitControl: async (cmd) => {
      agent.submissions.push(cmd);
      return pCommand;
    },
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);
  assert.equal(agent.appends.length, 0);
  assert.equal(agent.submissions.length, 0);

  // 2. 用户切 workspace-write（命令挂起）
  env.emitSessionEvent(agent.session, {type: 'permission/preset', data: {preset: 'workspace-write'}});
  assert.equal(agent.submissions.length, 1);
  assert.deepEqual(agent.submissions[0], {
    type: 'switchCollaborationMode',
    payload: {mode: 'edit'},
  });
  assert.equal(isInFlight(agent), true);

  // 3. 推 yolo（抑制零追加）
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agent.appends.length, 0, 'suppressed during in-flight: zero appends');

  // 4. settle
  resolveCommand({ok: true});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(isInFlight(agent), false);
  assert.equal(agent.appends.length, 0, 'zero compensation on settle');

  const readsBeforeResync = env.getStateOfCalls();

  // 5. 推 resyncing
  agent.conversation.pushState({status: 'resyncing'});
  assert.equal(agent.appends.length, 0, 'resyncing produces zero appends');

  // 6. 推 live 同 yolo
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  // 断言零追加零评估（探针断言零读，零追加+零命令）
  assert.equal(agent.appends.length, 0, 'resyncing->live same mode yolo produces zero appends');
  assert.equal(agent.submissions.length, 1, 'resyncing->live produces zero additional commands');
  assert.equal(env.getStateOfCalls(), readsBeforeResync, 'resyncing->live same mode must not read projection (zero evaluation)');

  // 7. 再推不同值 edit→追加（时机(b) 仍活）
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'edit'}},
  });
  assert.equal(agent.appends.length, 3, 'subsequent different value edit triggers timing (b) alignment');
  assert.deepEqual(agent.appends, [
    {type: 'permission/preset', data: {preset: 'workspace-write'}},
    {type: 'sandbox/mode', data: {mode: 'workspace-write'}},
    {type: 'approval/policy', data: {policy: 'ask'}},
  ]);
  assert.equal(agent.submissions.length, 1, 'echo absorbed by same-value guard');
});

test('Repair 2 (B1): rename resync does not trigger reopening alignment', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // live 一致态
  const agent = env.createFakeAgent('sess-repair-rename', {
    mode: 'edit',
    status: 'live',
    foldedPreset: 'workspace-write',
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);
  assert.equal(agent.appends.length, 0, 'initial matching state produces zero appends');

  // resyncing -> live 同 mode -> 零追加
  agent.conversation.pushState({status: 'resyncing'});
  assert.equal(agent.appends.length, 0, 'resyncing produces zero appends');

  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'edit'}},
  });
  assert.equal(agent.appends.length, 0, 'resyncing->live with same mode produces zero appends');
  assert.equal(agent.submissions.length, 0, 'zero commands produced');
});

test('Repair 3 (B2): E3c complete trajectory with announce window pin and initial read alignment', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // 1. 折叠态为 null（空权限日志），agent.initializing=true
  const agent = env.createFakeAgent('sess-repair-e3c', {
    initializing: true,
    hasConversation: true,
    snapshot: undefined,
    foldedPreset: null,
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);
  assert.equal(agent.appends.length, 0);
  assert.equal(agent.submissions.length, 0);

  // 2. agent.initializing=true 期间 dsh 侧 pin 追加（模拟：setSessionPermissions 置默认 workspace-write + emitSessionEvent permission/preset workspace-write 于 initializing 窗口内→零命令）
  env.setSessionPermissions(agent.session, {
    preset: 'workspace-write',
    sandbox: 'workspace-write',
    approval: 'ask',
    seeded: true,
  });
  env.emitSessionEvent(agent.session, {
    type: 'permission/preset',
    data: {preset: 'workspace-write'},
  });
  assert.equal(agent.submissions.length, 0, 'initializing window pin produces zero commands');
  assert.equal(getAgentBaseline(agent), 'workspace-write', 'must record preset baseline');

  // 3. initializing=false
  agent.initializing = false;

  // 4. 推 live 快照 yolo→时机(a)：0 命令、3 追加（danger-full-access 组）、回声被守卫消化
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agent.submissions.length, 0, 'timing (a) must produce 0 commands');
  assert.equal(agent.appends.length, 3, 'timing (a) must produce 3 appends');
  assert.deepEqual(agent.appends, [
    {type: 'permission/preset', data: {preset: 'danger-full-access'}},
    {type: 'sandbox/mode', data: {mode: 'danger-full-access'}},
    {type: 'approval/policy', data: {policy: 'never'}},
  ]);

  const finalPermissions = env.permissionsMap.get(agent.session);
  assert.equal(finalPermissions.preset, 'danger-full-access');
  assert.equal(finalPermissions.sandbox, 'danger-full-access');
  assert.equal(finalPermissions.approval, 'never');
});

test('Repair 4 (B2): E5 complete trajectory with missing snapshot, in-flight suppression, and matching effect frame', async () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  let resolveCommand;
  const pCommand = new Promise(resolve => { resolveCommand = resolve; });

  // 1. 快照缺席
  const agent = env.createFakeAgent('sess-repair-e5', {
    hasConversation: true,
    snapshot: undefined,
    foldedPreset: 'workspace-write',
    submitControl: async (cmd) => {
      agent.submissions.push(cmd);
      return pCommand;
    },
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);
  assert.equal(agent.appends.length, 0);
  assert.equal(agent.submissions.length, 0);

  // 2. 用户 read-only 事件→1 命令挂起
  env.emitSessionEvent(agent.session, {
    type: 'permission/preset',
    data: {preset: 'read-only'},
  });
  assert.equal(agent.submissions.length, 1);
  assert.deepEqual(agent.submissions[0], {
    type: 'switchCollaborationMode',
    payload: {mode: 'build'},
  });
  assert.equal(isInFlight(agent), true);

  // 用户选择折叠态更新为 read-only
  env.setSessionPermissions(agent.session, {
    preset: 'read-only',
    sandbox: 'read-only',
    approval: 'ask',
    seeded: true,
  });

  // 3. 推 live 快照 yolo（在飞抑制零追加）
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(agent.appends.length, 0, 'snapshot during in-flight must be suppressed (zero appends)');

  // 4. 命令 settle
  resolveCommand({ok: true});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(isInFlight(agent), false);
  assert.equal(agent.appends.length, 0, 'command settle must not produce compensation appends');

  // 5. 推 build 效果帧（值转变时机(b)，折叠已是 read-only→一致零追加）
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'build'}},
  });
  assert.equal(agent.appends.length, 0, 'matching folded state on effect frame produces zero appends');

  // 6. 终态断言：1 命令、0 追加、折叠 read-only、观察 mode build
  assert.equal(agent.submissions.length, 1, 'must have exactly 1 command total');
  assert.equal(agent.appends.length, 0, 'must have exactly 0 appends total');
  assert.equal(env.permissionsMap.get(agent.session).preset, 'read-only', 'folded preset must be read-only');
  assert.equal(agent.conversation.state.snapshot.config.mode, 'build', 'observed mode must be build');
});

test('Repair 5 (NIT): triplet mismatch with same preset but different approval triggers 3 appends to correct approval', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // preset 相同但 approval 不同（setSessionPermissions 手工置 {preset:'workspace-write',sandbox:'workspace-write',approval:'never'}）
  const agent = env.createFakeAgent('sess-repair-nit', {
    mode: 'edit',
    status: 'connecting',
    foldedPreset: null,
    emitOnAppend: true,
  });
  env.setSessionPermissions(agent.session, {
    preset: 'workspace-write',
    sandbox: 'workspace-write',
    approval: 'never',
    seeded: true,
  });
  env.emitAgentCreated(agent);
  assert.equal(agent.appends.length, 0);

  // 推 live 同 mode edit→断言 3 追加（修正 approval 为 ask）
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'edit'}},
  });

  assert.equal(agent.appends.length, 3, 'triplet mismatch must append 3 events to correct approval');
  assert.deepEqual(agent.appends, [
    {type: 'permission/preset', data: {preset: 'workspace-write'}},
    {type: 'sandbox/mode', data: {mode: 'workspace-write'}},
    {type: 'approval/policy', data: {policy: 'ask'}},
  ]);

  const updatedPermissions = env.permissionsMap.get(agent.session);
  assert.equal(updatedPermissions.preset, 'workspace-write');
  assert.equal(updatedPermissions.sandbox, 'workspace-write');
  assert.equal(updatedPermissions.approval, 'ask', 'approval must be corrected to ask');
  assert.equal(agent.submissions.length, 0, 'echo preset event must be swallowed by same-value guard');
});

// ============================================================================
// S02 评审修复波3（恢复首读标记穿过 connecting）
// ============================================================================

test('Repair 6 (S02波3 a): live->error->connecting->live same mode with misaligned folded state triggers 1 evaluation and 3 appends', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // 1. live(yolo, folded danger-full-access 一致态)
  const agent = env.createFakeAgent('sess-repair-recover-misaligned', {
    mode: 'yolo',
    status: 'live',
    foldedPreset: 'danger-full-access',
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);
  assert.equal(agent.appends.length, 0, 'initial matching state produces zero appends');
  const callsBefore = env.getStateOfCalls();

  // 2. error 态：置 recovering 粘性标记
  agent.conversation.pushState({status: 'error'});
  assert.equal(agent.appends.length, 0, 'error status produces zero appends');
  assert.equal(env.getStateOfCalls(), callsBefore, 'error status does not evaluate projections');

  // 3. connecting 态：不清除 recovering 标记
  agent.conversation.pushState({status: 'connecting'});
  assert.equal(agent.appends.length, 0, 'connecting status produces zero appends');
  assert.equal(env.getStateOfCalls(), callsBefore, 'connecting status does not evaluate projections');

  // 4. 断线期间折叠态错位（例如回退到 workspace-write）
  env.setSessionPermissions(agent.session, {
    preset: 'workspace-write',
    sandbox: 'workspace-write',
    approval: 'ask',
    seeded: true,
  });

  // 5. 恢复 live 同 mode yolo：粘性 recovering 触发首读评估（stateOfCalls 增长恰好 1），发现错位追加 3 事件并消费标记
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(env.getStateOfCalls(), callsBefore + 1, 'recovery to live must evaluate projection exactly once');
  assert.equal(agent.appends.length, 3, 'misaligned folded state triggers 3 appends');
  assert.deepEqual(agent.appends, [
    {type: 'permission/preset', data: {preset: 'danger-full-access'}},
    {type: 'sandbox/mode', data: {mode: 'danger-full-access'}},
    {type: 'approval/policy', data: {policy: 'never'}},
  ]);

  // 6. 标记已消费：再次推同值 live 不再评估
  const callsAfter = env.getStateOfCalls();
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(env.getStateOfCalls(), callsAfter, 'subsequent live with same mode must not re-evaluate (recovering consumed)');
  assert.equal(agent.appends.length, 3, 'no additional appends');
});

test('Repair 7 (S02波3 b): live->error->connecting->live same mode with matching folded state produces zero appends', () => {
  const env = createFakeEnv();
  installPermissionModeSeam(env.ctx, env.factory);

  // 1. live(yolo, folded danger-full-access 一致态)
  const agent = env.createFakeAgent('sess-repair-recover-matching', {
    mode: 'yolo',
    status: 'live',
    foldedPreset: 'danger-full-access',
    emitOnAppend: true,
  });
  env.emitAgentCreated(agent);
  assert.equal(agent.appends.length, 0, 'initial matching state produces zero appends');
  const callsBefore = env.getStateOfCalls();

  // 2. error 态
  agent.conversation.pushState({status: 'error'});
  assert.equal(agent.appends.length, 0);

  // 3. connecting 态
  agent.conversation.pushState({status: 'connecting'});
  assert.equal(agent.appends.length, 0);

  // 4. 恢复 live 同 mode yolo，折叠态保持一致
  agent.conversation.pushState({
    status: 'live',
    snapshot: {config: {mode: 'yolo'}},
  });
  assert.equal(env.getStateOfCalls(), callsBefore + 1, 'recovery to live performs opening read evaluation');
  assert.equal(agent.appends.length, 0, 'matching folded state produces zero appends');
  assert.equal(agent.submissions.length, 0, 'zero commands produced');
});
