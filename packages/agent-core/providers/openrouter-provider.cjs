'use strict'

const { ProviderError, buildPrompt, safeErrorMessage } = require('./provider-contract.cjs')

const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'

/**
 * Secondary provider. OpenAI-compatible chat completions.
 *
 * Used when Gemini fails, times out, or when the request is classified as
 * complex — see createProviderChain(). A longer default timeout than the
 * primary, because it is the fallback and a slow answer beats no answer.
 */
function createOpenRouterProvider({
  apiKey,
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 45000
} = {}) {
  const configured = typeof apiKey === 'string' && apiKey.trim().length > 0
  const endpoint = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`

  async function generate({ messages, signal }) {
    if (!configured) throw new ProviderError('OpenRouter is not configured.', { provider: 'openrouter' })
    if (typeof fetchImpl !== 'function') throw new ProviderError('No fetch implementation available.', { provider: 'openrouter' })

    const { system, turns } = buildPrompt(messages)
    const chatMessages = system ? [{ role: 'system', content: system }, ...turns] : turns

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    signal?.addEventListener?.('abort', onAbort)

    let response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          // OpenRouter attribution headers. Deliberately not a real URL: this
          // is a desktop app, and there is no site to identify.
          'x-title': 'Rata Office Assistant'
        },
        body: JSON.stringify({ model, messages: chatMessages }),
        signal: controller.signal
      })
    } catch (error) {
      const aborted = error?.name === 'AbortError'
      throw new ProviderError(
        aborted ? `OpenRouter did not respond within ${timeoutMs}ms.` : `OpenRouter request failed: ${safeErrorMessage(error)}`,
        { provider: 'openrouter', retryable: false }
      )
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
    }

    if (!response.ok) {
      throw new ProviderError(`OpenRouter returned HTTP ${response.status}.`, {
        provider: 'openrouter',
        status: response.status
      })
    }

    let payload
    try {
      payload = await response.json()
    } catch (error) {
      throw new ProviderError(`OpenRouter returned unreadable JSON: ${safeErrorMessage(error)}`, { provider: 'openrouter' })
    }

    const text = String(payload?.choices?.[0]?.message?.content || '').trim()
    if (!text) throw new ProviderError('OpenRouter returned no text.', { provider: 'openrouter' })

    return { text, model: payload?.model || model, provider: 'openrouter' }
  }

  return {
    id: 'openrouter',
    label: 'OpenRouter',
    model,
    isConfigured: () => configured,
    generate
  }
}

module.exports = { createOpenRouterProvider, DEFAULT_MODEL, DEFAULT_BASE_URL }
