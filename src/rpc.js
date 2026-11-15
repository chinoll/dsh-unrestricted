import { clientRequestSchema } from '@deepseek-ai/dsh-client-connection'

/** Mount read-only RPCs on the authenticated, owner-only Connection Fetch surface. */
export function registerRpc(connection, handle) {
  const disposers = []
  try {
    for (const name of ['status', 'session-status', 'preview', 'recheck']) {
      const endpoint = `dsh-unrestricted/${name}`
      disposers.push(connection.fetch.register({
        path: `/api/${endpoint}`,
        methods: ['POST'],
        requestBody: 'buffered',
        async fetch(request) {
          if (request.headers.get('content-type')?.split(';', 1)[0].trim() !== 'application/json') {
            return new Response('Expected application/json', { status: 415 })
          }
          let body
          try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
          const parsed = clientRequestSchema.safeParse(body)
          if (!parsed.success || parsed.data.method !== endpoint) return new Response('Invalid RPC request', { status: 400 })
          let result
          try { result = await handle(name, parsed.data.payload) }
          catch { result = { ok: false, error: { code: 'internal', message: 'Unable to read unrestricted mode.', details: {} } } }
          return Response.json({ type: 'server-response', rpcId: parsed.data.rpcId, result })
        },
      }))
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    throw error
  }
  return () => { for (const dispose of disposers.reverse()) dispose() }
}
