const path = require('node:path')

/**
 * The `file.` domain. RATA-006 adds read-only access; `file.delete` stays
 * disabled.
 *
 * Every tool here is read-only by construction. The security core lives in
 * electron/file-access.cjs — this module is the contract layer: risk,
 * confirmation, input validation and what the approval card says.
 *
 * `fileAccess` is optional in the same way `webSearch` is. A machine with no
 * readable roots configured is a legitimate state, and throwing during
 * composition would take every other tool down with it. The tools register and
 * fail at execute, so the UI can explain why.
 */
function requireObject(input, toolId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolId} input must be an object.`)
  }
  return input
}

function requireQuery(value, toolId) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${toolId} requires a search term.`)
  }
  if (value.length > 200) {
    throw new TypeError(`${toolId} search terms must be 200 characters or fewer.`)
  }
  return value.trim()
}

function requirePath(value, toolId) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${toolId} requires a file path.`)
  }
  if (value.length > 4096 || value.includes('\0')) {
    throw new TypeError(`${toolId} received an invalid path.`)
  }
  return value
}

function requireLimit(value) {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    throw new TypeError('A result limit must be a whole number between 1 and 50.')
  }
  return value
}

function unavailable() {
  throw new Error('Local file access is not configured.')
}

function create({ fileAccess, revealItem } = {}) {
  const access = fileAccess || {
    roots: [],
    searchFiles: unavailable,
    statFile: unavailable,
    readTextFile: unavailable,
    searchFileContent: unavailable,
    resolvePath: unavailable
  }

  return [
    {
      id: 'file.delete',
      description: 'Delete a file. Not implemented in MVP.',
      risk: 'destructive',
      confirmation: 'always',
      validateInput: input => requireObject(input, 'file.delete'),
      execute: async () => { throw new Error('Destructive file operations are disabled in MVP.') }
    },
    {
      id: 'file.search',
      description: 'Find files by name within the folders Rata may read.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => {
        const value = requireObject(input, 'file.search')
        const query = requireQuery(value.query, 'file.search')
        const limit = requireLimit(value.limit)
        return limit === undefined ? { query } : { query, limit }
      },
      execute: async ({ query, limit }) => {
        const { results, truncated } = await access.searchFiles({ query, limit })
        const summary = results.length
          ? `Found ${results.length}${truncated ? '+' : ''} file(s) matching “${query}”`
          : `No files matched “${query}”`
        return {
          results,
          truncated,
          summary,
          message: results.length
            ? `${summary}:\n${results.map(item => `• ${item.name} — ${item.path}`).join('\n')}`
            : `${summary}. I only look inside the folders you have allowed.`
        }
      }
    },
    {
      id: 'file.stat',
      description: 'Report size and timestamps for one file Rata may read.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => {
        const value = requireObject(input, 'file.stat')
        return { path: requirePath(value.path, 'file.stat') }
      },
      execute: async ({ path: target }) => {
        const info = await access.statFile({ path: target })
        return {
          ...info,
          summary: `${info.name} — ${info.size} bytes`,
          message: `${info.name} is ${info.size} bytes, last modified ${info.modified}.`
        }
      }
    },
    {
      id: 'file.readText',
      // Content read here is passed to a provider, so it is an egress decision
      // exactly like web.fetch, and it is confirmed by the same mechanism.
      description: 'Read bounded text from one file within the folders Rata may read.',
      risk: 'read',
      confirmation: 'configurable',
      confirmationSetting: 'fileReadConfirm',
      validateInput: input => {
        const value = requireObject(input, 'file.readText')
        return { path: requirePath(value.path, 'file.readText') }
      },
      describeInput: input =>
        `Read the contents of ${String(input.path).slice(0, 300)}. The text may be sent to your AI provider.`,
      execute: async ({ path: target }) => {
        const file = await access.readTextFile({ path: target })
        return {
          ...file,
          summary: `Read ${file.name}${file.truncated ? ' (truncated)' : ''}`,
          message: `I read ${file.name}${file.truncated ? ' (truncated to the read limit)' : ''}.`
        }
      }
    },
    {
      id: 'file.searchContent',
      description: 'Search inside readable text files for a phrase.',
      risk: 'read',
      confirmation: 'configurable',
      confirmationSetting: 'fileReadConfirm',
      validateInput: input => {
        const value = requireObject(input, 'file.searchContent')
        const query = requireQuery(value.query, 'file.searchContent')
        const limit = requireLimit(value.limit)
        return limit === undefined ? { query } : { query, limit }
      },
      describeInput: input =>
        `Search inside your readable files for “${String(input.query).slice(0, 120)}”. Matching text may be sent to your AI provider.`,
      execute: async ({ query, limit }) => {
        const { matches, truncated, trust } = await access.searchFileContent({ query, limit })
        const summary = matches.length
          ? `Found ${matches.length}${truncated ? '+' : ''} match(es) for “${query}”`
          : `No file contents matched “${query}”`
        return {
          matches,
          truncated,
          trust,
          summary,
          message: matches.length
            ? `${summary}:\n${matches.map(item => `• ${item.name}:${item.line} — ${item.snippet}`).join('\n')}`
            : summary
        }
      }
    },
    {
      id: 'file.reveal',
      // Opens an Explorer window. It changes nothing on disk, but it is a
      // visible side effect rather than a pure read, so it is not risk 'read'.
      description: 'Show one file in Windows Explorer.',
      risk: 'safe-write',
      confirmation: 'never',
      validateInput: input => {
        const value = requireObject(input, 'file.reveal')
        return { path: requirePath(value.path, 'file.reveal') }
      },
      execute: async ({ path: target }) => {
        // Resolved through the same gate as every read, so reveal cannot be
        // used to point Explorer at a path outside the allowed roots.
        const resolved = access.resolvePath(target)
        if (typeof revealItem !== 'function') {
          throw new Error('Showing files in Explorer is not available.')
        }
        revealItem(resolved)
        return {
          path: resolved,
          summary: `Revealed ${path.basename(resolved)}`,
          message: `I opened Explorer at ${path.basename(resolved)}.`
        }
      }
    }
  ]
}

module.exports = {
  id: 'file',
  toolIds: ['file.delete', 'file.search', 'file.stat', 'file.readText', 'file.searchContent', 'file.reveal'],
  create
}
