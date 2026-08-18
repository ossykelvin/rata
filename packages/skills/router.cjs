'use strict'

/**
 * Words that carry no routing signal.
 *
 * These are dropped from both sides, so they count in neither the matches nor
 * the trigger length. Both halves of that matter. A function word left in a
 * trigger inflates the denominator, so a trigger that describes its skill well
 * scores *worse* than a vague one: "Move these reports into folders by year"
 * scored 0.33 and fell under the threshold, while Calendar Assistant's "Move my
 * meeting" scored 0.50 on the single word "move" and won a file request.
 */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'this', 'that', 'with', 'from', 'into', 'your', 'you',
  'are', 'was', 'what', 'when', 'where', 'which', 'have', 'has', 'had', 'can',
  'will', 'about', 'me', 'my', 'a', 'an', 'to', 'of', 'on', 'in', 'is', 'it',
  // Function words. "how" and "do" together carried a whole routing decision:
  // "how do I fix a dishwasher?" matched System Info's "How much RAM do I
  // have?" on those two words alone and nothing else.
  'how', 'do', 'does', 'did', 'be', 'been', 'am', 'at', 'by', 'or', 'not',
  'no', 'if', 'so', 'up', 'out', 'these', 'those', 'them', 'there', 'then',
  'than', 'some', 'any', 'all', 'we', 'us', 'they', 'its', 'as', 'but',
  // Apostrophe fragments left behind when the splitter breaks "isn't"/"don't".
  'isn', 'don', 'won', 'didn', 'doesn', 'couldn', 'shouldn', 'wouldn'
])

function words(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
}

/**
 * Whether a trigger word appears in the message as a word.
 *
 * The prefix rule tolerates the morphology a user actually types — "files" for
 * "file", "saving" for "save" — without matching inside an unrelated word.
 * Both sides must be at least four characters, so short trigger words match
 * only themselves.
 */
function matchesWord(messageWords, triggerWord) {
  if (messageWords.has(triggerWord)) return true
  if (triggerWord.length < 4) return false
  for (const word of messageWords) {
    if (word.length < 4) continue
    const [shorter, longer] = word.length < triggerWord.length ? [word, triggerWord] : [triggerWord, word]
    if (longer.length - shorter.length <= 3 && longer.startsWith(shorter)) return true
  }
  return false
}

/**
 * How much of a trigger the message actually contains.
 *
 * This used to fall back to `message.includes(word)` — a raw substring test
 * against the whole message, with no word boundary. A trigger word therefore
 * matched inside any longer word: Screenshot Inspector triggers on "at", which
 * is inside "what", "that" and "create", so it scored against nearly every
 * English sentence. "am" matched "name", "do" matched "document" and
 * "downloads", "ora" matched "temporary", and "isn"/"don" matched the middle of
 * ordinary words.
 *
 * Because the score is hits/triggerWords.length, the damage grew with message
 * length: the longer the request, the more spurious hits every trigger
 * collected. That is why "Draft a memo about the project status" routed
 * correctly and the same request with a sentence of detail after it routed to
 * Web Search, which sent the whole memo request to Serper as a search query.
 * FIX-014 boosted drafting to paper over one instance; this removes the cause.
 */
function triggerScore(message, trigger) {
  const messageWords = new Set(words(message))
  const triggerWords = words(trigger)
  if (!triggerWords.length) return 0
  const hits = triggerWords.filter(word => matchesWord(messageWords, word)).length
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

  const knowsAvailability = Boolean(toolRegistry && typeof toolRegistry.has === 'function')

  /**
   * A skill whose tools are not registered cannot do anything: the agent
   * dead-ends with "installed, but its tools are not registered yet". Letting
   * one of those outscore a skill that can actually run turns a working
   * request into a refusal — "move the invoice into the archive folder"
   * selected Calendar Assistant, whose four tools are all missing, while File
   * Organizer sat available.
   *
   * Deliberately a hair, not a thumb. It is small enough to break a tie and
   * nothing else, because when an unavailable skill is genuinely the better
   * match the honest answer is to say it is not wired up yet. Sized as a
   * multiplier instead, it flipped "Find the latest email from…" (Email
   * Assistant 1.00) to Web Search (0.67) — which would have sent the user's
   * private request to Serper as a public search query.
   *
   * Subtractive and constant, so the ordering stays a total order.
   */
  const UNAVAILABLE_TIE_BREAK = 0.02

  function isRunnable(skill) {
    if (!knowsAvailability) return true
    return skill.tools.every(id => toolRegistry.has(id))
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
      // The tie-break orders candidates; it must not gate them. Applied to the
      // threshold instead, a skill that is the best match but not yet wired up
      // would drop out entirely and the user would get "no skill matched"
      // rather than being told which skill is missing its tools.
      const rank = isRunnable(skill) ? score : score - UNAVAILABLE_TIE_BREAK
      return { skill, score, rank }
    }).filter(item => item.score >= 0.34)
      .sort((a, b) => b.rank - a.rank)

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
