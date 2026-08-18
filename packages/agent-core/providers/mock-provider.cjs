'use strict'

const { buildPrompt, messagesWantVision, ProviderError } = require('./provider-contract.cjs')

/**
 * Offline provider. Retained deliberately (RATA-002 acceptance): tests and the
 * default configuration must never reach the network, so `provider: 'mock'`
 * stays the shipped default and nothing leaves the machine until the user
 * chooses otherwise.
 */
function createMockProvider({ reply } = {}) {
  return {
    id: 'mock',
    label: 'Mock (offline)',
    model: 'mock',
    supportsVision: false,
    isConfigured: () => true,
    async generate({ messages }) {
      if (messagesWantVision(messages)) {
        throw new ProviderError('The mock provider cannot analyse images.', { provider: 'mock' })
      }
      const { turns } = buildPrompt(messages)
      const last = [...turns].reverse().find(turn => turn.role === 'user')
      const text = typeof reply === 'function'
        ? reply(last?.content || '')
        : `Mock provider: no live AI is configured, so I cannot answer “${(last?.content || '').slice(0, 120)}”. Set a provider in Control Center to enable Gemini or OpenRouter.`
      return { text, model: 'mock', provider: 'mock' }
    }
  }
}

module.exports = { createMockProvider }
