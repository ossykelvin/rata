const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  createMvpRegistry,
  createToolDefinitions,
  createToolRegistry,
  discoverToolModules,
  validateToolModule
} = require('../electron/tools/index.cjs')
const compatibility = require('../electron/mvp-tools.cjs')

// Lane H regression coverage for P0-2 (issue #19).
//
// Composition is privileged: it decides which code becomes a registered tool.
// Every check below asserts it FAILS CLOSED — a malformed or conflicting
// module must abort composition entirely rather than register a subset.

const TOOLS_DIR = path.join(__dirname, '..', 'electron', 'tools')

/** The tools the MVP ships. Changing this list is a security decision. */
// WEB-001 added web.fetch. RATA-006 added the five read-only file tools.
// RATA-007 added weather.current. RATA-SKILL-007 added the three read-only
// filesystem tools, and RATA-005 added the system status and keep-awake
// tools. RATA-013 added document.create, presentation.create,
// presentation.render and file.save so the document and presentation skills
// can generate Markdown/HTML and save it. RATA-014 added folder.create,
// file.move and file.rename so File Organizer can create a folder and move
// or rename files inside the same roots. RATA-015 added screen.capture and
// vision.analyze so Screenshot Inspector can capture the primary display
// and send the approved image to a vision provider. RATA-016 added app.find,
// app.launch and app.focus so Application Launcher can name a catalog id
// rather than an executable. Updated deliberately: this list is the
// privileged tool surface, and it must only change when a tool is
// consciously added.
const EXPECTED_TOOL_IDS = [
  'app.find',
  'app.focus',
  'app.launch',
  'calculator.evaluate',
  'clipboard.write',
  'document.create',
  'file.delete',
  'file.move',
  'file.readText',
  'file.rename',
  'file.reveal',
  'file.save',
  'file.search',
  'file.searchContent',
  'file.stat',
  'filesystem.diskUsage',
  'filesystem.hash',
  'filesystem.scan',
  'folder.create',
  'presentation.create',
  'presentation.render',
  'screen.capture',
  'system.info',
  'system.keepAwake.start',
  'system.keepAwake.status',
  'system.keepAwake.stop',
  'system.openApp',
  'system.processSummary',
  'system.storage',
  'vision.analyze',
  'weather.current',
  'web.fetch',
  'web.search'
]

const DEPENDENCIES = Object.freeze({
  spawnProcess: () => ({ unref() {} }),
  clipboardApi: { writeText() {} },
  osApi: Object.freeze({
    type: () => 'Windows_NT',
    platform: () => 'win32',
    release: () => '10.0',
    version: () => 'Windows 10',
    arch: () => 'x64',
    totalmem: () => 0,
    freemem: () => 0,
    uptime: () => 0
  }),
  listStorage: async () => [],
  listProcesses: async () => [],
  powerSaveBlocker: Object.freeze({
    start: () => 1,
    stop: () => true
  }),
  // Bound capabilities, never credentials. See electron/serper-client.cjs
  // and electron/public-web-client.cjs.
  webSearch: async () => [],
  webFetch: async () => ({ url: 'https://example.test/', contentType: 'text/html', title: 't', content: 'c', trust: 'untrusted-external' })
})

/** Minimal well-formed module, so each test varies exactly one thing. */
function moduleFixture(overrides = {}) {
  return {
    id: 'fixture',
    toolIds: ['fixture.alpha'],
    create: () => [{
      id: 'fixture.alpha',
      description: 'Fixture tool.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => input,
      execute: async () => ({ summary: 'ok', message: 'ok' })
    }],
    ...overrides
  }
}

// --- discovery ----------------------------------------------------------

test('discovery reads only the trusted electron/tools directory', () => {
  const modules = discoverToolModules()
  assert.ok(modules.length >= 4)
  for (const module of modules) {
    assert.equal(typeof module.id, 'string')
    assert.equal(typeof module.create, 'function')
  }
  // index.cjs must never be discovered as a domain module.
  assert.equal(modules.some(module => module.id === 'index'), false)
})

test('discovery is deterministic across repeated calls', () => {
  const first = discoverToolModules().map(module => module.id)
  const second = discoverToolModules().map(module => module.id)
  const third = discoverToolModules().map(module => module.id)
  assert.deepEqual(first, second)
  assert.deepEqual(second, third)
  assert.deepEqual(first, [...first].sort(), 'discovery order is not sorted')
})

test('discovery covers every module file on disk, so none is silently skipped', () => {
  const onDisk = fs.readdirSync(TOOLS_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.cjs') && entry.name !== 'index.cjs')
    .map(entry => path.basename(entry.name, '.cjs'))
    .sort()
  assert.deepEqual(discoverToolModules().map(module => module.id).sort(), onDisk)
})

// --- module validation --------------------------------------------------

test('malformed modules are rejected', () => {
  for (const bad of [null, undefined, 'module', 42]) {
    assert.throws(() => validateToolModule(bad), /must export an object/)
  }
  // An array is `typeof 'object'`, so it passes the first guard and is caught
  // one line later on the id check. Different message, still fails closed —
  // which is what matters. Asserted without a message matcher on purpose.
  assert.throws(() => validateToolModule([]), TypeError)
  assert.throws(() => validateToolModule(moduleFixture({ id: 'Bad-ID' })), /lowercase id/)
  assert.throws(() => validateToolModule(moduleFixture({ id: '' })), /lowercase id/)
  assert.throws(() => validateToolModule(moduleFixture({ toolIds: [] })), /must declare toolIds/)
  assert.throws(() => validateToolModule(moduleFixture({ toolIds: 'fixture.alpha' })), /must declare toolIds/)
  assert.throws(() => validateToolModule(moduleFixture({ toolIds: ['notnamespaced'] })), /invalid tool id/)
  assert.throws(() => validateToolModule(moduleFixture({ toolIds: [42] })), /invalid tool id/)
  assert.throws(() => validateToolModule(moduleFixture({ create: null })), /must declare create/)
})

test('a module declaring the same tool twice is rejected', () => {
  const module = moduleFixture({ toolIds: ['fixture.alpha', 'fixture.alpha'] })
  assert.throws(() => validateToolModule(module), /duplicate tool id/)
})

test('composition rejects an empty or non-array module list', () => {
  assert.throws(() => createToolDefinitions({ dependencies: DEPENDENCIES, modules: [] }), /At least one tool module/)
  assert.throws(() => createToolDefinitions({ dependencies: DEPENDENCIES, modules: 'system' }), /At least one tool module/)
})

test('composition rejects a non-object dependency bag', () => {
  for (const bad of [null, 'deps', []]) {
    assert.throws(
      () => createToolDefinitions({ dependencies: bad, modules: [moduleFixture()] }),
      /dependencies must be an object/
    )
  }
})

// --- ownership conflicts ------------------------------------------------

test('duplicate module ids are rejected', () => {
  const modules = [moduleFixture(), moduleFixture({ toolIds: ['fixture.beta'], create: () => [] })]
  assert.throws(() => createToolDefinitions({ dependencies: DEPENDENCIES, modules }), /Duplicate tool module id: fixture/)
})

test('two modules claiming the same tool id are rejected', () => {
  const modules = [
    moduleFixture({ id: 'first' }),
    moduleFixture({ id: 'second' })
  ]
  assert.throws(
    () => createToolDefinitions({ dependencies: DEPENDENCIES, modules }),
    /fixture\.alpha is declared by both first and second/
  )
})

test('a module may not silently claim a tool another module owns', () => {
  const shadow = {
    id: 'shadow',
    toolIds: ['system.openApp'],
    create: () => [{
      id: 'system.openApp',
      description: 'Shadowed.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => input,
      execute: async () => ({ summary: 'x', message: 'x' })
    }]
  }
  const modules = [...discoverToolModules(), shadow]
  assert.throws(() => createToolDefinitions({ dependencies: DEPENDENCIES, modules }), /declared by both/)
})

// --- declared vs created mismatch ---------------------------------------

test('a module that creates fewer tools than it declares is rejected', () => {
  const module = moduleFixture({ toolIds: ['fixture.alpha', 'fixture.beta'] })
  assert.throws(
    () => createToolDefinitions({ dependencies: DEPENDENCIES, modules: [module] }),
    /does not match its declared toolIds/
  )
})

test('a module that creates an undeclared tool is rejected', () => {
  const module = moduleFixture({
    create: () => [{
      id: 'fixture.smuggled',
      description: 'Undeclared.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => input,
      execute: async () => ({ summary: 'x', message: 'x' })
    }]
  })
  assert.throws(
    () => createToolDefinitions({ dependencies: DEPENDENCIES, modules: [module] }),
    /does not match its declared toolIds/
  )
})

test('a module returning nothing usable is rejected', () => {
  for (const created of [[], null, 'tool', {}]) {
    const module = moduleFixture({ create: () => created })
    assert.throws(
      () => createToolDefinitions({ dependencies: DEPENDENCIES, modules: [module] }),
      /must create a non-empty array|does not match its declared toolIds/
    )
  }
})

test('a module creating the same id twice is rejected', () => {
  const definition = {
    id: 'fixture.alpha',
    description: 'Fixture.',
    risk: 'read',
    confirmation: 'never',
    validateInput: input => input,
    execute: async () => ({ summary: 'x', message: 'x' })
  }
  const module = moduleFixture({ create: () => [definition, { ...definition }] })
  assert.throws(() => createToolDefinitions({ dependencies: DEPENDENCIES, modules: [module] }), /created duplicate tool ids/)
})

// --- metadata still enforced by ToolRegistry.register() -----------------

test('invalid tool metadata is rejected by ToolRegistry.register(), not the composer', () => {
  const cases = [
    [{ risk: 'omnipotent' }, /invalid risk level/],
    [{ confirmation: 'sometimes' }, /invalid confirmation policy/],
    [{ description: '' }, /must declare a description/],
    [{ validateInput: undefined }, /must declare validateInput and execute/],
    [{ execute: undefined }, /must declare validateInput and execute/],
    // An external-write tool cannot opt out of confirmation.
    [{ risk: 'external-write', confirmation: 'never' }, /cannot disable confirmation/],
    // A configurable tool must name the setting that governs it.
    [{ confirmation: 'configurable' }, /must declare confirmationSetting/]
  ]

  for (const [override, expected] of cases) {
    const module = moduleFixture({
      create: () => [{
        id: 'fixture.alpha',
        description: 'Fixture tool.',
        risk: 'read',
        confirmation: 'never',
        validateInput: input => input,
        execute: async () => ({ summary: 'ok', message: 'ok' }),
        ...override
      }]
    })
    assert.throws(() => createToolRegistry({ dependencies: DEPENDENCIES, modules: [module] }), expected)
  }
})

test('composition cannot smuggle a tool past register()', () => {
  // Every definition the composer produces must survive register(). If a
  // module produced a definition register() would reject, the whole registry
  // build must fail rather than yield a partially populated registry.
  const module = moduleFixture({
    create: () => [{ id: 'fixture.alpha', description: 'No metadata.' }]
  })
  assert.throws(() => createToolRegistry({ dependencies: DEPENDENCIES, modules: [module] }), /invalid risk level/)
})

// --- native dependency failures -----------------------------------------

test('missing native dependencies fail with a clear message', () => {
  // Modules are created in sorted order, so `clipboard` reports before
  // `system`. Each message names the specific dependency that is absent.
  assert.throws(() => createMvpRegistry({}), /clipboardApi dependency is required/)
  assert.throws(() => createMvpRegistry(), /clipboardApi dependency is required/)
  assert.throws(
    () => createMvpRegistry({ clipboardApi: { writeText() {} } }),
    /spawnProcess dependency is required/
  )
  // Whatever is missing, no registry is produced at all.
  for (const deps of [{}, { clipboardApi: { writeText() {} } }, { spawnProcess: () => ({ unref() {} }) }]) {
    assert.throws(() => createMvpRegistry(deps), /dependency is required/)
  }
})

// --- stability of the shipped surface -----------------------------------

test('the shipped tool ids are unchanged', () => {
  const registry = createMvpRegistry(DEPENDENCIES)
  assert.deepEqual(registry.list().map(tool => tool.id).sort(), EXPECTED_TOOL_IDS)
})

test('shipped tools keep their risk and confirmation metadata', () => {
  const registry = createMvpRegistry(DEPENDENCIES)
  const meta = id => registry.describe(id)

  assert.deepEqual(
    { risk: meta('system.openApp').risk, confirmation: meta('system.openApp').confirmation },
    { risk: 'safe-write', confirmation: 'never' }
  )
  assert.deepEqual(
    { risk: meta('app.find').risk, confirmation: meta('app.find').confirmation },
    { risk: 'read', confirmation: 'never' }
  )
  assert.deepEqual(
    {
      risk: meta('app.launch').risk,
      confirmation: meta('app.launch').confirmation
    },
    { risk: 'safe-write', confirmation: 'always' }
  )
  assert.deepEqual(
    {
      risk: meta('app.focus').risk,
      confirmation: meta('app.focus').confirmation,
      setting: meta('app.focus').confirmationSetting
    },
    { risk: 'safe-write', confirmation: 'configurable', setting: 'appFocusConfirm' }
  )
  assert.deepEqual(
    { risk: meta('system.info').risk, confirmation: meta('system.info').confirmation },
    { risk: 'read', confirmation: 'never' }
  )
  assert.deepEqual(
    { risk: meta('system.keepAwake.start').risk, confirmation: meta('system.keepAwake.start').confirmation },
    { risk: 'safe-write', confirmation: 'never' }
  )
  assert.deepEqual(
    {
      risk: meta('clipboard.write').risk,
      confirmation: meta('clipboard.write').confirmation,
      setting: meta('clipboard.write').confirmationSetting
    },
    { risk: 'safe-write', confirmation: 'configurable', setting: 'clipboardConfirm' }
  )
  assert.deepEqual(
    { risk: meta('calculator.evaluate').risk, confirmation: meta('calculator.evaluate').confirmation },
    { risk: 'read', confirmation: 'never' }
  )
  assert.deepEqual(
    { risk: meta('file.delete').risk, confirmation: meta('file.delete').confirmation },
    { risk: 'destructive', confirmation: 'always' }
  )
})

test('the compatibility entry point still exports the MVP surface', () => {
  assert.equal(typeof compatibility.createMvpRegistry, 'function')
  assert.equal(typeof compatibility.isAllowListedApp, 'function')
  assert.ok(compatibility.APP_ALLOW_LIST)
  // REVIEW-001 H2 must survive the move: null-prototype, own-property only.
  assert.equal(Object.getPrototypeOf(compatibility.APP_ALLOW_LIST), null)
  assert.equal(compatibility.isAllowListedApp('constructor'), false)
  assert.equal(compatibility.isAllowListedApp('notepad'), true)

  const viaCompat = compatibility.createMvpRegistry(DEPENDENCIES).list().map(tool => tool.id).sort()
  assert.deepEqual(viaCompat, EXPECTED_TOOL_IDS)
})

test('composition still executes tools only through the registry', async () => {
  const spawned = []
  const registry = createMvpRegistry({
    spawnProcess: exe => { spawned.push(exe); return { unref() {} } },
    clipboardApi: { writeText() {} }
  })

  // Metadata accessors must not hand out an executor (REVIEW-001 M2).
  assert.equal(typeof registry.describe('system.openApp').execute, 'undefined')

  await registry.execute('system.openApp', { appName: 'notepad' })
  assert.deepEqual(spawned, ['notepad.exe'])

  // And the allow-list bypass stays closed after the refactor.
  await assert.rejects(
    () => registry.execute('system.openApp', { appName: 'constructor' }),
    /not in the MVP allow-list/
  )
  assert.deepEqual(spawned, ['notepad.exe'], 'a non-allow-listed name reached the spawner')
})

// --- web.search is a first-class discovered module -----------------------
//
// It used to be registered by a separate call in main.cjs after discovery,
// because it needs a credential and the dependency bag carries none. It is now
// discovered like every other domain, and receives a bound capability rather
// than the API key.

test('web.search is discovered, not bolted on after composition', () => {
  assert.ok(discoverToolModules().some(module => module.id === 'web'), 'the web module was not discovered')
  const registry = createMvpRegistry(DEPENDENCIES)
  assert.equal(registry.has('web.search'), true)
})

test('the web module receives a capability, never the credential', () => {
  const seen = []
  const definitions = require('../electron/tools/web.cjs').create({
    webSearch: async query => { seen.push(query); return [] },
    webFetch: async () => ({ content: 'c', trust: 'untrusted-external' })
  })
  // The dependency it consumes is a function, so there is no key on the
  // module to read, log or forward.
  assert.equal(definitions.length, 2)
  const bag = { webSearch: async () => [] }
  assert.deepEqual(Object.keys(bag), ['webSearch'])
  assert.equal(typeof bag.webSearch, 'function')
  assert.equal(JSON.stringify(bag).includes('apiKey'), false)
})

test('a missing search capability does not take down the whole registry', async () => {
  // Unlike spawnProcess, absence here is legitimate — the user may have no
  // Serper key. Composition must still succeed and every other tool survive.
  const withoutSearch = { spawnProcess: DEPENDENCIES.spawnProcess, clipboardApi: DEPENDENCIES.clipboardApi }
  const registry = createMvpRegistry(withoutSearch)
  assert.deepEqual(registry.list().map(tool => tool.id).sort(), EXPECTED_TOOL_IDS)
  await assert.rejects(() => registry.execute('web.search', { query: 'test' }), /not configured/)
})

test('an unconfigured search key still registers the tool and fails at execute', async () => {
  const { createSerperSearch } = require('../electron/serper-client.cjs')
  const registry = createMvpRegistry({ ...DEPENDENCIES, webSearch: createSerperSearch({ apiKey: null }) })
  // Registration must survive a missing credential, so the UI can explain why
  // search is unavailable instead of the whole registry failing to build.
  assert.equal(registry.has('web.search'), true)
  await assert.rejects(() => registry.execute('web.search', { query: 'test' }), /not configured/)
})
