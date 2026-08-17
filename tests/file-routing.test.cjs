const test = require('node:test')
const assert = require('node:assert/strict')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const fileModule = require('../electron/tools/file.cjs')
const webModule = require('../electron/tools/web.cjs')

// FIX-010. Found by walking docs/VALIDATION.md rather than by a test.
//
// The file tools shipped with no deterministic route, so ordinary phrasing
// fell through to the skill router and answered with a skill-prompt message
// instead of running the tool that existed. Worse, "search my files for X"
// matched the web-search pattern, which would have sent a request about local
// files to Serper.

function harness() {
  const calls = []
  const registry = new ToolRegistry()
  const noop = async () => ({})
  const access = {
    roots: ['root'],
    searchFiles: async ({ query }) => { calls.push(['file.search', query]); return { results: [], truncated: false } },
    searchFileContent: async ({ query }) => {
      calls.push(['file.searchContent', query])
      return { matches: [], truncated: false, trust: 'untrusted-external' }
    },
    statFile: noop, readTextFile: noop, saveTextFile: noop, createFolder: noop,
    moveFile: noop, renameFile: noop, prepareSave: () => ({}), prepareCreateFolder: () => ({}),
    prepareMove: () => ({}), prepareRename: () => ({}), resolvePath: value => value
  }
  for (const definition of fileModule.create({ fileAccess: access, revealItem() {} })) registry.register(definition)
  for (const definition of webModule.create({
    webSearch: async query => { calls.push(['web.search', query]); return [] }
  })) registry.register(definition)

  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    settings: () => ({ fileReadConfirm: false, webSearchConfirm: false }),
    activity: () => {}
  })
  return { agent, calls }
}

test('a request about local files never reaches the web search tool', async () => {
  // The bug: "search my files for X" matched /^search\s+(.+)$/ and sent
  // "my files for X" to Serper. A local request must not leave the machine.
  for (const text of [
    'search my files for invoice',
    'search my documents for budget',
    'grep my files for password',
    'look inside my notes for the address'
  ]) {
    const { agent, calls } = harness()
    await agent.handle(text)
    assert.ok(calls.length > 0, `nothing ran for: ${text}`)
    assert.equal(calls[0][0], 'file.searchContent', `${text} routed to ${calls[0][0]}`)
    assert.equal(
      calls.some(([tool]) => tool === 'web.search'),
      false,
      `a local file request reached the web: ${text}`
    )
  }
})

test('finding files by name runs file.search with the name extracted', async () => {
  const cases = [
    ['find files called notes', 'notes'],
    ['find files named report.md', 'report.md'],
    ['list all files matching draft', 'draft'],
    ['show me the files called budget?', 'budget']
  ]
  for (const [text, expected] of cases) {
    const { agent, calls } = harness()
    await agent.handle(text)
    assert.deepEqual(calls[0], ['file.search', expected], `wrong routing for: ${text}`)
  }
})

test('web search intent still reaches the web', async () => {
  for (const [text, expected] of [
    ['search the web for cats', 'cats'],
    ['look up rain in spain', 'rain in spain'],
    ['google electron sandbox', 'electron sandbox']
  ]) {
    const { agent, calls } = harness()
    await agent.handle(text)
    assert.deepEqual(calls[0], ['web.search', expected], `wrong routing for: ${text}`)
  }
})

test('a matched skill with a live provider answers instead of claiming none exists', async () => {
  // The message said "the mock agent has no live provider to continue"
  // without ever checking, so a fully configured install was told its
  // provider was missing while the same session was answering with Gemini.
  const { agent: base } = harness()
  const agent = new MockAgent({
    registry: base.registry,
    policy: new PolicyEngine(),
    settings: () => ({}),
    activity: () => {},
    provider: { generate: async () => ({ text: 'answered', provider: 'gemini', model: 'x', attempts: [] }) },
    skills: {
      router: { route: () => ({ selectedSkillIds: ['filesystem-scan'], missingTools: [], shortReason: 'matched', skill: { name: 'Filesystem Scan' } }) },
      loader: { loadPrompt: () => 'skill prompt' },
      registry: { list: () => [] }
    }
  })
  const reply = await agent.handle('give me a storage health report')
  assert.equal(reply.state, 'success')
  assert.equal(reply.message, 'answered')
  assert.doesNotMatch(reply.message, /no live provider/)
})

test('without a provider the message is honest and actionable', async () => {
  const { agent: base } = harness()
  const agent = new MockAgent({
    registry: base.registry,
    policy: new PolicyEngine(),
    settings: () => ({}),
    activity: () => {},
    provider: null,
    skills: {
      router: { route: () => ({ selectedSkillIds: ['filesystem-scan'], missingTools: [], shortReason: 'matched', skill: { name: 'Filesystem Scan' } }) },
      loader: { loadPrompt: () => 'skill prompt' },
      registry: { list: () => [] }
    }
  })
  const reply = await agent.handle('give me a storage health report')
  assert.match(reply.message, /no AI provider is connected/)
  assert.doesNotMatch(reply.message, /mock agent/, 'the message should not describe internals')
})
