const test = require('node:test')
const assert = require('node:assert/strict')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const { registerSearchTools, MAX_QUERY_LENGTH } = require('../electron/search-tools.cjs')
const { parseEnv, loadRuntimeConfig, describeConfig } = require('../electron/config.cjs')

function serperResponse(organic) {
  return async () => ({ ok: true, status: 200, json: async () => ({ organic }) })
}

function harness({ apiKey = 'test-key', fetchImpl } = {}) {
  const registry = new ToolRegistry()
  registerSearchTools(registry, { apiKey, fetchImpl: fetchImpl || serperResponse([]) })
  return registry
}

test('web.search declares risk and confirmation metadata', () => {
  const meta = harness().describe('web.search')
  assert.equal(meta.risk, 'read')
  assert.equal(meta.confirmation, 'configurable')
  assert.equal(meta.confirmationSetting, 'webSearchConfirm')
})

test('the query leaving the machine requires approval by default', async () => {
  const registry = harness()
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    // webSearchConfirm absent entirely: the policy must still confirm.
    settings: () => ({}),
    activity: () => {}
  })
  const reply = await agent.handle('search the web for windows automation')
  assert.ok(reply.approval, 'search executed without approval')
  assert.match(reply.approval.detail, /leaves your machine/)
})

test('approval can be disabled deliberately', async () => {
  const calls = []
  const registry = harness({
    fetchImpl: async (url, options) => {
      calls.push(JSON.parse(options.body).q)
      return { ok: true, status: 200, json: async () => ({ organic: [{ title: 'T', link: 'https://e.example', snippet: 'S' }] }) }
    }
  })
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    settings: () => ({ webSearchConfirm: false }),
    activity: () => {}
  })
  const reply = await agent.handle('search the web for windows automation')
  assert.equal(reply.state, 'success')
  assert.deepEqual(calls, ['windows automation'])
})

test('the API key is sent as a header and never in the body or URL', async () => {
  let seen = null
  const registry = harness({
    apiKey: 'serper-secret',
    fetchImpl: async (url, options) => {
      seen = { url, options }
      return { ok: true, status: 200, json: async () => ({ organic: [] }) }
    }
  })
  await registry.execute('web.search', { query: 'test' })
  assert.equal(seen.options.headers['X-API-KEY'], 'serper-secret')
  assert.equal(seen.url.includes('serper-secret'), false)
  assert.equal(seen.options.body.includes('serper-secret'), false)
})

test('input validation rejects empty and oversized queries', () => {
  const registry = harness()
  assert.throws(() => registry.validate('web.search', { query: '   ' }), /non-empty/)
  assert.throws(() => registry.validate('web.search', { query: 'x'.repeat(MAX_QUERY_LENGTH + 1) }), /characters or fewer/)
  assert.throws(() => registry.validate('web.search', {}), /non-empty/)
})

test('results are clamped, and provider errors do not leak the endpoint', async () => {
  const long = 'x'.repeat(5000)
  const registry = harness({
    fetchImpl: serperResponse([{ title: long, link: long, snippet: long }])
  })
  const result = await registry.execute('web.search', { query: 'test' })
  assert.ok(result.results[0].title.length <= 400)

  const failing = harness({ fetchImpl: async () => { throw new Error('connect ECONNREFUSED https://google.serper.dev key=abc') } })
  await assert.rejects(
    () => failing.execute('web.search', { query: 'test' }),
    error => {
      assert.equal(error.message.includes('key=abc'), false, 'the error leaked credentials')
      return /Web search request failed/.test(error.message)
    }
  )
})

test('an unconfigured search key fails closed', async () => {
  const registry = harness({ apiKey: null })
  await assert.rejects(() => registry.execute('web.search', { query: 'test' }), /not configured/)
})

// --- config loading -----------------------------------------------------

test('env parsing handles comments, quotes and blank lines', () => {
  const parsed = parseEnv(['# comment', '', 'A=1', 'B="two"', "C='three'", 'BAD LINE', 'D=has=equals'].join('\n'))
  assert.deepEqual({ ...parsed }, { A: '1', B: 'two', C: 'three', D: 'has=equals' })
})

test('config describes presence without exposing values', () => {
  const config = loadRuntimeConfig({
    rootDir: __dirname,
    files: [],
    processEnv: { GEMINI_API_KEY: 'g-secret', RATA_SERPER_API_KEY: 's-secret' }
  })
  const described = describeConfig(config)
  assert.deepEqual(described, { defaultProviderMode: 'mock', gemini: true, openrouter: false, serper: true })
  assert.equal(JSON.stringify(described).includes('secret'), false)
})
