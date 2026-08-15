const test = require('node:test')
const assert = require('node:assert/strict')

const { createSecurityPolicy } = require('../electron/security.cjs')
const { registerIpcHandlers } = require('../electron/ipc/index.cjs')

// Regression cover for REVIEW-001 findings H3 and H4.
//
// H3: neither window restricted navigation or window.open, so a renderer
//     navigated to a remote origin inherited the preload bridge.
// H4: no IPC handler checked event.senderFrame, so any frame in a Rata window
//     could invoke every privileged channel.

const APP_ORIGIN = 'http://127.0.0.1:5173/'

const FOREIGN_URLS = [
  'https://evil.example/',
  'http://127.0.0.1:5174/',
  'file:///C:/Windows/System32/drivers/etc/hosts',
  'data:text/html,<script>fetch("/steal")</script>',
  'javascript:void(0)',
  // Prefix-confusion attempts against a naive startsWith check.
  'http://127.0.0.1:5173.evil.example/',
  'https://127.0.0.1:5173/'
]

function policy(onBlocked = () => {}) {
  return createSecurityPolicy({ allowedPrefixes: [APP_ORIGIN], onBlocked })
}

/** Minimal stand-in for BrowserWindow.webContents. */
function fakeWindow() {
  const listeners = new Map()
  let openHandler = null
  return {
    webContents: {
      on(eventName, listener) {
        listeners.set(eventName, listener)
      },
      setWindowOpenHandler(handler) {
        openHandler = handler
      }
    },
    emit(eventName, url) {
      const listener = listeners.get(eventName)
      if (!listener) throw new Error(`no listener registered for ${eventName}`)
      let prevented = false
      listener({ preventDefault: () => { prevented = true } }, url)
      return prevented
    },
    open(url) {
      return openHandler({ url })
    },
    has(eventName) {
      return listeners.has(eventName)
    }
  }
}

test('the security policy requires at least one allowed prefix', () => {
  assert.throws(() => createSecurityPolicy({ allowedPrefixes: [] }), /at least one allowed URL prefix/)
  assert.throws(() => createSecurityPolicy({}), /at least one allowed URL prefix/)
  assert.throws(() => createSecurityPolicy({ allowedPrefixes: [''] }), /non-empty strings/)
})

test('only the application origin is treated as our renderer', () => {
  const { isAllowedUrl } = policy()
  assert.equal(isAllowedUrl(APP_ORIGIN), true)
  assert.equal(isAllowedUrl(`${APP_ORIGIN}#/overlay`), true)
  assert.equal(isAllowedUrl(`${APP_ORIGIN}#/control`), true)
  for (const url of FOREIGN_URLS) {
    assert.equal(isAllowedUrl(url), false, `should not have allowed: ${url}`)
  }
})

test('missing or malformed URLs fail closed', () => {
  const { isAllowedUrl } = policy()
  for (const url of [undefined, null, '', 0, {}, [], true]) {
    assert.equal(isAllowedUrl(url), false)
  }
})

test('H3: foreign navigation and redirects are prevented', () => {
  const blocked = []
  const win = fakeWindow()
  policy(details => blocked.push(details.url)).applyWindowGuards(win)

  assert.equal(win.has('will-navigate'), true)
  assert.equal(win.has('will-redirect'), true)
  assert.equal(win.has('will-attach-webview'), true)

  for (const url of FOREIGN_URLS) {
    assert.equal(win.emit('will-navigate', url), true, `navigation not prevented: ${url}`)
    assert.equal(win.emit('will-redirect', url), true, `redirect not prevented: ${url}`)
  }
  assert.equal(blocked.length, FOREIGN_URLS.length * 2)
})

test('H3: in-app navigation is still allowed', () => {
  const win = fakeWindow()
  policy().applyWindowGuards(win)
  assert.equal(win.emit('will-navigate', `${APP_ORIGIN}#/control`), false)
  assert.equal(win.emit('will-redirect', APP_ORIGIN), false)
})

test('H3: window.open is denied outright', () => {
  const win = fakeWindow()
  policy().applyWindowGuards(win)
  assert.deepEqual(win.open('https://evil.example/'), { action: 'deny' })
  // Even our own origin: Rata never opens popups, and a popup would carry the
  // same preload bridge.
  assert.deepEqual(win.open(APP_ORIGIN), { action: 'deny' })
})

test('H3: webview attachment is prevented', () => {
  const win = fakeWindow()
  policy().applyWindowGuards(win)
  assert.equal(win.emit('will-attach-webview'), true)
})

test('H4: sender trust follows the frame URL', () => {
  const { isTrustedSender } = policy()
  assert.equal(isTrustedSender({ senderFrame: { url: `${APP_ORIGIN}#/overlay` } }), true)
  for (const url of FOREIGN_URLS) {
    assert.equal(isTrustedSender({ senderFrame: { url } }), false, `trusted a foreign frame: ${url}`)
  }
  // A disposed frame is null; a malformed event has no frame at all.
  assert.equal(isTrustedSender({ senderFrame: null }), false)
  assert.equal(isTrustedSender({}), false)
  assert.equal(isTrustedSender(undefined), false)
})

// --- H4 wired through the real registration machinery ------------------

const IPC = { alpha: 'rata:alpha' }

function fakeIpcMain() {
  const handlers = new Map()
  return {
    handle: (channel, handler) => handlers.set(channel, handler),
    removeHandler: channel => handlers.delete(channel),
    invoke: (channel, event, ...args) => handlers.get(channel)(event, ...args),
    size: () => handlers.size
  }
}

const alphaModule = calls => ({
  id: 'alpha',
  channels: ['alpha'],
  register: ({ handle }) => handle('alpha', () => {
    calls.push('executed')
    return 'sensitive-result'
  })
})

test('H4: registration refuses to run without a sender check', () => {
  assert.throws(
    () => registerIpcHandlers({ ipcMain: fakeIpcMain(), IPC, services: {}, modules: [alphaModule([])] }),
    /requires isTrustedSender/
  )
})

test('H4: an untrusted frame cannot reach a handler', async () => {
  const calls = []
  const refused = []
  const ipcMain = fakeIpcMain()
  registerIpcHandlers({
    ipcMain,
    IPC,
    services: {},
    isTrustedSender: event => event?.senderFrame?.url === APP_ORIGIN,
    onUntrustedSender: details => refused.push(details),
    modules: [alphaModule(calls)]
  })

  await assert.rejects(
    async () => ipcMain.invoke('rata:alpha', { senderFrame: { url: 'https://evil.example/' } }),
    /untrusted frame/
  )
  assert.deepEqual(calls, [], 'the handler ran for an untrusted sender')
  assert.equal(refused.length, 1)
  assert.equal(refused[0].channel, 'rata:alpha')
})

test('H4: the trusted renderer still works', async () => {
  const calls = []
  const ipcMain = fakeIpcMain()
  registerIpcHandlers({
    ipcMain,
    IPC,
    services: {},
    isTrustedSender: event => event?.senderFrame?.url === APP_ORIGIN,
    modules: [alphaModule(calls)]
  })

  const result = await ipcMain.invoke('rata:alpha', { senderFrame: { url: APP_ORIGIN } })
  assert.equal(result, 'sensitive-result')
  assert.deepEqual(calls, ['executed'])
})
