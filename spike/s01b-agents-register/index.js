/**
 * S01b agents.register probe — host half.
 *
 * Runs inside a throwaway official DSH web instance and proves/refutes the
 * single remaining plugin-only path for per-session runtime coexistence:
 * publishing a pre-constructed foreign Agent through `ctx.agents.register`.
 *
 * It performs NO model call. It (1) creates one live Session carrying a static
 * stub transcript, (2) publishes a minimal mock "zcode" Agent over it, and
 * (3) creates one ordinary native-runtime Session through `ctx.agents.create`
 * to prove the two coexist in the same registry and sidebar.
 *
 * Findings are written to `S01B_SPIKE_RESULT` (default /tmp/s01b-spike-host.json)
 * at each stage so a partial run is still diagnosable.
 */
import { writeFileSync } from 'node:fs';

export const name = 's01b-agents-register';

/** Both services must exist before the probe can create/register anything. */
export const inject = ['agents', 'sessions'];

const ZCODE_ID = 'zcode-mock-0001';
const NATIVE_ID = 'native-mock-0001';
const RESULT_PATH = () => process.env.S01B_SPIKE_RESULT ?? '/tmp/s01b-spike-host.json';

/** Append-only probe report. */
const result = {
  plugin: '@dsh-zcode/s01b-agents-register',
  stages: {},
};

function flush() {
  try {
    writeFileSync(RESULT_PATH(), JSON.stringify(result, null, 2));
  } catch {
    // A probe must never break host boot.
  }
}

/** Append a stub transcript to a live Session without any model call. */
function appendStubTranscript(session, prefix, provider) {
  session.append('turn/start', { turn: 1 });
  session.append('step/start', { turn: 1, step: 1 });
  session.append('user/message', {
    id: `${prefix}-user-1`,
    role: 'user',
    source: { kind: 'user' },
    content: [{ type: 'text', text: `${prefix}-USER hello from the ${provider} stub session` }],
  }, { surfaceOp: 'append' });
  session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: {
      id: `${prefix}-assistant-1`,
      role: 'assistant',
      source: { kind: 'model', provider, model: provider },
      content: [{
        type: 'text',
        text: `${prefix}-STUB: transcript served by the ${provider} runtime; no model call was made.`,
      }],
    },
    stream: [],
  }, { surfaceOp: 'append' });
  session.append('step/end', { turn: 1, step: 1 });
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } });
}

/** Minimal Agent object satisfying the structural `Agent` face consumers read. */
function makeMockAgent(ctx, session) {
  const inbox = {
    nextTurn: [],
    nextStep: [],
    clear() {},
    append() {},
    prepend() {},
    replace() { return false; },
    remove() { return false; },
    splice() { return []; },
  };
  return {
    id: ZCODE_ID,
    options: { provider: 'zcode-mock', model: 'zcode-mock' },
    session,
    inbox,
    status: 'idle',
    // A real Cordis Context, but NOT an Agent-scoped one: this is the plugin's
    // own shared context passed through. The official contract types agent.ctx
    // as the agent-local context whose contributions unwind on disposal
    // (core/agent/src/runtime-types.ts:173); native agents receive theirs from
    // the factory's createScope. agent/created listeners that call
    // agent.ctx.inject(...) / scopeOf(agent.ctx) therefore see this plugin's
    // scope here — harmless for this display-only probe, but S02 MUST mint a
    // real Agent scope for a production adapter (otherwise contributions do not
    // unwind per agent and scopeOf does not identify the agent).
    ctx,
    cancel() {},
    whenIdle() { return Promise.resolve(); },
    runMaintenance(task) { return Promise.resolve(task(new AbortController().signal)); },
    send() {},
    followup() {},
    steer() {},
    inject() {},
  };
}

function snapshot(agents, sessions) {
  return {
    agentListIds: agents.list().map(agent => agent.id),
    agentRootIds: agents.roots().map(agent => agent.id),
    sessionListIds: sessions.list().map(session => session.id),
  };
}

export function apply(ctx) {
  const run = async () => {
    result.cwd = process.cwd();

    // ── Stage A: create the live Session carrying the stub transcript ──────
    let zSession;
    try {
      zSession = ctx.sessions.create(ZCODE_ID, { meta: { cwd: process.cwd() } });
      appendStubTranscript(zSession, 'ZCODE-MOCK', 'zcode-mock');
      result.stages.createSession = {
        outcome: 'created',
        sessionId: zSession.id,
        headerCwd: zSession.header.cwd,
        seq: zSession.seq,
      };
    } catch (error) {
      result.stages.createSession = { outcome: 'failed', error: String(error?.stack ?? error) };
      flush();
      return;
    }
    flush();

    // ── Stage B: publish a pre-constructed mock Agent via register ────────
    const mockAgent = makeMockAgent(ctx, zSession);
    // The official contract requires awaiting register() before using the
    // agent: register enters, then announces through the serial `agent/created`
    // dispatch, and a failing listener rolls the entry back (agent/src/index.ts:426).
    // Awaiting inside the catch boundary surfaces an async rejection here.
    let disposeHandle = null;
    try {
      // Keep the exact disposer function, and await it to observe the
      // `agent/created` announce (a serial listener failure rejects here).
      const dispose = ctx.agents.register(mockAgent);
      await dispose;
      disposeHandle = dispose;
      result.stages.register = {
        outcome: 'announced',
        returnType: typeof dispose,
        disposerRetained: true,
      };
    } catch (error) {
      result.stages.register = { outcome: 'threw', error: String(error?.stack ?? error) };
    }
    if (disposeHandle === null) {
      // Nothing was published; do not pretend the coexistence stages can run.
      result.stages.registryAfterRegister = snapshot(ctx.agents, ctx.sessions);
      flush();
      return;
    }
    const live = ctx.agents.get(ZCODE_ID);
    result.stages.register = {
      ...result.stages.register,
      liveAfterAnnounce: live !== undefined,
      exactIdentity: live === mockAgent,
      sessionMatchesLive: live?.session === zSession,
      // The sidebar projection's own availability predicate (list.ts:118).
      agentAvailablePredicate: ctx.agents.get(zSession.id)?.session === zSession,
    };
    result.stages.registryAfterRegister = snapshot(ctx.agents, ctx.sessions);
    flush();

    // ── Stage C: native-runtime session through the owner create flow ─────
    // create() delegates to the single factory slot owned by dsh-agent-loop;
    // this is the same path session-controller uses. No prompt => no model call.
    try {
      const handle = await ctx.agents.create({ sessionId: NATIVE_ID, meta: { cwd: process.cwd() } });
      result.stages.nativeCreate = { outcome: 'created', agentId: handle.agent.id, native: true };
      // A marker transcript keeps the native row non-blank (blank rows render as
      // the provisional "New session" placeholder) so the coexistence snapshot
      // shows two distinct, unambiguous session rows.
      try {
        appendStubTranscript(handle.agent.session, 'NATIVE-MOCK', 'dsh-native-mock');
        result.stages.nativeTranscript = { outcome: 'appended', seq: handle.agent.session.seq };
      } catch (transcriptError) {
        result.stages.nativeTranscript = { outcome: 'failed', error: String(transcriptError?.stack ?? transcriptError) };
      }
    } catch (error) {
      result.stages.nativeCreate = { outcome: 'failed', error: String(error?.stack ?? error) };
    }
    result.stages.registryAfterNative = snapshot(ctx.agents, ctx.sessions);
    // ── Stage D: attach both sessions to the workspace that owns the cwd ──
    // The sidebar renders workspace.sessionIds, so a live session is only
    // visible after the workspace registry accounts it. The native controller
    // attach happens in its own create command; a plugin-created session must
    // replicate that step.
    const attached = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve('timeout: workspaceRegistry unavailable'), 8000);
      ctx.inject(['workspaceRegistry'], async (wctx) => {
        clearTimeout(timer);
        try {
          const { realpath } = await import('node:fs/promises');
          const real = await realpath(process.cwd());
          let ws = await wctx.workspaceRegistry.resolveByPath(real);
          let created = false;
          if (ws === undefined) {
            ws = await wctx.workspaceRegistry.create(real, 'S01b probe workspace');
            created = true;
          }
          await ws.attachSession(ZCODE_ID);
          await ws.attachSession(NATIVE_ID);
          result.stages.workspaceAttach = {
            outcome: 'attached',
            path: real,
            workspaceId: ws.id,
            createdWorkspace: created,
            sessionIds: [...ws.sessionIds],
          };
        } catch (error) {
          result.stages.workspaceAttach = { outcome: 'failed', error: String(error?.stack ?? error) };
        }
        flush();
        resolve('done');
      });
    });
    if (typeof attached === 'string' && attached.startsWith('timeout')) {
      result.stages.workspaceAttach = { outcome: attached };
      flush();
    }

    // Answer the selection question with the seam as DECLARED BY SOURCE. This
    // stage is a static transcription of the official type declarations, not a
    // runtime observation: create() has no runtime selector and every create
    // goes through the one native factory (agent-loop/index.ts:330,369;
    // CreateAgentOptions in core/agent/src/index.ts:63 declares the key set and
    // the meta shape).
    result.stages.runtimeSelection = {
      source: 'static-transcription',
      sourceRefs: [
        'packages/core/agent/src/index.ts:63 CreateAgentOptions',
        'packages/core/agent-loop/src/index.ts:330,369 single factory',
      ],
      observedAtRuntime: false,
      createAgentOptionsKeys: ['sessionId', 'parentAgent', 'meta', 'inheritedEventCount', 'seed', 'agentOptions', 'signal', 'setup'],
      metaKeys: ['cwd', 'parentSession', 'isSeeded', 'origin', 'delegationDepth', 'agentPreset'],
      runtimeFieldPresent: false,
      registerAcceptsRuntime: false,
    };
    flush();
  };

  // Never let a probe rejection escape as an unhandled boot failure.
  void run().catch((error) => {
    result.stages.fatal = String(error?.stack ?? error);
    flush();
  });
}
