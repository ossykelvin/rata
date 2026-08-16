const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createWindowsVoice } = require('../electron/voice-win.cjs')
const { registerIpcHandlers } = require('../electron/ipc/index.cjs')
const { IPC } = require('../packages/contracts/ipc-channels.cjs')
const voiceHandler = require('../electron/ipc/voice.cjs')

function fakeChild() {
  const child = new EventEmitter()
  child.stdin = { write() {} }
  child.stdout = new EventEmitter()
  child.stdout.setEncoding = () => {}
  child.stderr = new EventEmitter()
  child.stderr.setEncoding = () => {}
  child.kill = () => child.emit('exit', 0)
  return child
}

test('Windows voice start emits trimmed transcripts and does not keep audio', () => {
  const transcripts = []
  const child = fakeChild()
  const voice = createWindowsVoice({
    spawnProcess: () => child,
    sendTranscript: payload => transcripts.push(payload)
  })

  assert.deepEqual(voice.start(), { ok: true })
  child.stdout.emit('data', 'Hello Rata\n')
  assert.deepEqual(transcripts, [{ transcript: 'Hello Rata' }])
  assert.deepEqual(voice.stop(), { ok: true })
})

test('voice IPC refuses to listen when the microphone setting is off', async () => {
  const started = []
  const ipcMain = {
    handlers: new Map(),
    handle(channel, handler) { this.handlers.set(channel, handler) },
    removeHandler(channel) { this.handlers.delete(channel) }
  }
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

  assert.throws(
    () => ipcMain.handlers.get(IPC.startVoiceListening)({}),
    /Microphone is disabled/
  )
  assert.deepEqual(started, [])
})

test('voice channels are declared on the shared contract', () => {
  assert.equal(IPC.startVoiceListening, 'rata:voice-start')
  assert.equal(IPC.stopVoiceListening, 'rata:voice-stop')
  assert.equal(IPC.voiceTranscript, 'rata:voice-transcript')
})
