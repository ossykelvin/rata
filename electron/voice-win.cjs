'use strict'

const { spawn } = require('node:child_process')
const path = require('node:path')

const MAX_TRANSCRIPT_LENGTH = 2_000
const SCRIPT = path.join(__dirname, 'voice-listen.ps1')

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

  function stop() {
    if (!child) return { ok: true }
    const current = child
    child = null
    try { current.stdin.write('\n') } catch { /* already closed */ }
    const killer = setTimeout(() => {
      try { current.kill() } catch { /* already exited */ }
    }, 2500)
    current.once('exit', () => clearTimeout(killer))
    return { ok: true }
  }

  function start() {
    if (process.platform !== 'win32' && spawnProcess === spawn) {
      throw new Error('Windows speech recognition is only available on Windows.')
    }
    if (child) return { ok: true }

    child = spawnProcess('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let buffer = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop()
      for (const line of lines) {
        const transcript = line.trim().slice(0, MAX_TRANSCRIPT_LENGTH)
        if (transcript) sendTranscript({ transcript })
      }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      const text = String(chunk)
      if (text.includes('NO_MIC')) {
        logActivity('Voice listening failed', 'No default microphone was available.', 'error')
        sendTranscript({ transcript: '', error: 'No microphone is available.' })
      } else if (text.includes('NO_ENGINE')) {
        logActivity('Voice listening failed', 'Windows speech recognition is not installed.', 'error')
        sendTranscript({ transcript: '', error: 'Windows speech recognition is not installed.' })
      }
    })
    child.on('exit', (_code) => {
      if (buffer.trim()) sendTranscript({ transcript: buffer.trim().slice(0, MAX_TRANSCRIPT_LENGTH) })
      child = null
    })
    child.on('error', () => { child = null })
    logActivity('Voice listening started', 'Windows speech recognition is listening.', 'info')
    return { ok: true }
  }

  return { start, stop }
}

module.exports = { createWindowsVoice, MAX_TRANSCRIPT_LENGTH }
