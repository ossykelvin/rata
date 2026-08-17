const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  createHandyTranscriber,
  resolveHandyExecutable,
  candidateExecutables,
  parseTranscription,
  isWavBuffer,
  silentWav,
  MAX_AUDIO_BYTES
} = require('../electron/handy-stt.cjs')
const { parseAudioForTranscription } = require('../packages/contracts/ipc-validation.cjs')
const { IPC } = require('../packages/contracts/ipc-channels.cjs')
const transcriptionHandler = require('../electron/ipc/transcription.cjs')
const transcriptionBridge = require('../electron/bridge/transcription.cjs')

// Lane H coverage for RATA-009.
//
// No test runs handy.exe. The runner is injected everywhere, because what
// matters here is the boundary: a third-party executable is spawned with a
// temp file containing the user's voice, and neither the renderer nor a model
// may influence which binary runs or what arguments it receives.

function fakeRunner(stdout = '{"text":"open notepad"}', { fail = false } = {}) {
  const calls = []
  const runFile = (file, args, options, callback) => {
    calls.push({ file, args, options })
    if (fail) {
      const error = new Error('spawn failed')
      error.killed = false
      callback(error, '', 'stderr detail with C:\\Users\\someone\\model.gguf')
      return
    }
    callback(null, stdout, '')
  }
  return { calls, runFile }
}

function transcriber(overrides = {}) {
  const { calls, runFile } = overrides.runner || fakeRunner()
  return {
    calls,
    instance: createHandyTranscriber({
      executablePath: 'C:\\fake\\handy.exe',
      runFile,
      tempDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rata-stt-test-')),
      ...overrides
    })
  }
}

// --- executable resolution ----------------------------------------------

test('the executable is resolved from known install locations only', () => {
  const paths = candidateExecutables({ LOCALAPPDATA: 'C:\\u', ProgramFiles: 'C:\\pf' })
  assert.ok(paths.every(candidate => candidate.endsWith('handy.exe')))
  assert.ok(paths.some(candidate => candidate.includes('C:\\u')))
  // Nothing may come from the environment beyond the standard roots.
  assert.equal(paths.some(candidate => candidate.includes('..')), false)
})

test('a missing install reports unavailable rather than throwing', async () => {
  const instance = createHandyTranscriber({ executablePath: null })
  assert.equal(instance.available, false)
  await assert.rejects(() => instance.transcribe(silentWav()), /not installed/)
  assert.deepEqual(await instance.warmUp(), { ok: false, reason: 'not-installed' })
})

test('resolution returns null when nothing is installed', () => {
  assert.equal(resolveHandyExecutable({ env: { LOCALAPPDATA: 'C:\\nope' }, exists: () => false }), null)
})

// --- argument construction ----------------------------------------------

test('arguments are fixed and contain only our own temp path', async () => {
  const { calls, instance } = transcriber()
  await instance.transcribe(silentWav())

  assert.equal(calls.length, 1)
  const { file, args, options } = calls[0]
  assert.equal(file, 'C:\\fake\\handy.exe')
  assert.equal(args[0], '--transcribe-file')
  assert.ok(args[1].endsWith('.wav'))
  assert.ok(path.basename(args[1]).startsWith('rata-stt-'))
  assert.deepEqual(args.slice(2), ['--model', instance.model, '--json'])
  assert.equal(options.windowsHide, true)
  assert.ok(options.timeout > 0, 'a spawn without a timeout can hang a press')
  // No UI, no shortcut, no clipboard paste, no shell.
  for (const forbidden of ['--toggle-transcription', '--start-hidden', '--no-tray', '--cancel']) {
    assert.equal(args.includes(forbidden), false, `${forbidden} must never be passed`)
  }
})

test('a device index is passed only when explicitly configured', async () => {
  const withDevice = transcriber({ deviceIndex: 1 })
  await withDevice.instance.transcribe(silentWav())
  assert.deepEqual(withDevice.calls[0].args.slice(-2), ['--device-index', '1'])

  const withoutDevice = transcriber()
  await withoutDevice.instance.transcribe(silentWav())
  assert.equal(withoutDevice.calls[0].args.includes('--device-index'), false)
})

// --- the recording is the user's voice ----------------------------------

test('the temp recording is deleted even when transcription fails', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rata-stt-clean-'))
  const failing = createHandyTranscriber({
    executablePath: 'C:\\fake\\handy.exe',
    runFile: fakeRunner('', { fail: true }).runFile,
    tempDir
  })
  await assert.rejects(() => failing.transcribe(silentWav()))
  assert.deepEqual(fs.readdirSync(tempDir), [], 'a recording of the user was left on disk')
})

test('the temp recording is deleted after a successful transcription', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rata-stt-clean2-'))
  const instance = createHandyTranscriber({
    executablePath: 'C:\\fake\\handy.exe',
    runFile: fakeRunner().runFile,
    tempDir
  })
  await instance.transcribe(silentWav())
  assert.deepEqual(fs.readdirSync(tempDir), [])
})

test('a failure message carries no machine or model detail', async () => {
  const instance = createHandyTranscriber({
    executablePath: 'C:\\fake\\handy.exe',
    runFile: fakeRunner('', { fail: true }).runFile,
    tempDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rata-stt-err-'))
  })
  const error = await instance.transcribe(silentWav()).catch(caught => caught)
  assert.match(error.message, /Transcription failed/)
  assert.equal(/C:\\Users/.test(error.message), false, 'a local path leaked')
  assert.equal(/gguf/.test(error.message), false, 'a model path leaked')
})

test('the transcript is never written to the audit log', async () => {
  const events = []
  const instance = createHandyTranscriber({
    executablePath: 'C:\\fake\\handy.exe',
    runFile: fakeRunner('{"text":"my bank password is hunter2","transcribe_ms":[10]}').runFile,
    tempDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rata-stt-audit-')),
    logActivity: (action, detail, status) => events.push({ action, detail, status })
  })
  const result = await instance.transcribe(silentWav())
  assert.equal(result.transcript, 'my bank password is hunter2')
  assert.ok(events.length >= 1)
  for (const event of events) {
    assert.equal(/hunter2/.test(event.detail), false, 'the transcript was audited')
  }
})

// --- input validation ---------------------------------------------------

test('only a real WAV is accepted', async () => {
  const { instance } = transcriber()
  assert.equal(isWavBuffer(silentWav()), true)
  for (const bad of [Buffer.alloc(0), Buffer.alloc(100), Buffer.from('not a wav at all, really not')]) {
    await assert.rejects(() => instance.transcribe(bad), /not a readable WAV/)
  }
})

test('an oversized recording is refused before anything is spawned', async () => {
  const { calls, instance } = transcriber()
  const huge = Buffer.concat([silentWav(), Buffer.alloc(MAX_AUDIO_BYTES + 1)])
  await assert.rejects(() => instance.transcribe(huge), /too long/)
  assert.equal(calls.length, 0, 'a process was spawned for an oversized payload')
})

test('the IPC validator refuses malformed audio at the boundary', () => {
  // The renderer is not a boundary, so this is checked twice on purpose.
  const good = parseAudioForTranscription({ audio: new Uint8Array(silentWav()) })
  assert.ok(good.audio.length > 44)
  for (const bad of [null, {}, { audio: 'string' }, { audio: [1, 2, 3] }, { audio: new Uint8Array(100) }]) {
    assert.throws(() => parseAudioForTranscription(bad))
  }
})

// --- output parsing -----------------------------------------------------

test('the transcript is read from the JSON line among log noise', () => {
  const parsed = parseTranscription('starting\n{"text":"Open notepad.","audio_secs":3.5,"transcribe_ms":[336],"bound_backend":"Vulkan1"}\n')
  assert.equal(parsed.transcript, 'Open notepad.')
  assert.equal(parsed.transcribeMs, 336)
  assert.equal(parsed.backend, 'Vulkan1')
})

test('unusable output fails closed', () => {
  for (const bad of ['', '   ', 'no json here', '{"notext":1}', '{broken']) {
    assert.throws(() => parseTranscription(bad))
  }
})

// --- IPC contract -------------------------------------------------------

test('the transcription channel is declared on the shared contract', () => {
  assert.equal(typeof IPC.transcribeAudio, 'string')
  assert.deepEqual(transcriptionHandler.channels, ['transcribeAudio'])
  assert.deepEqual(transcriptionBridge.channels, ['transcribeAudio'])
  assert.equal(transcriptionHandler.id, 'transcription')
})

test('the handler refuses when the microphone setting is off', async () => {
  const handlers = new Map()
  transcriptionHandler.register({
    handle: (channel, fn) => handlers.set(channel, fn),
    services: {
      getStore: () => ({ getSettings: () => ({ microphoneEnabled: false }) }),
      getTranscriber: () => ({ available: true, transcribe: async () => ({ transcript: 'x' }) })
    }
  })
  await assert.rejects(
    () => handlers.get('transcribeAudio')({}, { audio: new Uint8Array(silentWav()) }),
    /Microphone is disabled/
  )
})

test('the handler returns only the transcript, not timings or paths', async () => {
  const handlers = new Map()
  transcriptionHandler.register({
    handle: (channel, fn) => handlers.set(channel, fn),
    services: {
      getStore: () => ({ getSettings: () => ({ microphoneEnabled: true }) }),
      getTranscriber: () => ({
        available: true,
        transcribe: async () => ({ transcript: 'open notepad', transcribeMs: 336, backend: 'Vulkan1' })
      })
    }
  })
  const reply = await handlers.get('transcribeAudio')({}, { audio: new Uint8Array(silentWav()) })
  assert.deepEqual(reply, { transcript: 'open notepad' })
})

test('the handler reports cleanly when Handy is not installed', async () => {
  const handlers = new Map()
  transcriptionHandler.register({
    handle: (channel, fn) => handlers.set(channel, fn),
    services: {
      getStore: () => ({ getSettings: () => ({ microphoneEnabled: true }) }),
      getTranscriber: () => ({ available: false })
    }
  })
  await assert.rejects(
    () => handlers.get('transcribeAudio')({}, { audio: new Uint8Array(silentWav()) }),
    /not installed/
  )
})
