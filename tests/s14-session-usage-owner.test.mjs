// Regression test derived from reviewer reproduction script:
// /Users/ibobby/Projects/dsh-zcode-acp/.agent-work/reviews/CB14-S14-final-bounded-repro.mjs (witness CB14-1)
// Verifies CB14-1: reopening the same address replaces the session owner. A late legitimate usage reply from
// the previous owner (A) must never overwrite the current owner's (B) view. The same-address sidebar reopen
// does not remount by key, so only an owner/request guard can prevent the cross-owner overwrite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PassThrough } from 'node:stream';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const require = createRequire(pathToFileURL(resolve('package.json')));
const dshRequire = createRequire(pathToFileURL(resolve('../dsh/package.json')));
const { buildSync } = require('esbuild');
const { JSDOM } = dshRequire('jsdom');

test('CB14-1: a late usage reply from the replaced owner never overwrites the current address view', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = React;

  const code = buildSync({
    stdin: {
      contents: "export {RuntimeSessions} from './packages/client/sources.mjs'; export {ZCodeSessionPanel} from './packages/client/directory-view.jsx';",
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['react'], tsconfig: '../dsh/tsconfig.base.json', jsx: 'automatic',
  }).outputFiles[0].text;

  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')(require, mod, mod.exports);
  const { RuntimeSessions, ZCodeSessionPanel } = mod.exports;
  const { ProtocolPeer } = await import(pathToFileURL(resolve('packages/host/protocol.mjs')));
  const { V4Conversation } = await import(pathToFileURL(resolve('packages/host/conversation.mjs')));
  const fixture = JSON.parse(readFileSync('tests/fixtures/s03a/success.json', 'utf8'));
  const usage = JSON.parse(readFileSync('tests/fixtures/s14/usage.json', 'utf8'));
  const address = { runtime: 'zcode', authority: 'fixture', workspace: '/fixture/workspace', sessionId: 'fixture-session' };

  // One port + one real V4 owner per open, mirroring the Host's per-view handle ownership.
  function owner(connectionId) {
    const input = new PassThrough(), output = new PassThrough(), sent = [];
    output.on('data', bytes => sent.push(JSON.parse(bytes.toString())));
    const peer = new ProtocolPeer(input, output, { timeoutMs: 3000 });
    const conversation = new V4Conversation(peer, {
      address, workspace: { workspacePath: address.workspace, workspaceKey: address.workspace },
      connectionId, clientId: 'fixture', runnable: false,
    });
    output.on('data', bytes => {
      const request = JSON.parse(bytes.toString());
      if (request.method === 'v4/conversation/subscribe') input.write(JSON.stringify({ id: request.id, result: fixture.ack }) + '\n' + JSON.stringify({ method: 'v4/conversation/frame', params: fixture.initial }) + '\n');
      else if (request.method === 'v4/conversation/unsubscribe') input.write(JSON.stringify({ id: request.id, result: {} }) + '\n');
    });
    return { peer, sent, conversation, reply: (request, result) => input.write(JSON.stringify({ id: request.id, result }) + '\n') };
  }

  const a = await (async () => { const f = owner('owner-A'); await f.conversation.connect(); assert.equal(f.conversation.state.status, 'live'); return f; })();
  const b = await (async () => { const f = owner('owner-B'); await f.conversation.connect(); assert.equal(f.conversation.state.status, 'live'); return f; })();
  let next = a.conversation;
  const native = { ids: [], byId: {} };
  const sessionList = {
    ok: true,
    value: {
      sessions: [{ address, title: 'same session', cwd: address.workspace }],
      scope: { authority: address.authority, workspace: address.workspace },
      availability: { state: 'restricted', reason: 'fixture', capabilities: { create: false, open: false, nativeAgent: false } },
      catalog: { complete: true, truncated: false, sharedGui: 'unverified', deleted: [] },
    },
  };
  const handles = new Map();
  let counter = 0;
  const rpc = {
    call: async (_channel, endpoint, payload) => {
      if (endpoint === 'sessions') return sessionList;
      try {
        if (payload.operation === 'open') { const handle = 'view-' + (++counter); handles.set(handle, next); return { ok: true, value: { handle, state: next.state } }; }
        const owner = handles.get(payload.handle);
        if (payload.operation === 'state') return { ok: true, value: owner.state };
        if (payload.operation === 'sessionUsage') return { ok: true, value: await owner.sessionUsage() };
        if (payload.operation === 'release') { await owner.cancel(); handles.delete(payload.handle); return { ok: true, value: { released: true } }; }
        throw Error('unexpected-operation');
      } catch (error) { return { ok: false, error: { code: error.code ?? error.message, message: error.message } }; }
    },
  };
  const sources = new RuntimeSessions({
    sessions: { list: { getSnapshot: () => native, subscribe: () => () => {} } },
    rpc, nativeAuthority: 'native', settings: { getItem: () => null, setItem: () => {} },
  });
  const root = createRoot(document.getElementById('root'));

  try {
    await act(async () => { await sources.open(address); root.render(React.createElement(ZCodeSessionPanel, { sources })); });
    // Owner A issues a genuine official usage read; it stays in flight.
    await act(async () => document.querySelector('[data-session-usage="idle"]').click());
    const oldRead = a.sent.find(request => request.method === 'v4/conversation/usage');
    assert.ok(oldRead, 'owner A must issue the scoped official usage read');

    // Sidebar reopen of the SAME address: B becomes the current owner, A is closed/released.
    next = b.conversation;
    await act(async () => { await sources.open(address); });
    assert.equal(sources.selection.getSnapshot().conversation.constructor.name, 'RemoteConversation');
    assert.equal(counter, 2, 'the reopen is a second per-view owner, not a reuse');
    assert.equal(a.conversation.state.status, 'closed', 'the previous owner is replaced');

    // B reads the real empty aggregate and renders it.
    assert.ok(document.querySelector('[data-session-usage="idle"]'), 'the reopened owner view starts idle');
    await act(async () => document.querySelector('[data-session-usage="idle"]').click());
    const currentRead = b.sent.find(request => request.method === 'v4/conversation/usage');
    await act(async () => b.reply(currentRead, usage.emptySessionUsage));
    const beforeLate = document.querySelector('[data-session-usage="loaded"]').textContent;
    assert.match(beforeLate, /0 tokens/);

    // A's late legitimate reply lands after the owner was replaced: the current view must not change.
    await act(async () => { a.reply(oldRead, usage.nonEmptySessionUsage); });
    const afterLate = document.querySelector('[data-session-usage="loaded"]').textContent;
    assert.match(afterLate, /0 tokens/, 'B keeps its own 0-token result');
    assert.doesNotMatch(afterLate, /4,200/, 'the replaced owner never overwrites the current view');
    assert.equal(afterLate, beforeLate);
  } finally {
    await act(async () => root.unmount());
    await sources.dispose();
    a.peer.close();
    b.peer.close();
    dom.window.close();
  }
});
