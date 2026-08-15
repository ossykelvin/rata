const fs = require('node:fs')
const path = require('node:path')

function discoverHandlerModules(directory = __dirname) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.cjs') && entry.name !== 'index.cjs')
    .map(entry => path.join(directory, entry.name))
    .sort()
    .map(modulePath => require(modulePath))
}

function validateHandlerModule(module, IPC) {
  if (!module || typeof module !== 'object') throw new TypeError('IPC handler module must export an object.')
  if (typeof module.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(module.id)) {
    throw new TypeError('IPC handler module must declare a lowercase id.')
  }
  if (!Array.isArray(module.channels) || module.channels.length === 0 || module.channels.some(key => typeof key !== 'string')) {
    throw new TypeError(`IPC handler module ${module.id} must declare channel keys.`)
  }
  if (typeof module.register !== 'function') throw new TypeError(`IPC handler module ${module.id} must declare register().`)
  for (const key of module.channels) {
    if (typeof IPC[key] !== 'string' || !IPC[key]) throw new TypeError(`IPC handler module ${module.id} references unknown channel key: ${key}`)
  }
}

function registerIpcHandlers({ ipcMain, IPC, services, modules = discoverHandlerModules() }) {
  if (!ipcMain || typeof ipcMain.handle !== 'function' || typeof ipcMain.removeHandler !== 'function') {
    throw new TypeError('A scoped ipcMain implementation is required.')
  }
  if (!IPC || typeof IPC !== 'object') throw new TypeError('The IPC contract aggregate is required.')

  const ids = new Set()
  const ownersByChannel = new Map()
  for (const module of modules) {
    validateHandlerModule(module, IPC)
    if (ids.has(module.id)) throw new Error(`Duplicate IPC handler module id: ${module.id}`)
    ids.add(module.id)
    for (const key of module.channels) {
      if (ownersByChannel.has(key)) {
        throw new Error(`IPC channel key ${key} is declared by both ${ownersByChannel.get(key)} and ${module.id}.`)
      }
      ownersByChannel.set(key, module.id)
    }
  }

  const registeredChannels = []
  try {
    for (const module of modules) {
      const declared = new Set(module.channels)
      const registeredByModule = new Set()
      const handle = (key, handler) => {
        if (!declared.has(key)) throw new Error(`IPC handler module ${module.id} attempted undeclared channel: ${key}`)
        if (registeredByModule.has(key)) throw new Error(`IPC handler module ${module.id} registered ${key} more than once.`)
        if (typeof handler !== 'function') throw new TypeError(`IPC handler for ${key} must be a function.`)
        registeredByModule.add(key)
        const channel = IPC[key]
        ipcMain.handle(channel, handler)
        registeredChannels.push(channel)
      }
      module.register({ handle, IPC, services })
      for (const key of declared) {
        if (!registeredByModule.has(key)) throw new Error(`IPC handler module ${module.id} did not register declared channel: ${key}`)
      }
    }
  } catch (error) {
    for (const channel of registeredChannels) ipcMain.removeHandler(channel)
    throw error
  }

  return () => {
    for (const channel of registeredChannels) ipcMain.removeHandler(channel)
  }
}

module.exports = { discoverHandlerModules, registerIpcHandlers }
