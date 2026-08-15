const test = require('node:test')
const assert = require('node:assert/strict')

const { registerIpcHandlers } = require('../electron/ipc/index.cjs')
const providersHandler = require('../electron/ipc/providers.cjs')
const providersBridge = require('../electron/bridge/providers.cjs')
const { composeBridge } = require('../electron/bridge/compose.cjs')
const { IPC } = require('../packages/contracts/ipc-channels.cjs')
const {
  createProviderChain,
  createGeminiProvider,
  createOpenRouterProvider
} = require('../packages/agent-core/providers/index.cjs')

const APP_ORIGIN = 'http://127.0.0.1:5173/'
const GEMINI_SECRET = 'gemini-key-do-not-leak'
const OPENROUTER_SECRET = 'openrouter-key-do-not-leak'

function fakeIpcMain() {
  const handlers = new Map()
  return {
    handle: (channel, handler) => handlers.set(channel, handler),
    removeHandler: channel => handlers.delete(channel),
    invoke: (channel, event, ...args) => handlers.get(channel)(event, ...args),
    channels: () => [...handlers.keys()]
  }
}

function realChain() {
  return createProviderChain({
    mode: 'auto',
    gemini: createGeminiProvider({ apiKey: GEMINI_SECRET }),
    openrouter: createOpenRouterProvider({ apiKey: OPENROUTER_SECRET })
  })
}

function wire({ provider = realChain(), searchConfigured = true } = {}) {
  const ipcMain = fakeIpcMain()
  registerIpcHandlers({
    ipcMain,
    IPC,
    isTrustedSender: event => event?.senderFrame?.url === APP_ORIGIN,
    services: { getProvider: () => provider, isSearchConfigured: () => searchConfigured },
    modules: [providersHandler]
  })
  return ipcMain
}

const trusted = { senderFrame: { url: APP_ORIGIN } }

test('the channel is declared in the shared contract', () => {
  assert.equal(typeof IPC.getProviders, 'string')
  assert.match(IPC.getProviders, /^rata:/)
})

test('provider status never carries a credential', async () => {
  const snapshot = await wire().invoke(IPC.getProviders, trusted)
  const serialized = JSON.stringify(snapshot)
  assert.equal(serialized.includes(GEMINI_SECRET), false, 'the Gemini key leaked over IPC')
  assert.equal(serialized.includes(OPENROUTER_SECRET), false, 'the OpenRouter key leaked over IPC')
  assert.equal(/apiKey|api_key|secret|token/i.test(serialized), false, 'a credential-shaped field leaked')
})

test('status reports configuration as booleans', async () => {
  const snapshot = await wire().invoke(IPC.getProviders, trusted)
  assert.equal(snapshot.mode, 'auto')
  assert.equal(snapshot.searchConfigured, true)
  const gemini = snapshot.providers.find(p => p.id === 'gemini')
  assert.equal(gemini.configured, true)
  assert.equal(gemini.label, 'Google Gemini')
  assert.equal(typeof gemini.model, 'string')
})

test('an unconfigured provider is reported, not hidden', async () => {
  const chain = createProviderChain({
    mode: 'auto',
    gemini: createGeminiProvider({ apiKey: null }),
    openrouter: createOpenRouterProvider({ apiKey: OPENROUTER_SECRET })
  })
  const snapshot = await wire({ provider: chain, searchConfigured: false }).invoke(IPC.getProviders, trusted)
  assert.equal(snapshot.providers.find(p => p.id === 'gemini').configured, false)
  assert.equal(snapshot.providers.find(p => p.id === 'openrouter').configured, true)
  assert.equal(snapshot.searchConfigured, false)
})

test('the channel inherits the untrusted-sender guard', async () => {
  const ipcMain = wire()
  await assert.rejects(
    async () => ipcMain.invoke(IPC.getProviders, { senderFrame: { url: 'https://evil.example/' } }),
    /untrusted frame/
  )
})

test('missing provider wiring degrades safely rather than throwing', async () => {
  const ipcMain = fakeIpcMain()
  registerIpcHandlers({
    ipcMain,
    IPC,
    isTrustedSender: () => true,
    services: {},
    modules: [providersHandler]
  })
  const snapshot = await ipcMain.invoke(IPC.getProviders, trusted)
  assert.deepEqual(snapshot, { mode: 'mock', providers: [], searchConfigured: false })
})

test('the preload fragment exposes only the declared channel', () => {
  const invoked = []
  const bridge = composeBridge({
    ipcRenderer: { invoke: channel => { invoked.push(channel); return Promise.resolve() }, on() {}, removeListener() {} },
    IPC,
    modules: [providersBridge]
  })
  assert.deepEqual(Object.keys(bridge), ['getProviders'])
  bridge.getProviders()
  assert.deepEqual(invoked, [IPC.getProviders])
  assert.equal(Object.isFrozen(bridge), true)
})
