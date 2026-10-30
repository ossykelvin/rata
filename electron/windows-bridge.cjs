'use strict'

const crypto = require('node:crypto')
const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')

/** How long one bridge call may take before it is abandoned. */
const CALL_TIMEOUT_MS = 10_000
/** How long the child has to create its pipe and announce itself. */
const START_TIMEOUT_MS = 15_000
/** Longest response line accepted, matching Protocol.MaxLineLength. */
const MAX_LINE_LENGTH = 64 * 1024

/**
 * Processes Rata is willing to drive, sent to the bridge at handshake.
 *
 * The bridge intersects this with its own compiled-in list and can never be
 * widened by it, so this is a narrowing request rather than a grant. Keeping a
 * copy here is still worth it: it is the list a reviewer reads in the host, and
 * it documents what Rata intends rather than only what the bridge tolerates.
 */
const DEFAULT_ALLOW_LIST = Object.freeze([
  'notepad',
  'calc',
  'calculator',
  'wordpad',
  'explorer',
  'winword',
  'excel',
  'powerpnt',
  'onenote'
])

class WindowsBridgeError extends Error {
  constructor(message, code = 'bridge-failed') {
    super(message)
    this.name = 'WindowsBridgeError'
    this.code = code
  }
}

/**
 * Resolves the bridge executable. Packaged builds carry it in `resources`.
 *
 * Same trap as the PowerShell scripts: a path inside `app.asar` is not a real
 * file on disk, so a child process cannot be started from it.
 */
function resolveBridgePath({
  packaged = String(__dirname).includes('app.asar'),
  resourcesPath = process.resourcesPath,
  projectRoot = path.join(__dirname, '..')
} = {}) {
  if (packaged) return path.join(resourcesPath, 'bridge', 'Rata.WindowsBridge.exe')
  return path.join(
    projectRoot,
    'bridge',
    'Rata.WindowsBridge',
    'bin',
    'Debug',
    'net10.0-windows',
    'Rata.WindowsBridge.exe'
  )
}

/**
 * Client for the native Windows bridge. RATA-005 / ADR-024.
 *
 * Every call carries a correlation id that the bridge echoes and writes to its
 * own stderr, so one line in Rata's activity log matches one call into a
 * process that can drive another application's UI.
 *
 * The authentication token is generated here and handed to the child in its
 * environment, never on the command line: an argument vector is readable from
 * any process listing on the machine, which would publish the secret to every
 * user on it.
 */
function createWindowsBridge({
  spawnProcess = spawn,
  connect = net.connect,
  executablePath = resolveBridgePath(),
  allowList = DEFAULT_ALLOW_LIST,
  logActivity = () => {},
  callTimeoutMs = CALL_TIMEOUT_MS,
  startTimeoutMs = START_TIMEOUT_MS,
  randomBytes = crypto.randomBytes,
  randomUUID = crypto.randomUUID
} = {}) {
  let child = null
  let socket = null
  let starting = null
  let disposed = false
  let counter = 0
  let buffer = ''
  const pending = new Map()

  function nextId() {
    counter += 1
    return `c${counter}`
  }

  function settleAll(error) {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    pending.clear()
  }

  function teardown(error) {
    const dyingSocket = socket
    const dyingChild = child
    socket = null
    child = null
    starting = null
    buffer = ''
    settleAll(error || new WindowsBridgeError('The Windows bridge stopped.', 'bridge-stopped'))
    try {
      dyingSocket?.destroy()
    } catch {
      // Already gone.
    }
    try {
      dyingChild?.kill()
    } catch {
      // Already gone.
    }
  }

  function handleLine(line) {
    const raw = line.trim()
    if (!raw) return
    let message
    try {
      message = JSON.parse(raw)
    } catch {
      // A response that is not JSON means the stream is no longer trustworthy.
      teardown(new WindowsBridgeError('The Windows bridge sent an unreadable response.', 'bridge-protocol'))
      return
    }
    const entry = pending.get(message?.id)
    if (!entry) return
    pending.delete(message.id)
    clearTimeout(entry.timer)
    if (message.ok === true) entry.resolve(message)
    else entry.reject(new WindowsBridgeError(String(message.error || 'The bridge refused that request.'), 'bridge-refused'))
  }

  function attach(stream) {
    stream.setEncoding('utf8')
    stream.on('data', chunk => {
      buffer += chunk
      if (buffer.length > MAX_LINE_LENGTH * 4) {
        teardown(new WindowsBridgeError('The Windows bridge sent too much data.', 'bridge-protocol'))
        return
      }
      let index
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 1)
        handleLine(line)
      }
    })
    stream.on('error', () => teardown(new WindowsBridgeError('The Windows bridge connection failed.', 'bridge-stopped')))
    stream.on('close', () => {
      if (!disposed) teardown()
    })
  }

  /**
   * Starts the child and completes the handshake.
   *
   * Concurrent callers share one start: the bridge accepts a single client, so
   * two starts would race for the same pipe and one would be refused.
   */
  function start() {
    if (disposed) return Promise.reject(new WindowsBridgeError('The Windows bridge is shut down.', 'bridge-stopped'))
    if (socket) return Promise.resolve()
    if (starting) return starting

    const pipeName = `rata-bridge-${randomUUID()}`
    const token = randomBytes(32).toString('hex')

    starting = new Promise((resolve, reject) => {
      let settled = false
      const fail = error => {
        if (settled) return
        settled = true
        teardown(error)
        reject(error)
      }

      const timer = setTimeout(
        () => fail(new WindowsBridgeError('The Windows bridge did not start in time.', 'bridge-timeout')),
        startTimeoutMs
      )

      let spawned
      try {
        spawned = spawnProcess(executablePath, [pipeName], {
          windowsHide: true,
          stdio: ['ignore', 'ignore', 'pipe'],
          // The token goes in the environment, not argv. See the note above.
          env: { ...process.env, RATA_BRIDGE_TOKEN: token }
        })
      } catch {
        clearTimeout(timer)
        fail(new WindowsBridgeError('The Windows bridge could not be started.', 'bridge-missing'))
        return
      }
      child = spawned

      spawned.on('error', () => {
        clearTimeout(timer)
        fail(new WindowsBridgeError('The Windows bridge could not be started.', 'bridge-missing'))
      })
      spawned.on('exit', code => {
        if (!settled) {
          clearTimeout(timer)
          fail(new WindowsBridgeError(`The Windows bridge exited (${code}).`, 'bridge-stopped'))
          return
        }
        if (!disposed) teardown()
      })

      let stderr = ''
      spawned.stderr?.setEncoding('utf8')
      spawned.stderr?.on('data', chunk => {
        stderr += chunk
        // Diagnostics carry the correlation id. They are audited, never shown
        // to the model and never returned to a caller.
        for (const line of String(chunk).split(/\r?\n/)) {
          const text = line.trim()
          if (text && text !== 'bridge|ready') logActivity('Windows bridge', text.slice(0, 200), 'info')
        }
        if (!stderr.includes('bridge|ready') || settled) return

        const pipePath = path.join('\\\\.\\pipe', pipeName)
        const connected = connect({ path: pipePath }, async () => {
          attach(connected)
          socket = connected
          try {
            await call('hello', { token, allow: [...allowList] }, { skipReadyCheck: true })
            clearTimeout(timer)
            settled = true
            logActivity('Windows bridge', 'Connected and authenticated.', 'success')
            resolve()
          } catch (error) {
            clearTimeout(timer)
            fail(error instanceof WindowsBridgeError ? error : new WindowsBridgeError('The Windows bridge refused the handshake.', 'bridge-refused'))
          }
        })
        connected.on('error', () => {
          clearTimeout(timer)
          fail(new WindowsBridgeError('The Windows bridge connection failed.', 'bridge-stopped'))
        })
      })
    })

    return starting
  }

  function call(op, args = {}, { skipReadyCheck = false } = {}) {
    if (!socket && !skipReadyCheck) return Promise.reject(new WindowsBridgeError('The Windows bridge is not connected.', 'bridge-stopped'))
    const id = nextId()
    const payload = JSON.stringify({ id, op, ...args })
    if (payload.length > MAX_LINE_LENGTH) {
      return Promise.reject(new WindowsBridgeError('That request is too large for the bridge.', 'bridge-too-large'))
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new WindowsBridgeError('The Windows bridge did not answer in time.', 'bridge-timeout'))
      }, callTimeoutMs)
      pending.set(id, { resolve, reject, timer })
      try {
        socket.write(`${payload}\n`)
      } catch {
        pending.delete(id)
        clearTimeout(timer)
        reject(new WindowsBridgeError('The Windows bridge connection failed.', 'bridge-stopped'))
      }
    })
  }

  /** Starts the bridge if needed, then performs one operation. */
  async function request(op, args = {}) {
    await start()
    return call(op, args)
  }

  function dispose() {
    disposed = true
    teardown(new WindowsBridgeError('The Windows bridge is shut down.', 'bridge-stopped'))
    return { ok: true }
  }

  return {
    request,
    start,
    dispose,
    isConnected: () => Boolean(socket),
    allowList: [...allowList]
  }
}

module.exports = {
  createWindowsBridge,
  resolveBridgePath,
  WindowsBridgeError,
  DEFAULT_ALLOW_LIST,
  CALL_TIMEOUT_MS,
  START_TIMEOUT_MS,
  MAX_LINE_LENGTH
}
