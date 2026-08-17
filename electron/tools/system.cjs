// Null-prototype on purpose. A plain object would resolve inherited keys such
// as "constructor" and could turn an allow-list lookup into an allow-list
// bypass. See docs/reviews/REVIEW-001-mvp-security.md (H2).
const APP_ALLOW_LIST = Object.freeze(Object.assign(Object.create(null), {
  notepad: { exe: 'notepad.exe', label: 'Notepad' },
  calculator: { exe: 'calc.exe', label: 'Calculator' }
}))

const MAX_KEEP_AWAKE_SECONDS = 4 * 60 * 60
const PROCESS_SUMMARY_LIMIT = 8
const PROCESS_NAME_MAX = 64

function isAllowListedApp(name) {
  return typeof name === 'string' && Object.hasOwn(APP_ALLOW_LIST, name)
}

function requireObject(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${label} input must be an object.`)
  }
  return input
}

function requireEmptyInput(input, label) {
  if (input == null) return {}
  const value = requireObject(input, label)
  const keys = Object.keys(value)
  if (keys.length) throw new TypeError(`${label} does not accept input fields.`)
  return {}
}

function requireKeepAwakeDuration(input) {
  const value = requireObject(input, 'system.keepAwake.start')
  const extra = Object.keys(value).filter(key => key !== 'durationSeconds')
  if (extra.length) throw new TypeError('system.keepAwake.start does not accept extra fields.')
  const durationSeconds = value.durationSeconds
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1) {
    throw new TypeError('durationSeconds must be a positive whole number of seconds.')
  }
  return { durationSeconds: Math.min(durationSeconds, MAX_KEEP_AWAKE_SECONDS) }
}

function sanitizeProcessName(name) {
  if (typeof name !== 'string' || !name.trim()) return 'unknown'
  const firstToken = name.trim().split(/\s+/)[0]
  const base = firstToken.split(/[/\\]/).pop()
  const coarse = String(base).replace(/[^\w.-]/g, '').slice(0, PROCESS_NAME_MAX)
  return coarse || 'unknown'
}

function summarizeProcess(entry) {
  return {
    name: sanitizeProcessName(entry?.name),
    memoryBytes: Number.isFinite(Number(entry?.memoryBytes)) ? Math.max(0, Math.floor(Number(entry.memoryBytes))) : 0
  }
}

function createWindowsVolumeLister(statfsSync) {
  return function listStorage() {
    if (typeof statfsSync !== 'function') return []
    const volumes = []
    for (let code = 65; code <= 90; code += 1) {
      const mount = `${String.fromCharCode(code)}:\\`
      try {
        const stats = statfsSync(mount)
        const bsize = Number(stats.bsize)
        const totalBytes = Number(stats.blocks) * bsize
        const freeBytes = Number(stats.bavail ?? stats.bfree) * bsize
        if (Number.isFinite(totalBytes) && totalBytes > 0 && Number.isFinite(freeBytes)) {
          volumes.push({ mount, totalBytes, freeBytes: Math.max(0, freeBytes) })
        }
      } catch {
        // Drive letter is unused.
      }
    }
    return volumes
  }
}

function createWindowsProcessLister(spawnProcess) {
  if (typeof spawnProcess !== 'function') throw new TypeError('spawnProcess dependency is required.')
  return function listProcesses() {
    return new Promise((resolve, reject) => {
      const child = spawnProcess('tasklist.exe', ['/FO', 'CSV', '/NH'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      })
      if (!child || !child.stdout || typeof child.on !== 'function') {
        reject(new Error('Could not list processes.'))
        return
      }
      let stdout = ''
      if (typeof child.stdout.setEncoding === 'function') child.stdout.setEncoding('utf8')
      child.stdout.on('data', chunk => { stdout += chunk })
      child.on('error', error => reject(error))
      child.on('exit', code => {
        if (code) {
          reject(new Error('Could not list processes.'))
          return
        }
        const processes = []
        for (const line of stdout.split(/\r?\n/)) {
          const match = line.match(/^"([^"]+)","(\d+)","[^"]*","[^"]*","([^"]+)"/)
          if (!match) continue
          const memoryKb = Number(String(match[3]).replace(/[^0-9]/g, ''))
          processes.push({
            name: match[1],
            memoryBytes: Number.isFinite(memoryKb) ? memoryKb * 1024 : 0
          })
        }
        resolve(processes)
      })
    })
  }
}

function createKeepAwake({ powerSaveBlocker, clock }) {
  let blockerId = null
  let expiresAt = null
  let timer = null

  function remainingSeconds() {
    if (blockerId == null || expiresAt == null) return 0
    return Math.max(0, Math.ceil((expiresAt - clock.now()) / 1000))
  }

  function release() {
    if (timer != null) {
      clock.clearTimer(timer)
      timer = null
    }
    if (blockerId != null) {
      try { powerSaveBlocker.stop(blockerId) } catch { /* already released */ }
      blockerId = null
    }
    expiresAt = null
  }

  if (typeof clock.onQuit === 'function') clock.onQuit(release)

  return {
    release,
    start({ durationSeconds }) {
      release()
      blockerId = powerSaveBlocker.start('prevent-display-sleep')
      expiresAt = clock.now() + durationSeconds * 1000
      timer = clock.setTimer(release, durationSeconds * 1000)
      if (timer && typeof timer.unref === 'function') timer.unref()
      return {
        held: true,
        durationSeconds,
        remainingSeconds: remainingSeconds()
      }
    },
    stop() {
      const wasHeld = blockerId != null
      release()
      return { held: false, released: wasHeld }
    },
    status() {
      const held = blockerId != null
      return { held, remainingSeconds: held ? remainingSeconds() : 0 }
    }
  }
}

function create({
  spawnProcess,
  osApi,
  listStorage,
  listProcesses,
  powerSaveBlocker,
  clock = {
    now: Date.now,
    setTimer: setTimeout,
    clearTimer: clearTimeout
  }
} = {}) {
  if (typeof spawnProcess !== 'function') throw new TypeError('spawnProcess dependency is required.')
  if (!osApi || typeof osApi.type !== 'function' || typeof osApi.release !== 'function'
    || typeof osApi.arch !== 'function' || typeof osApi.totalmem !== 'function'
    || typeof osApi.freemem !== 'function' || typeof osApi.uptime !== 'function') {
    throw new TypeError('osApi dependency is required.')
  }
  if (typeof listStorage !== 'function') throw new TypeError('listStorage dependency is required.')
  if (typeof listProcesses !== 'function') throw new TypeError('listProcesses dependency is required.')
  if (!powerSaveBlocker || typeof powerSaveBlocker.start !== 'function' || typeof powerSaveBlocker.stop !== 'function') {
    throw new TypeError('powerSaveBlocker dependency is required.')
  }
  if (typeof clock.now !== 'function' || typeof clock.setTimer !== 'function' || typeof clock.clearTimer !== 'function') {
    throw new TypeError('clock dependency is required.')
  }

  const keepAwake = createKeepAwake({ powerSaveBlocker, clock })

  return [
    {
      id: 'system.openApp',
      description: 'Open an allow-listed Windows application.',
      risk: 'safe-write',
      confirmation: 'never',
      validateInput: input => {
        const value = requireObject(input, 'system.openApp')
        if (!isAllowListedApp(value.appName)) throw new TypeError('Application is not in the MVP allow-list.')
        return { appName: value.appName }
      },
      execute: async ({ appName }) => {
        if (!isAllowListedApp(appName)) throw new TypeError('Application is not in the MVP allow-list.')
        const target = APP_ALLOW_LIST[appName]
        const child = spawnProcess(target.exe, [], { detached: true, stdio: 'ignore' })
        child.unref()
        return { summary: `${target.label} launched`, message: `Done. I opened ${target.label}.` }
      }
    },
    {
      id: 'system.info',
      description: 'Read OS name, version, architecture, memory and uptime.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => requireEmptyInput(input, 'system.info'),
      execute: async () => {
        const totalMemBytes = osApi.totalmem()
        const freeMemBytes = osApi.freemem()
        const info = {
          os: osApi.type(),
          platform: typeof osApi.platform === 'function' ? osApi.platform() : undefined,
          release: osApi.release(),
          version: typeof osApi.version === 'function' ? osApi.version() : osApi.release(),
          arch: osApi.arch(),
          totalMemBytes,
          freeMemBytes,
          uptimeSeconds: Math.floor(osApi.uptime())
        }
        return {
          summary: `${info.os} ${info.release} (${info.arch})`,
          message: `This PC is ${info.os} ${info.version}, ${info.arch}, with ${Math.round(freeMemBytes / 1_048_576)} MB free of ${Math.round(totalMemBytes / 1_048_576)} MB RAM.`,
          info
        }
      }
    },
    {
      id: 'system.storage',
      description: 'Read per-drive total, free and used space.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => requireEmptyInput(input, 'system.storage'),
      execute: async () => {
        const volumes = (await listStorage()).map(volume => {
          const totalBytes = Math.max(0, Number(volume.totalBytes) || 0)
          const freeBytes = Math.max(0, Number(volume.freeBytes) || 0)
          return {
            mount: String(volume.mount || '').slice(0, 8),
            totalBytes,
            freeBytes,
            usedBytes: Math.max(0, totalBytes - freeBytes)
          }
        })
        return {
          summary: `${volumes.length} volume(s)`,
          message: volumes.length
            ? `Storage: ${volumes.map(volume => `${volume.mount} ${Math.round(volume.freeBytes / 1_073_741_824)} GB free`).join('; ')}.`
            : 'I could not see any volumes.',
          volumes
        }
      }
    },
    {
      id: 'system.processSummary',
      description: 'Summarise running processes by count and memory. No command lines.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => requireEmptyInput(input, 'system.processSummary'),
      execute: async () => {
        const raw = await listProcesses()
        const list = Array.isArray(raw) ? raw.map(summarizeProcess) : []
        const top = [...list].sort((left, right) => right.memoryBytes - left.memoryBytes).slice(0, PROCESS_SUMMARY_LIMIT)
        return {
          summary: `${list.length} processes`,
          message: `There are ${list.length} processes. Top by memory: ${top.map(entry => entry.name).join(', ') || 'none'}.`,
          processCount: list.length,
          top
        }
      }
    },
    {
      id: 'system.keepAwake.start',
      description: 'Prevent sleep for a bounded duration.',
      risk: 'safe-write',
      confirmation: 'never',
      validateInput: requireKeepAwakeDuration,
      describeInput: input => `Keep the computer awake for ${input.durationSeconds} seconds.`,
      execute: async ({ durationSeconds }) => {
        const status = keepAwake.start({ durationSeconds })
        return {
          summary: `Keep awake ${durationSeconds}s`,
          message: `I will keep the computer awake for ${durationSeconds} seconds.`,
          ...status
        }
      }
    },
    {
      id: 'system.keepAwake.stop',
      description: 'Release a keep-awake blocker.',
      risk: 'safe-write',
      confirmation: 'never',
      validateInput: input => requireEmptyInput(input, 'system.keepAwake.stop'),
      execute: async () => {
        const status = keepAwake.stop()
        return {
          summary: status.released ? 'Keep awake released' : 'Keep awake was not held',
          message: status.released ? 'The computer may sleep again.' : 'Nothing was keeping the computer awake.',
          ...status
        }
      }
    },
    {
      id: 'system.keepAwake.status',
      description: 'Report whether a keep-awake blocker is held and how long remains.',
      risk: 'read',
      confirmation: 'never',
      validateInput: input => requireEmptyInput(input, 'system.keepAwake.status'),
      execute: async () => {
        const status = keepAwake.status()
        return {
          summary: status.held ? `Keep awake ${status.remainingSeconds}s left` : 'Keep awake off',
          message: status.held
            ? `Keep-awake is on, with ${status.remainingSeconds} seconds remaining.`
            : 'Keep-awake is not on.',
          ...status
        }
      }
    }
  ]
}

const SYSTEM_TOOL_IDS = Object.freeze([
  'system.openApp',
  'system.info',
  'system.storage',
  'system.processSummary',
  'system.keepAwake.start',
  'system.keepAwake.stop',
  'system.keepAwake.status'
])

module.exports = {
  id: 'system',
  toolIds: [...SYSTEM_TOOL_IDS],
  create,
  APP_ALLOW_LIST,
  isAllowListedApp,
  MAX_KEEP_AWAKE_SECONDS,
  PROCESS_SUMMARY_LIMIT,
  createWindowsVolumeLister,
  createWindowsProcessLister
}
