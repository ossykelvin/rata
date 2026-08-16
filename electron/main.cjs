const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, Notification, clipboard, session, shell } = require('electron')
const { existsSync } = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const { JsonStore } = require('./store.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const { createToolRegistry } = require('./tools/index.cjs')
const { createSerperSearch } = require('./serper-client.cjs')
const { loadRuntimeConfig, describeConfig } = require('./config.cjs')
const {
  createProviderChain,
  createGeminiProvider,
  createOpenRouterProvider,
  createMockProvider
} = require('../packages/agent-core/providers/index.cjs')
const { registerIpcHandlers } = require('./ipc/index.cjs')
const { createSecurityPolicy, applySessionPermissionHandler } = require('./security.cjs')
const { createWindowsVoice } = require('./voice-win.cjs')
const { IPC } = require('../packages/contracts/ipc-channels.cjs')
const { createSkillRegistry, createSkillRouter, createSkillLoader } = require('../packages/skills/index.cjs')
const { createFileAccess } = require('./file-access.cjs')

let overlayWindow
let controlWindow
let tray
let store
let agent
let skillRuntime
let security
let runtimeConfig
let providers

const isDev = !app.isPackaged
const APP_ID = 'uk.koptechnology.rata'
const APP_ICON_FILE = '24_dialog_avatar_reply.png'
const DEV_URL = 'http://127.0.0.1:5173/'
const PROJECT_ROOT = path.join(__dirname, '..')

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}
const PACKAGED_ENTRY = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href
const hasSingleInstanceLock = app.requestSingleInstanceLock()
const PRELOAD_BUNDLE = path.join(PROJECT_ROOT, 'dist-electron', 'preload.cjs')

function rendererTarget(route) {
  if (isDev) return `${DEV_URL}#/${route}`
  return `${PACKAGED_ENTRY}#/${route}`
}

/**
 * The only URLs that count as Rata's own renderer. Everything else is refused
 * navigation and refused IPC. See electron/security.cjs (REVIEW-001 H3/H4).
 */
function rendererOrigins() {
  return isDev ? [DEV_URL] : [PACKAGED_ENTRY]
}

function logActivity(action, detail, status = 'info') {
  const event = { id: crypto.randomUUID(), at: new Date().toISOString(), action, detail, status }
  store.addActivity(event)
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.activity, event)
}

function windowPreferences() {
  if (!existsSync(PRELOAD_BUNDLE)) {
    throw new Error('Sandboxed preload bundle is missing. Run npm run build:preload before starting Rata.')
  }
  return {
    preload: PRELOAD_BUNDLE,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
}

function createOverlay() {
  const settings = store.getSettings()
  const display = screen.getPrimaryDisplay().workArea
  const window = new BrowserWindow({
    width: 360,
    height: 470,
    x: Math.max(display.x, display.x + display.width - 390),
    y: Math.max(display.y, display.y + display.height - 500),
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    icon: loadAppIcon(),
    webPreferences: windowPreferences()
  })
  overlayWindow = window
  security.applyWindowGuards(window)
  window.setAlwaysOnTop(settings.alwaysOnTop, 'floating')
  window.loadURL(rendererTarget('overlay'))
  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) window.showInactive()
  })
  window.on('closed', () => {
    if (overlayWindow === window) overlayWindow = undefined
  })
}

function getOverlayWindow() {
  return overlayWindow && !overlayWindow.isDestroyed() ? overlayWindow : undefined
}

function showOverlay({ inactive = false } = {}) {
  const window = getOverlayWindow()
  if (!window) {
    // createOverlay() reveals the replacement after its renderer is ready,
    // avoiding a blank transparent window while the page is still loading.
    createOverlay()
    return
  }
  if (window.isMinimized()) window.restore()
  if (inactive) window.showInactive()
  else window.show()
}

function createControlCenter() {
  controlWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 940,
    minHeight: 650,
    show: false,
    backgroundColor: '#07142f',
    autoHideMenuBar: true,
    icon: loadAppIcon(),
    webPreferences: windowPreferences()
  })
  security.applyWindowGuards(controlWindow)
  controlWindow.loadURL(rendererTarget('control'))
  controlWindow.once('ready-to-show', () => controlWindow.show())
  controlWindow.on('close', event => {
    if (!app.isQuitting) {
      event.preventDefault()
      controlWindow.hide()
    }
  })
}

function appIconPath() {
  return isDev
    ? path.join(PROJECT_ROOT, 'public', APP_ICON_FILE)
    : path.join(process.resourcesPath, APP_ICON_FILE)
}

function loadAppIcon() {
  const image = nativeImage.createFromPath(appIconPath())
  return image.isEmpty() ? undefined : image
}

function trayIcon() {
  const image = loadAppIcon()
  if (image) return image.resize({ width: 24, height: 24 })
  return nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAMElEQVR4nGNgGAWjYBSMglEwCkbBKBicwPj//38GKgATA8XAqAajYBSMglEwCkbBKBgFwxUAAG0qB/H2mS0qAAAAAElFTkSuQmCC')
}

function createTray() {
  const image = trayIcon()
  tray = new Tray(image)
  tray.setToolTip('Rata Office Assistant')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Control Center', click: () => showControl() },
    { label: 'Show Rata', click: () => showOverlay() },
    { label: 'Hide Rata', click: () => getOverlayWindow()?.hide() },
    { type: 'separator' },
    { label: 'Quit Rata', click: () => { app.isQuitting = true; app.quit() } }
  ]))
  tray.on('double-click', showControl)
}

function showControl() {
  if (!controlWindow) createControlCenter()
  if (controlWindow.isMinimized()) controlWindow.restore()
  controlWindow.show()
  controlWindow.focus()
}

function broadcastSettings(settings) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.settingsChanged, settings)
}

/**
 * Builds the provider chain: Gemini primary, OpenRouter secondary, mock last.
 *
 * The mode is read from the stored `provider` setting each call, so switching
 * providers in Control Center takes effect on the next message without a
 * restart. Credentials come from runtimeConfig and stay in this process.
 */
/**
 * Decides which provider mode is active.
 *
 * `RATA_AI_PROVIDER` wins when it names a mode we implement. This used to be
 * written as `storedSetting || envDefault`, which never fired: the stored
 * setting always holds a value (it defaults to 'mock'), so the env variable
 * was unreachable and editing it appeared to do nothing.
 *
 * Env-wins matches the precedence `electron/config.cjs` already documents for
 * every other value, and it is the only way to change providers until the
 * Control Center panel exists. Once that panel ships, unset the variable and
 * the stored setting takes over.
 */
function resolveProviderMode() {
  return runtimeConfig.providerModeOverride || store.getSettings().provider || 'mock'
}

function createProviders() {
  // Built once; credentials never leave this process.
  const gemini = createGeminiProvider(runtimeConfig.gemini)
  const openrouter = createOpenRouterProvider(runtimeConfig.openrouter)
  const mock = createMockProvider()

  // The chain is rebuilt per call — it is a plain object, so this is cheap —
  // so changing the provider in Control Center takes effect on the next
  // message rather than at the next restart.
  const chainFor = () => createProviderChain({
    mode: resolveProviderMode(),
    gemini,
    openrouter,
    mock,
    onFallback: ({ from, reason }) => logActivity('Provider fallback', `${from}: ${reason}`, 'warning')
  })

  return {
    describe: () => chainFor().describe(),
    generate: request => chainFor().generate(request)
  }
}

function createSkillRuntime(toolRegistry) {
  const registry = createSkillRegistry({ rootDir: PROJECT_ROOT, toolRegistry })
  const loader = createSkillLoader({ registry })
  const router = createSkillRouter({ registry, toolRegistry })
  if (registry.loadError) {
    console.error('Rata rejected one or more skill fragments:', registry.loadError)
  }
  return { registry, loader, router }
}

// FIX-001: a second launch must not start a second runtime. Two instances
// would write the same JSON store and race each other.
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  // Deliberately ignores the second instance's argv. Command-line arguments
  // from another process are untrusted input and must not steer this one.
  app.on('second-instance', () => {
    showControl()
    showOverlay({ inactive: true })
  })

  app.whenReady().then(() => {
    store = new JsonStore(app)
    runtimeConfig = loadRuntimeConfig({ rootDir: PROJECT_ROOT })
    security = createSecurityPolicy({
      allowedPrefixes: rendererOrigins(),
      // Audit the refusal without recording payloads.
      onBlocked: ({ url }) => logActivity('Blocked navigation', `Refused a foreign destination: ${String(url)}`, 'warning')
    })
    // REVIEW-001 M4 / Codex b1d9c52: renderer `microphoneEnabled` is not a
    // boundary. Deny media unless the setting is on; deny every other permission.
    applySessionPermissionHandler(session.defaultSession, () => store.getSettings())
    const voice = createWindowsVoice({
      sendTranscript: payload => {
        for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.voiceTranscript, payload)
      },
      logActivity
    })
    const registry = createToolRegistry({
      dependencies: {
        spawnProcess: spawn,
        clipboardApi: clipboard,
        // A bound capability, not the credential. The key stays inside the
        // client closure, so no discovered module can read it.
        webSearch: createSerperSearch({ apiKey: runtimeConfig.serper.apiKey }),
        // Read-only local file access, bound to three user folders. The roots
        // are decided here and closed over, so no discovered tool module can
        // widen them. RATA-006.
        fileAccess: createFileAccess({
          roots: ['documents', 'downloads', 'desktop'].map(name => {
            try {
              return app.getPath(name)
            } catch {
              return ''
            }
          })
        }),
        revealItem: target => shell.showItemInFolder(target)
      }
    })
    providers = createProviders()
    const policy = new PolicyEngine()
    skillRuntime = createSkillRuntime(registry)
    agent = new MockAgent({
      registry,
      policy,
      settings: () => store.getSettings(),
      activity: logActivity,
      skills: skillRuntime,
      provider: providers
    })
    registerIpcHandlers({
      ipcMain,
      IPC,
      isTrustedSender: event => security.isTrustedSender(event),
      onUntrustedSender: ({ channel, url }) =>
        logActivity('Blocked IPC call', `${channel} was called from an untrusted frame: ${String(url)}`, 'error'),
      services: {
        getStore: () => store,
        getAgent: () => agent,
        getSkillRuntime: () => skillRuntime,
        getProvider: () => providers,
        // Boolean only. The key itself never leaves this process.
        isSearchConfigured: () => Boolean(runtimeConfig.serper.apiKey),
        getOverlayWindow,
        showOverlay,
        showControl,
        broadcastSettings,
        logActivity,
        Notification,
        getVoice: () => voice
      }
    })
    createOverlay()
    createControlCenter()
    createTray()
    logActivity('Rata started', skillRuntime.registry.loaded
      ? `MVP runtime is online with ${skillRuntime.registry.count()} installed skills.`
      : 'MVP runtime is online. Skill pack failed closed.', 'success')

    // Booleans only — which credentials are present, never their values.
    const configured = describeConfig(runtimeConfig)
    logActivity(
      'Providers configured',
      `mode=${resolveProviderMode()} (${runtimeConfig.providerModeOverride ? 'RATA_AI_PROVIDER' : 'stored setting'})`
      + ` gemini=${configured.gemini} openrouter=${configured.openrouter} search=${configured.serper}`,
      'info'
    )
    // A typo in RATA_AI_PROVIDER must not look like a working configuration.
    if (runtimeConfig.providerModeRejected) {
      logActivity(
        'Provider mode ignored',
        `RATA_AI_PROVIDER="${runtimeConfig.providerModeRejected}" is not a known mode; using ${resolveProviderMode()}.`,
        'warning'
      )
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createOverlay(); createControlCenter()
      } else showControl()
    })
  })

  app.on('before-quit', () => { app.isQuitting = true })
  app.on('window-all-closed', event => {
    event?.preventDefault?.()
  })
}
