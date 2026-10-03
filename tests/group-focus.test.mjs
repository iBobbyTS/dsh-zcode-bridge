// Regression test derived from reviewer reproduction script:
// /Users/ibobby/Projects/dsh-zcode-acp/.agent-work/reviews/CB5-S04-group-focus-repro.mjs
// Verifies CB5-1: continuous multi-character typing preserves focus,
// draft edits do not prematurely unmount/migrate the row,
// and commit via onBlur or Enter correctly migrates the session to the new group.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const repo = process.cwd();
const require = createRequire(pathToFileURL(resolve(repo, 'package.json')));
const dshRequire = createRequire(pathToFileURL(resolve(repo, '../dsh/package.json')));
const { JSDOM } = dshRequire('jsdom');
const { buildSync } = require('esbuild');

test('CB5-1: continuous multi-character typing preserves focus, and commit migrates row to new group', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { Simulate } = require('react-dom/test-utils');

  const code = buildSync({
    stdin: {
      contents: "export {RuntimeSessions} from './packages/client/sources.mjs';export {ZCodeDirectory} from './packages/client/directory-view.jsx';",
      resolveDir: repo,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['react'],
    tsconfig: resolve(repo, '../dsh/tsconfig.base.json'),
    jsx: 'automatic',
  }).outputFiles[0].text;

  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')(require, mod, mod.exports);
  const { RuntimeSessions, ZCodeDirectory } = mod.exports;

  const address0 = { runtime: 'zcode', authority: 'official-headless:controlled', workspace: '/fixture/workspace', sessionId: 's0' };
  const address1 = { runtime: 'zcode', authority: 'official-headless:controlled', workspace: '/fixture/workspace', sessionId: 's1' };
  const rpc = {
    call: async () => ({
      ok: true,
      value: {
        sessions: [
          { address: address0, title: 'Title 0', cwd: address0.workspace },
          { address: address1, title: 'Title 1', cwd: address1.workspace },
        ],
        scope: { authority: address0.authority, workspace: address0.workspace },
        catalog: { complete: true, truncated: false, deleted: [], sharedGui: 'unverified' },
        availability: { state: 'restricted', reason: 'official-auth-source-missing', capabilities: { create: false, open: false, nativeAgent: false } },
      },
    }),
  };
  const native = { list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => {} }, refresh: async () => {} };
  const sources = new RuntimeSessions({ sessions: native, rpc, nativeAuthority: 'native', settings: dom.window.localStorage });
  await sources.refresh();
  const root = createRoot(document.getElementById('root'));

  try {
    await React.act(async () => root.render(React.createElement(ZCodeDirectory, { sources })));

    // 1. Initial state: both rows in "Ungrouped"
    const input0 = document.querySelector('input[aria-label="DSH-only group (local display): Title 0"]');
    assert.ok(input0);
    input0.focus();
    assert.equal(document.activeElement, input0);

    const initialHeading = input0.closest('div').querySelector('h5');
    assert.equal(initialHeading.textContent, 'Ungrouped');

    // 2. Continuous multi-character typing: 'F', 'Fi', 'First'
    await React.act(async () => Simulate.change(input0, { target: { value: 'F' } }));
    assert.equal(input0.value, 'F');
    assert.equal(input0.isConnected, true);
    assert.equal(document.activeElement, input0);

    await React.act(async () => Simulate.change(input0, { target: { value: 'Fi' } }));
    assert.equal(input0.value, 'Fi');
    assert.equal(input0.isConnected, true);
    assert.equal(document.activeElement, input0);

    await React.act(async () => Simulate.change(input0, { target: { value: 'First' } }));
    assert.equal(input0.value, 'First');
    assert.equal(input0.isConnected, true);
    assert.equal(document.activeElement, input0);

    // During editing, row has not migrated and store has not changed
    assert.equal(sources.directory.getSnapshot().rows.find(r => r.address.sessionId === 's0').group, '');
    assert.equal(input0.closest('div').querySelector('h5').textContent, 'Ungrouped');

    // 3. Commit via blur: row migrates to "First"
    await React.act(async () => Simulate.blur(input0));
    assert.equal(sources.directory.getSnapshot().rows.find(r => r.address.sessionId === 's0').group, 'First');

    const headingsAfterBlur = Array.from(document.querySelectorAll('div > h5')).map(h => h.textContent);
    assert.ok(headingsAfterBlur.includes('First'));
    assert.ok(headingsAfterBlur.includes('Ungrouped'));

    const migratedInput0 = document.querySelector('input[aria-label="DSH-only group (local display): Title 0"]');
    assert.equal(migratedInput0.value, 'First');
    assert.equal(migratedInput0.closest('div').querySelector('h5').textContent, 'First');

    // 4. Test commit via Enter key on Title 1
    const input1 = document.querySelector('input[aria-label="DSH-only group (local display): Title 1"]');
    assert.ok(input1);
    input1.focus();
    assert.equal(document.activeElement, input1);

    await React.act(async () => Simulate.change(input1, { target: { value: 'S' } }));
    assert.equal(input1.isConnected, true);
    assert.equal(document.activeElement, input1);

    await React.act(async () => Simulate.change(input1, { target: { value: 'Second' } }));
    assert.equal(input1.isConnected, true);
    assert.equal(document.activeElement, input1);

    // Commit via Enter
    await React.act(async () => Simulate.keyDown(input1, { key: 'Enter' }));
    assert.equal(sources.directory.getSnapshot().rows.find(r => r.address.sessionId === 's1').group, 'Second');

    const headingsAfterEnter = Array.from(document.querySelectorAll('div > h5')).map(h => h.textContent);
    assert.ok(headingsAfterEnter.includes('First'));
    assert.ok(headingsAfterEnter.includes('Second'));
    assert.ok(!headingsAfterEnter.includes('Ungrouped'));

    const migratedInput1 = document.querySelector('input[aria-label="DSH-only group (local display): Title 1"]');
    assert.equal(migratedInput1.value, 'Second');
    assert.equal(migratedInput1.closest('div').querySelector('h5').textContent, 'Second');
  } finally {
    await React.act(async () => root.unmount());
    await sources.dispose();
    dom.window.close();
  }
});
