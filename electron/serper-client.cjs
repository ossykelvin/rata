'use strict'

const DEFAULT_ENDPOINT = 'https://google.serper.dev/search'
const MAX_RESULTS = 8
const MAX_SNIPPET_LENGTH = 400

/**
 * Serper web-search client.
 *
 * The credential is captured in this closure and never leaves it. What the
 * tool layer receives is a bound `search(query)` capability, not the key — so
 * a tool module discovered from `electron/tools/` can perform a search but
 * cannot read, log or exfiltrate the credential. That distinction matters
 * because the P0-2 dependency bag is handed to every discovered module.
 */

/** Results are untrusted third-party text. Clamp and stringify every field. */
function sanitizeResult(entry) {
  const text = value => String(value == null ? '' : value).slice(0, MAX_SNIPPET_LENGTH)
  return { title: text(entry?.title), link: text(entry?.link), snippet: text(entry?.snippet) }
}

function createSerperSearch({
  apiKey,
  fetchImpl = globalThis.fetch,
  endpoint = DEFAULT_ENDPOINT,
  timeoutMs = 15000
} = {}) {
  const configured = typeof apiKey === 'string' && apiKey.trim().length > 0

  async function search(query) {
    // Unconfigured fails here, at execution, rather than at registration.
    // Aborting registration would remove the tool entirely and leave the UI
    // unable to explain why web search is unavailable.
    if (!configured) throw new Error('Web search is not configured. Set RATA_SERPER_API_KEY in .env.local.')
    if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation is available for web search.')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        // Key travels in a header, never in the URL or body, so it cannot
        // leak through a logged endpoint.
        headers: { 'content-type': 'application/json', 'X-API-KEY': apiKey },
        body: JSON.stringify({ q: query, num: MAX_RESULTS }),
        signal: controller.signal
      })
    } catch (error) {
      // Never surface the raw error: it can carry the endpoint and headers.
      // eslint-disable-next-line preserve-caught-error -- attaching the cause would re-expose them
      throw new Error(error?.name === 'AbortError' ? 'Web search timed out.' : 'Web search request failed.')
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) throw new Error(`Web search returned HTTP ${response.status}.`)

    let payload
    try {
      payload = await response.json()
    } catch {
      throw new Error('Web search returned unreadable JSON.')
    }

    return Array.isArray(payload?.organic) ? payload.organic.slice(0, MAX_RESULTS).map(sanitizeResult) : []
  }

  search.isConfigured = () => configured
  return search
}

module.exports = { createSerperSearch, sanitizeResult, DEFAULT_ENDPOINT, MAX_RESULTS }
