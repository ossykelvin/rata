const test = require('node:test')
const assert = require('node:assert/strict')
const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const { createMvpRegistry } = require('../electron/tools/index.cjs')
const { createSkillRegistry } = require('../packages/skills/registry.cjs')
const screenModule = require('../electron/tools/screen.cjs')
const {
  createScreenCapture,
  MAX_BYTES
} = require('../electron/screen-capture.cjs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const FIXTURE_MARK = 'RATA-VISION-FIXTURE-BYTES-DO-NOT-LEAK'

function fixturePng({ extraBytes = 0 } = {}) {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(FIXTURE_MARK),
    Buffer.alloc(extraBytes, 0x41)
  ])
}

function source({ id = 'screen:0:0', displayId = '1', width = 64, height = 48, extraBytes = 0 } = {}) {
  return { id, displayId, width, height, png: fixturePng({ width, height, extraBytes }) }
}

function harness({
  enabled = true,
  sources = [source()],
  ownWindowSourceIds = () => [],
  now = () => Date.now(),
  ttlMs,
  visionGenerate,
  resizePng
} = {}) {
  const calls = []
  const capture = createScreenCapture({
    getSources: async options => {
      calls.push(options)
      return sources
    },
    getPrimaryDisplayId: () => '1',
    ownWindowSourceIds,
    now,
    ttlMs,
    resizePng
  })
  const registry = new ToolRegistry()
  for (const tool of screenModule.create({
    screenCapture: capture,
    screenCaptureEnabled: () => enabled,
    visionGenerate
  })) {
    registry.register(tool)
  }
  const events = []
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    settings: () => ({ screenCaptureEnabled: enabled }),
    activity: (...args) => events.push(args)
  })
  return { registry, capture, agent, events, calls }
}

function serialized(value) {
  return JSON.stringify(value)
}

test('screenCaptureEnabled false refuses capture and never calls the capturer', async () => {
  const { registry, calls, agent } = harness({ enabled: false })
  assert.throws(() => registry.validate('screen.capture', {}), /disabled/)
  const reply = await agent.runTool('screen.capture', {}, 'Capture the primary display')
  assert.equal(reply.state, 'blocked')
  assert.equal(calls.length, 0)
})

test('screenCaptureEnabled false refuses vision.analyze before a provider is called', () => {
  let visionCalls = 0
  const { registry } = harness({
    enabled: false,
    visionGenerate: async () => {
      visionCalls += 1
      return { text: 'should not run' }
    }
  })
  assert.throws(() => registry.validate('vision.analyze', {
    handle: '11111111-1111-4111-8111-111111111111',
    question: 'what is this?'
  }), /disabled/)
  assert.equal(visionCalls, 0)
})

test('confirmation is always for both tools and settings cannot turn it off', () => {
  const { registry } = harness()
  const policy = new PolicyEngine()
  for (const id of ['screen.capture', 'vision.analyze']) {
    const tool = registry.describe(id)
    assert.equal(tool.confirmation, 'always', id)
    assert.equal(tool.confirmationSetting, undefined, id)
    assert.equal(policy.evaluate(tool, {}, { screenCaptureEnabled: true }).decision, 'confirm', id)
    assert.equal(policy.evaluate(tool, {}, { screenCaptureEnabled: false }).decision, 'confirm', id)
    assert.equal(policy.evaluate(tool, {}, {}).decision, 'confirm', id)
  }
})

test('an oversized image is refused rather than truncated', async () => {
  const { registry, calls } = harness({
    sources: [source({ extraBytes: MAX_BYTES + 100 })]
  })
  const pending = await registry.validate('screen.capture', {})
  assert.deepEqual(pending, {})
  await assert.rejects(() => registry.execute('screen.capture', {}), /too large/)
  assert.equal(calls.length, 1)
})

test('capture returns dimensions and a handle, never image bytes', async () => {
  const { registry, agent } = harness()
  const first = await agent.runTool('screen.capture', {}, 'Capture the primary display')
  assert.equal(first.state, 'awaiting_approval')
  const result = await agent.approve(first.approval.id)
  assert.equal(result.state, 'success')
  const executed = await registry.execute('screen.capture', {})
  assert.equal(typeof executed.handle, 'string')
  assert.equal(executed.width, 64)
  assert.equal(executed.height, 48)
  assert.equal(typeof executed.byteCount, 'number')
  const packed = serialized(executed)
  assert.equal(packed.includes(FIXTURE_MARK), false)
  assert.equal(packed.includes('data:image'), false)
  assert.equal(executed.png, undefined)
  assert.equal(executed.data, undefined)
  assert.equal(executed.image, undefined)
})

test("Rata's own windows are excluded from the source list", async () => {
  const { capture } = harness({
    sources: [
      source({ id: 'window:rata:0', displayId: '1' }),
      source({ id: 'screen:0:0', displayId: '1' })
    ],
    ownWindowSourceIds: () => ['window:rata:0']
  })
  const filtered = capture.filterSources([
    source({ id: 'window:rata:0' }),
    source({ id: 'screen:0:0' })
  ])
  assert.deepEqual(filtered.map(item => item.id), ['screen:0:0'])
  const result = await capture.capturePrimary()
  assert.equal(typeof result.handle, 'string')
})

test('a source list that is only Rata windows fails closed', async () => {
  const { capture } = harness({
    sources: [source({ id: 'window:rata:0' })],
    ownWindowSourceIds: () => ['window:rata:0']
  })
  await assert.rejects(() => capture.capturePrimary(), /could not be captured/)
})

test('audit output never contains the fixture byte pattern', async () => {
  const { agent, events } = harness()
  const first = await agent.runTool('screen.capture', {}, 'Capture the primary display')
  await agent.approve(first.approval.id)
  const packed = serialized(events)
  assert.equal(packed.includes(FIXTURE_MARK), false)
  assert.equal(packed.includes('data:image'), false)
  assert.match(serialized(events.find(event => event[0] === 'Tool completed')), /64×48/)
})

test('screenshot-inspector reports ready against a composed registry', () => {
  const tools = createMvpRegistry({
    spawnProcess: () => ({ unref() {} }),
    clipboardApi: { writeText() {} }
  })
  const skills = createSkillRegistry({ rootDir: ROOT, toolRegistry: tools })
  const inspector = skills.list().find(skill => skill.id === 'screenshot-inspector')
  assert.ok(inspector, 'screenshot-inspector skill is missing')
  assert.equal(inspector.status, 'ready')
  assert.deepEqual(inspector.missingTools, [])
  assert.deepEqual(inspector.availableTools.slice().sort(), ['screen.capture', 'vision.analyze'])
})
