import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection/src/rpc-host.ts'
import { expect, it } from 'vitest'
import { apply, inject } from '../packages/host/index.mjs'
it('DSH authenticated dedicated carrier enumerates/watches launcher status and denies execution payloads', async () => {
  const ctx = new Context()
  try {
    await ctx.plugin((owner) => { new HostConnectionService(owner, [], { isAuthenticated: () => true } as never) })
    await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
    await ctx.plugin({ inject, apply }, { authorityMode: 'host-backed' } as never)
    const call = async (method: string, payload: unknown) => (await fetch(`http://127.0.0.1:${ctx.get('webServer')!.port}/zcode-bridge/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'client-req', method, payload }) })).json()
    expect(await call('launcher', { operation: 'state' })).toMatchObject({ result: { ok: true, value: { phase: 'unconfigured', channelAvailable: false } } })
    expect(await call('launcher', { operation: 'services' })).toMatchObject({ result: { ok: true, value: { services: [], channelAvailable: false } } })
    expect(await call('launcher', { operation: 'watch', afterRevision: 0 })).toMatchObject({ result: { ok: true, value: { phase: 'unconfigured' } } })
    expect(await call('launcher', { operation: 'state', command: 'closeSession' })).toMatchObject({ result: { ok: false, error: { code: 'invalid-payload' } } })
    expect(await call('connect', {})).toMatchObject({ result: { ok: true, value: { connected: false, reason: 'launcher-unconfigured' } } })
  } finally { await ctx.fiber.dispose() }
})
