'use strict'

const { spawn } = require('node:child_process')
const path = require('node:path')

const MAX_TRANSCRIPT_LENGTH = 2_000

/**
 * Results at or above this confidence are delivered; below it they are audited
 * and discarded.
 *
 * Deliberately low. Dictation returns a guess for almost any audio, and an
 * empty room measured 0.225 and 0.323 on this hardware, so some gate is
 * needed. But a first attempt at 0.4 was tuned partly on synthesised audio
 * scoring 0.681, which is far cleaner than a real microphone in a real room,
 * and it silently swallowed genuine speech. Discarded results are now logged
 * with their score, so this number can be set from real measurements instead
 * of from a guess.
 */
const MIN_CONFIDENCE = 0.2
const SCRIPT_NAME = 'voice-listen.ps1'

/**
 * Where the recognizer script lives at runtime.
 *
 * In a packaged build `__dirname` is inside `app.asar`, and `powershell.exe`
 * is an external process with no asar awareness — it cannot read a path in
 * there, so voice worked in dev and silently did nothing once installed.
 * electron-builder copies the script to `resources/` via `extraResources`,
 * which is a real directory on disk. Same shape as appIconPath() in main.cjs.
 */
function resolveScriptPath({ packaged = isPackagedRuntime(), resourcesPath = process.resourcesPath } = {}) {
  return packaged ? path.join(resourcesPath, SCRIPT_NAME) : path.join(__dirname, SCRIPT_NAME)
}

/**
 * True when running from an asar archive. Derived from the path rather than
 * `app.isPackaged` so this module stays testable without importing Electron.
 */
function isPackagedRuntime(dir = __dirname) {
  return dir.includes(`app.asar${path.sep}`) || dir.endsWith('app.asar') || dir.includes('app.asar')
}

const SCRIPT = resolveScriptPath()

/**
 * Parses one stdout line from the recognizer.
 *
 * The script emits "0.412|some text". A line with no confidence prefix is
 * still accepted as plain text with a null score, so an older or hand-edited
 * script keeps working rather than falling silent.
 */
function parseResultLine(line) {
  const raw = String(line).trim()
  if (!raw) return null
  const match = raw.match(/^(\d+(?:\.\d+)?)\|([\s\S]*)$/)
  if (!match) return { confidence: null, transcript: raw.slice(0, MAX_TRANSCRIPT_LENGTH) }
  const transcript = match[2].trim().slice(0, MAX_TRANSCRIPT_LENGTH)
  if (!transcript) return null
  const confidence = Number(match[1])
  return { confidence: Number.isFinite(confidence) ? confidence : null, transcript }
}

function createWindowsVoice({
  spawnProcess = spawn,
  sendTranscript,
  logActivity = () => {},
  scriptPath = SCRIPT
} = {}) {
  if (typeof sendTranscript !== 'function') {
    throw new TypeError('createWindowsVoice requires sendTranscript().')
  }

  let child = null
  let stopping = null
  let startChain = Promise.resolve()
  // Children we asked to stop. An exit that is not in here was not requested,
  // which means the recognizer died on its own and the user is still waiting.
  const intentionalStops = new WeakSet()

  function stop() {
    if (!child) return { ok: true }
    const current = child
    child = null
    intentionalStops.add(current)
    const done = new Promise(resolve => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearTimeout(killer)
        resolve()
      }
      const killer = setTimeout(() => {
        try { current.kill() } catch { /* already exited */ }
        finish()
      }, 2500)
      if (typeof killer.unref === 'function') killer.unref()
      current.once('exit', finish)
      try { current.stdin.write('\n') } catch { /* already closed */ }
    })
    stopping = done.finally(() => {
      if (stopping === done) stopping = null
    })
    return { ok: true }
  }

  function start() {
    const result = startChain.then(startNow)
    startChain = result.catch(() => {})
    return result
  }

  async function startNow() {
    if (process.platform !== 'win32' && spawnProcess === spawn) {
      throw new Error('Windows speech recognition is only available on Windows.')
    }
    if (stopping) await stopping
    if (child) return { ok: true }

    const spawned = spawnProcess('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    child = spawned

    let buffer = ''
    spawned.stdout.setEncoding('utf8')
    spawned.stdout.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop()
      for (const line of lines) {
        const parsed = parseResultLine(line)
        if (!parsed) continue
        if (parsed.confidence !== null && parsed.confidence < MIN_CONFIDENCE) {
          // Audited rather than dropped in silence. "Heard nothing" and "heard
          // something and discarded it" are different problems and used to be
          // indistinguishable from outside.
          logActivity(
            'Voice result discarded',
            `Heard “${parsed.transcript.slice(0, 80)}” at confidence ${parsed.confidence.toFixed(3)}, below ${MIN_CONFIDENCE}.`,
            'info'
          )
          continue
        }
        sendTranscript({ transcript: parsed.transcript })
      }
    })
    spawned.stderr.setEncoding('utf8')
    spawned.stderr.on('data', chunk => {
      const text = String(chunk)
      if (text.includes('NO_MIC')) {
        logActivity('Voice listening failed', 'No default microphone was available.', 'error')
        sendTranscript({ transcript: '', error: 'No microphone is available.' })
      } else if (text.includes('NO_ENGINE')) {
        logActivity('Voice listening failed', 'Windows speech recognition is not installed.', 'error')
        sendTranscript({ transcript: '', error: 'Windows speech recognition is not installed.' })
      }
    })
    spawned.on('exit', code => {
      // Deliberate: stop() (including microphone disable) still delivers a
      // leftover partial line. Push-to-talk release uses the same stop(), so
      // dropping the buffer would lose the last utterance. Complete lines
      // already emitted stay emitted. New stdout after child is nulled is
      // still delivered until the process actually exits.
      if (buffer.trim()) sendTranscript({ transcript: buffer.trim().slice(0, MAX_TRANSCRIPT_LENGTH) })
      // A recognizer that dies on its own must say so. Without this the
      // renderer stays in its listening state for ever: the UI is waiting for
      // a transcript from a process that no longer exists, and the user sees
      // nothing at all. FIX-005.
      if (!intentionalStops.has(spawned)) {
        logActivity('Voice listening stopped', `The speech recognizer exited unexpectedly (code ${code}).`, 'error')
        sendTranscript({ transcript: '', error: 'Speech recognition stopped unexpectedly.' })
      }
      // Same shape as overlayWindow === window in main.cjs: an old child's
      // exit must not clear a newer child's reference.
      if (child === spawned) child = null
    })
    spawned.on('error', () => {
      if (!intentionalStops.has(spawned)) {
        logActivity('Voice listening failed', 'The speech recognizer could not be started.', 'error')
        sendTranscript({ transcript: '', error: 'Speech recognition could not be started.' })
      }
      if (child === spawned) child = null
    })
    logActivity('Voice listening started', 'Windows speech recognition is listening.', 'info')
    return { ok: true }
  }

  return { start, stop }
}

module.exports = { createWindowsVoice, resolveScriptPath, isPackagedRuntime, parseResultLine, MAX_TRANSCRIPT_LENGTH, MIN_CONFIDENCE, SCRIPT_NAME }
