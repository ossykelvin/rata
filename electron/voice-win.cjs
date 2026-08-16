'use strict'

const { spawn } = require('node:child_process')
const path = require('node:path')

const MAX_TRANSCRIPT_LENGTH = 2_000
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

  function stop() {
    if (!child) return { ok: true }
    const current = child
    child = null
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
        const transcript = line.trim().slice(0, MAX_TRANSCRIPT_LENGTH)
        if (transcript) sendTranscript({ transcript })
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
    spawned.on('exit', () => {
      if (buffer.trim()) sendTranscript({ transcript: buffer.trim().slice(0, MAX_TRANSCRIPT_LENGTH) })
      // Same shape as overlayWindow === window in main.cjs: an old child's
      // exit must not clear a newer child's reference.
      if (child === spawned) child = null
    })
    spawned.on('error', () => {
      if (child === spawned) child = null
    })
    logActivity('Voice listening started', 'Windows speech recognition is listening.', 'info')
    return { ok: true }
  }

  return { start, stop }
}

module.exports = { createWindowsVoice, resolveScriptPath, isPackagedRuntime, MAX_TRANSCRIPT_LENGTH, SCRIPT_NAME }
