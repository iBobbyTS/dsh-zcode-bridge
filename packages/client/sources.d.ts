import type { Context } from '@deepseek-ai/cordis'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  ISessions, RuntimeSessionAddress, RuntimeSessionSummary, RuntimeSourceReference,
  SessionRuntime, SessionSourceAvailability, SessionRetainOptions,
} from '@deepseek-ai/dsh-api-session-controller/client'

/** Fixed native and restricted official-catalog routes. No foreign Agent scope. */
export class RuntimeSessions {
  /**
   * @param options - existing native controller, authenticated carrier, generation source, and browser Host origin.
   */
  constructor(options: {
    sessions: ISessions
    rpc: ConnectionHandle['rpc']
    connectionGeneration?: ConnectionHandle['generation']
    nativeAuthority: string
  })
  /** Native and official catalog facts, keyed by the complete runtime address. */
  readonly list: ObservableSnapshot<readonly RuntimeSessionSummary[]>
  /** Restricted or disconnected official source; execution capabilities remain false. */
  readonly zcodeAvailability: ObservableSnapshot<SessionSourceAvailability>
  /**
   * @param sessionId - known legacy native identity with no runtime binding.
   * @returns fixed native address without consulting the creation default.
   */
  legacyAddress(sessionId: SessionId): RuntimeSessionAddress
  /**
   * @param options - explicit runtime and native controller creation options.
   * @returns catalogued native address; ZCode creation rejects as not ready.
   */
  create(options: { runtime: SessionRuntime } & NonNullable<Parameters<ISessions['create']>[0]>): Promise<RuntimeSessionAddress>
  /** @returns completion of native and official catalog reads; official failure is exposed in availability. */
  refresh(): Promise<void>
  /**
   * @param address - immutable routing facts to query without activating execution.
   * @returns completion; official rejection propagates and does not invoke the native controller.
   */
  refreshAddress(address: RuntimeSessionAddress): Promise<void>
  /**
   * @param address - fixed address from a catalog or saved UI reference.
   * @param options - native reference owner and optional acquisition cancellation.
   * @returns owned native reference or read-only foreign summary reference.
   */
  retain(address: RuntimeSessionAddress, options: SessionRetainOptions): RuntimeSourceReference
  /** @returns completion after withdrawing references/listeners and settling cancelled official reads. */
  dispose(): Promise<void>
}
/**
 * Install as a child of the existing sessions injection.
 * @param ctx - Client plugin context with connection and browser location.
 * @returns asynchronous disposer for the child fiber and its adapter.
 */
export function installRuntimeSessions(ctx: Context): () => Promise<void>

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Bridge-owned catalog and runtime reference routing; native execution stays in ctx.sessions. */
    runtimeSessions: RuntimeSessions
  }
}
