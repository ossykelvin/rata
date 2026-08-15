const RISKS = new Set(['read', 'safe-write', 'external-write', 'destructive'])
const CONFIRMATION_POLICIES = new Set(['never', 'configurable', 'always'])

/**
 * Fields safe to hand to a caller that only needs to reason about a tool.
 * `execute` and `validateInput` are deliberately absent. See REVIEW-001 M2.
 */
function toolMetadata(tool) {
  return Object.freeze({
    id: tool.id,
    description: tool.description,
    risk: tool.risk,
    confirmation: tool.confirmation,
    confirmationSetting: tool.confirmationSetting
  })
}

/**
 * The registry is the only place a privileged action may run.
 *
 * `CLAUDE.md` states tools must execute "through ToolRegistry.execute() so
 * input validation cannot be skipped". That used to be convention: `get()`
 * returned the live tool object including its executor, so any caller could
 * invoke it directly and bypass validateInput(). Now no accessor hands out an
 * executor at all — `execute()` is the only path to one, and it validates
 * first. The guarantee is structural rather than a rule people remember.
 */
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

  /** Is this tool registered? Cheaper and clearer than a truthiness check. */
  has(id) { return this.tools.has(id) }

  /** Security metadata for a tool. Never returns an executor. */
  describe(id) {
    const tool = this.tools.get(id)
    return tool ? toolMetadata(tool) : undefined
  }

  /**
   * Retained for callers that reason about a tool. Returns metadata only —
   * identical to describe(). Kept so `Boolean(registry.get(id))` and
   * `registry.get(id).risk` keep working.
   */
  get(id) { return this.describe(id) }

  validate(id, input) {
    const tool = this.tools.get(id)
    if (!tool) throw new Error('Tool is not registered.')
    return tool.validateInput(input)
  }

  async execute(id, input) {
    const tool = this.tools.get(id)
    if (!tool) throw new Error('Tool is not registered.')
    // Validate here rather than trusting the caller to have done it.
    return tool.execute(tool.validateInput(input))
  }

  list() {
    return [...this.tools.values()].map(toolMetadata)
  }
}

module.exports = { ToolRegistry }
