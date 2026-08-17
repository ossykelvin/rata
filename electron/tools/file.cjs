const path = require('node:path')

/**
 * The `file.` domain. RATA-006 added read-only access; RATA-013 adds
 * `file.save`; RATA-014 adds `folder.create`, `file.move` and `file.rename`.
 * `file.delete` stays disabled.
 *
 * The security core lives in electron/file-access.cjs — this module is the
 * contract layer: risk, confirmation, input validation and what the approval
 * card says.
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
    resolvePath: unavailable,
    prepareSave: unavailable,
    saveTextFile: unavailable,
    prepareCreateFolder: unavailable,
    createFolder: unavailable,
    prepareMove: unavailable,
    moveFile: unavailable,
    prepareRename: unavailable,
    renameFile: unavailable
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
    },
    {
      id: 'file.save',
      description:
        'Write a text file inside Documents, Downloads or Desktop. v1 saves Markdown or HTML text, not .docx or PowerPoint.',
      risk: 'safe-write',
      confirmation: 'configurable',
      confirmationSetting: 'fileWriteConfirm',
      validateInput: input => {
        const value = requireObject(input, 'file.save')
        if (typeof value.path !== 'string' || !value.path.trim()) {
          throw new TypeError('file.save requires a file path.')
        }
        if (value.path.length > 4096 || value.path.includes('\0')) {
          throw new TypeError('file.save received an invalid path.')
        }
        return access.prepareSave({
          path: value.path,
          content: value.content,
          overwrite: value.overwrite
        })
      },
      describeInput: input => {
        const target = String(input.path)
        const bytes = Number.isInteger(input.byteLength) ? input.byteLength : 0
        if (input.overwrite === true || input.exists === true) {
          return `Save ${bytes} byte(s) to ${target}. This overwrites the existing file.`
        }
        return `Save ${bytes} byte(s) to ${target}.`
      },
      execute: async ({ path: target, content, overwrite }) => {
        const saved = await access.saveTextFile({ path: target, content, overwrite })
        return {
          ...saved,
          summary: saved.overwritten ? `Overwrote ${saved.name}` : `Saved ${saved.name}`,
          message: saved.overwritten
            ? `I replaced ${saved.name} (${saved.byteLength} bytes).`
            : `I saved ${saved.name} (${saved.byteLength} bytes).`
        }
      }
    },
    {
      id: 'folder.create',
      description:
        'Create one folder inside Documents, Downloads or Desktop. The parent folder must already exist. Does not create files.',
      risk: 'safe-write',
      confirmation: 'configurable',
      confirmationSetting: 'fileWriteConfirm',
      validateInput: input => {
        const value = requireObject(input, 'folder.create')
        if (typeof value.path !== 'string' || !value.path.trim()) {
          throw new TypeError('folder.create requires a folder path.')
        }
        if (value.path.length > 4096 || value.path.includes('\0')) {
          throw new TypeError('folder.create received an invalid path.')
        }
        return access.prepareCreateFolder({ path: value.path })
      },
      describeInput: input => `Create folder ${String(input.path)}.`,
      execute: async ({ path: target }) => {
        const created = await access.createFolder({ path: target })
        return {
          ...created,
          summary: `Created ${created.name}`,
          message: `I created the folder ${created.name}.`
        }
      }
    },
    {
      id: 'file.move',
      description:
        'Move one file inside Documents, Downloads or Desktop. Destination folders must already exist. Does not move folders.',
      risk: 'safe-write',
      confirmation: 'configurable',
      confirmationSetting: 'fileWriteConfirm',
      validateInput: input => {
        const value = requireObject(input, 'file.move')
        if (typeof value.source !== 'string' || !value.source.trim()) {
          throw new TypeError('file.move requires a source path.')
        }
        if (typeof value.destination !== 'string' || !value.destination.trim()) {
          throw new TypeError('file.move requires a destination path.')
        }
        if (value.source.length > 4096 || value.source.includes('\0') ||
            value.destination.length > 4096 || value.destination.includes('\0')) {
          throw new TypeError('file.move received an invalid path.')
        }
        return access.prepareMove({
          source: value.source,
          destination: value.destination,
          overwrite: value.overwrite
        })
      },
      describeInput: input => {
        const source = String(input.source)
        const destination = String(input.destination)
        if (input.overwrite === true || input.exists === true) {
          return `Move ${source} to ${destination}. This overwrites the existing file.`
        }
        return `Move ${source} to ${destination}.`
      },
      execute: async ({ source, destination, overwrite }) => {
        const moved = await access.moveFile({ source, destination, overwrite })
        return {
          ...moved,
          summary: moved.overwritten ? `Replaced ${moved.name}` : `Moved ${moved.name}`,
          message: moved.overwritten
            ? `I moved the file to ${moved.name}, replacing the file that was already there.`
            : `I moved the file to ${moved.name}.`
        }
      }
    },
    {
      id: 'file.rename',
      description:
        'Rename one file in the same folder inside Documents, Downloads or Desktop. Use file.move to change folders.',
      risk: 'safe-write',
      confirmation: 'configurable',
      confirmationSetting: 'fileWriteConfirm',
      validateInput: input => {
        const value = requireObject(input, 'file.rename')
        if (typeof value.path !== 'string' || !value.path.trim()) {
          throw new TypeError('file.rename requires a file path.')
        }
        if (value.path.length > 4096 || value.path.includes('\0')) {
          throw new TypeError('file.rename received an invalid path.')
        }
        return access.prepareRename({
          path: value.path,
          name: value.name,
          destination: value.destination,
          overwrite: value.overwrite
        })
      },
      describeInput: input => {
        const source = String(input.source)
        const destination = String(input.destination)
        if (input.overwrite === true || input.exists === true) {
          return `Rename ${source} to ${destination}. This overwrites the existing file.`
        }
        return `Rename ${source} to ${destination}.`
      },
      execute: async ({ source, name, overwrite }) => {
        const renamed = await access.renameFile({ path: source, name, overwrite })
        return {
          ...renamed,
          summary: renamed.overwritten ? `Replaced ${renamed.name}` : `Renamed ${renamed.name}`,
          message: renamed.overwritten
            ? `I renamed the file to ${renamed.name}, replacing the file that was already there.`
            : `I renamed the file to ${renamed.name}.`
        }
      }
    }
  ]
}

module.exports = {
  id: 'file',
  toolIds: [
    'file.delete',
    'file.search',
    'file.stat',
    'file.readText',
    'file.searchContent',
    'file.reveal',
    'file.save',
    'folder.create',
    'file.move',
    'file.rename'
  ],
  create
}
