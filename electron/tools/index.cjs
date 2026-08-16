const fs = require('node:fs')
const path = require('node:path')
const { ToolRegistry } = require('../../packages/agent-core/tool-registry.cjs')

const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]*$/
const TOOL_ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/

function discoverToolModules(directory = __dirname) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name !== 'index.cjs' && entry.name.endsWith('.cjs') && MODULE_ID_PATTERN.test(path.basename(entry.name, '.cjs')))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right))
    .map(file => require(path.join(directory, file)))
}

function validateToolModule(module) {
  if (!module || typeof module !== 'object') throw new TypeError('Tool module must export an object.')
  if (typeof module.id !== 'string' || !MODULE_ID_PATTERN.test(module.id)) {
    throw new TypeError('Tool module must declare a lowercase id.')
  }
  if (!Array.isArray(module.toolIds) || module.toolIds.length === 0) {
    throw new TypeError(`Tool module ${module.id} must declare toolIds.`)
  }
  if (module.toolIds.some(toolId => typeof toolId !== 'string' || !TOOL_ID_PATTERN.test(toolId))) {
    throw new TypeError(`Tool module ${module.id} declares an invalid tool id.`)
  }
  if (new Set(module.toolIds).size !== module.toolIds.length) {
    throw new Error(`Tool module ${module.id} declares a duplicate tool id.`)
  }
  if (typeof module.create !== 'function') throw new TypeError(`Tool module ${module.id} must declare create().`)
}

function createToolDefinitions({ dependencies = {}, modules = discoverToolModules() } = {}) {
  if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
    throw new TypeError('Tool dependencies must be an object.')
  }
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new TypeError('At least one tool module is required.')
  }

  const moduleIds = new Set()
  const declaredOwners = new Map()
  for (const module of modules) {
    validateToolModule(module)
    if (moduleIds.has(module.id)) throw new Error(`Duplicate tool module id: ${module.id}`)
    moduleIds.add(module.id)
    for (const toolId of module.toolIds) {
      if (declaredOwners.has(toolId)) {
        throw new Error(`Tool ${toolId} is declared by both ${declaredOwners.get(toolId)} and ${module.id}.`)
      }
      declaredOwners.set(toolId, module.id)
    }
  }

  const definitions = []
  for (const module of modules) {
    const created = module.create(dependencies)
    if (!Array.isArray(created) || created.length === 0) {
      throw new TypeError(`Tool module ${module.id} must create a non-empty array.`)
    }
    const createdIds = created.map(tool => tool?.id)
    const createdSet = new Set(createdIds)
    if (createdSet.size !== createdIds.length) throw new Error(`Tool module ${module.id} created duplicate tool ids.`)
    const missing = module.toolIds.filter(toolId => !createdSet.has(toolId))
    const undeclared = createdIds.filter(toolId => !module.toolIds.includes(toolId))
    if (missing.length || undeclared.length) {
      throw new Error(`Tool module ${module.id} creation does not match its declared toolIds.`)
    }
    definitions.push(...created)
  }
  return definitions
}

function createToolRegistry(options) {
  const definitions = createToolDefinitions(options)
  const registry = new ToolRegistry()
  for (const definition of definitions) registry.register(definition)
  return registry
}

// Inert system adapters so unit tests that only care about other tools do not
// need Electron or live machine state. Production main.cjs must pass real os,
// volume/process listers and powerSaveBlocker.
const INERT_SYSTEM_DEPENDENCIES = Object.freeze({
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
  })
})

function createMvpRegistry(dependencies = {}) {
  return createToolRegistry({
    dependencies: {
      ...INERT_SYSTEM_DEPENDENCIES,
      ...dependencies
    }
  })
}

module.exports = {
  createMvpRegistry,
  createToolDefinitions,
  createToolRegistry,
  discoverToolModules,
  validateToolModule
}
