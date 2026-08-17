const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createSkillRegistry, createSkillLoader, createSkillRouter } = require('../packages/skills/index.cjs')
const { validateManifest } = require('../packages/skills/contracts.cjs')
const { createMvpRegistry } = require('../electron/mvp-tools.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')

const ROOT = path.join(__dirname, '..')

test('skill manifest loads and stays inside the skills directory', () => {
  const registry = createSkillRegistry({ rootDir: ROOT })
  assert.equal(registry.loaded, true)
  assert.equal(registry.loadError, null)
  assert.ok(registry.get('calculator'))
  assert.ok(registry.list().length >= 10)
})

test('malformed skill path is rejected before any file is read', () => {
  assert.throws(() => validateManifest({
    schema_version: 1,
    skills: [{
      id: 'evil',
      name: 'Evil',
      path: 'skills/../../../windows/system32/config',
      category: 'desktop',
      risk: 'read-only',
      background_capable: false,
      confirmation: 'none',
      permissions: ['file.read'],
      tools: ['file.readText'],
      triggers: ['hack']
    }]
  }), /path must stay/)
})

test('invalid pack fails closed instead of loading a partial registry', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rata-skills-'))
  fs.writeFileSync(path.join(dir, 'skills.manifest.json'), '{"schema_version":1,"skills":[]}', 'utf8')
  const registry = createSkillRegistry({ rootDir: dir })
  assert.equal(registry.loaded, false)
  assert.match(registry.loadError, /at least one skill/)
  assert.equal(registry.list().length, 0)
})

test('skill loader extracts the prompt text and never evaluates it', () => {
  const registry = createSkillRegistry({ rootDir: ROOT })
  const loader = createSkillLoader({ registry })
  const prompt = loader.loadPrompt('calculator')
  assert.match(prompt, /Calculator skill/)
  assert.doesNotMatch(prompt, /```/)
})

test('router prefers calculator for arithmetic and does not invent tools', () => {
  const tools = createMvpRegistry({ spawnProcess: () => ({ unref() {} }), clipboardApi: { writeText() {} } })
  const registry = createSkillRegistry({ rootDir: ROOT, toolRegistry: tools })
  const router = createSkillRouter({ registry, toolRegistry: tools })
  const routed = router.route('what is 36 * 14?')
  assert.deepEqual(routed.selectedSkillIds, ['calculator'])
  assert.deepEqual(routed.availableTools, ['calculator.evaluate'])
  assert.deepEqual(routed.missingTools, [])
})

test('mock agent executes calculator through policy and reports missing skill tools honestly', async () => {
  const tools = createMvpRegistry({ spawnProcess: () => ({ unref() {} }), clipboardApi: { writeText() {} } })
  const registry = createSkillRegistry({ rootDir: ROOT, toolRegistry: tools })
  const router = createSkillRouter({ registry, toolRegistry: tools })
  const events = []
  const agent = new MockAgent({
    registry: tools,
    policy: new PolicyEngine(),
    settings: () => ({ clipboardConfirm: true }),
    activity: (...args) => events.push(args),
    skills: { registry, router }
  })

  const calc = await agent.handle('what is 36 * 14?')
  assert.equal(calc.state, 'success')
  assert.match(calc.message, /504/)

  // This used to ask about scanning a drive, because `filesystem-scan` was the
  // nearest skill with no registered tools. RATA-SKILL-007 registered all three
  // of its tools, so the honest-refusal path needs a skill that is still
  // blocked: `screenshot-inspector` needs screen capture and vision, which are
  // a different lane entirely.
  const missing = await agent.handle('what is on my screen?')
  assert.match(missing.message, /not registered yet/i)
  assert.match(missing.message, /screen\.capture/)
  assert.equal(events.some(event => event[0] === 'Skill selected'), true)

  // And the skill that moved must really have moved, or the change above would
  // just be hiding a regression.
  assert.equal(registry.summarize(registry.get('filesystem-scan')).status, 'ready')
  assert.deepEqual(registry.summarize(registry.get('filesystem-scan')).missingTools, [])
})
