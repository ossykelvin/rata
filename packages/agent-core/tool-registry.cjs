const RISKS = new Set(['read', 'safe-write', 'external-write', 'destructive'])
const CONFIRMATION_POLICIES = new Set(['never', 'configurable', 'always'])

class ToolRegistry {
  constructor() {
    this.tools = new Map()
  }

  register(tool) {
    if (!tool || typeof tool !== 'object') throw new Error('Invalid tool registration')
    if (typeof tool.id !== 'string' || !/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(tool.id)) {
      throw new Error('Tool id must be a namespaced identifier.')
    }
    if (typeof tool.description !== 'string' || !tool.description.trim()) {
      throw new Error(`Tool ${tool.id} must declare a description.`)
    }
    if (!RISKS.has(tool.risk)) throw new Error(`Tool ${tool.id} has an invalid risk level.`)
    if (!CONFIRMATION_POLICIES.has(tool.confirmation)) {
      throw new Error(`Tool ${tool.id} has an invalid confirmation policy.`)
    }
    if (tool.risk === 'external-write' && tool.confirmation === 'never') {
      throw new Error(`External-write tool ${tool.id} cannot disable confirmation.`)
    }
    if (tool.confirmation === 'configurable' && typeof tool.confirmationSetting !== 'string') {
      throw new Error(`Configurable tool ${tool.id} must declare confirmationSetting.`)
    }
    if (typeof tool.validateInput !== 'function' || typeof tool.execute !== 'function') {
      throw new Error(`Tool ${tool.id} must declare validateInput and execute functions.`)
    }
    if (this.tools.has(tool.id)) throw new Error(`Duplicate tool: ${tool.id}`)
    this.tools.set(tool.id, tool)
  }

  get(id) { return this.tools.get(id) }

  validate(id, input) {
    const tool = this.get(id)
    if (!tool) throw new Error('Tool is not registered.')
    return tool.validateInput(input)
  }

  async execute(id, input) {
    const tool = this.get(id)
    if (!tool) throw new Error('Tool is not registered.')
    const validatedInput = this.validate(id, input)
    return tool.execute(validatedInput)
  }

  list() {
    return [...this.tools.values()].map(({ execute, validateInput, ...meta }) => meta)
  }
}

module.exports = { ToolRegistry }
