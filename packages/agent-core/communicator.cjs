'use strict'

const { fenceUntrusted } = require('./providers/provider-contract.cjs')
const {
  stripSingleJsonFence,
  hasExactKeys
} = require('./orchestrator/system-action-planner.cjs')

const INTENT_VERSION = 1
const COMMUNICATOR_TIMEOUT_MS = 8_000
const ENVELOPE_LIMIT = 512

const UNICODE_DASHES = '\u2014\u2013\u2015\u2012\u2212'
const RANGE_DASHES = `${UNICODE_DASHES}-`

/**
 * Intent values the model may return. toolId is a literal here and is never
 * read from provider output. ADR-012.
 */
const INTENT_TO_TOOL = Object.freeze({
  weather: Object.freeze({ toolId: 'weather.current', parameterKey: 'location', inputKey: 'query' }),
  webSearch: Object.freeze({ toolId: 'web.search', parameterKey: 'query', inputKey: 'query' }),
  fileSearch: Object.freeze({ toolId: 'file.search', parameterKey: 'query', inputKey: 'query' })
})

const ALLOWED_INTENTS = Object.freeze(['weather', 'webSearch', 'fileSearch', 'none'])

const AI_TELLS = Object.freeze([
  "it's important to note",
  "i'd be happy to",
  'i hope this helps',
  "it's worth noting",
  'great question',
  'in conclusion',
  'as an ai',
  'furthermore',
  'certainly',
  'moreover',
  'delve',
  'sure!'
])

class CommunicatorError extends Error {
  constructor(code) {
    super(code)
    this.name = 'CommunicatorError'
    this.code = code
  }
}

function parseCommunicatorIntent(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > ENVELOPE_LIMIT) {
    throw new CommunicatorError('invalid-intent-envelope')
  }

  let value
  try {
    value = JSON.parse(stripSingleJsonFence(raw.trim()))
  } catch {
    throw new CommunicatorError('invalid-intent-json')
  }

  if (value?.intent === 'none') {
    if (!hasExactKeys(value, ['version', 'intent']) || value.version !== INTENT_VERSION) {
      throw new CommunicatorError('invalid-none-intent')
    }
    return null
  }

  if (!hasExactKeys(value, ['version', 'intent', 'parameters']) || value.version !== INTENT_VERSION) {
    throw new CommunicatorError('invalid-intent')
  }

  const mapping = Object.prototype.hasOwnProperty.call(INTENT_TO_TOOL, value.intent)
    ? INTENT_TO_TOOL[value.intent]
    : null
  if (!mapping) throw new CommunicatorError('unsupported-intent')
  if (!hasExactKeys(value.parameters, [mapping.parameterKey])) {
    throw new CommunicatorError('invalid-intent-parameters')
  }

  const extracted = value.parameters[mapping.parameterKey]
  if (typeof extracted !== 'string') throw new CommunicatorError('invalid-intent-parameter')

  return Object.freeze({
    intent: value.intent,
    toolId: mapping.toolId,
    input: Object.freeze({ [mapping.inputKey]: extracted })
  })
}

function withTimeout(promise, timeoutMs) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new CommunicatorError('timeout')
      reject(error)
    }, timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function generateWithTimeout(provider, args, timeoutMs) {
  if (!provider || typeof provider.generate !== 'function') {
    throw new CommunicatorError('provider-unavailable')
  }
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const abortTimer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    return await withTimeout(
      provider.generate({ ...args, signal: controller?.signal }),
      timeoutMs
    )
  } finally {
    if (abortTimer) clearTimeout(abortTimer)
  }
}

async function interpretRequest({ provider, request, prompt, timeoutMs = COMMUNICATOR_TIMEOUT_MS }) {
  const result = await generateWithTimeout(provider, {
    prompt: request,
    preferredProvider: 'gemini',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: request }
    ]
  }, timeoutMs)
  return {
    interpretation: parseCommunicatorIntent(result.text),
    providerResult: result
  }
}

function extractFacts(text) {
  const value = String(text)
  const facts = []
  const urls = value.match(/https?:\/\/[^\s]+/gi) || []
  facts.push(...urls)
  let remaining = value
  for (const url of urls) remaining = remaining.split(url).join(' ')

  const windowsPaths = remaining.match(/[A-Za-z]:\\[^\s]+/g) || []
  facts.push(...windowsPaths)
  for (const item of windowsPaths) remaining = remaining.split(item).join(' ')

  remaining = remaining.replace(/["“”']([^"“”']+)["“”']/g, (_, inner) => {
    facts.push(inner)
    return ' '
  })

  facts.push(...(remaining.match(/\d+(?:\.\d+)?/g) || []))
  return facts
}

function factsPreserved(original, rewrite) {
  return extractFacts(original).every(fact => rewrite.includes(fact))
}

function stripAiTells(text) {
  let result = text
  for (const phrase of AI_TELLS) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`\\b${escaped}`, 'gi'), '')
  }
  return result
}

function sanitizeVoice(text) {
  if (typeof text !== 'string') return ''
  let result = text

  const range = new RegExp(`(\\d)\\s*[${RANGE_DASHES}]\\s*(\\d)`, 'g')
  result = result.replace(range, '$1 to $2')

  const dash = `[${UNICODE_DASHES}]`
  result = result.replace(new RegExp(`\\s*${dash}\\s+([^${UNICODE_DASHES}]+?)\\s*${dash}(?=\\s|$)`, 'g'), ', $1,')
  result = result.replace(new RegExp(`\\s*${dash}\\s*$`, 'g'), '.')
  result = result.replace(new RegExp(`\\s*${dash}\\s+`, 'g'), '. ')
  result = result.replace(new RegExp(dash, 'g'), '')

  result = stripAiTells(result)
  let previous
  do {
    previous = result
    result = result.replace(/[ \t]{2,}/g, ' ')
    result = result.replace(/[ \t]+([.,!?;:])/g, '$1')
    result = result.replace(/^[.,!?;:]+(?:\s+|$)/, '')
    result = result.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    result = result.replace(/,\s*,/g, ',')
    result = result.replace(/\.\s*\./g, '.')
    result = result.replace(/[ \t]{2,}/g, ' ').trim()
  } while (result !== previous)
  return result
}

function isRefusalMessage(message) {
  return typeof message === 'string' && message.startsWith('I blocked that action:')
}

function shouldRewriteReply(reply) {
  if (!reply || typeof reply !== 'object' || typeof reply.message !== 'string') return false
  if (reply.state === 'awaiting_approval') return false
  if (Object.prototype.hasOwnProperty.call(reply, 'approval')) return false
  if (isRefusalMessage(reply.message)) return false
  return true
}

function toolTitle(interpretation) {
  if (interpretation.intent === 'weather') {
    return `Check the weather in ${interpretation.input.query}`
  }
  if (interpretation.intent === 'webSearch') return 'Research the web'
  if (interpretation.intent === 'fileSearch') return 'Find files'
  return interpretation.toolId
}

function continuationFor(interpretation, question) {
  if (interpretation.intent !== 'webSearch') return null
  return {
    kind: 'research-web',
    question,
    approvalDetail:
      'Send this query to Serper, then fetch the first public result for AI synthesis. Each request leaves your machine.'
  }
}

async function presentReply(reply, { enabled, provider, activity, voicePrompt, timeoutMs = COMMUNICATOR_TIMEOUT_MS } = {}) {
  if (!shouldRewriteReply(reply)) return reply

  const original = reply.message
  let text = original

  if (enabled && provider && voicePrompt) {
    try {
      const result = await generateWithTimeout(provider, {
        prompt: original,
        preferredProvider: 'gemini',
        messages: [
          { role: 'system', content: voicePrompt },
          { role: 'user', content: fenceUntrusted(original) }
        ]
      }, timeoutMs)
      const rewrite = typeof result?.text === 'string' ? result.text.trim() : ''
      if (rewrite && factsPreserved(original, rewrite)) {
        text = rewrite
      } else if (rewrite) {
        activity?.('Communicator voice', 'Rewrite dropped a fact; using the original reply.', 'warning')
        text = original
      }
    } catch {
      activity?.('Communicator voice', 'Rewrite unavailable; using the original reply.', 'warning')
      text = original
    }
  }

  const sanitised = sanitizeVoice(text)
  if (sanitised === original) return reply
  return { ...reply, message: sanitised }
}

module.exports = {
  ALLOWED_INTENTS,
  COMMUNICATOR_TIMEOUT_MS,
  CommunicatorError,
  INTENT_TO_TOOL,
  INTENT_VERSION,
  continuationFor,
  extractFacts,
  factsPreserved,
  interpretRequest,
  parseCommunicatorIntent,
  presentReply,
  sanitizeVoice,
  shouldRewriteReply,
  toolTitle
}
