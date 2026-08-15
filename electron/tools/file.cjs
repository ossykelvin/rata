function requireObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('file.delete input must be an object.')
  }
  return input
}

function create() {
  return [{
    id: 'file.delete',
    description: 'Delete a file. Not implemented in MVP.',
    risk: 'destructive',
    confirmation: 'always',
    validateInput: requireObject,
    execute: async () => { throw new Error('Destructive file operations are disabled in MVP.') }
  }]
}

module.exports = { id: 'file', toolIds: ['file.delete'], create }
