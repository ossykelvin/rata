'use strict'

const { spawn } = require('node:child_process')
const path = require('node:path')

const SCRIPT_NAME = 'speak.ps1'
const MAX_TEXT_LENGTH = 4_000
/** A child that has not reported READY for this long is replaced, not trusted. */
const READY_TIMEOUT_MS = 10_000

/**
 * Where the speaker script lives at runtime.
 *
 * In a packaged build `__dirname` is inside `app.asar`, and `powershell.exe`
 * cannot read a path in there — the same trap that made voice-listen.ps1 work
 * in dev and do nothing once installed. electron-builder copies this script to
 * `resources/` via `extraResources`, which is a real directory on disk.
 */
function resolveScriptPath({ packaged = isPackagedRuntime(), resourcesPath = process.resourcesPath } = {}) {
  return packaged ? path.join(resourcesPath, SCRIPT_NAME) : path.join(__dirname, SCRIPT_NAME)
}

function isPackagedRuntime(dir = __dirname) {
  return dir.includes('app.asar')
}

/** Parses one stdout line from the speaker. Returns null for anything else. */
function parseSpeakerLine(line) {
  const raw = String(line).trim()
  if (!raw) return null
  if (raw === 'READY') return { kind: 'ready' }
  const parts = raw.split('|')
  if (parts[0] === 'SPEAKING' && parts[1]) return { kind: 'speaking', id: parts[1] }
  if (parts[0] === 'DONE' && parts[1]) return { kind: 'done', id: parts[1] }
  if (parts[0] === 'WARN') return { kind: 'warn', detail: parts[1] || 'unknown' }
  if (parts[0] === 'ERR') return { kind: 'error', detail: parts[1] || 'unknown' }
  return null
}

/**
 * Windows speech synthesis through a warm PowerShell child.
 *
 * Latency is why the child is kept warm: measured on this machine, a cold
 * spawn reaches first audio in 322ms and a warm one in 27ms.
 *
 * Cancelling kills the child and starts a replacement rather than asking the
 * synthesizer to stop. The alternative — SpeakAsync plus a SpeakCompleted
 * handler — needs a PowerShell ScriptBlock invoked as a .NET delegate on a
 * thread-pool thread with no runspace, which is exactly what killed
 * voice-listen.ps1 earlier in this project: no stderr, exit code 2, and a
 * feature that looked dead while the engine was fine. Measured: killing stops
 * synthesis in progress at 26% of a full run, so cancellation is immediate.
 *
 * Nothing is written to disk and no audio is retained. Synthesis goes straight
 * to the audio device; `waveOut` exists only so tests can stay silent.
 */
function createWindowsSpeaker({
  spawnProcess = spawn,
  scriptPath = resolveScriptPath(),
  voice = '',
  rate = 0,
  waveOut = '',
  logActivity = () => {},
  now = () => Date.now()
} = {}) {
  let child = null
  let ready = false
  let startedAt = 0
  let speakingId = null
  let queued = null
  let disposed = false
  let counter = 0
  let buffer = ''

  function childArgs() {
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]
    if (voice) args.push('-Voice', voice)
    args.push('-Rate', String(rate))
    if (waveOut) args.push('-WaveOut', waveOut)
    return args
  }

  function warm() {
    if (disposed || child) return
    buffer = ''
    ready = false
    startedAt = now()
    const spawned = spawnProcess('powershell.exe', childArgs(), {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    child = spawned

    spawned.stdout?.on('data', data => {
      // Only the current child may mutate shared state. A killed child can
      // still deliver buffered stdout after its replacement has started.
      if (child !== spawned) return
      buffer += String(data)
      let index
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 1)
        handleLine(parseSpeakerLine(line), spawned)
      }
    })

    spawned.on('error', () => {
      if (child !== spawned) return
      child = null
      ready = false
      speakingId = null
      logActivity('Text to speech', 'The speech synthesizer could not be started.', 'warning')
    })

    spawned.on('exit', () => {
      if (child !== spawned) return
      child = null
      ready = false
      speakingId = null
      // No respawn here on purpose. speak() warms a child when one is needed,
      // so a synthesizer that fails repeatedly cannot become a spawn loop.
    })
  }

  function handleLine(parsed, spawned) {
    if (!parsed || child !== spawned) return
    if (parsed.kind === 'ready') {
      ready = true
      if (queued) {
        const pending = queued
        queued = null
        write(pending.id, pending.text)
      }
      return
    }
    if (parsed.kind === 'speaking') {
      speakingId = parsed.id
      return
    }
    if (parsed.kind === 'done') {
      if (speakingId === parsed.id) speakingId = null
      return
    }
    if (parsed.kind === 'warn') {
      logActivity('Text to speech', 'The configured voice is not installed; using the default voice.', 'info')
      return
    }
    if (parsed.kind === 'error') {
      logActivity('Text to speech', 'The speech synthesizer reported a failure.', 'warning')
    }
  }

  function write(id, text) {
    if (!child?.stdin?.writable) return false
    const encoded = Buffer.from(text, 'utf8').toString('base64')
    child.stdin.write(`SPEAK|${id}|${encoded}\n`)
    return true
  }

  /**
   * Speaks `text`, replacing anything already being spoken.
   *
   * Replacing rather than queueing is deliberate: a spoken reply that is
   * already stale by the time it is heard is worse than silence, and an
   * assistant that talks over itself is unusable.
   */
  function speak(text) {
    if (disposed) return { ok: false, reason: 'disposed' }
    const value = typeof text === 'string' ? text.trim() : ''
    if (!value) return { ok: false, reason: 'empty' }
    const utterance = value.slice(0, MAX_TEXT_LENGTH)

    // A child that never reported READY is not usable. Replace it rather than
    // writing into a process that may be wedged.
    if (child && !ready && now() - startedAt > READY_TIMEOUT_MS) kill()
    if (speakingId) cancel()

    counter += 1
    const id = `u${counter}`
    if (!child) warm()
    if (ready) {
      if (write(id, utterance)) return { ok: true, id }
      queued = { id, text: utterance }
      return { ok: true, id, queued: true }
    }
    // READY has not arrived yet. Hold exactly one utterance; a newer request
    // replaces it, for the same reason speak() replaces live speech.
    queued = { id, text: utterance }
    return { ok: true, id, queued: true }
  }

  function kill() {
    const dying = child
    child = null
    ready = false
    speakingId = null
    queued = null
    buffer = ''
    if (!dying) return
    try {
      dying.stdin?.end()
    } catch {
      // Already closed; the kill below is what matters.
    }
    try {
      dying.kill()
    } catch {
      // Already gone.
    }
  }

  /** Stops speech immediately and re-warms, so the next utterance is fast. */
  function cancel() {
    const wasSpeaking = Boolean(speakingId) || Boolean(queued)
    kill()
    if (!disposed) warm()
    return { ok: true, cancelled: wasSpeaking }
  }

  function dispose() {
    disposed = true
    const dying = child
    child = null
    ready = false
    speakingId = null
    queued = null
    if (!dying) return { ok: true }
    try {
      if (dying.stdin?.writable) dying.stdin.write('QUIT\n')
      dying.stdin?.end()
    } catch {
      // Fall through to the kill.
    }
    try {
      dying.kill()
    } catch {
      // Already gone.
    }
    return { ok: true }
  }

  return {
    id: 'windows',
    available: true,
    speak,
    cancel,
    dispose,
    warm,
    isSpeaking: () => Boolean(speakingId)
  }
}

module.exports = {
  createWindowsSpeaker,
  parseSpeakerLine,
  resolveScriptPath,
  isPackagedRuntime,
  SCRIPT_NAME,
  MAX_TEXT_LENGTH,
  READY_TIMEOUT_MS
}
