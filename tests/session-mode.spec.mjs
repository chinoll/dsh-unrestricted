import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Config, apply } from '../src/node.js'
import { sessionEnabled } from '../src/session-mode.js'

test('sessions default on, explicit choices survive JSON persistence and stay isolated', () => {
  const defaults = Config({}).get()
  assert.equal(defaults.enabled, true)
  const config = JSON.parse(JSON.stringify({ ...defaults, sessions: { a: false, b: true } }))
  assert.equal(sessionEnabled(config, 'a'), false)
  assert.equal(sessionEnabled(config, 'b'), true)
  assert.equal(sessionEnabled(config, 'new'), true)
  config.enabled = false
  assert.equal(sessionEnabled(config, 'b'), true)
  assert.equal(sessionEnabled(config, 'new'), false)
})

test('delegated children inherit their parent; normal sessions and explicit children are independent', () => {
  const headers = {
    child: { origin: 'subagent', parentSession: 'parent' },
    nested: { origin: 'subagent', parentSession: 'child' },
    fork: { parentSession: 'parent', isSeeded: true },
  }
  const config = { enabled: true, sessions: { parent: false } }
  assert.equal(sessionEnabled(config, 'nested', id => headers[id]), false)
  assert.equal(sessionEnabled(config, 'fork', id => headers[id]), true)
  config.sessions.child = true
  assert.equal(sessionEnabled(config, 'nested', id => headers[id]), true)
})

async function host(t) {
  let config = Config({}).get()
  const listeners = new Map()
  const disposers = []
  const agents = new Map()
  const rpc = new Map()
  const ctx = {
    settings: { configure: () => () => {} }, fiber: {},
    loader: { await: async () => {} },
    systemPrompt: {},
    get: name => name === 'agents' ? { list: () => [...agents.values()], get: id => agents.get(id) }
      : name === 'agentPresets' ? { composedPreset: ctx => ctx.preset } : undefined,
    on: (name, handler) => { listeners.set(name, handler); return () => listeners.delete(name) },
    effect: effect => { disposers.push(effect()) },
    inject: (_names, setup) => setup({ effect: effect => disposers.push(effect()), connection: { fetch: { register: route => { rpc.set(route.path, route.fetch); return () => rpc.delete(route.path) } } } }),
  }
  apply(ctx, { get: () => config })
  t.after(() => disposers.reverse().forEach(dispose => dispose?.()))
  function agent(id, preset = 'standard', parent) {
    const sections = new Map()
    const value = {
      session: { id, header: { id, ...(parent ? { origin: 'subagent', parentSession: parent } : {}) } },
      ctx: { preset, systemPrompt: { section: section => { sections.set(section.name, section); return () => sections.delete(section.name) } } },
    }
    agents.set(id, value)
    listeners.get('agent/created')({ agent: value })
    return { value, sections }
  }
  return {
    agent,
    update(next) { config = Config(next).get(); listeners.get('loader/volatile-update')() },
    assemble: (agent, original) => listeners.get('system-prompt/assemble')(original, { agent }, async () => original),
    status: async id => {
      const response = await rpc.get('/api/dsh-unrestricted/session-status')(new Request('http://localhost/api/dsh-unrestricted/session-status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'test', method: 'dsh-unrestricted/session-status', payload: { sessionId: id } }) }))
      return (await response.json()).result
    },
  }
}

test('actual host waterfall returns disabled session assembly verbatim while another session remains fused', async t => {
  const h = await host(t)
  const a = h.agent('a').value
  const b = h.agent('b').value
  const sections = JSON.parse(await readFile(new URL('./fixtures/sections-standard.json', import.meta.url)))
  const original = { sections, contexts: [], variables: {}, tools: [] }
  h.update({ sessions: { a: false } })
  assert.equal(await h.assemble(a, original), original)
  assert.notEqual(await h.assemble(b, original), original)
  assert.equal((await h.status('a')).value.enabled, false)
  assert.equal((await h.status('b')).value.enabled, true)
  h.update({ sessions: { a: true, b: false } })
  assert.notEqual(await h.assemble(a, original), original)
  assert.equal(await h.assemble(b, original), original)
})

test('minimal shadows are removed and restored only for affected sessions, including delegated children', async t => {
  const h = await host(t)
  const a = h.agent('a', 'minimal')
  const b = h.agent('b', 'minimal')
  const child = h.agent('child', 'minimal', 'a')
  assert.equal(a.sections.size, 1)
  h.update({ sessions: { a: false } })
  assert.equal(a.sections.size, 0)
  assert.equal(child.sections.size, 0)
  assert.equal(b.sections.size, 1)
  h.update({ enabled: false, sessions: { a: true } })
  assert.equal(a.sections.size, 1)
  assert.equal(child.sections.size, 1)
  assert.equal(b.sections.size, 0)
})
