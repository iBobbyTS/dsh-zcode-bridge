/**
 * Capability admission spike — host half.
 *
 * Runs inside a throwaway official DSH web instance and records, to
 * `process.env.CAPABILITY_ADMISSION_SPIKE_RESULT` (default /tmp/capability-admission-spike-host.json), what the
 * host-side plugin context actually exposes. It performs one guarded,
 * self-reverting probe of the single Agent factory slot (item ①) and never
 * starts an agent, a session or a model call.
 */
import { writeFileSync } from 'node:fs';

export const name = 'capability-admission-spike';

/** `agents` is the single-factory registry probed below (item ①). */
export const inject = ['agents'];

export function apply(ctx) {
  const result = {
    plugin: '@dsh-zcode/capability-admission',
    services: {
      agents: typeof ctx.agents === 'object' && ctx.agents !== null,
      sessionController: ctx.get?.('sessionController') !== undefined,
      sessionQuery: ctx.get?.('sessionQuery') !== undefined,
      workspaceController: ctx.get?.('workspaceController') !== undefined,
      sessionQueryObserve: typeof ctx.get?.('sessionQuery')?.observeSession === 'function',
    },
    setFactory: { present: typeof ctx.agents?.setFactory === 'function' },
  };

  // Item ①: agent/index.ts:358 rejects a second factory. Probe it without
  // stealing the slot: if the call is accepted we dispose it immediately.
  if (typeof ctx.agents?.setFactory === 'function') {
    let handedBack = false;
    const probeFactory = {
      createAgent: () => { throw new Error('capability-admission-spike probe factory must never create'); },
      resume: () => { throw new Error('capability-admission-spike probe factory must never resume'); },
    };
    try {
      const dispose = ctx.agents.setFactory(probeFactory);
      handedBack = true;
      if (typeof dispose === 'function') dispose();
      result.setFactory.outcome = 'accepted-slot-was-free';
    } catch (error) {
      result.setFactory.outcome = 'rejected-slot-occupied';
      result.setFactory.error = String(error?.message ?? error);
    }
    result.setFactory.disposed = handedBack;
  }

  try {
    writeFileSync(process.env.CAPABILITY_ADMISSION_SPIKE_RESULT ?? '/tmp/capability-admission-spike-host.json', JSON.stringify(result, null, 2));
  } catch {
    // A probe must never break host boot.
  }
}
