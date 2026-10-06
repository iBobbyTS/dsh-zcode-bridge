// Regression test derived from reviewer reproduction script:
// interaction-state-repro
// Verifies:
// CB6-1: questionnaire draft parsing restores free text into customAnswer, supports numeric keys,
// and user edits replace the draft cleanly without mixing old values into wire answers.
// CB6-2: queued items without autoResolution do not send snooze or display false snoozed state;
// once promoted to head with official autoResolution, deferred user snooze intent is submitted,
// official registry snoozes and cancels deadline, and official autoResolution state remains authoritative.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const repo = process.cwd();
const require = createRequire(pathToFileURL(resolve(repo, 'package.json')));
// jsdom is this repository's own devDependency; the deleted ../dsh checkout is no
// longer a prerequisite. This suite bundles only conversation-view.jsx (React + local
// modules), so it is the one RESTORABLE suite of the five previously jsdom-gated files.
const { JSDOM } = require('jsdom');
const { buildSync, transformSync } = require('esbuild');

test('CB6-1: restores free text draft, supports numeric keys, and replaces custom text without mixing old notes', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { Simulate } = require('react-dom/test-utils');

  const code = buildSync({
    entryPoints: [resolve(repo, 'packages/client/conversation-view.jsx')],
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'],
  }).outputFiles[0].text;
  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')(require, mod, mod.exports);
  const { ZCodePendingInteractions } = mod.exports;
  const root = createRoot(document.getElementById('root'));
  const qBase = JSON.parse(readFileSync(resolve(repo, 'tests/fixtures/interaction-plan-review-trust/questionnaire.json'))).initial.frame.payload.snapshot.pendingInteractions[0];
  const selector = id => document.querySelector(`[data-testid="${id}"]`);

  let answers = [];
  const onResolve = async (id, answer) => {
    answers.push({ id, answer });
    return { state: 'accepted-awaiting-terminal', ack: { status: 'accepted' } };
  };
  async function render(key, interactions, onSnooze = async () => ({ ack: { status: 'accepted' } })) {
    await React.act(async () => root.render(React.createElement(ZCodePendingInteractions, {
      key, state: { snapshot: { pendingInteractions: interactions } }, onResolve, onSnooze,
    })));
  }

  try {
    // 1. String key draft restoration into custom text input
    const savedText = structuredClone(qBase);
    delete savedText.autoResolution;
    savedText.payload.questions = [{ question: 'Notes?', header: 'Notes', options: [], multiSelect: false }];
    savedText.payload.answerDrafts = { answer_0: ['old notes'] };
    await render('saved-text', [savedText]);

    const input = selector('zcode-q-custom-input');
    assert.equal(input.value, 'old notes', 'restored free text should appear in the custom input');

    // Edit custom text and submit: replaces value cleanly without mixing old notes
    await React.act(async () => Simulate.change(input, { target: { value: 'replacement notes' } }));
    assert.equal(input.value, 'replacement notes');
    await React.act(async () => Simulate.click(selector('zcode-questionnaire-submit')));

    const content = answers.at(-1).answer.content;
    assert.equal(content.answer_0, 'replacement notes', 'answer_0 wire payload must be replacement notes');
    assert.equal(content.answers['Notes?'], 'replacement notes', 'question answers map must not contain old notes');
    assert.equal(content.answer, 'replacement notes');

    // 2. Numeric key draft ({ '0': ['saved numeric-key notes'] }) restoration
    const numericDraft = structuredClone(savedText);
    numericDraft.payload.answerDrafts = { '0': ['saved numeric-key notes'] };
    await render('numeric-draft', [numericDraft]);

    const numInput = selector('zcode-q-custom-input');
    assert.equal(numInput.value, 'saved numeric-key notes', 'numeric key draft should appear in custom input');

    await React.act(async () => Simulate.click(selector('zcode-questionnaire-submit')));
    const numContent = answers.at(-1).answer.content;
    assert.equal(numContent.answer_0, 'saved numeric-key notes');
    assert.equal(numContent.answers['Notes?'], 'saved numeric-key notes');
    assert.equal(numContent.answer, 'saved numeric-key notes');

    // 3. Option + free text separation
    const mixedDraft = structuredClone(savedText);
    mixedDraft.payload.questions = [{
      question: 'Choice & Notes',
      options: [{ value: 'optA', label: 'Option A' }, { value: 'optB', label: 'Option B' }],
      multiSelect: false,
    }];
    mixedDraft.payload.answerDrafts = { answer_0: ['optA', 'extra commentary'] };
    await render('mixed-draft', [mixedDraft]);

    const mixedInput = selector('zcode-q-custom-input');
    const optARadio = selector('zcode-option-optA');
    assert.equal(optARadio.checked, true, 'matching option optA should be selected');
    assert.equal(mixedInput.value, 'extra commentary', 'non-option value should be placed in customAnswer');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});

test('CB6-2: queued interaction does not send premature snooze or false label; head promotion triggers snooze; official state is authoritative', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { Simulate } = require('react-dom/test-utils');

  const code = buildSync({
    entryPoints: [resolve(repo, 'packages/client/conversation-view.jsx')],
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'],
  }).outputFiles[0].text;
  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')(require, mod, mod.exports);
  const { ZCodePendingInteractions } = mod.exports;
  const root = createRoot(document.getElementById('root'));
  const qBase = JSON.parse(readFileSync(resolve(repo, 'tests/fixtures/interaction-plan-review-trust/questionnaire.json'))).initial.frame.payload.snapshot.pendingInteractions[0];
  const selector = id => document.querySelector(`[data-testid="${id}"]`);

  const onResolve = async () => ({ state: 'accepted-awaiting-terminal', ack: { status: 'accepted' } });
  async function render(key, interactions, onSnooze = async () => ({ ack: { status: 'accepted' } })) {
    await React.act(async () => root.render(React.createElement(ZCodePendingInteractions, {
      key, state: { snapshot: { pendingInteractions: interactions } }, onResolve, onSnooze,
    })));
  }

  // Load and execute official V4InteractionRegistry
  const registryPath = resolve(repo, '../reference/ZCode/apps/zcode-cli/packages/bootstrap/src/zcode-protocol-v4/interaction-registry.ts');
  const registryCode = transformSync(readFileSync(registryPath, 'utf8'), { loader: 'ts', format: 'cjs', target: 'node22' }).code;
  const registryModule = { exports: {} };
  const registryRequire = name => name === '@zcode/shared'
    ? { ASK_USER_QUESTION_E2E_CLOCK_SCALE_ENV: 'ZCODE_ASK_USER_QUESTION_E2E_CLOCK_SCALE' }
    : require(name);
  vm.runInThisContext('(function(require,module,exports){' + registryCode + '\n})')(registryRequire, registryModule, registryModule.exports);

  let now = 1000;
  const registry = new registryModule.exports.V4InteractionRegistry({ hiddenGraceMs: 100000, autoResolutionMs: 200000, now: () => now });
  let secondAutoResolution;
  let secondResolved;
  let snoozeCalls = 0;
  let earlySnoozeResult;

  const unregisterFirst = registry.register('first', () => {}, { sessionId: 'same-session', kind: 'askUserQuestion' });
  const secondOptions = {
    sessionId: 'same-session',
    kind: 'askUserQuestion',
    onAutoResolutionUpdated: value => { secondAutoResolution = value; },
  };
  let unregisterSecond = registry.register('second', answer => { secondResolved = answer; }, secondOptions);

  const second = structuredClone(qBase);
  delete second.autoResolution;
  second.interactionId = 'second';
  second.payload.questions = [{ question: 'Queued Q?', header: 'Queued', options: [], multiSelect: false }];
  second.payload.answerDrafts = {};

  const snooze = async id => {
    snoozeCalls++;
    earlySnoozeResult = await registry.snoozeAutoResolution(id);
    return { state: 'accepted-awaiting-terminal', ack: { status: 'accepted' } };
  };

  try {
    assert.equal(secondAutoResolution, undefined, 'queued second question does not have autoResolution initially');

    // 1. Render queued item without autoResolution and simulate typing
    await render('queued', [second], snooze);
    await React.act(async () => Simulate.change(selector('zcode-q-custom-input'), { target: { value: 'draft while queued' } }));

    // Must NOT call snooze prematurely when queued, and must NOT falsely display snoozed
    assert.equal(snoozeCalls, 0, 'queued item must not send premature snooze command');
    assert.equal(selector('zcode-auto-resolution-snoozed'), null, 'queued item must not be falsely marked as snoozed');

    // 2. Resolve first item: second item becomes head of queue in registry
    registry.resolve('first', { action: 'accept', content: { answers: {} } });
    assert.ok(secondAutoResolution, 'head item receives autoResolution from registry');
    assert.equal(secondAutoResolution.state, 'hiddenGrace');

    // Provide official autoResolution to the second item and re-render
    second.autoResolution = structuredClone(secondAutoResolution);
    await render('queued', [second], snooze);

    // Deferred snooze intent is submitted now that autoResolution is ready
    assert.equal(snoozeCalls, 1, 'snooze is submitted once autoResolution is ready');
    assert.equal(earlySnoozeResult, true, 'official registry accepts snooze for head item');
    assert.equal(secondAutoResolution.state, 'snoozed', 'official registry converts autoResolution to snoozed');

    // Update with authoritative official snoozed state
    second.autoResolution = structuredClone(secondAutoResolution);
    await render('queued', [second], snooze);
    assert.ok(selector('zcode-auto-resolution-snoozed'), 'UI displays official snoozed badge');
    assert.equal(selector('zcode-auto-resolution-countdown'), null);

    // 3. Continuing to type does not resend snooze
    await React.act(async () => Simulate.change(selector('zcode-q-custom-input'), { target: { value: 'continue typing' } }));
    assert.equal(snoozeCalls, 1, 'subsequent typing does not re-send snooze');

    // 4. Registry expired-deadline check: deadline timer was cancelled by snooze, so it does not auto-resolve
    now = secondAutoResolution.deadlineAt + 1;
    unregisterSecond = registry.register('second', answer => { secondResolved = answer; }, secondOptions);
    await Promise.resolve();
    assert.equal(secondResolved, undefined, 'official deadline timer does not fire because registry was snoozed');

    // 5. Test un-interacted queued item promotion: displays countdown, not false snoozed (official state authoritative)
    const thirdOptions = { sessionId: 'same-session', kind: 'askUserQuestion' };
    const unregisterThird = registry.register('third', () => {}, thirdOptions);
    const third = structuredClone(second);
    third.interactionId = 'third';
    third.autoResolution = { state: 'hiddenGrace', deadlineAt: now + 50000 };

    await render('third-fresh', [third], snooze);
    assert.equal(selector('zcode-auto-resolution-snoozed'), null, 'un-snoozed fresh item must not show snoozed');
    assert.ok(selector('zcode-auto-resolution-countdown'), 'fresh item in hiddenGrace shows countdown active');

    unregisterThird();
  } finally {
    unregisterFirst();
    unregisterSecond();
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});

test('FB6-1: snooze timeout yields outcome-unknown and unconfirmed UI; official visibleCountdown snapshot corrects local snoozed state; same-commandId query reconciles terminal state', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { Simulate } = require('react-dom/test-utils');

  const code = buildSync({
    entryPoints: [resolve(repo, 'packages/client/conversation-view.jsx')],
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'],
  }).outputFiles[0].text;
  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')(require, mod, mod.exports);
  const { ZCodePendingInteractions } = mod.exports;
  const root = createRoot(document.getElementById('root'));
  const qBase = JSON.parse(readFileSync(resolve(repo, 'tests/fixtures/interaction-plan-review-trust/questionnaire.json'))).initial.frame.payload.snapshot.pendingInteractions[0];
  const selector = id => document.querySelector(`[data-testid="${id}"]`);

  const onResolve = async () => ({ state: 'accepted-awaiting-terminal', ack: { status: 'accepted' } });
  let snoozeCalls = 0;
  const snoozeResult = { commandId: 'cmd-snooze-timeout-1', state: 'outcome-unknown', error: 'request-timeout' };
  const snooze = async () => {
    snoozeCalls++;
    return snoozeResult;
  };

  async function render(key, interactions, commands = [], onSnooze = snooze) {
    await React.act(async () => root.render(React.createElement(ZCodePendingInteractions, {
      key, state: { snapshot: { pendingInteractions: interactions }, commands }, onResolve, onSnooze,
    })));
  }

  try {
    const item = structuredClone(qBase);
    item.interactionId = 'test-countdown-item';
    item.autoResolution = {
      state: 'visibleCountdown',
      startedAt: 1000,
      visibleAt: 2000,
      deadlineAt: 60000,
    };
    item.payload.questions = [{ question: 'Name?', header: 'Name', options: [], multiSelect: false }];
    item.payload.answerDrafts = {};

    // 1. Initial render shows countdown active
    await render('step-1', [item]);
    assert.ok(selector('zcode-auto-resolution-countdown'), 'countdown must be active initially');
    assert.equal(selector('zcode-auto-resolution-snoozed'), null, 'must not be snoozed initially');

    // 2. User types in custom input -> triggers snooze
    await React.act(async () => Simulate.change(selector('zcode-q-custom-input'), { target: { value: 'first char' } }));
    assert.equal(snoozeCalls, 1, 'snooze is invoked on user input');

    // 3. Snooze RPC yielded outcome-unknown: UI must NOT falsely display snoozed (不虚标已延期)
    // Must display countdown active and unconfirmed warning with commandId and reconciliation hint
    assert.equal(selector('zcode-auto-resolution-snoozed'), null, 'must not falsely mark outcome-unknown snooze as snoozed');
    assert.ok(selector('zcode-auto-resolution-countdown'), 'countdown remains active on outcome-unknown');
    assert.ok(selector('zcode-auto-resolution-unconfirmed'), 'unconfirmed badge must be displayed');
    const warning = selector('zcode-snooze-warning-test-countdown-item');
    assert.ok(warning, 'snooze warning must be rendered');
    assert.ok(warning.textContent.includes('结果未确认'), 'warning must indicate 结果未确认');
    assert.ok(warning.textContent.includes('cmd-snooze-timeout-1'), 'warning must include commandId');
    assert.ok(warning.textContent.includes('对账') || warning.textContent.includes('reconcile'), 'warning must include reconciliation hint');

    // 4. B04: typing more does NOT blind-resend snooze
    await React.act(async () => Simulate.change(selector('zcode-q-custom-input'), { target: { value: 'second char' } }));
    assert.equal(snoozeCalls, 1, 'typing again must not blind-resend snooze');

    // 5. Subsequent official visibleCountdown snapshot arrives
    const visibleCountdownSnapshot = structuredClone(item);
    visibleCountdownSnapshot.autoResolution = {
      state: 'visibleCountdown',
      startedAt: 1000,
      visibleAt: 2000,
      deadlineAt: 50000,
    };
    await render('step-2', [visibleCountdownSnapshot]);
    assert.equal(selector('zcode-auto-resolution-snoozed'), null, 'subsequent official visibleCountdown snapshot maintains countdown');
    assert.ok(selector('zcode-auto-resolution-countdown'), 'official visibleCountdown is authoritative');

    // 6. Same commandId reconciliation: command in state.commands transitions to accepted
    const reconciledCommands = [{
      commandId: 'cmd-snooze-timeout-1',
      type: 'snoozeInteractionAutoResolution',
      state: 'accepted-awaiting-terminal',
      ack: { status: 'accepted' },
    }];
    await render('step-3', [visibleCountdownSnapshot], reconciledCommands);
    assert.equal(selector('zcode-snooze-warning-test-countdown-item'), null, 'reconciled command clears unconfirmed warning');

    // 7. Official server frame arrives with snoozed state: final state呈現
    const snoozedSnapshot = structuredClone(item);
    snoozedSnapshot.autoResolution = {
      state: 'snoozed',
      startedAt: 1000,
      snoozedAt: 3000,
    };
    await render('step-4', [snoozedSnapshot], reconciledCommands);
    assert.ok(selector('zcode-auto-resolution-snoozed'), 'UI displays official snoozed state');
    assert.equal(selector('zcode-auto-resolution-countdown'), null, 'countdown removed once officially snoozed');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});

test('FB6B-1: snooze timeout -> reconcile -> failed (fault.command.executionFailed) echoes official reasonCode, ends unconfirmed state, and restores active retry', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { Simulate } = require('react-dom/test-utils');

  const code = buildSync({
    entryPoints: [resolve(repo, 'packages/client/conversation-view.jsx')],
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'],
  }).outputFiles[0].text;
  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')(require, mod, mod.exports);
  const { ZCodePendingInteractions } = mod.exports;
  const root = createRoot(document.getElementById('root'));
  const qBase = JSON.parse(readFileSync(resolve(repo, 'tests/fixtures/interaction-plan-review-trust/questionnaire.json'))).initial.frame.payload.snapshot.pendingInteractions[0];
  const selector = id => document.querySelector(`[data-testid="${id}"]`);

  const onResolve = async () => ({ state: 'accepted-awaiting-terminal', ack: { status: 'accepted' } });
  let snoozeCalls = 0;
  let nextSnoozeResult = { commandId: 'cmd-snooze-timeout-fb6b-1', state: 'outcome-unknown', error: 'request-timeout' };
  const snooze = async () => {
    snoozeCalls++;
    return nextSnoozeResult;
  };

  async function render(key, interactions, commands = [], onSnooze = snooze) {
    await React.act(async () => root.render(React.createElement(ZCodePendingInteractions, {
      key, state: { snapshot: { pendingInteractions: interactions }, commands }, onResolve, onSnooze,
    })));
  }

  try {
    const item = structuredClone(qBase);
    item.interactionId = 'test-countdown-fb6b-1';
    item.autoResolution = {
      state: 'visibleCountdown',
      startedAt: 1000,
      visibleAt: 2000,
      deadlineAt: 60000,
    };
    item.payload.questions = [{ question: 'Environment?', header: 'Env', options: [], multiSelect: false }];
    item.payload.answerDrafts = {};

    // 1. Initial render shows countdown active
    await render('session-fb6b-1', [item]);
    assert.ok(selector('zcode-auto-resolution-countdown'), 'countdown must be active initially');
    assert.equal(selector('zcode-auto-resolution-snoozed'), null, 'must not be snoozed initially');

    // 2. User types in custom input -> triggers snooze
    await React.act(async () => Simulate.change(selector('zcode-q-custom-input'), { target: { value: 'first input' } }));
    assert.equal(snoozeCalls, 1, 'snooze is invoked on user input');

    // 3. Snooze RPC yielded outcome-unknown: UI displays unconfirmed warning
    assert.ok(selector('zcode-auto-resolution-unconfirmed'), 'unconfirmed badge must be displayed');
    const warning = selector('zcode-snooze-warning-test-countdown-fb6b-1');
    assert.ok(warning, 'snooze warning must be rendered');
    assert.ok(warning.textContent.includes('结果未确认'), 'warning must indicate 结果未确认');
    assert.ok(warning.textContent.includes('cmd-snooze-timeout-fb6b-1'), 'warning must include commandId');

    // 4. Typing again does NOT resend while unconfirmed (B04)
    await React.act(async () => Simulate.change(selector('zcode-q-custom-input'), { target: { value: 'second input' } }));
    assert.equal(snoozeCalls, 1, 'typing again must not blind-resend snooze while unconfirmed');

    // 5. Query reconcile returns failed with fault.command.executionFailed
    const failedCommands = [{
      commandId: 'cmd-snooze-timeout-fb6b-1',
      type: 'snoozeInteractionAutoResolution',
      state: 'failed',
      ack: {
        status: 'failed',
        commandId: 'cmd-snooze-timeout-fb6b-1',
        reasonCode: 'fault.command.executionFailed',
        revisionAtDecision: 2,
      },
    }];
    await render('session-fb6b-1', [item], failedCommands);

    // 6. UI must echo official failure, end unconfirmed state, and countdown remains active
    assert.equal(selector('zcode-auto-resolution-unconfirmed'), null, 'unconfirmed badge must be cleared');
    const failedWarning = selector('zcode-snooze-warning-test-countdown-fb6b-1');
    assert.ok(failedWarning, 'warning must remain rendered with failure details');
    assert.ok(failedWarning.textContent.includes('fault.command.executionFailed'), 'failure must echo reasonCode');
    assert.ok(failedWarning.textContent.includes('Auto-resolution snooze failed'), 'warning text must state failure');
    assert.ok(selector('zcode-auto-resolution-countdown'), 'countdown remains active');
    assert.equal(selector('zcode-auto-resolution-snoozed'), null, 'must not be marked snoozed');

    // 7. Active retry eligibility restored: typing again triggers a new snooze
    nextSnoozeResult = { commandId: 'cmd-snooze-retry-2', state: 'accepted-awaiting-terminal', ack: { status: 'accepted' } };
    await React.act(async () => Simulate.change(selector('zcode-q-custom-input'), { target: { value: 'retry input' } }));
    assert.equal(snoozeCalls, 2, 'user interaction triggers active retry snooze');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});
