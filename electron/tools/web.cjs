'use strict'

const { createPublicWebFetch, validatePublicUrlSyntax } = require('../public-web-client.cjs')

const MAX_QUERY_LENGTH = 400
const MAX_PREVIEW_CHARS = 4000

function requireObject(input, toolId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolId} input must be an object.`)
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
 * The module receives a bound `webSearch(query)` capability, never the Serper
 * key. `web.fetch` is deliberately keyless: it pins a validated public DNS
 * answer and returns bounded text. Provider credentials stay in their provider
 * adapters and never enter this module.
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
function create({ webSearch, webFetch } = {}) {
  const search =
    typeof webSearch === 'function'
      ? webSearch
      : async () => {
          throw new Error('Web search is not configured. Set RATA_SERPER_API_KEY in .env.local.')
        }
  const fetchPage = typeof webFetch === 'function' ? webFetch : createPublicWebFetch()

  return [
    {
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
      // The approval card must say plainly that the query leaves the machine.
      describeInput: input =>
        `Send this search to Serper: “${String(input.query).slice(0, 120)}”. The query leaves your machine.`,
      execute: async ({ query }) => {
        const results = await search(query)
        if (results.length === 0) {
          return {
            summary: `No results for “${query}”`,
            message: `I searched for “${query}” but found nothing usable.`,
            results: []
          }
        }
        const lines = results.map((item, index) => `${index + 1}. ${item.title} — ${item.link}\n   ${item.snippet}`)
        return {
          summary: `${results.length} result(s) for “${query}”`,
          message: `Here is what I found for “${query}”:\n\n${lines.join('\n')}`,
          results
        }
      }
    },
    {
      id: 'web.fetch',
      description: 'Fetch bounded readable text from a public HTTP(S) page.',
      risk: 'read',
      confirmation: 'configurable',
      confirmationSetting: 'webSearchConfirm',
      validateInput: input => {
        const value = requireObject(input, 'web.fetch')
        return { url: validatePublicUrlSyntax(value.url).toString() }
      },
      describeInput: input =>
        `Fetch this public page: ${String(input.url).slice(0, 300)}. The request leaves your machine.`,
      execute: async ({ url }) => {
        const page = await fetchPage(url)
        const heading = page.title ? `${page.title}\n${page.url}` : page.url
        return {
          summary: `Fetched public page: ${page.url}`,
          message: `${heading}\n\n${page.content.slice(0, MAX_PREVIEW_CHARS)}`,
          ...page
        }
      }
    }
  ]
}

module.exports = {
  id: 'web',
  toolIds: ['web.search', 'web.fetch'],
  create,
  MAX_QUERY_LENGTH,
  MAX_PREVIEW_CHARS
}
