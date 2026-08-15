'use strict'

const DEFAULT_ENDPOINT = 'https://google.serper.dev/search'
const MAX_QUERY_LENGTH = 400
const MAX_RESULTS = 8
const MAX_SNIPPET_LENGTH = 400

function requireObject(input, toolId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolId} input must be an object.`)
  }
  return input
}

/** Search results are untrusted third-party text. Clamp and stringify. */
function sanitizeResult(entry) {
  const text = value => String(value == null ? '' : value).slice(0, MAX_SNIPPET_LENGTH)
  return {
    title: text(entry?.title),
    link: text(entry?.link),
    snippet: text(entry?.snippet)
  }
}

/**
 * Registers `web.search`, backed by Serper.
 *
 * Registered from its own module rather than inside `createMvpRegistry` so it
 * does not collide with P0-2, which restructures `electron/mvp-tools.cjs`.
 *
 * Risk classification, deliberately: the tool only *reads*, but running it
 * sends the user's query to a third party, and a query can contain sensitive
 * text. docs/SECURITY.md requires external communication to be confirmed by
 * default, so this is `read` risk with `configurable` confirmation defaulting
 * to on. A user who searches constantly can turn it off in Control Center;
 * the default does not assume that for them.
 */
function registerSearchTools(registry, { apiKey, fetchImpl = globalThis.fetch, endpoint = DEFAULT_ENDPOINT, timeoutMs = 15000 } = {}) {
  registry.register({
    id: 'web.search',
    description: 'Search the web through Serper and return titles, links and snippets.',
    risk: 'read',
    confirmation: 'configurable',
    confirmationSetting: 'webSearchConfirm',
    validateInput: input => {
      const value = requireObject(input, 'web.search')
      if (typeof value.query !== 'string' || !value.query.trim()) {
        throw new TypeError('Search query must be a non-empty string.')
      }
      const query = value.query.trim()
      if (query.length > MAX_QUERY_LENGTH) {
        throw new TypeError(`Search query must be ${MAX_QUERY_LENGTH} characters or fewer.`)
      }
      return { query }
    },
    describeInput: input => `Send this search to Serper: “${String(input.query).slice(0, 120)}”. The query leaves your machine.`,
    execute: async ({ query }) => {
      if (!apiKey) throw new Error('Web search is not configured. Set RATA_SERPER_API_KEY in .env.local.')
      if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation is available for web search.')

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'X-API-KEY': apiKey },
          body: JSON.stringify({ q: query, num: MAX_RESULTS }),
          signal: controller.signal
        })
      } catch (error) {
        // Never surface the raw error: it can contain the endpoint and headers.
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

      const results = Array.isArray(payload?.organic) ? payload.organic.slice(0, MAX_RESULTS).map(sanitizeResult) : []
      if (results.length === 0) {
        return { summary: `No results for “${query}”`, message: `I searched for “${query}” but found nothing usable.`, results: [] }
      }

      const lines = results.map((item, index) => `${index + 1}. ${item.title} — ${item.link}\n   ${item.snippet}`)
      return {
        summary: `${results.length} result(s) for “${query}”`,
        message: `Here is what I found for “${query}”:\n\n${lines.join('\n')}`,
        results
      }
    }
  })

  return registry
}

module.exports = { registerSearchTools, sanitizeResult, DEFAULT_ENDPOINT, MAX_QUERY_LENGTH, MAX_RESULTS }
