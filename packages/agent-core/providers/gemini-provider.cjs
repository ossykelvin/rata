'use strict'

const { ProviderError, buildPrompt, safeErrorMessage } = require('./provider-contract.cjs')

// Verified against GET /v1beta/models on 2026-08-15. Model ids are retired
// without notice: a wrong name fails as HTTP 404, which looks like an auth
// problem but is not. Override with GEMINI_MODEL.
const DEFAULT_MODEL = 'gemini-2.5-flash'
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * Primary provider. Google Generative Language API over plain fetch — no SDK,
 * so there is no transitive dependency reading the key.
 *
 * The key is sent in the `x-goog-api-key` header, never in the URL, so it
 * cannot leak through redirect logging or an error string containing the URL.
 */
function createGeminiProvider({
  apiKey,
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 20000
} = {}) {
  const configured = typeof apiKey === 'string' && apiKey.trim().length > 0

  async function generate({ messages, signal }) {
    if (!configured) throw new ProviderError('Gemini is not configured.', { provider: 'gemini' })
    if (typeof fetchImpl !== 'function') throw new ProviderError('No fetch implementation available.', { provider: 'gemini' })

    const { system, turns } = buildPrompt(messages)
    const body = {
      contents: turns.map(turn => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }]
      }))
    }
    if (system) body.systemInstruction = { parts: [{ text: system }] }

    // Own timeout so a hung provider hands over to the secondary rather than
    // blocking the agent indefinitely.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    signal?.addEventListener?.('abort', onAbort)

    let response
    try {
      response = await fetchImpl(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: controller.signal
      })
    } catch (error) {
      const aborted = error?.name === 'AbortError'
      throw new ProviderError(
        aborted ? `Gemini did not respond within ${timeoutMs}ms.` : `Gemini request failed: ${safeErrorMessage(error)}`,
        { provider: 'gemini', retryable: true }
      )
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
    }

    if (!response.ok) {
      // 429 and 5xx are worth trying elsewhere; 4xx generally is not.
      const retryable = response.status === 429 || response.status >= 500
      throw new ProviderError(`Gemini returned HTTP ${response.status}.`, {
        provider: 'gemini',
        status: response.status,
        retryable
      })
    }

    let payload
    try {
      payload = await response.json()
    } catch (error) {
      throw new ProviderError(`Gemini returned unreadable JSON: ${safeErrorMessage(error)}`, { provider: 'gemini', retryable: true })
    }

    const text = (payload?.candidates?.[0]?.content?.parts || [])
      .map(part => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim()

    if (!text) {
      const reason = payload?.candidates?.[0]?.finishReason || payload?.promptFeedback?.blockReason
      throw new ProviderError(
        reason ? `Gemini returned no text (${String(reason).slice(0, 40)}).` : 'Gemini returned no text.',
        { provider: 'gemini', retryable: true }
      )
    }

    return { text, model, provider: 'gemini' }
  }

  return {
    id: 'gemini',
    label: 'Google Gemini',
    model,
    isConfigured: () => configured,
    generate
  }
}

module.exports = { createGeminiProvider, DEFAULT_MODEL, DEFAULT_BASE_URL }
