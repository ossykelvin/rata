'use strict'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'this', 'that', 'with', 'from', 'into', 'your', 'you',
  'are', 'was', 'what', 'when', 'where', 'which', 'have', 'has', 'had', 'can',
  'will', 'about', 'me', 'my', 'a', 'an', 'to', 'of', 'on', 'in', 'is', 'it'
])

function words(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
}

function triggerScore(message, trigger) {
  const messageWords = new Set(words(message))
  const triggerWords = words(trigger)
  if (!triggerWords.length) return 0
  const hits = triggerWords.filter(word => messageWords.has(word) || message.includes(word)).length
  return hits / triggerWords.length
}

function looksLikeCalculation(message) {
  return /(\d+\s*%\s*(of\s+)?\d+)|(\d+\s*[+\-*/x×]\s*\d+)/i.test(message)
}

function createSkillRouter({ registry, toolRegistry = null } = {}) {
  if (!registry || typeof registry.list !== 'function') {
    throw new TypeError('Skill router requires a registry.')
  }

  function route(message) {
    const text = typeof message === 'string' ? message.trim() : ''
    if (!text) {
      return {
        selectedSkillIds: [],
        shortReason: 'Empty request.',
        requiredPermissions: [],
        needsConfirmation: false,
        canRunInBackground: false,
        availableTools: [],
        missingTools: []
      }
    }

    const lower = text.toLowerCase()
    const scored = registry.list().map(skill => {
      let score = Math.max(0, ...skill.triggers.map(trigger => triggerScore(lower, trigger)))
      if (lower.includes(skill.id.replaceAll('-', ' ')) || lower.includes(skill.name.toLowerCase())) {
        score += 0.35
      }
      if (skill.id === 'calculator' && looksLikeCalculation(lower)) score += 0.85
      if (skill.id === 'app-launcher' && /\b(open|launch|start)\b/.test(lower)) score += 0.25
      if (skill.id === 'clipboard-assistant' && /\bcopy\b/.test(lower)) score += 0.2
      return { skill, score }
    }).filter(item => item.score >= 0.34)
      .sort((a, b) => b.score - a.score)

    if (looksLikeCalculation(lower)) {
      const calculator = scored.find(item => item.skill.id === 'calculator')
      if (calculator) scored.splice(0, scored.length, calculator)
    }

    if (!scored.length) {
      return {
        selectedSkillIds: [],
        shortReason: 'No installed skill matched this request.',
        requiredPermissions: [],
        needsConfirmation: false,
        canRunInBackground: false,
        availableTools: [],
        missingTools: []
      }
    }

    const selected = scored[0].skill
    const availableTools = toolRegistry && typeof toolRegistry.get === 'function'
      ? selected.tools.filter(id => Boolean(toolRegistry.get(id)))
      : [...selected.availableTools]
    const missingTools = selected.tools.filter(id => !availableTools.includes(id))
    const writeLike = selected.risk === 'external-write' || selected.risk === 'file-write' || selected.risk === 'local-write'

    return {
      selectedSkillIds: [selected.id],
      shortReason: `Matched ${selected.name}.`,
      requiredPermissions: [...selected.permissions],
      needsConfirmation: writeLike || /always|confirm/.test(selected.confirmation),
      canRunInBackground: selected.backgroundCapable,
      availableTools,
      missingTools,
      skill: selected
    }
  }

  return { route }
}

module.exports = { createSkillRouter }
