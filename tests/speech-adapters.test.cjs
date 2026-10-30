const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')

const {
  resolveSttMode,
  createSpeaker,
  createSilentSpeaker,
  describeSpeechCapabilities,
  STT_PROVIDERS,
  TTS_PROVIDERS
} = require('../electron/speech/index.cjs')
const {
  createWindowsSpeaker,
  parseSpeakerLine,
  resolveScriptPath,
  isPackagedRuntime,
  MAX_TEXT_LENGTH
} = require('../electron/speech/tts-windows.cjs')
const { parseSpeakRequest, SETTING_KEYS, validateSettingValue } = require('../packages/contracts/ipc-validation.cjs')
const speechIpc = require('../electron/ipc/speech.cjs')

// RATA-004. Configurable STT/TTS adapters, interrupt/cancel, no retained audio.
//
// The STT choice used to live in the renderer: start the local recorder, and if
// getUserMedia threw, fall back to the Windows recognizer. That made provider
// policy a renderer concern, and the renderer is not a boundary. It also meant
// the choice could not be configured and that Handy's availability was
// discovered by exception rather than asked for.

// --- provider selection ----------------------------------------------------

test('auto prefers the local transcriber when it is installed', () => {
  assert.equal(resolveSttMode({ setting: 'auto', localAvailable: true }).mode, 'local')
  assert.equal(resolveSttMode({ setting: 'auto', localAvailable: false }).mode, 'windows')
})

test('an explicit choice is not silently substituted', () => {
  // A user who selected Handy and is quietly served the Windows recognizer has
  // no way to tell why accuracy changed.
  const resolved = resolveSttMode({ setting: 'local', localAvailable: false, windowsAvailable: true })
  assert.equal(resolved.mode, 'none')
  assert.match(resolved.reason, /not installed/i)
  assert.equal(resolved.requested, 'local')
})

test('an unknown provider falls back to auto rather than failing closed on speech', () => {
  assert.equal(resolveSttMode({ setting: 'nonsense', localAvailable: true }).requested, 'auto')
})

test('no provider at all reports a reason instead of a dead button', () => {
  const resolved = resolveSttMode({ setting: 'auto', localAvailable: false, windowsAvailable: false })
  assert.equal(resolved.mode, 'none')
  assert.ok(resolved.reason)
})

test('the capability snapshot answers "will Rata speak" in one place', () => {
  const off = describeSpeechCapabilities({ settings: { ttsProvider: 'off', speakReplies: true } })
  assert.equal(off.tts.speaking, false, 'provider off must win')
  const unset = describeSpeechCapabilities({ settings: { ttsProvider: 'windows', speakReplies: false } })
  assert.equal(unset.tts.speaking, false, 'the switch must be required too')
  const on = describeSpeechCapabilities({ settings: { ttsProvider: 'windows', speakReplies: true } })
  assert.equal(on.tts.speaking, true)
})

// --- defaults and contracts ------------------------------------------------

test('a fresh install is silent', async () => {
  // Built through the real store against an empty userData directory, rather
  // than by reading a `defaults` export — there is no such export, so the
  // first version of this test asserted nothing at all.
  const fsp = require('node:fs/promises')
  const os = require('node:os')
  const path = require('node:path')
  const { JsonStore } = require('../electron/store.cjs')
  const userData = await fsp.mkdtemp(path.join(os.tmpdir(), 'rata-speech-store-'))
  const store = new JsonStore({ getPath: () => userData })
  const settings = store.getSettings()

  assert.equal(settings.ttsProvider, 'off', 'a fresh install must not speak')
  assert.equal(settings.speakReplies, false)
  assert.equal(settings.sttProvider, 'auto')
  // The setting it replaced claimed to control spoken replies and controlled
  // nothing; it must not come back.
  assert.equal('voiceEnabled' in settings, false)
  await fsp.rm(userData, { recursive: true, force: true })
})

test('the speech settings are writable and constrained to known ids', () => {
  for (const key of ['sttProvider', 'ttsProvider', 'speakReplies']) {
    assert.ok(SETTING_KEYS.includes(key), `${key} is not a writable setting`)
  }
  assert.doesNotThrow(() => validateSettingValue('sttProvider', 'local'))
  assert.doesNotThrow(() => validateSettingValue('ttsProvider', 'windows'))
  // The renderer must not be able to name a provider the runtime does not
  // implement, for the same reason as the `provider` setting.
  assert.throws(() => validateSettingValue('sttProvider', 'whisper-cloud'))
  assert.throws(() => validateSettingValue('ttsProvider', 'elevenlabs'))
  assert.throws(() => validateSettingValue('speakReplies', 'yes'))
})

test('provider id lists stay in step with the contracts package', () => {
  const contracts = require('../packages/contracts/ipc-validation.cjs')
  assert.deepEqual([...STT_PROVIDERS], [...contracts.STT_PROVIDER_IDS])
  assert.deepEqual([...TTS_PROVIDERS], [...contracts.TTS_PROVIDER_IDS])
})

test('an utterance cannot carry a control byte into the line protocol', () => {
  // Text crosses a line-based stdin protocol. A newline inside one would be
  // read as the end of the command.
  const { text } = parseSpeakRequest({ text: 'first line\nSPEAK|forged|aGk=\nsecond' })
  assert.equal(text.includes('\n'), false)
  assert.match(text, /first line SPEAK\|forged\|aGk= second/)
  assert.throws(() => parseSpeakRequest({ text: '   ' }))
  assert.throws(() => parseSpeakRequest({}))
})

test('a long reply is clamped rather than refused', () => {
  const { text } = parseSpeakRequest({ text: 'a'.repeat(50_000) })
  assert.ok(text.length <= MAX_TEXT_LENGTH)
})

// --- the warm child --------------------------------------------------------

function fakeChild() {
  const child = new EventEmitter()
  child.written = []
  child.killed = 0
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdin = {
    writable: true,
    write: value => child.written.push(String(value)),
    end: () => { child.stdin.writable = false }
  }
  child.kill = () => { child.killed += 1 }
  return child
}

function speakerHarness() {
  const spawned = []
  const speaker = createWindowsSpeaker({
    spawnProcess: () => {
      const child = fakeChild()
      spawned.push(child)
      return child
    },
    scriptPath: 'C:\\fake\\speak.ps1'
  })
  return { speaker, spawned }
}

test('speaking waits for READY and then sends one encoded utterance', () => {
  const { speaker, spawned } = speakerHarness()
  speaker.speak('Hello there')
  assert.equal(spawned.length, 1, 'a child should have been warmed')
  assert.deepEqual(spawned[0].written, [], 'nothing may be written before READY')

  spawned[0].stdout.emit('data', 'READY\n')
  assert.equal(spawned[0].written.length, 1)
  const [line] = spawned[0].written
  const [command, id, payload] = line.trim().split('|')
  assert.equal(command, 'SPEAK')
  assert.ok(id)
  // Base64 so an utterance may contain '|', quotes or newlines with no quoting
  // rule, and so nothing in it is ever parsed as a command.
  assert.equal(Buffer.from(payload, 'base64').toString('utf8'), 'Hello there')
})

test('a second request replaces live speech rather than queueing behind it', () => {
  // A spoken reply that is stale by the time it is heard is worse than
  // silence, and an assistant that talks over itself is unusable.
  const { speaker, spawned } = speakerHarness()
  speaker.speak('first')
  spawned[0].stdout.emit('data', 'READY\n')
  spawned[0].stdout.emit('data', 'SPEAKING|u1\n')
  assert.equal(speaker.isSpeaking(), true)

  speaker.speak('second')
  assert.equal(spawned[0].killed, 1, 'the speaking child should have been killed')
  assert.equal(spawned.length, 2, 'a replacement child should be warm')
  assert.equal(speaker.isSpeaking(), false)

  spawned[1].stdout.emit('data', 'READY\n')
  const payload = spawned[1].written[0].trim().split('|')[2]
  assert.equal(Buffer.from(payload, 'base64').toString('utf8'), 'second')
})

test('cancel stops speech and leaves a warm child for the next utterance', () => {
  const { speaker, spawned } = speakerHarness()
  speaker.speak('a long reply')
  spawned[0].stdout.emit('data', 'READY\n')
  spawned[0].stdout.emit('data', 'SPEAKING|u1\n')

  const result = speaker.cancel()
  assert.equal(result.cancelled, true)
  assert.equal(spawned[0].killed, 1)
  assert.equal(spawned.length, 2, 'cancelling must re-warm, so the next reply is not slow')
  assert.equal(speaker.isSpeaking(), false)
})

test('cancelling when nothing is being spoken is safe and honest', () => {
  const { speaker } = speakerHarness()
  const result = speaker.cancel()
  assert.equal(result.ok, true)
  assert.equal(result.cancelled, false)
})

test('DONE clears the speaking state, so it is observed rather than estimated', () => {
  const { speaker, spawned } = speakerHarness()
  speaker.speak('x')
  spawned[0].stdout.emit('data', 'READY\n')
  spawned[0].stdout.emit('data', 'SPEAKING|u1\n')
  assert.equal(speaker.isSpeaking(), true)
  spawned[0].stdout.emit('data', 'DONE|u1\n')
  assert.equal(speaker.isSpeaking(), false)
})

test('a dead child does not leave the speaker permanently mute', () => {
  const { speaker, spawned } = speakerHarness()
  speaker.speak('one')
  spawned[0].stdout.emit('data', 'READY\n')
  spawned[0].emit('exit', 1, null)
  // The next request warms a new child rather than writing into a dead pipe.
  speaker.speak('two')
  assert.equal(spawned.length, 2)
  spawned[1].stdout.emit('data', 'READY\n')
  assert.equal(spawned[1].written.length, 1)
})

test('only the current child may change shared state', () => {
  // A killed child can still deliver buffered stdout after its replacement
  // has started.
  const { speaker, spawned } = speakerHarness()
  speaker.speak('first')
  spawned[0].stdout.emit('data', 'READY\n')
  spawned[0].stdout.emit('data', 'SPEAKING|u1\n')
  speaker.speak('second')
  spawned[0].stdout.emit('data', 'SPEAKING|u1\n')
  assert.equal(speaker.isSpeaking(), false, 'a dead child reported speaking')
})

test('dispose asks the child to quit, then kills it', () => {
  const { speaker, spawned } = speakerHarness()
  speaker.speak('x')
  spawned[0].stdout.emit('data', 'READY\n')
  speaker.dispose()
  assert.match(spawned[0].written.join(''), /QUIT/)
  assert.equal(spawned[0].killed, 1)
  // After disposal nothing speaks and nothing respawns.
  assert.equal(speaker.speak('later').ok, false)
  assert.equal(spawned.length, 1)
})

test('empty text is declined without spawning anything', () => {
  const { speaker, spawned } = speakerHarness()
  assert.equal(speaker.speak('   ').ok, false)
  assert.equal(speaker.speak(null).ok, false)
  assert.equal(spawned.length, 0)
})

test('the speaker line parser ignores anything it does not recognize', () => {
  assert.deepEqual(parseSpeakerLine('READY'), { kind: 'ready' })
  assert.deepEqual(parseSpeakerLine('SPEAKING|u7'), { kind: 'speaking', id: 'u7' })
  assert.deepEqual(parseSpeakerLine('DONE|u7'), { kind: 'done', id: 'u7' })
  assert.equal(parseSpeakerLine('ERR|synthesizer-failed').kind, 'error')
  assert.equal(parseSpeakerLine(''), null)
  assert.equal(parseSpeakerLine('unexpected chatter'), null)
})

test('the script is read from resources when packaged', () => {
  // powershell.exe cannot read a path inside app.asar. This is the trap that
  // made voice-listen.ps1 work in dev and do nothing once installed.
  assert.match(resolveScriptPath({ packaged: true, resourcesPath: 'C:\\app\\resources' }), /resources[\\/]speak\.ps1$/)
  assert.equal(isPackagedRuntime('C:\\app\\resources\\app.asar\\electron\\speech'), true)
  assert.equal(isPackagedRuntime('C:\\dev\\rata\\electron\\speech'), false)
})

// --- the switch is enforced in the main process ----------------------------

function ipcHarness(settings, speaker) {
  const handlers = new Map()
  speechIpc.register({
    handle: (channel, fn) => handlers.set(channel, fn),
    services: {
      getStore: () => ({ getSettings: () => settings }),
      getSpeaker: () => speaker,
      getTranscriber: () => ({ available: true })
    }
  })
  return handlers
}

test('the renderer asking to speak is not permission to speak', () => {
  // A renderer could hold a stale capability snapshot from before the user
  // turned speech off, so the setting is re-checked here.
  const spoken = []
  const speaker = { speak: text => { spoken.push(text); return { ok: true } }, cancel: () => ({ ok: true, cancelled: false }) }
  const handlers = ipcHarness({ ttsProvider: 'off', speakReplies: true }, speaker)
  const result = handlers.get('speakText')(null, { text: 'hello' })
  assert.equal(result.ok, false)
  assert.deepEqual(spoken, [], 'speech happened with the provider off')
})

test('speech is spoken when both switches are on', () => {
  const spoken = []
  const speaker = { speak: text => { spoken.push(text); return { ok: true, id: 'u1' } } }
  const handlers = ipcHarness({ ttsProvider: 'windows', speakReplies: true }, speaker)
  assert.equal(handlers.get('speakText')(null, { text: 'hello  there' }).ok, true)
  assert.deepEqual(spoken, ['hello there'])
})

test('cancelling is allowed even when speech is off', () => {
  // Cancel is how the user stops Rata talking; it must not depend on a setting
  // that may have just been switched off mid-utterance.
  let cancelled = 0
  const speaker = { cancel: () => { cancelled += 1; return { ok: true, cancelled: true } } }
  const handlers = ipcHarness({ ttsProvider: 'off', speakReplies: false }, speaker)
  assert.equal(handlers.get('cancelSpeech')().ok, true)
  assert.equal(cancelled, 1)
})

test('capabilities report the resolved mode, not just the setting', () => {
  const handlers = ipcHarness({ sttProvider: 'local', ttsProvider: 'windows', speakReplies: true }, createSilentSpeaker())
  const capabilities = handlers.get('speechCapabilities')()
  assert.equal(capabilities.stt.mode, 'local')
  assert.equal(capabilities.stt.localAvailable, true)
  assert.equal(capabilities.tts.speaking, true)
})

// --- the factory -----------------------------------------------------------

test('speech off yields a speaker that is safe to call unconditionally', () => {
  // Having a real object rather than a null means every call site can speak
  // without first asking whether speech is on.
  for (const settings of [{}, { ttsProvider: 'off' }, { ttsProvider: 'windows', speakReplies: false }]) {
    const speaker = createSpeaker({ settings })
    assert.equal(speaker.available, false)
    assert.equal(speaker.speak('x').ok, false)
    assert.doesNotThrow(() => speaker.cancel())
    assert.doesNotThrow(() => speaker.dispose())
    assert.equal(speaker.isSpeaking(), false)
  }
})

test('a synthesizer that cannot be constructed degrades to silence, loudly logged', () => {
  const logged = []
  const speaker = createSpeaker({
    settings: { ttsProvider: 'windows', speakReplies: true },
    speakerFactories: { windows: () => { throw new Error('no audio device') } },
    logActivity: (title, detail, level) => logged.push({ title, detail, level })
  })
  assert.equal(speaker.available, false)
  assert.equal(logged.length, 1, 'a silent failure must still be audited')
  assert.equal(logged[0].level, 'warning')
  // The underlying error text can carry device detail.
  assert.equal(/no audio device/.test(logged[0].detail), false)
})

test('no audio is written to disk by the speaker', () => {
  // Synthesis goes straight to the audio device. The wave-file argument exists
  // only so tests can stay silent, and production never passes it.
  //
  // The first version of this compared an empty array with itself and proved
  // nothing. This reads the arguments the child was actually spawned with.
  const calls = []
  const speaker = createWindowsSpeaker({
    spawnProcess: (command, args) => {
      calls.push({ command, args })
      return fakeChild()
    },
    scriptPath: 'C:\\fake\\speak.ps1'
  })
  speaker.speak('x')

  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, 'powershell.exe')
  assert.equal(calls[0].args.includes('-WaveOut'), false, 'production must not render audio to a file')
  // No shell, and the only caller-influenced value is our own script path.
  assert.ok(calls[0].args.includes('-NoProfile'))
  assert.ok(calls[0].args.includes('C:\\fake\\speak.ps1'))
  speaker.dispose()
})

test('the utterance never reaches the command line', () => {
  // It goes over stdin, base64 encoded. Text on an argument vector would be
  // visible to any process listing, and spoken replies quote the user's own
  // documents back to them.
  const calls = []
  const speaker = createWindowsSpeaker({
    spawnProcess: (command, args) => {
      calls.push(args.join(' '))
      return fakeChild()
    },
    scriptPath: 'C:\\fake\\speak.ps1'
  })
  speaker.speak('the quarterly revenue figure is confidential')
  assert.equal(calls.some(line => /quarterly|confidential/.test(line)), false)
  speaker.dispose()
})
