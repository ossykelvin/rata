const test = require('node:test')
const assert = require('node:assert/strict')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const systemModule = require('../electron/tools/system.cjs')
const {
  parseSystemActionPlan,
  looksLikeSystemActionRequest,
  SystemActionPlanError,
  ALLOWED_APP_NAMES
} = require('../packages/agent-core/orchestrator/system-action-planner.cjs')

// RATA-002 / ADR-009. A provider now influences whether a registered tool runs.
// That is the first path of its kind, so these tests hold the line at the two
// places that matter: the parser must accept nothing but the one fixed shape,
// and a rejected plan must spawn no process at all.

function harness({ text = '{"version":1,"action":"none"}', spawnCalls = [] } = {}) {
  const registry = new ToolRegistry()
  const spawnProcess = (exe, args, options) => {
    spawnCalls.push({ exe, args, options })
    return { unref() {} }
  }
  for (const definition of systemModule.create({ spawnProcess })) {
    registry.register(definition)
  }
  const provider = { generate: async () => ({ text, attempts: [] }) }
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    settings: () => ({}),
    activity: () => {},
    provider
  })
  return { agent, spawnCalls, registry }
}

test('only the two allow-listed application names are accepted', () => {
  assert.deepEqual([...ALLOWED_APP_NAMES], ['notepad', 'calculator'])
  for (const appName of ALLOWED_APP_NAMES) {
    const plan = parseSystemActionPlan(`{"version":1,"action":"system.openApp","input":{"appName":"${appName}"}}`)
    assert.equal(plan.toolId, 'system.openApp')
    assert.equal(plan.input.appName, appName)
  }
})

test('a declined plan parses to null rather than throwing', () => {
  assert.equal(parseSystemActionPlan('{"version":1,"action":"none"}'), null)
})

test('the model cannot name the tool that runs', () => {
  // toolId is a literal in the parser, never read from provider output. This is
  // the single most important property here: a compromised or confused model
  // can choose between two app names and nothing else.
  const plan = parseSystemActionPlan('{"version":1,"action":"system.openApp","input":{"appName":"notepad"}}')
  assert.equal(plan.toolId, 'system.openApp')
  assert.throws(
    () => parseSystemActionPlan('{"version":1,"action":"shell.exec","input":{"appName":"notepad"}}'),
    error => error instanceof SystemActionPlanError && error.code === 'unsupported-action-plan'
  )
})

test('every malformed or expanded plan shape fails closed', () => {
  const rejected = [
    ['prose instead of JSON', 'Sure, opening Notepad for you!'],
    ['prose wrapped around JSON', 'Sure! {"version":1,"action":"system.openApp","input":{"appName":"notepad"}}'],
    ['an extra top-level key', '{"version":1,"action":"system.openApp","input":{"appName":"notepad"},"elevate":true}'],
    ['an extra input key', '{"version":1,"action":"system.openApp","input":{"appName":"notepad","args":["x"]}}'],
    ['a missing input', '{"version":1,"action":"system.openApp"}'],
    ['an unknown application', '{"version":1,"action":"system.openApp","input":{"appName":"powershell"}}'],
    ['an executable path', '{"version":1,"action":"system.openApp","input":{"appName":"C:\\\\Windows\\\\System32\\\\cmd.exe"}}'],
    ['a case variant', '{"version":1,"action":"system.openApp","input":{"appName":"NOTEPAD"}}'],
    ['a non-string application', '{"version":1,"action":"system.openApp","input":{"appName":["notepad"]}}'],
    ['a bumped version', '{"version":2,"action":"system.openApp","input":{"appName":"notepad"}}'],
    ['a decline carrying extra keys', '{"version":1,"action":"none","then":"system.openApp"}'],
    ['an empty payload', ''],
    ['a non-string payload', null]
  ]
  for (const [label, raw] of rejected) {
    assert.throws(
      () => parseSystemActionPlan(raw),
      error => error instanceof SystemActionPlanError,
      `${label} was accepted`
    )
  }
})

test('one complete Markdown fence is tolerated with or without a JSON tag', () => {
  for (const raw of [
    '```json\n{"version":1,"action":"system.openApp","input":{"appName":"notepad"}}\n```',
    '```\n{"version":1,"action":"system.openApp","input":{"appName":"calculator"}}\n```'
  ]) {
    const plan = parseSystemActionPlan(raw)
    assert.equal(plan.toolId, 'system.openApp')
    assert.ok(ALLOWED_APP_NAMES.includes(plan.input.appName))
  }
})

test('unterminated or multiple Markdown fences still fail closed', () => {
  const rejected = [
    '```json\n{"version":1,"action":"none"}',
    '```json\n```json\n{"version":1,"action":"none"}\n```\n```'
  ]
  for (const raw of rejected) {
    assert.throws(
      () => parseSystemActionPlan(raw),
      error => error instanceof SystemActionPlanError && error.code === 'invalid-plan-json'
    )
  }
})

test('a plan cannot pollute Object.prototype', () => {
  assert.throws(() => parseSystemActionPlan('{"version":1,"action":"none","__proto__":{"polluted":true}}'))
  assert.equal({}.polluted, undefined)
})

test('an oversized payload is refused before JSON parsing', () => {
  const oversized = [
    `{"version":1,"action":"system.openApp","input":{"appName":"notepad","pad":"${'a'.repeat(600)}"}}`,
    `\`\`\`json\n${' '.repeat(500)}{"version":1,"action":"none"}\n\`\`\``
  ]
  for (const raw of oversized) {
    assert.throws(
      () => parseSystemActionPlan(raw),
      error => error.code === 'invalid-plan-envelope'
    )
  }
})

test('an accepted plan launches the fixed executable with no arguments', async () => {
  const { agent, spawnCalls } = harness({
    text: '{"version":1,"action":"system.openApp","input":{"appName":"calculator"}}'
  })
  const reply = await agent.handle('bring up the calculator app')
  assert.equal(spawnCalls.length, 1, 'expected exactly one launch')
  assert.deepEqual(spawnCalls[0].args, [], 'arguments must never come from the model')
  assert.equal(spawnCalls[0].options.detached, true)
  assert.match(reply.message, /opened/i)
})

test('a rejected plan spawns nothing', async () => {
  const hostile = [
    'Sure, running that for you.',
    '{"version":1,"action":"shell.exec","input":{"command":"whoami"}}',
    '{"version":1,"action":"system.openApp","input":{"appName":"cmd.exe"}}',
    '{"version":1,"action":"system.openApp","input":{"appName":"notepad","args":["C:\\\\secrets.txt"]}}'
  ]
  for (const text of hostile) {
    const { agent, spawnCalls } = harness({ text })
    await agent.handle('bring up the text editor app')
    assert.equal(spawnCalls.length, 0, `a process was spawned for: ${text}`)
  }
})

test('the deterministic path never consults the provider', async () => {
  const { spawnCalls } = harness()
  const registry = new ToolRegistry()
  const spawnProcess = (exe, args, options) => {
    spawnCalls.push({ exe, args, options })
    return { unref() {} }
  }
  for (const definition of systemModule.create({ spawnProcess })) registry.register(definition)
  let consulted = false
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    settings: () => ({}),
    activity: () => {},
    provider: { generate: async () => { consulted = true; return { text: '{"version":1,"action":"none"}' } } }
  })
  await agent.handle('open notepad')
  assert.equal(consulted, false, 'a plain "open notepad" must not need a provider round trip')
  assert.equal(spawnCalls.length, 1)
})

test('the launch hint does not capture explicit tool intent or ordinary questions', async () => {
  // The hint matches these strings, so ordering is what protects them: the
  // planner runs last, below every explicit route. When it ran first, each of
  // these was answered with a launch refusal instead of being routed.
  const swallowed = [
    'search the web for how to run a program on Windows',
    'find online how to start a program in python',
    'how do I run a program?'
  ]
  for (const text of swallowed) {
    assert.equal(looksLikeSystemActionRequest(text), true, `hint no longer matches: ${text}`)
  }

  const { agent, spawnCalls } = harness({ text: '{"version":1,"action":"none"}' })
  const reply = await agent.handle('how do I run a program?')
  assert.equal(spawnCalls.length, 0)
  // Answered as text rather than refused. ask() has no provider result shape
  // here beyond the stub, so assert only that it was not the launch refusal.
  assert.doesNotMatch(reply.message || '', /I can only safely launch/)
})

test('a declined plan falls through to an ordinary answer', async () => {
  const { agent, spawnCalls } = harness({ text: '{"version":1,"action":"none"}' })
  const reply = await agent.handle('bring up the text editor app')
  assert.equal(spawnCalls.length, 0)
  assert.ok(reply.message, 'the request must still be answered')
  assert.notEqual(reply.state, 'error', 'a decline is not an error')
})

test('system.openApp still declares its risk and confirmation policy', () => {
  const { registry } = harness()
  const meta = registry.describe('system.openApp')
  assert.equal(meta.risk, 'safe-write')
  assert.equal(meta.confirmation, 'never')
})
