'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * Loads local configuration for the Electron main process.
 *
 * Secrets live here and nowhere else. They are never passed over IPC, never
 * written to the JSON store, and never placed in an audit event
 * (AGENTS.md rules 12, 13). The renderer learns only whether a provider is
 * configured — a boolean — via the provider status channel.
 *
 * A hand-rolled parser rather than a dependency: this reads credentials, and
 * the smaller the code that touches them the better.
 *
 * docs/SECURITY.md still applies — a plain file is a development convenience.
 * Production credentials belong in OS-backed secret storage.
 */

/** Files are read in order; the first definition of a key wins. */
const ENV_FILES = Object.freeze(['.env.local', '.env'])

function parseEnv(contents) {
  const values = Object.create(null)
  for (const rawLine of String(contents).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = line.slice(separator + 1).trim()
    // Strip one layer of matching quotes; leave inner content untouched.
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1)
    }
    if (!(key in values)) values[key] = value
  }
  return values
}

function readEnvFiles(rootDir, files = ENV_FILES) {
  const merged = Object.create(null)
  for (const name of files) {
    const file = path.join(rootDir, name)
    let contents
    try {
      if (!fs.existsSync(file)) continue
      contents = fs.readFileSync(file, 'utf8')
    } catch {
      // An unreadable env file must not stop the app booting in mock mode.
      continue
    }
    for (const [key, value] of Object.entries(parseEnv(contents))) {
      if (!(key in merged)) merged[key] = value
    }
  }
  return merged
}

function trimmed(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Builds the runtime configuration. `env` defaults to the merged env files
 * plus `process.env`, with real environment variables taking precedence so a
 * CI or shell override wins over a checked-out file.
 */
function loadRuntimeConfig({ rootDir = path.join(__dirname, '..'), processEnv = process.env, files } = {}) {
  const fromFiles = readEnvFiles(rootDir, files)
  const env = { ...fromFiles, ...Object.fromEntries(Object.entries(processEnv).filter(([, v]) => typeof v === 'string' && v !== '')) }

  return {
    // Default provider mode when the stored setting has never been changed.
    defaultProviderMode: trimmed(env.RATA_AI_PROVIDER) || 'mock',
    gemini: {
      apiKey: trimmed(env.GEMINI_API_KEY),
      model: trimmed(env.GEMINI_MODEL) || undefined
    },
    openrouter: {
      apiKey: trimmed(env.OPENROUTER_API_KEY),
      baseUrl: trimmed(env.OPENROUTER_BASE_URL) || undefined,
      model: trimmed(env.OPENROUTER_MODEL) || undefined
    },
    serper: {
      apiKey: trimmed(env.RATA_SERPER_API_KEY)
    }
  }
}

/** Booleans only — safe to log and safe to send to the renderer. */
function describeConfig(config) {
  return {
    defaultProviderMode: config.defaultProviderMode,
    gemini: Boolean(config.gemini.apiKey),
    openrouter: Boolean(config.openrouter.apiKey),
    serper: Boolean(config.serper.apiKey)
  }
}

module.exports = { ENV_FILES, parseEnv, readEnvFiles, loadRuntimeConfig, describeConfig }
