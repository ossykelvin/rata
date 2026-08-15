'use strict'

const { ProviderError, safeErrorMessage } = require('./provider-contract.cjs')
const { createMockProvider } = require('./mock-provider.cjs')
const { createGeminiProvider } = require('./gemini-provider.cjs')
const { createOpenRouterProvider } = require('./openrouter-provider.cjs')

/** Provider ids the `provider` setting may hold. */
const PROVIDER_IDS = Object.freeze(['mock', 'gemini', 'openrouter', 'auto'])

/**
 * Rough complexity signal used to send a request straight to the secondary.
 *
 * Intentionally crude and cheap. It is a routing hint, never a security
 * decision — both providers are equally untrusted as far as the runtime is
 * concerned.
 */
const COMPLEX_HINTS = /\b(analy[sz]e|compare|critique|design|architect|refactor|debug|trade-?offs?|step by step|reason|prove|strategy|research)\b/i

function looksComplex(text, { longRequestChars = 600 } = {}) {
  const value = String(text || '')
  return value.length >= longRequestChars || COMPLEX_HINTS.test(value)
}

/**
 * Builds the provider chain described in the product brief:
 *
 *   - Gemini is primary.
 *   - OpenRouter is secondary. It is used when Gemini errors, times out, or
 *     returns nothing, and it is tried *first* for requests that look complex.
 *   - Mock is the terminal fallback so the agent always answers, and is the
 *     default when nothing is configured.
 *
 * `mode` mirrors the `provider` setting: 'auto' uses the chain, a specific id
 * pins to that provider, and 'mock' guarantees no network egress.
 */
function createProviderChain({
  mode = 'auto',
  gemini = null,
  openrouter = null,
  mock = createMockProvider(),
  onFallback = () => {},
  isComplex = looksComplex
} = {}) {
  const byId = new Map()
  for (const provider of [gemini, openrouter, mock]) {
    if (provider) byId.set(provider.id, provider)
  }

  const available = id => {
    const provider = byId.get(id)
    return provider && provider.isConfigured() ? provider : null
  }

  /** Ordered candidates for this request. */
  function plan(prompt, { preferredProvider = null } = {}) {
    if (mode === 'mock') return [mock]
    if (mode === 'gemini') return [available('gemini'), mock].filter(Boolean)
    if (mode === 'openrouter') return [available('openrouter'), mock].filter(Boolean)

    const primary = available('gemini')
    const secondary = available('openrouter')
    if (preferredProvider === 'gemini') return [primary, secondary, mock].filter(Boolean)
    if (preferredProvider === 'openrouter') return [secondary, primary, mock].filter(Boolean)
    // Complex work goes to the secondary first; it is the stronger model in
    // this configuration and a fallback afterwards would double the latency.
    const ordered = isComplex(prompt) ? [secondary, primary] : [primary, secondary]
    return [...ordered.filter(Boolean), mock]
  }

  function describe() {
    return {
      mode,
      providers: [...byId.values()].map(provider => ({
        id: provider.id,
        label: provider.label,
        model: provider.model,
        // Whether a credential is present. Never the credential itself.
        configured: provider.isConfigured()
      }))
    }
  }

  /**
   * @returns {{text, model, provider, attempts: Array<{provider, error}>}}
   */
  async function generate({ messages, signal, prompt = '', preferredProvider = null }) {
    const candidates = plan(prompt, { preferredProvider })
    const attempts = []
    let lastError = null

    for (const provider of candidates) {
      try {
        const result = await provider.generate({ messages, signal })
        return { ...result, attempts }
      } catch (error) {
        lastError = error
        const detail = safeErrorMessage(error)
        attempts.push({ provider: provider.id, error: detail })
        onFallback({ from: provider.id, reason: detail })
        // A non-retryable failure on a pinned provider still falls through to
        // mock so the user gets an answer rather than a dead UI.
      }
    }

    throw new ProviderError(
      `No provider could answer. ${attempts.map(a => `${a.provider}: ${a.error}`).join(' | ')}`.trim(),
      { provider: 'chain', status: lastError?.status }
    )
  }

  return { mode, describe, generate, plan, isConfigured: () => true }
}

module.exports = {
  PROVIDER_IDS,
  createProviderChain,
  createMockProvider,
  createGeminiProvider,
  createOpenRouterProvider,
  looksComplex,
  ProviderError
}
