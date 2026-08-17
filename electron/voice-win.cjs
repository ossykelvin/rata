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

  // One long-lived recognizer, reused across presses.
  //
  // Measured on this hardware: PowerShell start, assembly load and Add-Type
  // compilation cost about 1.2s and happen once per process, while acquiring
  // the microphone costs 25ms and releasing it 9ms. A process per press
  // therefore put a ~1.4s dead window at the front of every push-to-talk,
  // which is exactly when people start speaking, so a short press recognised
  // nothing at all. The microphone is still genuinely released between
  // presses via SetInputToNull(), so warm does not mean open.
  let child = null
  let listening = false
  let buffer = ''
  let sessionBest = 0
  const intentionalStops = new WeakSet()

  function flushPartial() {
    const leftover = buffer.trim()
    buffer = ''
    if (!leftover) return
    // Preserves the deliberate behaviour from #65: a partial line already
    // buffered when a session ends is delivered rather than dropped, because
    // push-to-talk release would otherwise lose the last utterance.
    const parsed = parseResultLine(leftover)
    if (parsed) sendTranscript({ transcript: parsed.transcript })
  }

  function handleLine(line) {
    const parsed = parseResultLine(line)
    if (!parsed) return
    const score = parsed.confidence
    if (score !== null && score < MIN_CONFIDENCE) {
      logActivity(
        'Voice result discarded',
        `Heard "${parsed.transcript.slice(0, 80)}" at confidence ${score.toFixed(3)}, below the ${MIN_CONFIDENCE} floor.`,
        'info'
      )
      return
    }
    // Selection is relative to the press, not to a fixed threshold. The user
    // held the button and spoke, so the best thing heard while they were
    // speaking is the answer, whatever it scored.
    if (score !== null && score <= sessionBest) {
      logActivity(
        'Voice result skipped',
        `Heard "${parsed.transcript.slice(0, 80)}" at confidence ${score.toFixed(3)}, not better than ${sessionBest.toFixed(3)}.`,
        'info'
      )
      return
    }
    if (score !== null) sessionBest = score
    sendTranscript({ transcript: parsed.transcript })
  }

  function send(command) {
    if (!child) return false
    try {
      child.stdin.write(`${command}\n`)
      return true
    } catch {
      return false
    }
  }

  function ensureChild() {
    if (child) return child

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
    buffer = ''

    spawned.stdout.setEncoding('utf8')
    spawned.stdout.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop()
      for (const line of lines) handleLine(line)
    })

    spawned.stderr.setEncoding('utf8')
    spawned.stderr.on('data', chunk => {
      const text = String(chunk)
      if (text.includes('NO_MIC')) {
        logActivity('Voice listening failed', 'No default microphone was available.', 'error')
        sendTranscript({ transcript: '', error: 'No microphone is available.' })
        listening = false
      } else if (text.includes('NO_ENGINE')) {
        logActivity('Voice listening failed', 'Windows speech recognition is not installed.', 'error')
        sendTranscript({ transcript: '', error: 'Windows speech recognition is not installed.' })
        listening = false
      }
    })

    spawned.on('exit', code => {
      // Only the live child may change shared state. A dead child's exit event
      // can arrive after a replacement exists, and clearing `listening` from
      // there would silently end the new session.
      if (child !== spawned) return
      flushPartial()
      const wasListening = listening
      listening = false
      child = null
      // A recognizer that dies on its own must say so. Without this the
      // renderer stays in its listening state for ever, waiting for a
      // transcript from a process that no longer exists. FIX-005.
      if (!intentionalStops.has(spawned) && wasListening) {
        logActivity('Voice listening stopped', `The speech recognizer exited unexpectedly (code ${code}).`, 'error')
        sendTranscript({ transcript: '', error: 'Speech recognition stopped unexpectedly.' })
      }
    })

    spawned.on('error', () => {
      if (child !== spawned) return
      const wasListening = listening
      listening = false
      child = null
      if (!intentionalStops.has(spawned) && wasListening) {
        logActivity('Voice listening failed', 'The speech recognizer could not be started.', 'error')
        sendTranscript({ transcript: '', error: 'Speech recognition could not be started.' })
      }
    })

    return spawned
  }

  function start() {
    if (process.platform !== 'win32' && spawnProcess === spawn) {
      throw new Error('Windows speech recognition is only available on Windows.')
    }
    ensureChild()
    if (listening) return { ok: true }
    // Each press competes only with itself.
    sessionBest = 0
    buffer = ''
    listening = true
    send('LISTEN')
    logActivity('Voice listening started', 'Windows speech recognition is listening.', 'info')
    return { ok: true }
  }

  function stop() {
    if (!listening) return { ok: true }
    listening = false
    send('STOP')
    flushPartial()
    return { ok: true }
  }

  /** Ends the warm process. Call on app quit so no powershell.exe is left. */
  function dispose() {
    const current = child
    if (!current) return { ok: true }
    listening = false
    intentionalStops.add(current)
    child = null
    try { current.stdin.write('QUIT\n') } catch { /* already closed */ }
    const killer = setTimeout(() => {
      try { current.kill() } catch { /* already exited */ }
    }, 2000)
    if (typeof killer.unref === 'function') killer.unref()
    current.once('exit', () => clearTimeout(killer))
    return { ok: true }
  }

  return { start, stop, dispose, isListening: () => listening }
}

module.exports = { createWindowsVoice, resolveScriptPath, isPackagedRuntime, parseResultLine, MAX_TRANSCRIPT_LENGTH, MIN_CONFIDENCE, SCRIPT_NAME }
