'use strict'

/**
 * Installed-application catalog for RATA-016.
 *
 * Counterpart to file-access.cjs: the security value is in what never enters
 * the catalog. Start Menu shortcuts are walked, resolved, and filtered. The
 * surviving set IS the allow-list. A path that is not in the catalog cannot
 * be launched.
 *
 * Opaque ids (SHA-256 of the canonical target path) are what cross the tool
 * boundary. No tool schema accepts a path. The model names a catalog entry;
 * this module is the only place that maps that id back to a filesystem target,
 * and it only maps ids it minted itself from targets it discovered.
 *
 * Shortcut resolution parses the MS-SHLLINK binary locally. It does not spawn
 * a shell and does not interpolate any path into a script body. Tests inject
 * `resolveShortcut` so they never need a real .lnk or a real disk.
 */

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFile } = require('node:child_process')

const MAX_DEPTH = 8
const MAX_ENTRIES_SCANNED = 20000
const MAX_CATALOG_ENTRIES = 2000
const MAX_PATH_LENGTH = 4096
const MAX_FIND_RESULTS = 10
const MAX_QUERY_LENGTH = 200
const LNK_HEADER_SIZE = 0x4C
const HAS_LINK_TARGET_ID_LIST = 1 << 0
const HAS_LINK_INFO = 1 << 1
const VOLUME_ID_AND_LOCAL_BASE_PATH = 1 << 0
const CATALOG_ID_PATTERN = /^[a-f0-9]{64}$/

const REJECTED_EXTENSIONS = Object.freeze(new Set([
  '.msi', '.bat', '.cmd', '.ps1', '.vbs', '.vbe', '.js', '.jse',
  '.wsf', '.scr', '.reg', '.hta', '.lnk', '.com', '.pif'
]))

const LOLBINS = Object.freeze(new Set([
  'cmd.exe',
  'powershell.exe',
  'pwsh.exe',
  'wscript.exe',
  'cscript.exe',
  'mshta.exe',
  'rundll32.exe',
  'regsvr32.exe',
  'regedit.exe',
  'reg.exe',
  'msiexec.exe',
  'certutil.exe',
  'bitsadmin.exe',
  'curl.exe',
  'wmic.exe',
  'installutil.exe',
  'msbuild.exe',
  'conhost.exe',
  'wt.exe'
]))

const INSTALLER_PATTERN = /uninstall|repair|setup|installer/i

class AppCatalogError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'AppCatalogError'
    this.code = code
  }
}

function defaultStartMenuRoots(env = process.env) {
  const roots = []
  const programData = env.ProgramData || env.PROGRAMDATA
  const appData = env.APPDATA
  if (programData) {
    roots.push(path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
  }
  if (appData) {
    roots.push(path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
  }
  return roots
}

function canonicalTarget(targetPath) {
  return path.normalize(String(targetPath)).replace(/\//g, '\\').toLowerCase()
}

function catalogIdFor(targetPath) {
  return crypto.createHash('sha256').update(canonicalTarget(targetPath)).digest('hex')
}

function isCatalogId(value) {
  return typeof value === 'string' && CATALOG_ID_PATTERN.test(value)
}

function looksLikePath(value) {
  if (typeof value !== 'string') return true
  if (!value) return true
  if (value.includes('\0')) return true
  if (/[\\/:]/.test(value)) return true
  if (value.includes('..')) return true
  if (/^[a-zA-Z]:/.test(value)) return true
  if (value.startsWith('\\\\') || value.startsWith('//')) return true
  return false
}

function readUInt16(buffer, offset) {
  if (offset + 2 > buffer.length) throw new AppCatalogError('Shortcut is truncated.', 'invalid-shortcut')
  return buffer.readUInt16LE(offset)
}

function readUInt32(buffer, offset) {
  if (offset + 4 > buffer.length) throw new AppCatalogError('Shortcut is truncated.', 'invalid-shortcut')
  return buffer.readUInt32LE(offset)
}

function readCString(buffer, offset, encoding) {
  if (offset >= buffer.length) return ''
  let end = offset
  if (encoding === 'utf16le') {
    while (end + 1 < buffer.length && (buffer[end] !== 0 || buffer[end + 1] !== 0)) end += 2
    return buffer.slice(offset, end).toString('utf16le')
  }
  while (end < buffer.length && buffer[end] !== 0) end += 1
  return buffer.slice(offset, end).toString('latin1')
}

/**
 * Extract the local filesystem target from a Shell Link (.lnk) buffer.
 * Parses LinkInfo LocalBasePath / LocalBasePathUnicode only. Network
 * targets, UWP shell items and anything without a local path fail closed.
 */
function parseLnkTarget(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < LNK_HEADER_SIZE) {
    throw new AppCatalogError('Shortcut is not a valid Windows link.', 'invalid-shortcut')
  }
  if (readUInt32(buffer, 0) !== LNK_HEADER_SIZE) {
    throw new AppCatalogError('Shortcut is not a valid Windows link.', 'invalid-shortcut')
  }
  const flags = readUInt32(buffer, 20)
  let offset = LNK_HEADER_SIZE
  if (flags & HAS_LINK_TARGET_ID_LIST) {
    const idListSize = readUInt16(buffer, offset)
    offset += 2 + idListSize
    if (offset > buffer.length) throw new AppCatalogError('Shortcut is truncated.', 'invalid-shortcut')
  }
  if (!(flags & HAS_LINK_INFO)) {
    throw new AppCatalogError('Shortcut has no local target path.', 'no-local-target')
  }
  const infoStart = offset
  const infoSize = readUInt32(buffer, infoStart)
  if (infoSize < 0x1C || infoStart + infoSize > buffer.length) {
    throw new AppCatalogError('Shortcut is truncated.', 'invalid-shortcut')
  }
  const infoHeaderSize = readUInt32(buffer, infoStart + 4)
  const infoFlags = readUInt32(buffer, infoStart + 8)
  if (!(infoFlags & VOLUME_ID_AND_LOCAL_BASE_PATH)) {
    throw new AppCatalogError('Shortcut has no local target path.', 'no-local-target')
  }
  const localBasePathOffset = readUInt32(buffer, infoStart + 16)
  let unicodePath = ''
  if (infoHeaderSize >= 0x24 && infoStart + 32 <= buffer.length) {
    const unicodeOffset = readUInt32(buffer, infoStart + 28)
    if (unicodeOffset >= infoHeaderSize && unicodeOffset < infoSize) {
      unicodePath = readCString(buffer, infoStart + unicodeOffset, 'utf16le').trim()
    }
  }
  let ansiPath = ''
  if (localBasePathOffset >= Math.min(infoHeaderSize, 0x1C) && localBasePathOffset < infoSize) {
    ansiPath = readCString(buffer, infoStart + localBasePathOffset, 'latin1').trim()
  }
  const target = unicodePath || ansiPath
  if (!target) throw new AppCatalogError('Shortcut has no local target path.', 'no-local-target')
  return target
}

function isUnsafeTargetPath(targetPath) {
  if (typeof targetPath !== 'string' || !targetPath.trim()) return true
  if (targetPath.includes('\0') || targetPath.length > MAX_PATH_LENGTH) return true
  const normalized = path.normalize(targetPath)
  if (normalized.includes('\0') || normalized.includes('..')) return true
  if (normalized.startsWith('\\\\') || normalized.startsWith('//')) return true
  if (/^\\\\[.?]\\/.test(normalized)) return true
  if (!/^[a-zA-Z]:[\\/]/.test(normalized)) return true
  return false
}

function rejectionCode(displayName, targetPath, targetStat) {
  if (isUnsafeTargetPath(targetPath)) return 'unsafe-target'
  const ext = path.extname(targetPath).toLowerCase()
  if (ext !== '.exe') return 'rejected-extension'
  if (REJECTED_EXTENSIONS.has(ext)) return 'rejected-extension'
  const base = path.basename(targetPath).toLowerCase()
  if (LOLBINS.has(base)) return 'lolbin'
  if (INSTALLER_PATTERN.test(displayName) || INSTALLER_PATTERN.test(targetPath)) return 'installer'
  if (!targetStat) return 'missing-target'
  if (typeof targetStat.isSymbolicLink === 'function' && targetStat.isSymbolicLink()) return 'is-symlink'
  if (typeof targetStat.isFile !== 'function' || !targetStat.isFile()) return 'not-a-file'
  return null
}

function toPublic(entry) {
  const result = { id: entry.id, name: entry.name }
  if (entry.publisher) result.publisher = entry.publisher
  return result
}

function defaultFsApi() {
  return {
    promises: fsp,
    lstatSync: fs.lstatSync,
    realpathSync: fs.realpathSync,
    readFileSync: fs.readFileSync
  }
}

async function readFileBuffer(fsApi, filePath) {
  if (fsApi.promises && typeof fsApi.promises.readFile === 'function') {
    return fsApi.promises.readFile(filePath)
  }
  if (typeof fsApi.readFileSync === 'function') return fsApi.readFileSync(filePath)
  throw new AppCatalogError('Filesystem cannot read files.', 'invalid-fs')
}

async function lstatOrNull(fsApi, target) {
  try {
    if (fsApi.promises && typeof fsApi.promises.lstat === 'function') {
      return await fsApi.promises.lstat(target)
    }
    if (typeof fsApi.lstatSync === 'function') return fsApi.lstatSync(target)
  } catch {
    return null
  }
  return null
}

async function defaultResolveShortcut(lnkPath, fsApi) {
  const buffer = await readFileBuffer(fsApi, lnkPath)
  return parseLnkTarget(buffer)
}

async function walkShortcuts(roots, fsApi, visit) {
  let scanned = 0
  for (const root of roots) {
    const queue = [{ directory: root, depth: 0 }]
    while (queue.length) {
      const { directory, depth } = queue.shift()
      if (depth > MAX_DEPTH) continue
      let entries
      try {
        entries = await fsApi.promises.readdir(directory, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (scanned >= MAX_ENTRIES_SCANNED) return
        scanned += 1
        if (entry.isSymbolicLink()) continue
        const full = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          queue.push({ directory: full, depth: depth + 1 })
          continue
        }
        if (!entry.isFile()) continue
        if (path.extname(entry.name).toLowerCase() !== '.lnk') continue
        const stop = await visit(full, entry)
        if (stop === true) return
      }
    }
  }
}

function scoreMatch(name, query) {
  const hay = name.toLowerCase()
  const needle = query.toLowerCase()
  if (hay === needle) return 100
  if (hay.startsWith(needle)) return 60
  if (hay.includes(needle)) return 30
  return 0
}

function createAppCatalog({
  roots,
  fsApi = defaultFsApi(),
  resolveShortcut,
  env = process.env
} = {}) {
  const startMenuRoots = Array.isArray(roots) && roots.length
    ? roots.slice()
    : defaultStartMenuRoots(env)
  const resolve = typeof resolveShortcut === 'function'
    ? resolveShortcut
    : (lnkPath => defaultResolveShortcut(lnkPath, fsApi))

  let entriesById = new Map()

  async function refresh() {
    const next = new Map()
    await walkShortcuts(startMenuRoots, fsApi, async (lnkPath, entry) => {
      if (next.size >= MAX_CATALOG_ENTRIES) return true
      const displayName = path.basename(entry.name, path.extname(entry.name))
      let target
      try {
        target = await resolve(lnkPath)
      } catch {
        return false
      }
      if (typeof target !== 'string' || !target.trim()) return false
      const normalized = path.normalize(target.trim())
      const targetStat = await lstatOrNull(fsApi, normalized)
      if (rejectionCode(displayName, normalized, targetStat)) return false
      const id = catalogIdFor(normalized)
      if (next.has(id)) return false
      next.set(id, Object.freeze({
        id,
        name: displayName,
        target: normalized
      }))
      return false
    })
    entriesById = next
    return { size: entriesById.size }
  }

  function getById(id) {
    if (!isCatalogId(id)) return null
    return entriesById.get(id) || null
  }

  function list() {
    return [...entriesById.values()].map(toPublic)
  }

  function find(query) {
    const needle = String(query || '').trim()
    if (!needle || needle.length > MAX_QUERY_LENGTH) return []
    return [...entriesById.values()]
      .map(entry => ({ entry, score: scoreMatch(entry.name, needle) }))
      .filter(row => row.score > 0)
      .sort((left, right) => right.score - left.score || left.entry.name.localeCompare(right.entry.name))
      .slice(0, MAX_FIND_RESULTS)
      .map(row => toPublic(row.entry))
  }

  return {
    refresh,
    getById,
    list,
    find,
    get size() { return entriesById.size }
  }
}

function createExecFileLauncher(execFileFn = execFile) {
  if (typeof execFileFn !== 'function') throw new TypeError('execFile dependency is required.')
  return function launchApp(targetPath) {
    if (typeof targetPath !== 'string' || !targetPath) {
      return Promise.reject(new AppCatalogError('The application could not be started.', 'launch-failed'))
    }
    return new Promise((resolve, reject) => {
      let settled = false
      const fail = () => {
        if (settled) return
        settled = true
        reject(new AppCatalogError('The application could not be started.', 'launch-failed'))
      }
      let child
      try {
        child = execFileFn(targetPath, [], {
          shell: false,
          windowsHide: false,
          detached: true,
          stdio: 'ignore'
        })
      } catch {
        fail()
        return
      }
      if (!child) {
        fail()
        return
      }
      if (typeof child.once === 'function') child.once('error', fail)
      if (typeof child.unref === 'function') child.unref()
      if (!settled) {
        settled = true
        resolve({ launched: true })
      }
    })
  }
}

function isPackagedRuntime(dir = __dirname) {
  return dir.includes(`app.asar${path.sep}`) || dir.endsWith('app.asar') || dir.includes('app.asar')
}

function resolveWindowsScriptDir({
  packaged = isPackagedRuntime(),
  resourcesPath = typeof process.resourcesPath === 'string' ? process.resourcesPath : ''
} = {}) {
  return packaged && resourcesPath
    ? path.join(resourcesPath, 'windows')
    : path.join(__dirname, 'windows')
}

function powershellExecutable(env = process.env) {
  const root = env.SystemRoot || env.SYSTEMROOT || 'C:\\Windows'
  return path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

function runExecFile(execFileFn, file, args) {
  return new Promise((resolve, reject) => {
    execFileFn(file, args, {
      shell: false,
      windowsHide: true,
      timeout: 8000,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') })
    })
  })
}

function parseProcessList(stdout) {
  const text = String(stdout || '').trim()
  if (!text) return []
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  const processes = []
  for (const row of rows) {
    const pid = Number(row?.ProcessId)
    const executablePath = typeof row?.ExecutablePath === 'string' ? row.ExecutablePath : ''
    if (!Number.isInteger(pid) || pid < 1 || pid > 0x7fffffff) continue
    if (!executablePath || isUnsafeTargetPath(executablePath)) continue
    processes.push({ pid, executablePath })
  }
  return processes
}

function createWindowsFocus({
  execFileFn = execFile,
  scriptDir = resolveWindowsScriptDir(),
  env = process.env
} = {}) {
  const powershell = powershellExecutable(env)
  const listScript = path.join(scriptDir, 'list-process-executables.ps1')
  const focusScript = path.join(scriptDir, 'focus-pid.ps1')

  async function listProcessExecutables() {
    const result = await runExecFile(execFileFn, powershell, [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', listScript
    ])
    return parseProcessList(result.stdout)
  }

  async function focusPid(pid) {
    if (!Number.isInteger(pid) || pid < 1 || pid > 0x7fffffff) {
      throw new AppCatalogError('Process id is not valid.', 'invalid-pid')
    }
    await runExecFile(execFileFn, powershell, [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', focusScript,
      '-ProcessId', String(pid)
    ])
  }

  return async function focusApp(targetPath) {
    if (typeof targetPath !== 'string' || !targetPath) return { focused: false }
    let processes
    try {
      processes = await listProcessExecutables()
    } catch {
      return { focused: false }
    }
    const wanted = canonicalTarget(targetPath)
    const match = processes.find(entry => canonicalTarget(entry.executablePath) === wanted)
    if (!match) return { focused: false }
    try {
      await focusPid(match.pid)
      return { focused: true }
    } catch {
      return { focused: false }
    }
  }
}

module.exports = {
  AppCatalogError,
  CATALOG_ID_PATTERN,
  LOLBINS,
  MAX_QUERY_LENGTH,
  MAX_FIND_RESULTS,
  catalogIdFor,
  canonicalTarget,
  createAppCatalog,
  createExecFileLauncher,
  createWindowsFocus,
  defaultStartMenuRoots,
  isCatalogId,
  looksLikePath,
  parseLnkTarget,
  parseProcessList,
  resolveWindowsScriptDir,
  rejectionCode
}
