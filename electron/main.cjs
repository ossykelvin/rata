const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, Notification, clipboard } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const { JsonStore } = require('./store.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const { createMvpRegistry } = require('./mvp-tools.cjs')
const { parseAgentMessage, parseApprovalRequest, parseSettingChange } = require('../packages/contracts/ipc-validation.cjs')
const { IPC } = require('../packages/contracts/ipc-channels.cjs')
const { createSkillRegistry, createSkillRouter, createSkillLoader } = require('../packages/skills/index.cjs')

let overlayWindow
let controlWindow
let tray
let store
let agent
let skillRuntime

const isDev = !app.isPackaged
const DEV_URL = 'http://127.0.0.1:5173/'
const PROJECT_ROOT = path.join(__dirname, '..')

function rendererTarget(route) {
  if (isDev) return `${DEV_URL}#/${route}`
  return `${pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href}#/${route}`
}

function logActivity(action, detail, status = 'info') {
  const event = { id: crypto.randomUUID(), at: new Date().toISOString(), action, detail, status }
  store.addActivity(event)
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.activity, event)
}

function windowPreferences() {
  return {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
}

function createOverlay() {
  const settings = store.getSettings()
  const display = screen.getPrimaryDisplay().workArea
  overlayWindow = new BrowserWindow({
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
    webPreferences: windowPreferences()
  })
  overlayWindow.setAlwaysOnTop(settings.alwaysOnTop, 'floating')
  overlayWindow.loadURL(rendererTarget('overlay'))
  overlayWindow.once('ready-to-show', () => overlayWindow.showInactive())
  overlayWindow.on('closed', () => { overlayWindow = undefined })
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
    webPreferences: windowPreferences()
  })
  controlWindow.loadURL(rendererTarget('control'))
  controlWindow.once('ready-to-show', () => controlWindow.show())
  controlWindow.on('close', event => {
    if (!app.isQuitting) {
      event.preventDefault()
      controlWindow.hide()
    }
  })
}

function trayIcon() {
  const imagePath = isDev ? path.join(__dirname, '..', 'public', 'rata-concept.png') : path.join(process.resourcesPath, 'rata-concept.png')
  let image = nativeImage.createFromPath(imagePath)
  if (!image.isEmpty()) return image.resize({ width: 18, height: 18 })
  return nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAMElEQVR4nGNgGAWjYBSMglEwCkbBKBicwPj//38GKgATA8XAqAajYBSMglEwCkbBKBgFwxUAAG0qB/H2mS0qAAAAAElFTkSuQmCC')
}

function createTray() {
  const image = trayIcon()
  tray = new Tray(image)
  tray.setToolTip('Rata Office Assistant')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Control Center', click: () => showControl() },
    { label: 'Show Rata', click: () => overlayWindow?.show() },
    { label: 'Hide Rata', click: () => overlayWindow?.hide() },
    { type: 'separator' },
    { label: 'Quit Rata', click: () => { app.isQuitting = true; app.quit() } }
  ]))
  tray.on('double-click', showControl)
}

function showControl() {
  if (!controlWindow) createControlCenter()
  controlWindow.show()
  controlWindow.focus()
}

function broadcastSettings(settings) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.settingsChanged, settings)
}

function listPublicSkills() {
  return skillRuntime?.registry.list() || []
}

function registerIpc() {
  ipcMain.handle(IPC.getSettings, () => store.getSettings())
  ipcMain.handle(IPC.setSetting, (_event, payload) => {
    const { key, value } = parseSettingChange(payload)
    const settings = store.setSetting(key, value)
    if (key === 'alwaysOnTop' && overlayWindow) overlayWindow.setAlwaysOnTop(Boolean(value), 'floating')
    broadcastSettings(settings)
    logActivity('Setting changed', `${key} = ${String(value)}`, 'info')
    return settings
  })
  ipcMain.handle(IPC.getActivity, () => store.getActivity())
  ipcMain.handle(IPC.getSkills, () => ({
    loaded: Boolean(skillRuntime?.registry.loaded),
    error: skillRuntime?.registry.loadError || null,
    pack: skillRuntime?.registry.pack,
    skills: listPublicSkills()
  }))
  ipcMain.handle(IPC.agentMessage, async (_event, payload) => {
    const { message } = parseAgentMessage(payload)
    const result = await agent.handle(message)
    overlayWindow?.webContents.send(IPC.overlayMessage, { message: result.message, state: result.state })
    return result
  })
  ipcMain.handle(IPC.approveAction, async (_event, payload) => {
    const { id } = parseApprovalRequest(payload)
    const result = await agent.approve(id)
    overlayWindow?.webContents.send(IPC.overlayMessage, { message: result.message, state: result.state })
    return result
  })
  ipcMain.handle(IPC.rejectAction, async (_event, payload) => {
    const { id } = parseApprovalRequest(payload)
    return agent.reject(id)
  })
  ipcMain.handle(IPC.showControl, () => showControl())
  ipcMain.handle(IPC.showOverlay, () => overlayWindow?.show())
  ipcMain.handle(IPC.hideOverlay, () => overlayWindow?.hide())
  ipcMain.handle(IPC.testNotification, () => {
    const settings = store.getSettings()
    if (settings.doNotDisturb) return
    if (Notification.isSupported()) new Notification({ title: 'Rata', body: 'I\'m here and ready to help.' }).show()
    logActivity('Notification tested', 'Desktop notification requested.', 'success')
  })
}

function createSkillRuntime(toolRegistry) {
  const registry = createSkillRegistry({ rootDir: PROJECT_ROOT, toolRegistry })
  const loader = createSkillLoader({ registry })
  const router = createSkillRouter({ registry, toolRegistry })
  if (registry.loadError) {
    console.error('Rata skill pack failed closed:', registry.loadError)
  }
  return { registry, loader, router }
}

app.whenReady().then(() => {
  store = new JsonStore(app)
  const registry = createMvpRegistry({ spawnProcess: spawn, clipboardApi: clipboard })
  const policy = new PolicyEngine()
  skillRuntime = createSkillRuntime(registry)
  agent = new MockAgent({
    registry,
    policy,
    settings: () => store.getSettings(),
    activity: logActivity,
    skills: skillRuntime
  })
  registerIpc()
  createOverlay()
  createControlCenter()
  createTray()
  logActivity('Rata started', skillRuntime.registry.loaded
    ? `MVP runtime is online with ${skillRuntime.registry.count()} installed skills.`
    : 'MVP runtime is online. Skill pack failed closed.', 'success')

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
