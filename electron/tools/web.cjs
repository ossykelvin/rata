'use strict'

const MAX_QUERY_LENGTH = 400

function requireObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('web.search input must be an object.')
  }
  return input
}

/**
 * Web domain tools.
 *
 * Risk classification, deliberately: `web.search` only reads, so it is `read`
 * risk — but running it sends the user's query to a third party, and a query
 * can contain sensitive text. docs/SECURITY.md requires external
 * communication to be confirmed by default, so confirmation is `configurable`
 * via `webSearchConfirm`, which ships enabled. A user who searches constantly
 * can turn it off; the default does not assume that for them.
 *
 * The module receives a bound `webSearch(query)` capability, never the API
 * key. See electron/serper-client.cjs.
 */
/**
 * `webSearch` is optional, unlike `spawnProcess` or `clipboardApi`.
 *
 * A missing spawner means the app is misconfigured. A missing search
 * capability is a legitimate state — the user simply has no Serper key — and
 * throwing here would abort composition and take every other tool down with
 * it. Instead the tool registers and fails at execute, so the UI can explain
 * why search is unavailable.
 */
function create({ webSearch } = {}) {
  const search = typeof webSearch === 'function'
    ? webSearch
    : async () => { throw new Error('Web search is not configured. Set RATA_SERPER_API_KEY in .env.local.') }

  return [{
    id: 'web.search',
    description: 'Search the web through Serper and return titles, links and snippets.',
    risk: 'read',
    confirmation: 'configurable',
    confirmationSetting: 'webSearchConfirm',
    validateInput: input => {
      const value = requireObject(input)
      if (typeof value.query !== 'string' || !value.query.trim()) {
        throw new TypeError('Search query must be a non-empty string.')
      }
      const query = value.query.trim()
      if (query.length > MAX_QUERY_LENGTH) {
        throw new TypeError(`Search query must be ${MAX_QUERY_LENGTH} characters or fewer.`)
      }
      return { query }
    },
    // The approval card must say plainly that the query leaves the machine.
    describeInput: input => `Send this search to Serper: “${String(input.query).slice(0, 120)}”. The query leaves your machine.`,
    execute: async ({ query }) => {
      const results = await search(query)
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
  }]
}

module.exports = { id: 'web', toolIds: ['web.search'], create, MAX_QUERY_LENGTH }
