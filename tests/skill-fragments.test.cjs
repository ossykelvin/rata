const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { createSkillRegistry, loadSkillFragments } = require('../packages/skills/registry.cjs')
const { validateSkillFragment, validatePackMetadata } = require('../packages/skills/contracts.cjs')

// Lane H regression coverage for P0-3 (issue #24).
//
// The point of splitting the manifest is fault isolation: one bad fragment
// must cost exactly one skill. Every rejection test below therefore asserts
// both halves — the bad fragment is excluded AND the good ones still load.

const PROJECT_ROOT = path.join(__dirname, '..')

/** The shipped pack, pinned. Changing this list is a product decision. */
const SHIPPED_SKILL_IDS = [
  'file-finder', 'local-content-search', 'filesystem-scan', 'app-launcher',
  'keep-awake', 'web-search', 'ai-research', 'calculator', 'trivia',
  'critical-thinking', 'problem-solver', 'presentation-builder',
  'document-assistant', 'clipboard-assistant', 'screenshot-inspector',
  'system-info', 'email-assistant', 'calendar-assistant', 'task-planner',
  'file-organizer'
]

function validFragment(id, order, overrides = {}) {
  return {
    schema_version: 1,
    order,
    id,
    name: `Skill ${id}`,
    path: `skills/${id}/SKILL.md`,
    category: 'utility',
    risk: 'read-only',
    background_capable: false,
    permissions: ['utility.calculate'],
    tools: ['calculator.evaluate'],
    confirmation: 'none',
    triggers: ['do the thing'],
    ...overrides
  }
}

/** Builds a throwaway skills tree so tests never touch the real one. */
function sandbox({ fragments = {}, pack = { schema_version: 1, pack: 'test', version: '1.0.0', description: 'test' }, omitPrompt = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rata-skills-'))
  const skillsDir = path.join(root, 'skills')
  fs.mkdirSync(skillsDir)
  if (pack !== null) {
    fs.writeFileSync(path.join(skillsDir, 'pack.json'), typeof pack === 'string' ? pack : JSON.stringify(pack))
  }
  for (const [id, body] of Object.entries(fragments)) {
    const dir = path.join(skillsDir, id)
    fs.mkdirSync(dir, { recursive: true })
    if (body !== undefined) {
      fs.writeFileSync(path.join(dir, 'skill.json'), typeof body === 'string' ? body : JSON.stringify(body))
    }
    if (!omitPrompt.includes(id)) {
      fs.writeFileSync(path.join(dir, 'SKILL.md'), '## System prompt\n\n```text\nbe useful\n```\n')
    }
  }
  return root
}

/** Two healthy fragments plus whatever the test is probing. */
function withHealthyNeighbours(extra = {}, options = {}) {
  return sandbox({ fragments: { alpha: validFragment('alpha', 0), zulu: validFragment('zulu', 9), ...extra }, ...options })
}

const loadedIds = root => loadSkillFragments(root).skills.map(skill => skill.id)

// --- shipped pack is unchanged -----------------------------------------

test('all 20 shipped skill ids load with routing order preserved', () => {
  const result = loadSkillFragments(PROJECT_ROOT)
  assert.deepEqual(result.errors, [], 'the shipped pack reported load errors')
  assert.deepEqual(result.skills.map(skill => skill.id), SHIPPED_SKILL_IDS)
  assert.deepEqual(result.skills.map(skill => skill.order), [...Array(20).keys()])
})

test('shipped public metadata is unchanged', () => {
  const registry = createSkillRegistry({ rootDir: PROJECT_ROOT })
  assert.equal(registry.loaded, true)
  assert.equal(registry.count(), 20)
  assert.equal(registry.loadError, null)

  const calculator = registry.list().find(skill => skill.id === 'calculator')
  assert.equal(calculator.name, 'Calculator')
  assert.equal(calculator.category, 'utility')
  assert.equal(calculator.risk, 'none')
  assert.equal(calculator.backgroundCapable, false)
  assert.deepEqual(calculator.tools, ['calculator.evaluate'])
  assert.deepEqual(calculator.permissions, ['utility.calculate'])
})

test('discovery is deterministic across repeated loads', () => {
  const runs = [1, 2, 3].map(() => loadSkillFragments(PROJECT_ROOT).skills.map(skill => skill.id))
  assert.deepEqual(runs[0], runs[1])
  assert.deepEqual(runs[1], runs[2])
})

// --- fault isolation ----------------------------------------------------

test('malformed JSON excludes only its own fragment', () => {
  const root = withHealthyNeighbours({ broken: '{ this is not json' })
  const result = loadSkillFragments(root)
  assert.deepEqual(result.skills.map(skill => skill.id), ['alpha', 'zulu'])
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], /broken/)
})

test('each schema violation rejects exactly one fragment', () => {
  const cases = {
    'bad-schema': validFragment('bad-schema', 1, { schema_version: 2 }),
    'negative-order': validFragment('negative-order', 1, { order: -1 }),
    'missing-order': (() => { const f = validFragment('missing-order', 1); delete f.order; return f })(),
    'bad-risk': validFragment('bad-risk', 1, { risk: 'omnipotent' }),
    'no-tools': validFragment('no-tools', 1, { tools: [] }),
    'bad-tool-id': validFragment('bad-tool-id', 1, { tools: ['not-namespaced'] }),
    'no-name': validFragment('no-name', 1, { name: '   ' }),
    'not-an-object': 'null'
  }

  for (const [id, fragment] of Object.entries(cases)) {
    const root = withHealthyNeighbours({ [id]: fragment })
    const result = loadSkillFragments(root)
    assert.deepEqual(result.skills.map(s => s.id), ['alpha', 'zulu'], `${id} was not excluded`)
    assert.equal(result.errors.length, 1, `${id} produced unexpected error count`)
  }
})

test('a fragment whose id does not match its directory is rejected', () => {
  const root = withHealthyNeighbours({ mismatch: validFragment('somethingelse', 1, { path: 'skills/somethingelse/SKILL.md' }) })
  const result = loadSkillFragments(root)
  assert.deepEqual(result.skills.map(s => s.id), ['alpha', 'zulu'])
  assert.match(result.errors.join(' '), /match its directory|path must match/)
})

test('path escape attempts are rejected', () => {
  const escapes = [
    '../../../etc/passwd',
    'skills/../../../etc/SKILL.md',
    'skills/evil/../../SKILL.md',
    '/etc/SKILL.md',
    'C:\\Windows\\SKILL.md',
    'skills/other/SKILL.md'
  ]
  for (const badPath of escapes) {
    assert.throws(
      () => validateSkillFragment(validFragment('escape', 1, { path: badPath }), 'escape'),
      /path/,
      `path was not rejected: ${badPath}`
    )
  }
})

test('a fragment whose SKILL.md is missing is rejected', () => {
  const root = withHealthyNeighbours({ noprompt: validFragment('noprompt', 1) }, { omitPrompt: ['noprompt'] })
  const result = loadSkillFragments(root)
  assert.deepEqual(result.skills.map(s => s.id), ['alpha', 'zulu'])
  assert.match(result.errors.join(' '), /Skill file missing/)
})

test('a directory with no skill.json is reported, not silently skipped', () => {
  const root = withHealthyNeighbours({ empty: undefined })
  const result = loadSkillFragments(root)
  assert.deepEqual(result.skills.map(s => s.id), ['alpha', 'zulu'])
  assert.match(result.errors.join(' '), /fragment is missing/i)
})

test('duplicate identity cannot be smuggled in', () => {
  // The directory name is the identity, so a fragment claiming another id is
  // rejected before it can shadow a real skill.
  assert.throws(
    () => validateSkillFragment(validFragment('calculator', 1, { path: 'skills/calculator/SKILL.md' }), 'impostor'),
    /match its directory/
  )
})

// --- pack metadata grants nothing ---------------------------------------

test('a missing or invalid pack.json does not disable valid skills', () => {
  for (const pack of [null, '{ broken', { schema_version: 99 }, { schema_version: 1 }]) {
    const root = withHealthyNeighbours({}, { pack })
    const result = loadSkillFragments(root)
    assert.deepEqual(result.skills.map(s => s.id), ['alpha', 'zulu'], 'valid skills were lost to a bad pack.json')
    assert.ok(result.errors.length >= 1, 'a bad pack.json was not reported')
  }
})

test('pack metadata carries no authority', () => {
  const pack = validatePackMetadata({ schema_version: 1, pack: 'p', version: '1', description: 'd' })
  assert.deepEqual(Object.keys(pack).sort(), ['description', 'pack', 'version'])
  for (const key of ['permissions', 'tools', 'risk', 'confirmation', 'grants']) {
    assert.equal(key in pack, false, `pack metadata exposed ${key}`)
  }
})

// --- empty pack ---------------------------------------------------------

test('zero valid fragments reports loaded=false', () => {
  const root = sandbox({ fragments: { broken: '{' } })
  const registry = createSkillRegistry({ rootDir: root })
  assert.equal(registry.loaded, false)
  assert.equal(registry.count(), 0)
  assert.ok(registry.loadError)
  assert.deepEqual(registry.list(), [])
})

// --- legacy loader is compatibility-only --------------------------------

test('the fragment loader is used when a skills directory exists', () => {
  const registry = createSkillRegistry({ rootDir: PROJECT_ROOT })
  assert.equal(registry.count(), 20)
  assert.equal(fs.existsSync(path.join(PROJECT_ROOT, 'skills.manifest.json')), false, 'the legacy root manifest is still present')
})

test('the legacy aggregate loads only when explicitly requested', () => {
  const root = sandbox({ fragments: { alpha: validFragment('alpha', 0) } })
  fs.writeFileSync(path.join(root, 'legacy.json'), JSON.stringify({
    schema_version: 1,
    pack: 'legacy',
    version: '1',
    description: 'legacy',
    skills: [validFragment('alpha', 0)]
  }))

  // Not requested: fragments win even though a legacy file exists.
  assert.equal(createSkillRegistry({ rootDir: root }).count(), 1)
  // Explicitly requested: the legacy path is taken.
  const legacy = createSkillRegistry({ rootDir: root, manifestPath: 'legacy.json' })
  assert.equal(legacy.count(), 1)
  assert.equal(legacy.loaded, true)
})

// --- packaging ----------------------------------------------------------

test('the packaged file list no longer ships a root manifest', () => {
  const files = require('../package.json').build.files
  assert.equal(files.some(entry => entry.includes('skills.manifest.json')), false)
  assert.ok(files.includes('skills/**/*'), 'skill fragments are not packaged')
})

// --- skills remain declarative data -------------------------------------

test('permissions are requirements, never grants', () => {
  const registry = createSkillRegistry({ rootDir: PROJECT_ROOT, toolRegistry: { has: () => false } })
  const emailAssistant = registry.list().find(skill => skill.id === 'email-assistant')

  // It declares mail permissions and external-write risk...
  assert.ok(emailAssistant.permissions.some(permission => permission.startsWith('mail.')))
  assert.equal(emailAssistant.risk, 'external-write')
  // ...but with no tool registered it is unavailable. Declaring a permission
  // grants nothing; only a registered tool can act.
  assert.deepEqual(emailAssistant.availableTools, [])
  assert.equal(emailAssistant.status, 'unavailable')
})

test('a skill cannot conjure a tool that is not registered', () => {
  const registered = new Set(['calculator.evaluate'])
  const registry = createSkillRegistry({ rootDir: PROJECT_ROOT, toolRegistry: { has: id => registered.has(id) } })
  for (const skill of registry.list()) {
    for (const tool of skill.availableTools) {
      assert.ok(registered.has(tool), `${skill.id} reported an unregistered tool as available: ${tool}`)
    }
  }
})

test('public skill data exposes no executable surface', () => {
  const registry = createSkillRegistry({ rootDir: PROJECT_ROOT })
  for (const skill of registry.list()) {
    for (const [key, value] of Object.entries(skill)) {
      assert.notEqual(typeof value, 'function', `${skill.id}.${key} is a function`)
    }
  }
  // And the raw definition is frozen, so a consumer cannot mutate a risk class.
  const raw = registry.get('email-assistant')
  assert.equal(Object.isFrozen(raw), true)
})
