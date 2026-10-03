// Regression test derived from reviewer reproduction script:
// /Users/ibobby/Projects/dsh-zcode-acp/.agent-work/reviews/CB4-S03B-session-switch-repro.mjs
// Verifies CB4-1: switching session A -> B at the same render position:
// 1. Shows B after switch
// 2. Stop/pending actions target B, not A
// 3. A's subscriptions/controller are fully released (no observer leaks)

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

test('CB4-1: switching session A -> B at same render position displays B, targets B, and releases A observers', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = React;

  const code = buildSync({
    stdin: {
      contents: "export {RuntimeSessions} from './packages/client/sources.mjs'; export {renderSessionArea} from '../dsh/packages/client/ui-session/src/client/session-provider.tsx';",
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['react'], tsconfig: '../dsh/tsconfig.base.json', jsx: 'automatic',
  }).outputFiles[0].text;

  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')(require, mod, mod.exports);
  const { RuntimeSessions, renderSessionArea } = mod.exports;
  const { ProtocolPeer } = await import(pathToFileURL(resolve('packages/host/protocol.mjs')));
  const { V4Conversation } = await import(pathToFileURL(resolve('packages/host/conversation.mjs')));
  const fixture = JSON.parse(readFileSync('tests/fixtures/s03a/success.json', 'utf8'));

  async function make(label) {
    const input = new PassThrough(), output = new PassThrough(), sent = [];
    output.on('data', bytes => sent.push(JSON.parse(bytes.toString())));
    const peer = new ProtocolPeer(input, output, { timeoutMs: 100 });
    const address = { runtime: 'zcode', authority: 'fixture', workspace: '/fixture/workspace', sessionId: label };
    const conversation = new V4Conversation(peer, {
      address, workspace: { workspacePath: address.workspace, workspaceKey: address.workspace },
      connectionId: 'conn-' + label, clientId: 'client-' + label, runnable: true,
    });
    const initial = structuredClone(fixture.initial);
    initial.topic = initial.frame.topic = 'conversation/' + label;
    const snapshot = initial.frame.payload.snapshot;
    snapshot.sessionId = label;
    snapshot.rows = {
      window: [{
        rowId: 1, turnId: 'turn-' + label, entityId: 'ent-' + label,
        kind: 'userInput', origin: 'realUser', text: 'Session ' + label, createdAt: 0, createdAtSeq: 0,
      }],
      totalCount: 1, firstRowId: 1,
    };
    snapshot.control.canStop = true;
    snapshot.control.activeWorks = [{ kind: 'primaryTurn', foregroundExecutionId: 'exec-' + label, startedAt: 0 }];
    snapshot.pendingInteractions = [{
      interactionId: 'pending-' + label,
      kind: 'permission',
      anchorRowId: null,
      createdAt: 0,
      payload: {
        kind: 'permission',
        toolCallId: 'tool-call-' + label,
        toolName: 'tool-' + label,
        summary: 'Action for ' + label,
        detail: {},
        options: [
          { optionId: 'allowOnce', label: 'Allow Once', kind: 'allowOnce' },
          { optionId: 'deny', label: 'Deny', kind: 'deny' },
        ],
      },
    }];

    const opening = conversation.connect();
    input.write(JSON.stringify({ id: sent.at(-1).id, result: fixture.ack }) + '\n'
      + JSON.stringify({ method: 'v4/conversation/frame', params: initial }) + '\n');
    await opening;
    if (conversation.state.status !== 'live') throw new Error(JSON.stringify(conversation.state));
    return { address, conversation, peer, sent, input };
  }

  const a = await make('A');
  const b = await make('B');
  const nativeSnapshot = { ids: [], byId: {} };
  const sources = new RuntimeSessions({
    sessions: { list: { getSnapshot: () => nativeSnapshot, subscribe: () => () => {} } },
    rpc: {}, nativeAuthority: 'native',
  });
  const aRef = sources.retain(a.address, { source: 'mainView', conversation: a.conversation });
  const bRef = sources.retain(b.address, { source: 'mainView', conversation: b.conversation });
  const binding = { key: undefined, props: {}, hooks: {}, keyedHooks: {} };
  const area = reference => renderSessionArea(binding, { session: reference, children: null });
  const root = createRoot(document.getElementById('root'));

  try {
    // 1. Initial render of Session A
    await act(async () => root.render(area(aRef)));
    const beforeText = document.querySelector('[data-testid="zcode-user-input-row"]').textContent;
    assert.equal(beforeText, 'Session A');
    assert.equal(a.conversation.listenerCount, 1, 'A must have exactly 1 active observer');
    assert.equal(b.conversation.listenerCount, 0, 'B must have 0 observers before mounting');
    assert.ok(document.querySelector('[data-testid="zcode-interaction-pending-A"]'), 'A pending card is present');

    // 2. Switch same render position to Session B
    await act(async () => root.render(area(bRef)));
    const afterText = document.querySelector('[data-testid="zcode-user-input-row"]').textContent;
    assert.equal(afterText, 'Session B', 'Switched view must render Session B');

    // 3. Verify observer release (no observer leak)
    assert.equal(a.conversation.listenerCount, 0, 'A subscriptions/observers must be fully released');
    assert.equal(b.conversation.listenerCount, 1, 'B must have exactly 1 active observer');

    // 4. Verify pending interactions isolation: A pending card is gone, B pending card is shown
    assert.equal(document.querySelector('[data-testid="zcode-interaction-pending-A"]'), null, 'A pending card must not leak to B');
    assert.ok(document.querySelector('[data-testid="zcode-interaction-pending-B"]'), 'B pending card must be present');

    // 5. Click Stop button: must target B foreground execution, NOT A
    await act(async () => document.querySelector('[data-testid="zcode-stop-button"]').click());
    const aStop = a.sent.find(m => m.params?.type === 'stop')?.params ?? null;
    const bStop = b.sent.find(m => m.params?.type === 'stop')?.params ?? null;
    assert.equal(aStop, null, 'No stop command may be sent to A after switching to B');
    assert.ok(bStop, 'Stop command must be sent to B');
    assert.equal(bStop.sessionId, 'B');
    assert.equal(bStop.payload.expectedForegroundExecutionId, 'exec-B');

    // 6. Resolve interaction on B: must target B, not A
    const allowBtn = document.querySelector('[data-testid="zcode-permission-btn-allowOnce"]');
    assert.ok(allowBtn, 'Allow Once button must be present on B pending card');
    await act(async () => allowBtn.click());
    const aResolve = a.sent.find(m => m.params?.type === 'resolveInteraction')?.params ?? null;
    const bResolve = b.sent.find(m => m.params?.type === 'resolveInteraction')?.params ?? null;
    assert.equal(aResolve, null, 'No interaction resolution may be sent to A');
    assert.ok(bResolve, 'Interaction resolution must be sent to B');
    assert.equal(bResolve.sessionId, 'B');
    assert.equal(bResolve.payload.interactionId, 'pending-B');
  } finally {
    await act(async () => root.unmount());
    assert.equal(a.conversation.listenerCount, 0, 'A observers 0 after unmount');
    assert.equal(b.conversation.listenerCount, 0, 'B observers 0 after unmount');
    await sources.dispose();
    a.peer.close();
    b.peer.close();
    dom.window.close();
  }
});
