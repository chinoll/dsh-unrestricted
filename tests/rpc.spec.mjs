import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection'
import { registerRpc } from '../src/rpc.js'

test('RPC routes use the real authenticated Connection Fetch bridge and dispose cleanly', async () => {
  const ctx = new Context()
  const connection = new HostConnectionService(ctx, [], {})
  const routes = connection.createSharedFetchHandler('/api')
  const dispose = registerRpc(connection, async (name, payload) => ({ ok: true, value: { name, ...payload } }))
  function request(body, type = 'application/json') {
    return new Request('http://localhost/api/dsh-unrestricted/session-status', {
      method: 'POST', headers: { 'content-type': type }, body: JSON.stringify(body),
    })
  }
  const body = { type: 'client-request', rpcId: 'regression', method: 'dsh-unrestricted/session-status', payload: { sessionId: 'a' } }
  const owner = { principal: { kind: 'owner' } }
  try {
    const response = await routes.fetch(request(body), owner)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { type: 'server-response', rpcId: 'regression', result: { ok: true, value: { name: 'session-status', sessionId: 'a' } } })
    assert.equal((await routes.fetch(request(body), { principal: { kind: 'agent' } })).status, 403)
    assert.equal((await routes.fetch(request({ ...body, method: 'status' }), owner)).status, 400)
    assert.equal((await routes.fetch(request(body, 'text/plain'), owner)).status, 415)
    dispose()
    assert.equal((await routes.fetch(request(body), owner)).status, 404)
  } finally { dispose(); await ctx.fiber.dispose() }
})
