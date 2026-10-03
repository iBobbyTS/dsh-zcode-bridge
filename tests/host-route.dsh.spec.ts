import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection/src/rpc-host.ts'
import type { BrowserAuth } from '@deepseek-ai/dsh-client-connection/src/browser-auth.ts'
import { expect, it } from 'vitest'
import { apply, inject } from '../packages/host/index.mjs'

it.each(['early', 'late'])('owns the real HTTP route in the injected fiber with %s webServer', async (timing) => {
  const ctx = new Context()
  const auth = { isAuthenticated: (request: { headers: { cookie?: string } }) => request.headers.cookie === 'route-test=allowed' } as BrowserAuth
  const requestStatus = () => fetch(`http://127.0.0.1:${ctx.get('webServer')!.port}/zcode-bridge/status`, {
    method: 'POST',
    headers: { cookie: 'route-test=allowed', 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'route-test', method: 'status', payload: {} }),
  })
  try {
    await ctx.plugin((owner) => { new HostConnectionService(owner, [], auth) })
    let server = timing === 'early' ? await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 }) : undefined
    const host = await ctx.plugin({ inject, apply })
    server ??= await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
    await expect.poll(async () => (await requestStatus()).status).toBe(200)
    expect(await (await requestStatus()).json()).toMatchObject({ result: { ok: true, value: { reason: 'not-connected' } } })
    expect((await fetch(`http://127.0.0.1:${ctx.get('webServer')!.port}/zcode-bridge/status`)).status).toBe(401)

    // Removing and replacing the dependency must release the old route and
    // bind the new server without needing a bridge plugin reload.
    await server.dispose()
    await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
    await expect.poll(async () => (await requestStatus()).status).toBe(200)
    await host.dispose()
    expect((await requestStatus()).status).toBe(404)
  } finally {
    await ctx.fiber.dispose()
  }
})
