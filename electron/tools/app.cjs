'use strict'

const {
  AppCatalogError,
  CATALOG_ID_PATTERN,
  MAX_QUERY_LENGTH,
  isCatalogId,
  looksLikePath
} = require('../app-catalog.cjs')

function requireObject(input, toolId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolId} input must be an object.`)
  }
  return input
}

function publicError(error, fallback) {
  if (error instanceof AppCatalogError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function requireQuery(input) {
  const value = requireObject(input, 'app.find')
  const keys = Object.keys(value)
  if (keys.some(key => key !== 'query')) {
    throw new TypeError('app.find accepts only a query.')
  }
  if (typeof value.query !== 'string' || !value.query.trim()) {
    throw new TypeError('app.find requires a query.')
  }
  if (value.query.length > MAX_QUERY_LENGTH) {
    throw new TypeError(`app.find queries must be ${MAX_QUERY_LENGTH} characters or fewer.`)
  }
  return { query: value.query.trim() }
}

function requireCatalogId(input, toolId) {
  const value = requireObject(input, toolId)
  const keys = Object.keys(value)
  if (keys.length !== 1 || keys[0] !== 'id') {
    throw new TypeError(`${toolId} accepts only a catalog id.`)
  }
  const id = value.id
  if (typeof id !== 'string' || looksLikePath(id) || !isCatalogId(id) || !CATALOG_ID_PATTERN.test(id)) {
    throw new TypeError(`${toolId} requires a catalog id.`)
  }
  return { id }
}

function unavailableCatalog() {
  throw new TypeError('Application catalog is not configured.')
}

function inertCatalog() {
  return {
    refresh: async () => ({ size: 0 }),
    getById: () => null,
    list: () => [],
    find: () => [],
    get size() { return 0 }
  }
}

function create({
  catalog,
  launchApp,
  focusApp
} = {}) {
  const apps = catalog || inertCatalog()

  function requireEntry(id, toolId) {
    if (typeof apps.getById !== 'function') unavailableCatalog()
    const entry = apps.getById(id)
    if (!entry || !entry.target || !entry.name || entry.id !== id) {
      throw new TypeError(`${toolId === 'app.launch' ? 'That application is not available to launch.' : 'That application is not available.'}`)
    }
    return entry
  }

  return [
    {
      id: 'app.find',
      description: 'Find installed applications in the Start Menu catalog by name.',
      risk: 'read',
      confirmation: 'never',
      validateInput: requireQuery,
      execute: async ({ query }) => {
        const matches = (apps.find(query) || []).map(match => {
          const row = { id: match.id, name: match.name }
          if (match.publisher) row.publisher = match.publisher
          return row
        })
        const summary = matches.length
          ? `Found ${matches.length} app(s) matching “${query}”`
          : `No installed apps matched “${query}”`
        const names = matches.map(match => match.name).join(', ')
        return {
          summary,
          message: matches.length
            ? `I found ${matches.length === 1 ? names : `${matches.length} matches: ${names}`}.`
            : `I could not find an installed app matching “${query}”.`,
          matches
        }
      }
    },
    {
      id: 'app.launch',
      description: 'Launch an installed application from the Start Menu catalog.',
      risk: 'safe-write',
      confirmation: 'always',
      validateInput: input => {
        const { id } = requireCatalogId(input, 'app.launch')
        requireEntry(id, 'app.launch')
        return { id }
      },
      describeInput: ({ id }) => {
        const entry = apps.getById(id)
        if (!entry) return 'Launch an installed application.'
        return `Launch ${entry.name} (${entry.target}).`
      },
      execute: async ({ id }) => {
        const entry = requireEntry(id, 'app.launch')
        if (typeof launchApp !== 'function') {
          throw new TypeError('Application launching is not configured.')
        }
        try {
          await launchApp(entry.target)
        } catch (error) {
          throw new Error(publicError(error, 'The application could not be started.'), { cause: error })
        }
        return {
          summary: `Launched ${entry.name}`,
          message: `Done. I opened ${entry.name}.`,
          launched: true,
          name: entry.name
        }
      }
    },
    {
      id: 'app.focus',
      description: 'Focus a running window of a catalogued application. Does not start a second instance.',
      risk: 'safe-write',
      confirmation: 'configurable',
      confirmationSetting: 'appFocusConfirm',
      validateInput: input => {
        const { id } = requireCatalogId(input, 'app.focus')
        requireEntry(id, 'app.focus')
        return { id }
      },
      describeInput: ({ id }) => {
        const entry = apps.getById(id)
        if (!entry) return 'Focus a running application.'
        return `Bring ${entry.name} to the front if it is already running.`
      },
      execute: async ({ id }) => {
        const entry = requireEntry(id, 'app.focus')
        if (typeof focusApp !== 'function') {
          throw new TypeError('Application focusing is not configured.')
        }
        let result
        try {
          result = await focusApp(entry.target)
        } catch (error) {
          throw new Error(publicError(error, 'The application could not be focused.'), { cause: error })
        }
        const focused = result && result.focused === true
        return {
          summary: focused ? `Focused ${entry.name}` : `Could not focus ${entry.name}`,
          message: focused
            ? `Brought ${entry.name} to the front.`
            : `${entry.name} is not running in a window I can focus. I did not start a second copy.`,
          focused,
          name: entry.name
        }
      }
    }
  ]
}

module.exports = {
  id: 'app',
  toolIds: ['app.find', 'app.launch', 'app.focus'],
  create
}
