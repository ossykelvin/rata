// Null-prototype on purpose. A plain object would resolve inherited keys such
// as "constructor" and could turn an allow-list lookup into an allow-list
// bypass. See docs/reviews/REVIEW-001-mvp-security.md (H2).
const APP_ALLOW_LIST = Object.freeze(Object.assign(Object.create(null), {
  notepad: { exe: 'notepad.exe', label: 'Notepad' },
  calculator: { exe: 'calc.exe', label: 'Calculator' }
}))

function isAllowListedApp(name) {
  return typeof name === 'string' && Object.hasOwn(APP_ALLOW_LIST, name)
}

function requireObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('system.openApp input must be an object.')
  }
  return input
}

function create({ spawnProcess }) {
  if (typeof spawnProcess !== 'function') throw new TypeError('spawnProcess dependency is required.')
  return [{
    id: 'system.openApp',
    description: 'Open an allow-listed Windows application.',
    risk: 'safe-write',
    confirmation: 'never',
    validateInput: input => {
      const value = requireObject(input)
      if (!isAllowListedApp(value.appName)) throw new TypeError('Application is not in the MVP allow-list.')
      return { appName: value.appName }
    },
    execute: async ({ appName }) => {
      if (!isAllowListedApp(appName)) throw new TypeError('Application is not in the MVP allow-list.')
      const target = APP_ALLOW_LIST[appName]
      const child = spawnProcess(target.exe, [], { detached: true, stdio: 'ignore' })
      child.unref()
      return { summary: `${target.label} launched`, message: `Done. I opened ${target.label}.` }
    }
  }]
}

module.exports = { id: 'system', toolIds: ['system.openApp'], create, APP_ALLOW_LIST, isAllowListedApp }
