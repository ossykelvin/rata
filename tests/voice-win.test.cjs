const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const path = require('node:path')
const { createWindowsVoice, parseResultLine, MIN_CONFIDENCE } = require('../electron/voice-win.cjs')
const { registerIpcHandlers } = require('../electron/ipc/index.cjs')
const { composeBridge } = require('../electron/bridge/compose.cjs')
const { IPC } = require('../packages/contracts/ipc-channels.cjs')
const voiceHandler = require('../electron/ipc/voice.cjs')
const voiceBridge = require('../electron/bridge/voice.cjs')
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

test('repeated start and stop never spawns a second powershell', async () => {
  // Was: "start during stop waits for the old child and does not spawn a
  // second powershell". That race guarded a design where every press spawned
  // its own process. The recognizer is now one warm process that acquires and
  // releases the microphone on command, so a second spawn is structurally
  // impossible rather than merely avoided. FIX-008.
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
  await voice.start()
  voice.stop()
  await voice.start()
  assert.equal(spawned.length, 1, 'a press spawned another powershell.exe')

  // The microphone is still released between presses: STOP calls
  // SetInputToNull() in the script, so warm does not mean an open mic.
  assert.deepEqual(
    spawned[0].stdinWrites,
    ['LISTEN\n', 'STOP\n', 'LISTEN\n', 'STOP\n', 'LISTEN\n']
  )
})

test('a replacement recognizer is not clobbered by the old one exiting', async () => {
  // The warm process only respawns after it has died, so the stale-callback
  // hazard is narrower than before but still real: the old child's exit event
  // can arrive after a replacement has been created.
  const spawned = []
  const voice = createWindowsVoice({
    spawnProcess: () => {
      const child = fakeChild()
      spawned.push(child)
      return child
    },
    sendTranscript: () => {},
    logActivity: () => {}
  })

  await voice.start()
  const first = spawned[0]
  first.emit('exit', 1)          // died on its own
  await voice.start()            // respawns
  const second = spawned[1]
  assert.equal(spawned.length, 2)

  first.emit('exit', 1)          // late duplicate from the dead child
  voice.stop()
  // The replacement is still the live child and still receives commands.
  assert.deepEqual(second.stdinWrites, ['LISTEN\n', 'STOP\n'])
})

test('voice channels are declared on the shared contract', () => {
  assert.equal(IPC.startVoiceListening, 'rata:voice-start')
  assert.equal(IPC.stopVoiceListening, 'rata:voice-stop')
  assert.equal(IPC.voiceTranscript, 'rata:voice-transcript')
})

test('a leftover partial transcript is delivered when the microphone is disabled', async () => {
  const transcripts = []
  const child = fakeChild()
  const voice = createWindowsVoice({
    spawnProcess: () => child,
    sendTranscript: payload => transcripts.push(payload)
  })

  await voice.start()
  child.stdout.emit('data', 'hello without newline')
  assert.deepEqual(transcripts, [])
  voice.stop()
  child.emit('exit', 0)
  assert.deepEqual(transcripts, [{ transcript: 'hello without newline' }])
})

test('complete lines already emitted stay emitted after disable', async () => {
  const transcripts = []
  const child = fakeChild()
  const voice = createWindowsVoice({
    spawnProcess: () => child,
    sendTranscript: payload => transcripts.push(payload)
  })

  await voice.start()
  child.stdout.emit('data', 'Done line\npartial')
  assert.deepEqual(transcripts, [{ transcript: 'Done line' }])
  voice.stop()
  child.emit('exit', 0)
  assert.deepEqual(transcripts, [{ transcript: 'Done line' }, { transcript: 'partial' }])
})

test('voice IPC awaits the start() promise and surfaces rejection as a clean error', async () => {
  const ipcMain = fakeIpcMain()
  registerIpcHandlers({
    ipcMain,
    IPC,
    isTrustedSender: () => true,
    services: {
      getStore: () => ({ getSettings: () => ({ microphoneEnabled: true }) }),
      getVoice: () => ({
        start: () => Promise.reject(new Error('recognizer failed')),
        stop: () => ({ ok: true })
      })
    },
    modules: [voiceHandler]
  })

  const unhandled = []
  const onUnhandled = error => unhandled.push(error)
  process.on('unhandledRejection', onUnhandled)
  try {
    await assert.rejects(
      () => ipcMain.handlers.get(IPC.startVoiceListening)({}),
      /recognizer failed/
    )
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(unhandled.length, 0)
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
})

test('voice IPC waits for a pending start() promise before returning', async () => {
  let resolveStart
  const started = new Promise(resolve => { resolveStart = resolve })
  const ipcMain = fakeIpcMain()
  registerIpcHandlers({
    ipcMain,
    IPC,
    isTrustedSender: () => true,
    services: {
      getStore: () => ({ getSettings: () => ({ microphoneEnabled: true }) }),
      getVoice: () => ({
        start: () => started.then(() => ({ ok: true })),
        stop: () => ({ ok: true })
      })
    },
    modules: [voiceHandler]
  })

  const pending = ipcMain.handlers.get(IPC.startVoiceListening)({})
  let settled = false
  pending.then(() => { settled = true })
  await Promise.resolve()
  assert.equal(settled, false)
  resolveStart()
  assert.deepEqual(await pending, { ok: true })
})

test('preload startVoiceListening returns the invoke promise', async () => {
  const bridge = composeBridge({
    ipcRenderer: {
      invoke: async () => { throw new Error('Microphone is disabled.') },
      on() {},
      removeListener() {}
    },
    IPC,
    modules: [voiceBridge]
  })
  const result = bridge.startVoiceListening()
  assert.equal(typeof result.then, 'function')
  await assert.rejects(() => result, /Microphone is disabled/)
})

// --- FIX-005: the recognizer never actually ran -------------------------

test('the recognizer script calls Run() directly, not via a ScriptBlock thread', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'electron', 'voice-listen.ps1'), 'utf8')

  // The original script marshalled the call onto a raw [System.Threading.Thread]
  // built from a PowerShell ScriptBlock. A ScriptBlock delegate has no runspace
  // on such a thread: powershell.exe died with exit code 2 before Run() was
  // entered, nothing reached stderr, and speech recognition never started once.
  assert.doesNotMatch(script, /System\.Threading\.Thread\]::new/, 'the ScriptBlock thread is back')
  assert.doesNotMatch(script, /SetApartmentState/, 'powershell.exe 5.1 is already STA; this is not needed')
  assert.match(script, /exit \[RataListen\]::Run\(\)/, 'Run() must be called directly')

  // The diagnostics only reach the app if Run() actually executes.
  assert.match(script, /NO_MIC/)
  assert.match(script, /NO_ENGINE/)
})

test('a recognizer that dies on its own is reported, not swallowed', async () => {
  const events = []
  const transcripts = []
  const child = fakeChild()
  const voice = createWindowsVoice({
    spawnProcess: () => child,
    sendTranscript: payload => transcripts.push(payload),
    logActivity: (action, detail, status) => events.push({ action, detail, status })
  })

  await voice.start()
  transcripts.length = 0
  events.length = 0
  // Nobody called stop(): the process exited by itself.
  child.emit('exit', 2)

  assert.equal(transcripts.length, 1, 'the renderer was never told the recognizer died')
  assert.equal(transcripts[0].transcript, '')
  assert.match(transcripts[0].error, /unexpectedly/i)
  assert.equal(events.some(event => event.status === 'error'), true, 'no error was audited')
})

test('a requested stop is not reported as an unexpected death', async () => {
  const transcripts = []
  const child = fakeChild()
  const voice = createWindowsVoice({
    spawnProcess: () => child,
    sendTranscript: payload => transcripts.push(payload),
    logActivity: () => {}
  })

  await voice.start()
  transcripts.length = 0
  voice.stop()
  child.emit('exit', 0)

  assert.equal(
    transcripts.some(payload => payload.error),
    false,
    'an ordinary stop reported an error'
  )
})

// --- FIX-006: the confidence decision belongs where it can be audited ---

test('a result line is parsed into confidence and transcript', () => {
  assert.deepEqual(parseResultLine('0.412|hello there'), { confidence: 0.412, transcript: 'hello there' })
  assert.deepEqual(parseResultLine('1.000|yes'), { confidence: 1, transcript: 'yes' })
  // No prefix: an older or hand-edited script must not fall silent.
  assert.deepEqual(parseResultLine('plain text'), { confidence: null, transcript: 'plain text' })
  assert.deepEqual(parseResultLine('abc|def'), { confidence: null, transcript: 'abc|def' })
  for (const empty of ['', '   ', '0.5|', '0.5|   ']) {
    assert.equal(parseResultLine(empty), null, `${JSON.stringify(empty)} should produce nothing`)
  }
})

test('a confident result is delivered to the renderer', async () => {
  const transcripts = []
  const child = fakeChild()
  const voice = createWindowsVoice({
    spawnProcess: () => child,
    sendTranscript: payload => transcripts.push(payload),
    logActivity: () => {}
  })
  await voice.start()
  child.stdout.emit('data', '0.680|open notepad\n')
  assert.deepEqual(transcripts, [{ transcript: 'open notepad' }])
})

test("the user's own measured speech is delivered, not discarded", async () => {
  // Ten consecutive spoken results on the reporting user's hardware scored
  // 0.003 to 0.167. Gates of 0.4 and then 0.2 sat above every one of them, so
  // every word was discarded and the feature looked dead while working.
  const measured = [0.003, 0.012, 0.051, 0.060, 0.088, 0.101, 0.122, 0.125, 0.151, 0.167]
  const transcripts = []
  const child = fakeChild()
  const voice = createWindowsVoice({
    spawnProcess: () => child,
    sendTranscript: payload => transcripts.push(payload),
    logActivity: () => {}
  })
  await voice.start()
  for (const score of measured) {
    child.stdout.emit('data', `${score.toFixed(3)}|utterance at ${score}
`)
  }
  assert.ok(transcripts.length > 0, 'real measured speech was discarded again')
  // The last thing delivered is the best heard, not the last heard.
  assert.match(transcripts[transcripts.length - 1].transcript, /0\.167/)
})

test('only an improvement on the session best is delivered', async () => {
  const transcripts = []
  const child = fakeChild()
  const voice = createWindowsVoice({
    spawnProcess: () => child,
    sendTranscript: payload => transcripts.push(payload),
    logActivity: () => {}
  })
  await voice.start()
  child.stdout.emit('data', '0.120|first guess\n')
  child.stdout.emit('data', '0.090|worse fragment\n')
  child.stdout.emit('data', '0.300|much better\n')
  child.stdout.emit('data', '0.100|trailing noise\n')
  assert.deepEqual(
    transcripts.map(payload => payload.transcript),
    ['first guess', 'much better'],
    'a worse later fragment overwrote a better transcript'
  )
})

test('a new session starts its own best, so a quiet utterance still lands', async () => {
  const transcripts = []
  const children = [fakeChild(), fakeChild()]
  let index = 0
  const voice = createWindowsVoice({
    spawnProcess: () => children[index++],
    sendTranscript: payload => transcripts.push(payload),
    logActivity: () => {}
  })
  await voice.start()
  children[0].stdout.emit('data', '0.400|loud first session\n')
  voice.stop()
  children[0].emit('exit', 0)
  await voice.start()
  transcripts.length = 0
  children[1].stdout.emit('data', '0.090|quiet second session\n')
  assert.deepEqual(transcripts.map(p => p.transcript), ['quiet second session'])
})

test('a low-confidence result is audited rather than discarded in silence', async () => {
  // "Heard nothing" and "heard something and threw it away" are different
  // problems. They used to be indistinguishable from outside the recognizer,
  // which is what made an over-tight gate look identical to a dead process.
  const transcripts = []
  const events = []
  const child = fakeChild()
  const voice = createWindowsVoice({
    spawnProcess: () => child,
    sendTranscript: payload => transcripts.push(payload),
    logActivity: (action, detail, status) => events.push({ action, detail, status })
  })
  await voice.start()
  events.length = 0
  child.stdout.emit('data', '0.012|and if were\n')

  assert.equal(transcripts.length, 0, 'an artefact reached the input box')
  assert.equal(events.length, 1, 'the discard was not audited')
  assert.match(events[0].detail, /0\.012/)
  assert.match(events[0].detail, /and if were/)
})

test('the gate is low enough not to swallow ordinary speech', () => {
  // A first attempt at 0.4 was tuned partly on synthesised audio scoring
  // 0.681, which is far cleaner than a real microphone in a real room, and it
  // silently swallowed genuine speech.
  // The reporting user's speech peaked at 0.167. Anything at or above that
  // discards every word they say.
  assert.ok(MIN_CONFIDENCE < 0.167, `MIN_CONFIDENCE ${MIN_CONFIDENCE} discards real measured speech`)
})

test('the recognizer script emits confidence with every result', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'electron', 'voice-listen.ps1'), 'utf8')
  assert.match(script, /result\.Confidence\.ToString/, 'confidence is not reported')
  assert.match(script, /InvariantCulture/, 'a comma decimal separator would break parsing')
  // The keep/discard decision must not live in the script, where it cannot be audited.
  assert.doesNotMatch(script, /MinConfidence/, 'the gate is back inside the script')
})
