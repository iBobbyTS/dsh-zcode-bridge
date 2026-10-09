import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {readFileSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {DriverStateStore, validModelCatalog} from '../packages/driver/driver-state.mjs';
import {ZCodeRuntime, STATIC_SEED_PROVIDERS, STATIC_SEED_CATALOG} from '../packages/host/zcode-runtime.mjs';
import {statusText} from '../packages/client/status.mjs';

const require = createRequire(import.meta.url);
const clientBundleCode = require('esbuild').buildSync({
  entryPoints: [resolve('packages/client/client.jsx')],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  external: ['react'],
}).outputFiles[0].text;
const clientModule = {exports: {}};
vm.runInThisContext('(function(require,module,exports){' + clientBundleCode + '\n})')(require, clientModule, clientModule.exports);
const {StatusCard} = clientModule.exports;

const renderStatus = status => renderToStaticMarkup(
  React.createElement(StatusCard, {
    controller: {subscribe: () => () => {}, getSnapshot: () => ({status})},
  })
);

async function withTempDir(prefix, fn) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
}

test('AC 1: 自管模式 runtime.modelProviders()（经 host.zcodeModelCatalog）返回非空且含 reasoningLevels（种子）', async () => {
  await withTempDir('s03-ac1-', async dir => {
    const store = new DriverStateStore(dir);
    let peerEnsured = false;
    const host = {
      authorityMode: 'self-managed',
      zcodeModelCatalog: async () => { await store.ensureLoaded(); return store.readModelCatalog() ?? STATIC_SEED_CATALOG; },
      async connect() { peerEnsured = true; throw new Error('ensurePeer called'); },
    };
    const runtime = new ZCodeRuntime({}, host, {
      store: {records: new Map(), file: join(dir, 'sessions.json'), async load() {}, save() { return Promise.resolve(); }},
    });

    const providers = await runtime.modelProviders();
    assert.equal(peerEnsured, false, 'self-managed discovery must not call ensurePeer');
    assert.ok(Array.isArray(providers) && providers.length > 0, 'providers must be non-empty');
    assert.equal(providers[0].id, 'account:zai-individual-coding-plan');
    assert.ok(Array.isArray(providers[0].models) && providers[0].models.length === 2);

    const glm = providers[0].models.find(m => m.id === 'GLM-5.3');
    assert.ok(glm, 'GLM-5.3 must exist');
    assert.deepEqual(glm.reasoningLevels, ['low', 'medium', 'high', 'xhigh', 'max']);
    assert.equal(glm.defaultReasoningLevel, 'max');

    const glmFlash = providers[0].models.find(m => m.id === 'GLM-5.3-Flash');
    assert.ok(glmFlash, 'GLM-5.3-Flash must exist');
    assert.deepEqual(glmFlash.reasoningLevels, ['low', 'medium', 'high', 'xhigh', 'max']);
    assert.equal(glmFlash.defaultReasoningLevel, 'max');
  });
});

test('AC 2: modelCatalog 持久化跨"重启"（新建 store 读同目录）及形状容错', async () => {
  await withTempDir('s03-ac2-', async dir => {
    const store1 = new DriverStateStore(dir);
    assert.equal(store1.readModelCatalog(), undefined);

    const catalog = {
      providers: [
        {
          id: 'test-provider',
          models: [
            {id: 'test-model', reasoningLevels: ['low', 'high'], defaultReasoningLevel: 'high'},
          ],
        },
      ],
      refreshedAt: 1728450000000,
    };
    await store1.writeModelCatalog(catalog);

    // "Reboot" - construct new store reading the same directory
    const store2 = new DriverStateStore(dir);
    await store2.load();
    assert.deepEqual(store2.readModelCatalog(), catalog);

    // Shape-tolerant load verification: invalid shapes must be ignored without throwing
    const stateFile = join(dir, 'zcode-bridge', 'driver-state.json');
    const invalidShapes = [
      'not-an-object',
      {providers: 'not-an-array'},
      {providers: [{id: 123}]},
      {providers: [{id: 'p', models: 'not-array'}]},
      {providers: [{id: 'p', models: [{id: 456}]}]},
      {providers: [{id: 'p', models: [{id: 'm', reasoningLevels: 'not-array'}]}]},
      {providers: [{id: 'p', models: [{id: 'm', defaultReasoningLevel: 789}]}]},
      {providers: [], refreshedAt: 'not-a-number'},
    ];

    for (const invalid of invalidShapes) {
      assert.equal(validModelCatalog(invalid), false);
      const rawData = {version: 1, nativeArchive: null, legacy: {}, bindings: {}, modelCatalog: invalid};
      await writeFile(stateFile, JSON.stringify(rawData));
      const tolerantStore = new DriverStateStore(dir);
      const loaded = await tolerantStore.load(); // Must not throw!
      assert.equal(tolerantStore.readModelCatalog(), undefined, 'invalid shape must be ignored (remain default)');
      assert.equal(loaded.version, 1);
    }
  });
});

test('AC 3: launcher 在配时 discovery 成功后 modelCatalog 被刷新（fake discovery 注入断言 refreshedAt/内容）', async () => {
  await withTempDir('s03-ac3-', async dir => {
    const driverStore = new DriverStateStore(dir);
    await driverStore.writeModelCatalog(STATIC_SEED_CATALOG);

    const discoveredProviders = [
      {
        id: 'official-live-provider',
        models: [
          {id: 'live-model-alpha', reasoningLevels: ['low', 'medium', 'high'], defaultReasoningLevel: 'high'},
          {id: 'live-model-beta'},
        ],
      },
    ];

    const host = {
      authorityMode: 'host-backed',
      launcher: {state: {phase: 'ready', auth: 'authenticated'}},
      driverStateStore: driverStore,
    };

    const runtime = new ZCodeRuntime({}, host, {
      discoverModels: async () => discoveredProviders,
      driverStateStore: driverStore,
    });

    const before = Date.now();
    const result = await runtime.modelProviders();
    const after = Date.now();

    assert.deepEqual(result, discoveredProviders);
    const refreshed = driverStore.readModelCatalog();
    assert.ok(refreshed, 'modelCatalog must be refreshed');
    assert.deepEqual(refreshed.providers, discoveredProviders);
    assert.ok(typeof refreshed.refreshedAt === 'number');
    assert.ok(refreshed.refreshedAt >= before && refreshed.refreshedAt <= after);

    // Verify written to disk
    const reloadedStore = new DriverStateStore(dir);
    await reloadedStore.load();
    assert.deepEqual(reloadedStore.readModelCatalog(), refreshed);
  });
});

test('AC 4: statusText 返回直连语义文案（不含"不可用"字样）；client auth 分支直连不出现执行不可用提示（对拍仍出现）', () => {
  const directState = {connected: true, auth: 'unavailable', reason: 'direct-storage'};
  const directText = statusText(directState);
  assert.ok(directText.includes('直连'), `expected direct semantics, got: ${directText}`);
  assert.equal(directText.includes('不可用'), false, 'statusText must not contain "不可用"');
  assert.equal(/unavailable/i.test(directText), false, 'statusText must not contain "unavailable"');
  assert.equal(directText.includes('未确认连接'), false, 'statusText must not contain "未确认连接"');

  // client.jsx rendering: connected===true && reason==='direct-storage'
  const directMarkup = renderStatus(directState);
  assert.equal(directMarkup.includes('Model execution is unavailable'), false,
    'execution unavailable notice must not appear for connected + direct-storage');
  assert.equal(directMarkup.includes('模型执行不可用'), false,
    'execution unavailable notice must not appear for connected + direct-storage');
  assert.ok(directMarkup.includes('Direct connection') || directMarkup.includes('直连'),
    'must present direct connection semantics');

  // Regression protection: other auth: 'unavailable' scenarios MUST still show the execution notice
  const unavailableScenarios = [
    {connected: false, auth: 'unavailable', reason: 'launcher-unusable'},
    {connected: true, auth: 'unavailable', reason: 'official-auth-source-missing'},
    {connected: false, auth: 'unavailable', reason: 'host-unreachable'},
  ];

  for (const scenario of unavailableScenarios) {
    const markup = renderStatus(scenario);
    assert.ok(markup.includes('Model execution is unavailable until a supported official authentication path is verified.'),
      `expected execution unavailable notice for ${JSON.stringify(scenario)}`);
    assert.ok(markup.includes('Official authentication source unavailable'));
  }
});

test('AC 5 / Finding 4: scripts/start-official-web.mjs --dry-run 未触碰 profile 目录（无 patch yml）且向 stdout 输出包含 config 的 JSON', async () => {
  await withTempDir('s03-ac5-self-', async selfDir => {
    const proc = spawnSync(process.execPath, [
      resolve('scripts/start-official-web.mjs'),
      '--self-managed',
      '--dry-run',
    ], {
      env: {...process.env, DSH_TMP_ROOT: selfDir},
      encoding: 'utf8',
    });
    assert.equal(proc.status, 0, `dry-run --self-managed failed: ${proc.stderr}`);

    // Verify stdout JSON contract includes config, tmpRoot, profile, selfManaged, dryRun
    const out = JSON.parse(proc.stdout.trim());
    assert.equal(out.tmpRoot, selfDir);
    assert.equal(out.profile, join(selfDir, 'dsh-home/profiles/web'));
    assert.equal(out.selfManaged, true);
    assert.equal(out.dryRun, true);
    assert.deepEqual(out.config, {
      authorityMode: 'self-managed',
      appPath: '/Applications/ZCode.app',
    });
    assert.equal(out.config.launcher, undefined, 'must have no launcher block');

    // Finding 4 verification: dry-run must NOT write any file — profile dir untouched
    const patchFile = join(selfDir, 'dsh-home/profiles/web/cordis.patch.yml');
    assert.equal(existsSync(patchFile), false, 'dry-run must not create cordis.patch.yml');
    assert.equal(existsSync(join(selfDir, 'dsh-home')), false, 'dry-run must leave profile dir untouched');
  });

  await withTempDir('s03-ac5-normal-', async normalDir => {
    const proc = spawnSync(process.execPath, [
      resolve('scripts/start-official-web.mjs'),
      '--dry-run',
    ], {
      env: {...process.env, DSH_TMP_ROOT: normalDir},
      encoding: 'utf8',
    });
    assert.equal(proc.status, 0, `dry-run without flag failed: ${proc.stderr}`);

    // Verify stdout JSON contract includes config, tmpRoot, profile, selfManaged, dryRun
    const out = JSON.parse(proc.stdout.trim());
    assert.equal(out.tmpRoot, normalDir);
    assert.equal(out.profile, join(normalDir, 'dsh-home/profiles/web'));
    assert.equal(out.selfManaged, false);
    assert.equal(out.dryRun, true);
    assert.equal(out.config.authorityMode, 'host-backed');
    assert.ok(out.config.launcher, 'must contain launcher block without flag');

    // Finding 4 verification: dry-run must NOT write any file — profile dir untouched
    const patchFile = join(normalDir, 'dsh-home/profiles/web/cordis.patch.yml');
    assert.equal(existsSync(patchFile), false, 'dry-run must not create cordis.patch.yml');
    assert.equal(existsSync(join(normalDir, 'dsh-home')), false, 'dry-run must leave profile dir untouched');
  });
});

test('Part D: driver apply() wires host.zcodeModelCatalog in self-managed mode only', async () => {
  const {apply} = await import('../packages/driver/index.mjs');
  await withTempDir('s03-driver-apply-', async dir => {
    process.env.DSH_HOME = dir;

    // Self-managed mode
    const selfHost = {authorityMode: 'self-managed', status: {sessionAuthority: 'self'}};
    const selfCtx = {
      zcodeBridgeHost: selfHost,
      fiber: {assertActive() {}},
      get: () => undefined,
      effect: () => () => {},
      on: () => () => {},
      emit() {},
      inject: () => ({await: async () => {}}),
      agents: {setFactory() { return () => {}; }},
      sessions: {},
      sessionProjections: {register() { return () => {}; }},
    };
    await apply(selfCtx);
    assert.equal(typeof selfHost.zcodeModelCatalog, 'function', 'host.zcodeModelCatalog must be wired in self-managed mode');
    const catalog = await selfHost.zcodeModelCatalog();
    assert.deepEqual(catalog, STATIC_SEED_CATALOG, 'returns static seed before store load or on empty store');

    // Host-backed mode: host.zcodeModelCatalog must NOT be wired
    const backedHost = {authorityMode: 'host-backed', status: {sessionAuthority: 'official-host'}};
    const backedCtx = {
      zcodeBridgeHost: backedHost,
      fiber: {assertActive() {}},
      get: () => undefined,
      effect: () => () => {},
      on: () => () => {},
      emit() {},
      inject: () => ({await: async () => {}}),
      agents: {setFactory() { return () => {}; }},
      sessions: {},
      sessionProjections: {register() { return () => {}; }},
    };
    await apply(backedCtx);
    assert.equal(backedHost.zcodeModelCatalog, undefined, 'host.zcodeModelCatalog must NOT be wired in host-backed mode');
  });
});

test('Part B: 首次自管启动时若 modelCatalog 缺省则写入种子', async () => {
  await withTempDir('s03-first-boot-', async dir => {
    const driverStore = new DriverStateStore(dir);
    assert.equal(driverStore.readModelCatalog(), undefined);

    const host = {
      authorityMode: 'self-managed',
      driverStateStore: driverStore,
    };
    const runtime = new ZCodeRuntime({}, host, {
      store: {records: new Map(), file: join(dir, 'sessions.json'), async load() {}, save() { return Promise.resolve(); }},
      driverStateStore: driverStore,
    });

    await runtime.start();

    // Verify seed was written to driverStore and persisted
    const catalog = driverStore.readModelCatalog();
    assert.ok(catalog, 'seed must be written to store on first self-managed boot');
    assert.deepEqual(catalog.providers, STATIC_SEED_PROVIDERS);

    const reloadedStore = new DriverStateStore(dir);
    await reloadedStore.load();
    assert.deepEqual(reloadedStore.readModelCatalog(), catalog);
  });
});

test('Finding 1 (state-erase): pre-populated store file + early launcher discovery -> bindings/nativeArchive/legacy/executionWorkspace all survive', async () => {
  await withTempDir('s03-f1-', async dir => {
    const {mkdir} = await import('node:fs/promises');
    await mkdir(join(dir, 'zcode-bridge'), {recursive: true});

    const stateFile = join(dir, 'zcode-bridge', 'driver-state.json');
    const initialData = {
      version: 1,
      nativeArchive: {outcome: 'archived', count: 42},
      legacy: {'legacy-session-1': {phase: 'synced', timestamp: 123456}},
      bindings: {
        'zcode-conv-1': {sessionId: 'dsh-session-1', workspace: '/custom/workspace'},
      },
      executionWorkspace: '/custom/execution/workspace',
    };
    await writeFile(stateFile, JSON.stringify(initialData, null, 2));

    // Construct DriverStateStore without calling load() or ensureLoaded() beforehand
    const driverStore = new DriverStateStore(dir);

    const host = {
      authorityMode: 'host-backed',
      launcher: {state: {phase: 'ready', auth: 'authenticated'}},
      driverStateStore: driverStore,
    };

    const discoveredProviders = [
      {
        id: 'discovered-provider',
        models: [{id: 'discovered-model', reasoningLevels: ['high'], defaultReasoningLevel: 'high'}],
      },
    ];

    const runtime = new ZCodeRuntime({}, host, {
      discoverModels: async () => discoveredProviders,
      driverStateStore: driverStore,
    });

    // Early launcher discovery triggers wrapper writeModelCatalog before explicit store load
    const result = await runtime.modelProviders();
    assert.deepEqual(result, discoveredProviders);

    // Verify all 4 fields survived in store memory
    assert.deepEqual(driverStore.value.nativeArchive, initialData.nativeArchive, 'nativeArchive must survive');
    assert.deepEqual(driverStore.value.legacy, initialData.legacy, 'legacy must survive');
    assert.deepEqual(driverStore.value.bindings, initialData.bindings, 'bindings must survive');
    assert.equal(driverStore.value.executionWorkspace, initialData.executionWorkspace, 'executionWorkspace must survive');
    assert.deepEqual(driverStore.readModelCatalog().providers, discoveredProviders, 'modelCatalog must be refreshed');

    // Reload from disk to verify persisted file contains all 4 fields
    const reloadedStore = new DriverStateStore(dir);
    await reloadedStore.load();
    assert.deepEqual(reloadedStore.value.nativeArchive, initialData.nativeArchive, 'persisted nativeArchive must survive');
    assert.deepEqual(reloadedStore.value.legacy, initialData.legacy, 'persisted legacy must survive');
    assert.deepEqual(reloadedStore.value.bindings, initialData.bindings, 'persisted bindings must survive');
    assert.equal(reloadedStore.value.executionWorkspace, initialData.executionWorkspace, 'persisted executionWorkspace must survive');
    assert.deepEqual(reloadedStore.readModelCatalog().providers, discoveredProviders, 'persisted modelCatalog must be refreshed');
  });
});

test('Finding 2 (seed pinning): first post-load query (picker-shaped cache) sees refreshed persisted catalog, never pre-load seed', async () => {
  const {apply} = await import('../packages/driver/index.mjs');
  await withTempDir('s03-f2-', async dir => {
    process.env.DSH_HOME = dir;

    const refreshedCatalog = {
      providers: [
        {
          id: 'persisted-official-provider',
          models: [{id: 'persisted-model', reasoningLevels: ['low', 'high'], defaultReasoningLevel: 'high'}],
        },
      ],
      refreshedAt: 1728500000000,
    };
    const {mkdir} = await import('node:fs/promises');
    await mkdir(join(dir, 'zcode-bridge'), {recursive: true});
    await writeFile(join(dir, 'zcode-bridge', 'driver-state.json'), JSON.stringify({
      version: 1,
      nativeArchive: null,
      legacy: {},
      bindings: {},
      modelCatalog: refreshedCatalog,
    }, null, 2));

    const host = {authorityMode: 'self-managed', status: {sessionAuthority: 'self'}};
    const ctx = {
      zcodeBridgeHost: host,
      fiber: {assertActive() {}},
      get: () => undefined,
      effect: () => () => {},
      on: () => () => {},
      emit() {},
      inject: () => ({await: async () => {}}),
      agents: {setFactory() { return () => {}; }},
      sessions: {},
      sessionProjections: {register() { return () => {}; }},
    };
    await apply(ctx);
    assert.equal(typeof host.zcodeModelCatalog, 'function');

    // First query by reference picker (which caches its first result)
    const pickerCachedCatalog = await host.zcodeModelCatalog();

    assert.notDeepEqual(pickerCachedCatalog, STATIC_SEED_CATALOG, 'must not return pre-load seed when persisted catalog exists');
    assert.deepEqual(pickerCachedCatalog, refreshedCatalog, 'must return refreshed persisted catalog');
  });
});

test('Finding 3 (persistence failure rejects discovery): simulated write failure still returns providers with diagnostic', async () => {
  await withTempDir('s03-f3-', async dir => {
    const driverStore = new DriverStateStore(dir);
    driverStore.writeModelCatalog = async () => {
      const err = new Error('EACCES: permission denied, open driver-state.json');
      err.code = 'EACCES';
      throw err;
    };

    const diagnostics = [];
    const host = {
      authorityMode: 'host-backed',
      launcher: {state: {phase: 'ready', auth: 'authenticated'}},
      driverStateStore: driverStore,
    };

    const discoveredProviders = [
      {
        id: 'healthy-provider',
        models: [{id: 'healthy-model'}],
      },
    ];

    const runtime = new ZCodeRuntime({}, host, {
      discoverModels: async () => discoveredProviders,
      driverStateStore: driverStore,
      logger: diag => diagnostics.push(diag),
    });

    // Discovery must NOT reject despite disk write failure
    const providers = await runtime.modelProviders();
    assert.deepEqual(providers, discoveredProviders, 'must return discovered providers despite persistence error');

    // Diagnostic must be recorded
    assert.ok(diagnostics.length > 0, 'diagnostic must be recorded via logger');
    assert.equal(diagnostics[0].event, 'model-catalog-write-failed');
    assert.equal(diagnostics[0].code, 'EACCES');
    assert.ok(runtime.catalogWriteDiagnostic, 'diagnostic must be recorded on runtime');
    assert.equal(runtime.catalogWriteDiagnostic.code, 'EACCES');
  });
});

test('Finding (legacy init store.load clobber): host-backed flow preserves early discovered catalog through legacy init and bindings save', async () => {
  await withTempDir('s03-legacy-clobber-', async dir => {
    const {mkdir} = await import('node:fs/promises');
    await mkdir(join(dir, 'zcode-bridge'), {recursive: true});

    const stateFile = join(dir, 'zcode-bridge', 'driver-state.json');
    const oldCatalog = {
      providers: [
        {
          id: 'old-persisted-provider',
          models: [{id: 'old-model', reasoningLevels: ['low'], defaultReasoningLevel: 'low'}],
        },
      ],
      refreshedAt: 1000000000000,
    };
    const initialData = {
      version: 1,
      nativeArchive: null,
      legacy: {},
      bindings: {},
      modelCatalog: oldCatalog,
    };
    await writeFile(stateFile, JSON.stringify(initialData, null, 2));

    const previousDshHome = process.env.DSH_HOME;
    process.env.DSH_HOME = dir;
    try {
      const {apply} = await import('../packages/driver/index.mjs');
      let capturedFactory;
      let legacyCallback;
      const host = {
        authorityMode: 'host-backed',
        status: {sessionAuthority: 'official-host'},
        launcher: {state: {phase: 'ready', auth: 'authenticated'}},
      };
      const ctx = {
        zcodeBridgeHost: host,
        fiber: {assertActive() {}},
        get: () => undefined,
        effect: callback => {
          const result = callback();
          const cleanups = [];
          if (result && typeof result.next === 'function') {
            let step = result.next();
            while (!step.done) {
              if (step.value) cleanups.push(step.value);
              step = result.next();
            }
          } else if (typeof result === 'function') cleanups.push(result);
          return () => {};
        },
        on: () => () => {},
        emit() {},
        inject: (names, callback) => {
          if (names.includes('sessionPersistence')) legacyCallback = callback;
          return {await: async () => {}};
        },
        agents: {
          setFactory(factory) {
            capturedFactory = factory;
            return () => {};
          },
        },
        sessions: {},
        sessionProjections: {register: () => () => {}},
      };
      await apply(ctx);
      assert.ok(capturedFactory, 'factory must be captured');
      assert.equal(typeof legacyCallback, 'function', 'legacy initialization callback must be registered');

      // Early discovery: wrapper refresh writes new catalog
      const newProviders = [
        {
          id: 'new-discovered-provider',
          models: [{id: 'new-model', reasoningLevels: ['high'], defaultReasoningLevel: 'high'}],
        },
      ];
      const runtime = new ZCodeRuntime({}, host, {
        discoverModels: async () => newProviders,
      });

      let writeStarted;
      const startedPromise = new Promise(resolve => { writeStarted = resolve; });
      const origSave = host.driverStateStore.save.bind(host.driverStateStore);
      host.driverStateStore.save = function() {
        writeStarted();
        return origSave();
      };

      const discoveryPromise = runtime.modelProviders();
      await startedPromise;

      // Legacy initialization path runs:
      const legacyCtx = {
        fiber: {assertActive() {}},
        get: name => {
          if (name === 'sessionPersistence') return {open: async () => {}};
          if (name === 'sessionQuery') return {listSessions: async () => []};
          if (name === 'sessions') return {};
          if (name === 'workspaceRegistry') return {archiveSession: async () => {}};
          return undefined;
        },
        effect: () => () => {},
      };
      await legacyCallback(legacyCtx);
      await discoveryPromise;

      // Trigger a save via bindings:
      capturedFactory.bindings.bind('zcode-conv-new', 'dsh-session-new', '/custom/workspace');
      await host.driverStateStore.writing;

      // Assert the persisted file still contains the NEW catalog (reload-and-clobber path eliminated)
      const reloadedStore = new DriverStateStore(dir);
      await reloadedStore.load();
      const persistedCatalog = reloadedStore.readModelCatalog();
      assert.ok(persistedCatalog, 'persisted modelCatalog must exist');
      assert.equal(persistedCatalog.providers?.[0]?.id, 'new-discovered-provider');
      assert.deepEqual(persistedCatalog.providers, newProviders);
    } finally {
      if (previousDshHome === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = previousDshHome;
    }
  });
});

