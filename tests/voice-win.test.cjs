const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createWindowsVoice } = require('../electron/voice-win.cjs')
const { registerIpcHandlers } = require('../electron/ipc/index.cjs')
const { IPC } = require('../packages/contracts/ipc-channels.cjs')
const voiceHandler = require('../electron/ipc/voice.cjs')
const settingsHandler = require('../electron/ipc/settings.cjs')

function fakeIpcMain() {
  return {
    handlers: new Map(),
    handle(channel, handler) { this.handlers.set(channel, handler) },
    removeHandler(channel) { this.handlers.delete(channel) }
  }
}

function fakeChild() {
  const child = new EventEmitter()
  child.stdinWrites = []
  child.stdin = { write(payload) { child.stdinWrites.push(payload) } }
  child.stdout = new EventEmitter()
  child.stdout.setEncoding = () => {}
  child.stderr = new EventEmitter()
  child.stderr.setEncoding = () => {}
  child.kill = () => {}
  return child
}

test('Windows voice start emits trimmed transcripts and does not keep audio', async () => {
  const transcripts = []
  const child = fakeChild()
  const voice = createWindowsVoice({
    spawnProcess: () => child,
    sendTranscript: payload => transcripts.push(payload)
  })

  assert.deepEqual(await voice.start(), { ok: true })
  child.stdout.emit('data', 'Hello Rata\n')
  assert.deepEqual(transcripts, [{ transcript: 'Hello Rata' }])
  assert.deepEqual(voice.stop(), { ok: true })
})

test('voice IPC refuses to listen when the microphone setting is off', async () => {
  const started = []
  const ipcMain = fakeIpcMain()
  registerIpcHandlers({
    ipcMain,
    IPC,
    isTrustedSender: () => true,
    services: {
      getStore: () => ({ getSettings: () => ({ microphoneEnabled: false }) }),
      getVoice: () => ({ start: () => started.push('start'), stop: () => ({ ok: true }) })
    },
    modules: [voiceHandler]
  })

  await assert.rejects(
    () => ipcMain.handlers.get(IPC.startVoiceListening)({}),
    /Microphone is disabled/
  )
  assert.deepEqual(started, [])
})

test('disabling the microphone mid-session stops the recognizer', async () => {
  const stopped = []
  const store = {
    settings: { microphoneEnabled: true, alwaysOnTop: true },
    getSettings() { return this.settings },
    setSetting(key, value) {
      this.settings = { ...this.settings, [key]: value }
      return this.settings
    }
  }
  const ipcMain = fakeIpcMain()
  registerIpcHandlers({
    ipcMain,
    IPC,
    isTrustedSender: () => true,
    services: {
      getStore: () => store,
      getOverlayWindow: () => undefined,
      getVoice: () => ({
        start() { return { ok: true } },
        stop() { stopped.push('stop'); return { ok: true } }
      }),
      broadcastSettings() {},
      logActivity() {}
    },
    modules: [settingsHandler]
  })

  await ipcMain.handlers.get(IPC.setSetting)({}, { key: 'alwaysOnTop', value: false })
  assert.deepEqual(stopped, [])
  await ipcMain.handlers.get(IPC.setSetting)({}, { key: 'microphoneEnabled', value: false })
  assert.deepEqual(stopped, ['stop'])
})

test('start during stop waits for the old child and does not spawn a second powershell', async () => {
  const spawned = []
  const voice = createWindowsVoice({
    spawnProcess: () => {
      const child = fakeChild()
      spawned.push(child)
      return child
    },
    sendTranscript: () => {}
  })

  await voice.start()
  assert.equal(spawned.length, 1)
  voice.stop()
  const restart = voice.start()
  assert.equal(spawned.length, 1, 'second start must wait for the old child to exit')
  spawned[0].emit('exit', 0)
  await restart
  assert.equal(spawned.length, 2)
})

test('an old child exit does not clear a newer child reference', async () => {
  const spawned = []
  const voice = createWindowsVoice({
    spawnProcess: () => {
      const child = fakeChild()
      spawned.push(child)
      return child
    },
    sendTranscript: () => {}
  })

  await voice.start()
  const first = spawned[0]
  voice.stop()
  const restart = voice.start()
  first.emit('exit', 0)
  await restart
  const second = spawned[1]
  first.emit('exit', 0)
  voice.stop()
  assert.deepEqual(second.stdinWrites, ['\n'])
})

test('voice channels are declared on the shared contract', () => {
  assert.equal(IPC.startVoiceListening, 'rata:voice-start')
  assert.equal(IPC.stopVoiceListening, 'rata:voice-stop')
  assert.equal(IPC.voiceTranscript, 'rata:voice-transcript')
})
