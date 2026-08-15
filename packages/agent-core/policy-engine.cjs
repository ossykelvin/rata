class PolicyEngine {
  evaluate(tool, input, settings) {
    if (!tool) return { decision: 'deny', reason: 'Tool not registered.' }
    if (tool.risk === 'destructive') return { decision: 'deny', reason: 'Destructive actions are blocked in MVP.' }
    if (tool.risk === 'external-write') return { decision: 'confirm' }
    if (tool.confirmation === 'always') return { decision: 'confirm' }
    if (tool.confirmation === 'configurable' && settings?.[tool.confirmationSetting] !== false) {
      return { decision: 'confirm' }
    }
    return { decision: 'allow' }
  }
}

module.exports = { PolicyEngine }
