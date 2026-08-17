'use strict'

const { fenceUntrusted } = require('./providers/provider-contract.cjs')

const DEFAULT_MAX_TURNS = 16
const DEFAULT_MAX_CHARS = 8_000

/**
 * In-memory session transcript. History is data, not authority: it cannot
 * grant tools, skip policy, or rewrite the current user request. ADR-013.
 */
function createConversationMemory({
  maxTurns = DEFAULT_MAX_TURNS,
  maxChars = DEFAULT_MAX_CHARS,
  fence = fenceUntrusted
} = {}) {
  const turns = []

  function usedChars() {
    return turns.reduce((total, turn) => total + turn.content.length, 0)
  }

  function trim() {
    while (turns.length > maxTurns || (turns.length > 0 && usedChars() > maxChars)) {
      turns.shift()
    }
  }

  function append(turn) {
    if (!turn || (turn.role !== 'user' && turn.role !== 'assistant')) return
    if (typeof turn.content !== 'string' || !turn.content) return
    turns.push({
      role: turn.role,
      content: turn.content,
      trust: turn.trust === 'untrusted-external' ? 'untrusted-external' : 'session'
    })
    trim()
  }

  function toProviderMessages() {
    return turns.map(turn => {
      if (turn.role === 'user') return { role: 'user', content: turn.content }
      return { role: 'context', content: fence(turn.content) }
    })
  }

  function reset() {
    turns.length = 0
  }

  function snapshot() {
    return turns.map(turn => ({ ...turn }))
  }

  return {
    append,
    toProviderMessages,
    reset,
    snapshot,
    size: () => turns.length,
    maxTurns,
    maxChars
  }
}

module.exports = {
  DEFAULT_MAX_CHARS,
  DEFAULT_MAX_TURNS,
  createConversationMemory
}
