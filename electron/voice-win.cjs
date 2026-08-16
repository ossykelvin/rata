'use strict'

const { spawn } = require('node:child_process')
const path = require('node:path')

const MAX_TRANSCRIPT_LENGTH = 2_000

/**
 * Absolute floor. Below this a result is an artefact, not an utterance.
 *
 * Set from measurements of real speech on this hardware, not from a guess.
 * Ten consecutive spoken results scored 0.003, 0.012, 0.051, 0.060, 0.088,
 * 0.101, 0.122, 0.125, 0.151 and 0.167. Two earlier attempts at 0.4 and then
 * 0.2 sat above every one of those, so every word the user spoke was
 * discarded and the feature looked dead while working perfectly.
 *
 * The desktop dictation engine simply reports low confidence on this
 * microphone. An absolute threshold anywhere in the useful range also
 * overlaps ambient noise, which measured 0.085 to 0.323, so confidence alone
 * cannot separate speech from a quiet room. 0.05 only removes the near-zero
 * artefacts; the real selection is relative, see below.
 */
const MIN_CONFIDENCE = 0.05
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
    // Highest confidence seen during this listening session.
    let sessionBest = 0
    spawned.stdout.setEncoding('utf8')
    spawned.stdout.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop()
      for (const line of lines) {
        const parsed = parseResultLine(line)
        if (!parsed) continue
        const score = parsed.confidence
        // Selection is relative to this session, not to a fixed threshold.
        //
        // The user held the button and spoke, so the best thing heard while
        // they were speaking is the answer, whatever it scored. A result is
        // delivered when it is the best so far in this session, which means
        // the first usable guess appears immediately and is replaced only by
        // something better. Later, worse fragments no longer overwrite it.
        if (score !== null && score < MIN_CONFIDENCE) {
          logActivity(
            'Voice result discarded',
            `Heard "${parsed.transcript.slice(0, 80)}" at confidence ${score.toFixed(3)}, below the ${MIN_CONFIDENCE} floor.`,
            'info'
          )
          continue
        }
        if (score !== null && score <= sessionBest) {
          logActivity(
            'Voice result skipped',
            `Heard "${parsed.transcript.slice(0, 80)}" at confidence ${score.toFixed(3)}, not better than ${sessionBest.toFixed(3)}.`,
            'info'
          )
          continue
        }
        if (score !== null) sessionBest = score
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
