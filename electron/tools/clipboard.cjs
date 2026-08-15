function requireObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('clipboard.write input must be an object.')
  }
  return input
}

function create({ clipboardApi }) {
  if (!clipboardApi || typeof clipboardApi.writeText !== 'function') {
    throw new TypeError('clipboardApi dependency is required.')
  }
  return [{
    id: 'clipboard.write',
    description: 'Write text to the system clipboard.',
    risk: 'safe-write',
    confirmation: 'configurable',
    confirmationSetting: 'clipboardConfirm',
    validateInput: input => {
      const value = requireObject(input)
      if (typeof value.text !== 'string' || !value.text || value.text.length > 1_000_000) {
        throw new TypeError('Clipboard text must contain between 1 and 1,000,000 characters.')
      }
      return { text: value.text }
    },
    execute: async ({ text }) => {
      clipboardApi.writeText(text)
      return { summary: 'Clipboard updated', message: 'Done. I copied that text to your clipboard.' }
    }
  }]
}

module.exports = { id: 'clipboard', toolIds: ['clipboard.write'], create }
