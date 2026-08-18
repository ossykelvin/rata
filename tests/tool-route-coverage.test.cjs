const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const fsp = require('node:fs/promises')
const path = require('node:path')

const {
  matchToolRoute,
  routableToolIds,
  parseDuration,
  INTENTIONALLY_UNROUTED
} = require('../packages/agent-core/tool-routes.cjs')
const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const { createFileAccess } = require('../electron/file-access.cjs')
const fileModule = require('../electron/tools/file.cjs')

// FIX-016.
//
// A registered tool is not a reachable tool. Nothing between a user's sentence
// and ToolRegistry.execute() comes from the model — the ADR-009 planner
// proposes system.openApp and nothing else — so a tool with no phrase route
// cannot run at all, however thoroughly it is registered and tested.
//
// Five tools shipped that way and were found one at a time by GUI testing:
// weather, voice, file search, file.save, then eleven more at once. With a
// provider connected the failure is silent: the request falls through to ask()
// and the model answers from general knowledge with state 'success'. "How much
// RAM do I have?" returned a confident wrong number, and "keep my PC awake for
// two hours" replied "I have kept your PC awake" while no blocker was held.
//
// This file is the guard. The first test fails when a tool is registered
// without either a route or a stated reason for not having one.

function registeredToolIds() {
  const dir = path.join(__dirname, '..', 'electron', 'tools')
  const ids = []
  for (const file of fs.readdirSync(dir)) {
    if (file === 'index.cjs' || !file.endsWith('.cjs')) continue
    for (const id of require(path.join(dir, file)).toolIds || []) ids.push(id)
  }
  return ids
}

test('every registered tool is reachable, or documented as deliberately not', () => {
  const routable = new Set(routableToolIds())
  const unreachable = registeredToolIds()
    .filter(id => !routable.has(id))
    .filter(id => !Object.prototype.hasOwnProperty.call(INTENTIONALLY_UNROUTED, id))
  assert.deepEqual(
    unreachable,
    [],
    `these tools are registered but no user phrase can reach them, and no reason is recorded:\n  ${unreachable.join('\n  ')}\n` +
    'Add a route to packages/agent-core/tool-routes.cjs, or an entry to INTENTIONALLY_UNROUTED explaining why not.'
  )
})

test('every documented exemption names a tool that still exists', () => {
  const registered = new Set(registeredToolIds())
  for (const id of Object.keys(INTENTIONALLY_UNROUTED)) {
    assert.ok(registered.has(id), `${id} is exempted from routing but is no longer registered`)
  }
})

test('every route points at a tool that exists', () => {
  const registered = new Set(registeredToolIds())
  for (const id of routableToolIds()) {
    assert.ok(registered.has(id), `a route targets ${id}, which is not registered`)
  }
})

// --- the specific requests that were answered by improvisation -------------

test('the requests a model used to improvise now reach a tool', () => {
  const expected = [
    ['how much RAM do I have?', 'system.info'],
    ['what version of Windows is this?', 'system.info'],
    ['how much disk space is free?', 'system.storage'],
    ['keep my PC awake for two hours', 'system.keepAwake.start'],
    ['stop keeping the computer awake', 'system.keepAwake.stop'],
    ['find large files', 'filesystem.scan'],
    ['give me a storage health report', 'filesystem.diskUsage'],
    ['what is using my memory?', 'system.processSummary']
  ]
  for (const [message, toolId] of expected) {
    const routed = matchToolRoute(message)
    assert.ok(routed, `"${message}" reached no tool`)
    assert.equal(routed.toolId, toolId, `"${message}" reached ${routed.toolId}`)
  }
})

test('keep-awake asks for a duration rather than inventing one', () => {
  const routed = matchToolRoute('keep my PC awake')
  assert.ok(routed.reply, 'a bare keep-awake request should ask, not act')
  assert.match(routed.reply.message, /how long/i)
})

test('a duration comes from the user, in words or digits, and is capped', () => {
  assert.equal(parseDuration('for two hours'), 7200)
  assert.equal(parseDuration('for 90 minutes'), 5400)
  assert.equal(parseDuration('for 30 seconds'), 30)
  assert.equal(parseDuration('for an hour'), 3600)
  assert.equal(parseDuration('for ever'), null)
  assert.equal(parseDuration('for 400 hours'), 12 * 60 * 60, 'an unbounded request must be clamped')
})

test('stopping is not mistaken for starting', () => {
  // "stop keeping the computer awake" contains "keep" and "awake".
  assert.equal(matchToolRoute('stop keeping the computer awake').toolId, 'system.keepAwake.stop')
  assert.equal(matchToolRoute('let my computer sleep').toolId, 'system.keepAwake.stop')
  assert.equal(matchToolRoute('keep my laptop awake for one hour').toolId, 'system.keepAwake.start')
})

test('a forbidden scan scope is refused before any approval card exists', () => {
  // filesystem.scan would refuse these itself, but only after the user had been
  // asked to approve a scan that was always going to fail.
  for (const message of ['scan my C drive', 'scan C:\\', 'scan the whole computer', 'scan \\\\server\\share', 'scan Program Files']) {
    const routed = matchToolRoute(message)
    assert.ok(routed?.reply, `"${message}" was not refused outright`)
    assert.equal(routed.reply.state, 'blocked')
    assert.match(routed.reply.message, /Documents, Downloads and Desktop/)
  }
})

test('an allowed scan is not caught by the scope refusal', () => {
  assert.equal(matchToolRoute('scan my Documents').toolId, 'filesystem.scan')
})

test('a local file request never routes to web search', () => {
  // "search my files for invoice" matches the web-search pattern too. Order in
  // the table is what keeps a local request on the machine. FIX-010.
  assert.equal(matchToolRoute('search my files for invoice').toolId, 'file.searchContent')
  assert.equal(matchToolRoute('search the web for invoice templates').toolId, 'web.search')
})

test('a route is skipped when its tool is not registered', () => {
  const routed = matchToolRoute('how much RAM do I have?', { has: id => id !== 'system.info' })
  assert.notEqual(routed?.toolId, 'system.info')
})

// --- the write routes still pass through validation and approval -----------

async function fileHarness() {
  const base = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'rata-routes-')))
  const root = path.join(base, 'Documents')
  await fsp.mkdir(root)
  await fsp.writeFile(path.join(root, 'report.md'), 'body\n')
  const registry = new ToolRegistry()
  for (const definition of fileModule.create({
    fileAccess: createFileAccess({ roots: [root] }),
    revealItem() {}
  })) registry.register(definition)
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    settings: () => ({ fileWriteConfirm: false }),
    activity: () => {}
  })
  return { agent, root }
}

test('a routed folder create actually creates the folder', async () => {
  const { agent, root } = await fileHarness()
  const reply = await agent.handle('create a folder called Archive in Documents')
  assert.equal(reply.state, 'success', reply.message)
  assert.ok(fs.existsSync(path.join(root, 'Archive')), 'no folder was created')
})

test('a routed move actually moves the file', async () => {
  const { agent, root } = await fileHarness()
  await agent.handle('create a folder called Archive in Documents')
  const reply = await agent.handle('move report.md into Archive')
  assert.equal(reply.state, 'success', reply.message)
  assert.equal(fs.existsSync(path.join(root, 'report.md')), false, 'the original is still there')
  assert.ok(fs.existsSync(path.join(root, 'Archive', 'report.md')), 'the file did not arrive')
})

test('a routed rename actually renames the file', async () => {
  const { agent, root } = await fileHarness()
  const reply = await agent.handle('rename report.md to old-report.md')
  assert.equal(reply.state, 'success', reply.message)
  assert.ok(fs.existsSync(path.join(root, 'old-report.md')))
})

test('validation is idempotent, because it runs twice on purpose', async () => {
  // The agent validates to build an approval card, then ToolRegistry.execute()
  // validates again so no caller can skip it. A validateInput that does not
  // accept its own output therefore fails at execute time, after the user has
  // already approved. file.rename took `path` and returned `source`, and no
  // test caught it because the tool had no route and had never run through the
  // agent. This asserts the property for every write tool at once.
  const { agent, root } = await fileHarness()
  const registry = agent.registry
  const cases = [
    ['folder.create', { path: 'Archive' }],
    ['file.move', { source: 'report.md', destination: 'Archive' }],
    ['file.rename', { path: 'report.md', name: 'old-report.md' }],
    ['file.save', { path: 'fresh.md', content: 'hello' }]
  ]
  for (const [id, input] of cases) {
    const once = registry.validate(id, input)
    const twice = registry.validate(id, once)
    assert.deepEqual(twice, once, `${id} does not accept its own validated output`)
  }
  void root
})

test('the boundary still holds through the new write routes', async () => {
  // A route extracts arguments; it never widens what a tool permits.
  const cases = [
    'move report.md into ..\\..\\somewhere',
    'rename report.md to payload.exe',
    'rename report.md to .env',
    'create a folder called ..\\..\\escape'
  ]
  for (const message of cases) {
    const { agent, root } = await fileHarness()
    const before = fs.readdirSync(root).sort()
    const reply = await agent.handle(message)
    assert.equal(reply.state, 'blocked', `${message} was not blocked (${reply.state})`)
    assert.deepEqual(fs.readdirSync(root).sort(), before, `${message} changed the directory`)
  }
})
