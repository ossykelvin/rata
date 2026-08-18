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

/**
 * An explicit instruction to write a document.
 *
 * `triggerScore` counts how many of a trigger's words appear in the message,
 * and falls back to a substring test, so a trigger made of short common words
 * scores well against any long message. "Draft a memo about the project
 * status" selected Document Assistant, and the same request with a sentence of
 * technical detail after it selected Web Search — which then sent the whole
 * memo request to Serper as a search query and saved the results as the
 * document.
 *
 * The verb is what the user meant; the nouns after it are the subject matter.
 * This is the same shape as the calculator and app-launcher boosts below:
 * an unambiguous intent gets weighted rather than left to word overlap.
 */
function looksLikeDrafting(message) {
  const noun = '(?:memo|report|document|letter|brief|briefing|proposal|summary|note|notes|sop|handover|minutes|agenda)'
  return new RegExp(`^(?:please\\s+)?(?:draft|write|prepare|compose|create|put\\s+together)\\s+(?:me\\s+)?(?:a|an|the|some)?\\s*(?:short|quick|brief|one[- ]page)?\\s*${noun}\\b`, 'i').test(message) ||
    new RegExp(`\\bturn\\s+(?:these|this|those|my|the)\\b[\\s\\S]{0,60}\\binto\\s+(?:a|an)?\\s*${noun}\\b`, 'i').test(message) ||
    new RegExp(`^summari[sz]e\\b[\\s\\S]{0,80}\\binto\\s+(?:a|an)?\\s*${noun}\\b`, 'i').test(message)
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
    const scored = registry.list()
      .filter(skill => skill.selectable !== false)
      .map(skill => {
      let score = Math.max(0, ...skill.triggers.map(trigger => triggerScore(lower, trigger)))
      if (lower.includes(skill.id.replaceAll('-', ' ')) || lower.includes(skill.name.toLowerCase())) {
        score += 0.35
      }
      if (skill.id === 'calculator' && looksLikeCalculation(lower)) score += 0.85
      // "Draft a memo about X" is a drafting request whatever X mentions. The
      // subject matter must not decide the skill. FIX-014.
      if (skill.id === 'document-assistant' && looksLikeDrafting(lower)) score += 0.85
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
    // Existence check only — the router selects skills, it never runs tools.
    const availableTools = toolRegistry && typeof toolRegistry.has === 'function'
      ? selected.tools.filter(id => toolRegistry.has(id))
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
