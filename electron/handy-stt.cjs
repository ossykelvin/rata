'use strict'

const { execFile } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

/**
 * Local speech-to-text through Handy (RATA-009).
 *
 * Handy is an MIT-licensed, fully offline transcriber. We use only its
 * headless batch mode:
 *
 *   handy.exe --transcribe-file <16kHz mono WAV> --model <id> --json
 *
 * Nothing here launches its UI, its global shortcut, or its clipboard paste.
 * Rata records the audio itself and asks Handy for text.
 *
 * Why this replaces the PowerShell recognizer: on this hardware Windows
 * desktop dictation turned "open notepad" into "eat one C", while Handy
 * returned "Open notepad and check the weather in Preston." exactly. Measured
 * cost is ~350ms of inference and ~2.1s wall clock per press, of which ~1.3s
 * is Handy's own application start.
 *
 * Boundaries:
 * - the executable path is resolved here from known install locations and is
 *   never supplied by the renderer or a model
 * - arguments are a fixed list; the only variable is a temp file path this
 *   module created
 * - execFile, never a shell, so nothing is word-split or expanded
 * - the temp WAV holds the user's voice and is deleted in a finally block
 * - no audio, transcript or file path is written to an audit event
 */

const TRANSCRIBE_TIMEOUT_MS = 60_000
const WARMUP_TIMEOUT_MS = 120_000
const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const MAX_TRANSCRIPT_LENGTH = 2_000

/** Whisper Small (English). Installed under Handy's own models directory. */
const DEFAULT_MODEL = 'handy-computer/whisper-small.en-gguf/whisper-small.en-Q8_0.gguf'

/** Known per-user and per-machine install locations, in preference order. */
function candidateExecutables(env = process.env) {
  const roots = [
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Handy'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Handy'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'Handy'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'Handy')
  ].filter(Boolean)
  return roots.map(root => path.join(root, 'handy.exe'))
}

/** The installed handy.exe, or null when Handy is not present. */
function resolveHandyExecutable({ env = process.env, exists = fs.existsSync } = {}) {
  for (const candidate of candidateExecutables(env)) {
    if (exists(candidate)) return candidate
  }
  return null
}

/**
 * Reads the transcript out of Handy's `--json` output.
 *
 * Handy writes its logs to stderr and one JSON object to stdout, but a stray
 * line on stdout must not break transcription, so the last JSON object wins.
 */
function parseTranscription(stdout) {
  const text = String(stdout || '').trim()
  if (!text) throw new Error('Transcription produced no output.')

  let parsed = null
  for (const line of text.split(/\r?\n/)) {
    const candidate = line.trim()
    if (!candidate.startsWith('{')) continue
    try {
      parsed = JSON.parse(candidate)
    } catch {
      // A partial or non-JSON line is ignored rather than fatal.
    }
  }
  if (!parsed || typeof parsed.text !== 'string') {
    throw new Error('Transcription returned an unexpected response.')
  }
  return {
    transcript: parsed.text.trim().slice(0, MAX_TRANSCRIPT_LENGTH),
    audioSeconds: Number.isFinite(parsed.audio_secs) ? parsed.audio_secs : null,
    transcribeMs: Array.isArray(parsed.transcribe_ms) ? Number(parsed.transcribe_ms[0]) : null,
    backend: typeof parsed.bound_backend === 'string' ? parsed.bound_backend.slice(0, 40) : null
  }
}

/** A 44-byte RIFF header followed by PCM data, as Handy expects. */
function isWavBuffer(buffer) {
  return Buffer.isBuffer(buffer) &&
    buffer.length > 44 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
}

function createHandyTranscriber({
  executablePath = resolveHandyExecutable(),
  model = DEFAULT_MODEL,
  deviceIndex = null,
  runFile = execFile,
  tempDir = os.tmpdir(),
  logActivity = () => {}
} = {}) {
  const available = Boolean(executablePath)

  function run(args, timeoutMs) {
    return new Promise((resolve, reject) => {
      // execFile, not exec: no shell, so no quoting or expansion of any
      // argument, and nothing here is caller-supplied except our own path.
      runFile(executablePath, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          // Handy's stderr carries model paths and machine detail. Report a
          // fixed message and keep the detail out of the audit log.
          reject(new Error(error.killed ? 'Transcription timed out.' : 'Transcription failed.'))
          return
        }
        resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') })
      })
    })
  }

  function fixedArgs(wavPath) {
    const args = ['--transcribe-file', wavPath, '--model', model, '--json']
    if (Number.isInteger(deviceIndex) && deviceIndex >= 0) {
      args.push('--device-index', String(deviceIndex))
    }
    return args
  }

  /**
   * Transcribes one recording.
   *
   * `audio` is a WAV buffer produced by the renderer at 16kHz mono. It is
   * validated here rather than trusted: the renderer is not a boundary.
   */
  async function transcribe(audio) {
    if (!available) throw new Error('Local speech to text is not installed.')
    const buffer = Buffer.isBuffer(audio) ? audio : Buffer.from(audio || [])
    if (!isWavBuffer(buffer)) throw new Error('That recording is not a readable WAV.')
    if (buffer.length > MAX_AUDIO_BYTES) throw new Error('That recording is too long to transcribe.')

    // Random name, and removed in `finally`: the file is the user's voice.
    const wavPath = path.join(tempDir, `rata-stt-${crypto.randomUUID()}.wav`)
    try {
      await fsp.writeFile(wavPath, buffer)
      const { stdout } = await run(fixedArgs(wavPath), TRANSCRIBE_TIMEOUT_MS)
      const result = parseTranscription(stdout)
      // Timing only. The transcript itself is never audited.
      logActivity(
        'Speech transcribed',
        `${result.transcript.length} characters in ${result.transcribeMs ?? '?'}ms${result.backend ? ` on ${result.backend}` : ''}.`,
        'info'
      )
      return result
    } finally {
      await fsp.rm(wavPath, { force: true }).catch(() => {})
    }
  }

  /**
   * Loads the model once so the first real press is not slow.
   *
   * The first transcription after installing costs ~20s while the GPU shader
   * cache is built; every later one is ~2s. Without this the user's first
   * attempt looks broken, which is exactly the failure mode this whole feature
   * has been suffering from.
   */
  async function warmUp() {
    if (!available) return { ok: false, reason: 'not-installed' }
    const wavPath = path.join(tempDir, `rata-stt-warmup-${crypto.randomUUID()}.wav`)
    try {
      await fsp.writeFile(wavPath, silentWav())
      await run(fixedArgs(wavPath), WARMUP_TIMEOUT_MS)
      logActivity('Speech to text ready', 'The local transcription model is loaded.', 'info')
      return { ok: true }
    } catch {
      // Never fatal: the fallback recognizer still works.
      logActivity('Speech to text warm-up failed', 'The local model could not be pre-loaded.', 'warning')
      return { ok: false, reason: 'warmup-failed' }
    } finally {
      await fsp.rm(wavPath, { force: true }).catch(() => {})
    }
  }

  return { available, executablePath, model, transcribe, warmUp }
}

/** Half a second of 16kHz mono silence, for warm-up only. */
function silentWav(sampleRate = 16000, seconds = 0.5) {
  const samples = Math.floor(sampleRate * seconds)
  const data = Buffer.alloc(samples * 2)
  return Buffer.concat([wavHeader(samples, sampleRate), data])
}

function wavHeader(sampleCount, sampleRate) {
  const header = Buffer.alloc(44)
  const byteRate = sampleRate * 2
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + sampleCount * 2, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)          // PCM
  header.writeUInt16LE(1, 22)          // mono
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(2, 32)          // block align
  header.writeUInt16LE(16, 34)         // bits per sample
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(sampleCount * 2, 40)
  return header
}

module.exports = {
  createHandyTranscriber,
  resolveHandyExecutable,
  candidateExecutables,
  parseTranscription,
  isWavBuffer,
  silentWav,
  wavHeader,
  DEFAULT_MODEL,
  MAX_AUDIO_BYTES,
  MAX_TRANSCRIPT_LENGTH
}
