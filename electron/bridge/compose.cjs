function validateBridgeModule(module, IPC) {
  if (!module || typeof module !== 'object') throw new TypeError('Bridge module must export an object.')
  if (typeof module.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(module.id)) {
    throw new TypeError('Bridge module must declare a lowercase id.')
  }
  if (!Array.isArray(module.channels) || module.channels.length === 0 || module.channels.some(key => typeof key !== 'string')) {
    throw new TypeError(`Bridge module ${module.id} must declare channel keys.`)
  }
  if (typeof module.create !== 'function') throw new TypeError(`Bridge module ${module.id} must declare create().`)
  for (const key of module.channels) {
    if (typeof IPC[key] !== 'string' || !IPC[key]) throw new TypeError(`Bridge module ${module.id} references unknown channel key: ${key}`)
  }
}

function composeBridge({ ipcRenderer, IPC, modules }) {
  if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function' || typeof ipcRenderer.on !== 'function' || typeof ipcRenderer.removeListener !== 'function') {
    throw new TypeError('A scoped ipcRenderer implementation is required.')
  }
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new TypeError('At least one preload bridge module is required.')
  }

  const ids = new Set()
  const channelOwners = new Map()
  const bridge = {}
  for (const module of modules) {
    validateBridgeModule(module, IPC)
    if (ids.has(module.id)) throw new Error(`Duplicate bridge module id: ${module.id}`)
    ids.add(module.id)
    for (const key of module.channels) {
      if (channelOwners.has(key)) throw new Error(`Bridge channel key ${key} is declared by both ${channelOwners.get(key)} and ${module.id}.`)
      channelOwners.set(key, module.id)
    }

    const declared = new Set(module.channels)
    const requireChannel = key => {
      if (!declared.has(key)) throw new Error(`Bridge module ${module.id} attempted undeclared channel: ${key}`)
      return IPC[key]
    }
    const invoke = (key, payload) => ipcRenderer.invoke(requireChannel(key), payload)
    const subscribe = (key, callback) => {
      if (typeof callback !== 'function') throw new TypeError(`Bridge subscription callback for ${key} must be a function.`)
      const channel = requireChannel(key)
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
    const fragment = module.create({ invoke, subscribe })
    if (!fragment || typeof fragment !== 'object' || Array.isArray(fragment)) {
      throw new TypeError(`Bridge module ${module.id} must create an object.`)
    }
    for (const [name, value] of Object.entries(fragment)) {
      if (Object.hasOwn(bridge, name)) throw new Error(`Duplicate preload bridge property: ${name}`)
      if (typeof value !== 'function') throw new TypeError(`Preload bridge property ${name} must be a function.`)
      bridge[name] = value
    }
  }
  return Object.freeze(bridge)
}

function exposeRataBridge({ contextBridge, ipcRenderer, IPC, modules }) {
  const bridge = composeBridge({ ipcRenderer, IPC, modules })
  contextBridge.exposeInMainWorld('rata', bridge)
  return bridge
}

module.exports = { composeBridge, exposeRataBridge, validateBridgeModule }
