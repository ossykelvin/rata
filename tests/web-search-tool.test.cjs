const test = require('node:test')
const assert = require('node:assert/strict')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const webModule = require('../electron/tools/web.cjs')
const { MAX_QUERY_LENGTH } = webModule
const { createSerperSearch } = require('../electron/serper-client.cjs')
const { parseEnv, loadRuntimeConfig, describeConfig } = require('../electron/config.cjs')

function serperResponse(organic) {
  return async () => ({ ok: true, status: 200, json: async () => ({ organic }) })
}

function harness({ apiKey = 'test-key', fetchImpl, webFetch } = {}) {
  const registry = new ToolRegistry()
  const deps = { webSearch: createSerperSearch({ apiKey, fetchImpl: fetchImpl || serperResponse([]) }) }
  if (webFetch) deps.webFetch = webFetch
  for (const definition of webModule.create(deps)) {
    registry.register(definition)
  }
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

// WEB-001 chains search -> fetch -> synthesis, so this now needs a fetch
// capability to reach a success state. See the companion test below for what
// happens when fetch is unavailable.
test('approval can be disabled deliberately', async () => {
  const calls = []
  const registry = harness({
    fetchImpl: async (url, options) => {
      calls.push(JSON.parse(options.body).q)
      return { ok: true, status: 200, json: async () => ({ organic: [{ title: 'T', link: 'https://e.example', snippet: 'S' }] }) }
    },
    webFetch: async () => ({ url: 'https://e.example', contentType: 'text/html', title: 'T', content: 'page text', trust: 'untrusted-external' })
  })
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    settings: () => ({ webSearchConfirm: false, webFetchConfirm: false }),
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
  assert.deepEqual(described, {
    providerModeOverride: null,
    providerModeRejected: null,
    gemini: true,
    openrouter: false,
    serper: true
  })
  assert.equal(JSON.stringify(described).includes('secret'), false)
})

// --- provider mode precedence -------------------------------------------
//
// RATA_AI_PROVIDER was previously unreachable: the mode was computed as
// `storedSetting || envDefault`, and the stored setting always holds a value,
// so editing the env variable appeared to do nothing.

test('a valid RATA_AI_PROVIDER is accepted as an override', () => {
  for (const mode of ['auto', 'gemini', 'openrouter', 'mock']) {
    const config = loadRuntimeConfig({ rootDir: __dirname, files: [], processEnv: { RATA_AI_PROVIDER: mode } })
    assert.equal(config.providerModeOverride, mode)
    assert.equal(config.providerModeRejected, null)
  }
})

test('no RATA_AI_PROVIDER means no override, so the stored setting decides', () => {
  const config = loadRuntimeConfig({ rootDir: __dirname, files: [], processEnv: {} })
  assert.equal(config.providerModeOverride, null)
  assert.equal(config.providerModeRejected, null)
})

test('an unknown RATA_AI_PROVIDER is rejected and reported, not silently used', () => {
  for (const bad of ['gpt4', 'AUTO ', 'openai', '']) {
    const config = loadRuntimeConfig({ rootDir: __dirname, files: [], processEnv: { RATA_AI_PROVIDER: bad } })
    assert.equal(config.providerModeOverride, null, `accepted an unknown mode: ${bad}`)
  }
  const typo = loadRuntimeConfig({ rootDir: __dirname, files: [], processEnv: { RATA_AI_PROVIDER: 'gemni' } })
  assert.equal(typo.providerModeOverride, null)
  assert.equal(typo.providerModeRejected, 'gemni')
})

test('describeConfig reports the override without exposing credentials', () => {
  const config = loadRuntimeConfig({
    rootDir: __dirname,
    files: [],
    processEnv: { RATA_AI_PROVIDER: 'auto', GEMINI_API_KEY: 'g-secret' }
  })
  const described = describeConfig(config)
  assert.equal(described.providerModeOverride, 'auto')
  assert.equal(described.gemini, true)
  assert.equal(JSON.stringify(described).includes('secret'), false)
})

test('a successful search still returns its results when synthesis cannot run', async () => {
  // WEB-001 made web.search the first half of a search -> fetch -> synthesise
  // chain. When the fetch half is unavailable the search itself has already
  // succeeded, so the results must survive.
  //
  // Pinned deliberately: the reply currently reports state 'error' even though
  // the user's actual request (search) worked. Raised as a finding on #40 —
  // this test records the behaviour so a change to it is visible.
  const registry = harness({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ organic: [{ title: 'T', link: 'https://e.example', snippet: 'S' }] })
    })
  })
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    settings: () => ({ webSearchConfirm: false, webFetchConfirm: false }),
    activity: () => {}
  })

  const reply = await agent.handle('search the web for windows automation')
  assert.match(reply.message, /T/, 'the search results were lost')
  assert.match(reply.message, /e\.example/)
  assert.equal(reply.state, 'error', 'behaviour changed — see the finding on #40')
})
