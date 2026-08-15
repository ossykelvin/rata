const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { evaluateExpression, formatNumber } = require('../packages/agent-core/calculator.cjs')

const APP_ALLOW_LIST = Object.freeze({
  notepad: { exe: 'notepad.exe', label: 'Notepad' },
  calculator: { exe: 'calc.exe', label: 'Calculator' }
})

function requireObject(input, toolId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolId} input must be an object.`)
  }
  return input
}

function createMvpRegistry({ spawnProcess, clipboardApi }) {
  if (typeof spawnProcess !== 'function') throw new TypeError('spawnProcess dependency is required.')
  if (!clipboardApi || typeof clipboardApi.writeText !== 'function') throw new TypeError('clipboardApi dependency is required.')

  const registry = new ToolRegistry()

  registry.register({
    id: 'system.openApp',
    description: 'Open an allow-listed Windows application.',
    risk: 'safe-write',
    confirmation: 'never',
    validateInput: input => {
      const value = requireObject(input, 'system.openApp')
      if (typeof value.appName !== 'string' || !APP_ALLOW_LIST[value.appName]) {
        throw new TypeError('Application is not in the MVP allow-list.')
      }
      return { appName: value.appName }
    },
    execute: async ({ appName }) => {
      const target = APP_ALLOW_LIST[appName]
      const child = spawnProcess(target.exe, [], { detached: true, stdio: 'ignore' })
      child.unref()
      return { summary: `${target.label} launched`, message: `Done. I opened ${target.label}.` }
    }
  })

  registry.register({
    id: 'clipboard.write',
    description: 'Write text to the system clipboard.',
    risk: 'safe-write',
    confirmation: 'configurable',
    confirmationSetting: 'clipboardConfirm',
    validateInput: input => {
      const value = requireObject(input, 'clipboard.write')
      if (typeof value.text !== 'string' || !value.text || value.text.length > 1_000_000) {
        throw new TypeError('Clipboard text must contain between 1 and 1,000,000 characters.')
      }
      return { text: value.text }
    },
    execute: async ({ text }) => {
      clipboardApi.writeText(text)
      return { summary: 'Clipboard updated', message: 'Done. I copied that text to your clipboard.' }
    }
  })

  registry.register({
    id: 'calculator.evaluate',
    description: 'Evaluate a safe arithmetic expression.',
    risk: 'read',
    confirmation: 'never',
    validateInput: input => {
      const value = requireObject(input, 'calculator.evaluate')
      if (typeof value.expression !== 'string' || !value.expression.trim()) {
        throw new TypeError('Calculator expression must be a non-empty string.')
      }
      return { expression: value.expression.trim() }
    },
    execute: async ({ expression }) => {
      const result = evaluateExpression(expression)
      const formatted = formatNumber(result)
      return {
        summary: `Calculated ${expression}`,
        message: `${expression} = ${formatted}`
      }
    }
  })

  registry.register({
    id: 'file.delete',
    description: 'Delete a file. Not implemented in MVP.',
    risk: 'destructive',
    confirmation: 'always',
    validateInput: input => requireObject(input, 'file.delete'),
    execute: async () => { throw new Error('Destructive file operations are disabled in MVP.') }
  })

  return registry
}

module.exports = { APP_ALLOW_LIST, createMvpRegistry }
