'use strict'

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

/**
 * Local file access for RATA-006 (reads) and RATA-013 (file.save).
 *
 * This module is to the file tools what public-web-client.cjs is to web.fetch:
 * the whole security value is in what it refuses. No caller can reach a path
 * outside the configured roots. Move, rename, folder.create and delete are
 * not implemented here.
 *
 * Two boundaries matter and are enforced separately:
 *
 * 1. Containment. Every path is resolved and realpath'd before use, and
 *    compared against realpath'd roots, so a symlink or Windows junction
 *    cannot walk out of Documents into AppData. Directory traversal skips
 *    links entirely rather than trying to reason about where they point.
 *
 * 2. Sensitivity. Being inside Documents does not make a file safe to read.
 *    Credential-shaped names are refused even when they are perfectly within
 *    an allowed root, because file content flows onward to a cloud provider.
 *
 * The second is the one that is easy to forget: containment alone would
 * happily hand a provider the contents of ~/Documents/.env.
 */

const MAX_PATH_LENGTH = 4096
const MAX_READ_BYTES = 128 * 1024
const MAX_CONTENT_CHARS = 50000
const MAX_RESULTS = 50
const MAX_ENTRIES_SCANNED = 20000
const MAX_DEPTH = 8
const MAX_QUERY_LENGTH = 200
const MAX_MATCHES_PER_FILE = 5
const MAX_WRITE_BYTES = 5 * 1024 * 1024

/**
 * Extensions that must never be written, matched case-insensitively on the
 * final suffix. Creating an executable or script is not a document save.
 */
const DENIED_WRITE_EXTENSIONS = Object.freeze(new Set([
  '.exe', '.dll', '.com', '.scr', '.bat', '.cmd', '.ps1', '.psm1',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.msi', '.msp',
  '.reg', '.lnk', '.cpl', '.hta', '.jar', '.sys', '.drv', '.inf', '.chm'
]))

/** Windows device names, with or without an extension. */
const RESERVED_DEVICE_PATTERN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/**
 * Files that are refused even inside an allowed root. Matched on the basename,
 * case-insensitively. This list is deliberately about *shape*, not location —
 * a stray `.env` in Documents is exactly as dangerous as one in a repo.
 */
const DENIED_NAME_PATTERNS = Object.freeze([
  /^\.env(\..*)?$/i,
  /^\.netrc$/i,
  /^\.npmrc$/i,
  /^\.pgpass$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^credentials$/i,
  /^secrets?\.(ya?ml|json|toml|ini)$/i,
  /\.(pem|key|pfx|p12|jks|keystore|ppk|kdbx|asc|gpg)$/i,
  /\.(sqlite|sqlite3|db)$/i
])

/**
 * Directories never descended into. Credential stores, VCS metadata (a git
 * config can hold a token in a remote URL) and dependency trees that would
 * dominate every result set without ever being what the user meant.
 */
const DENIED_DIRECTORY_NAMES = new Set([
  '.git', '.svn', '.hg',
  '.ssh', '.aws', '.azure', '.gnupg', '.gcloud', '.kube', '.docker',
  'node_modules', '.venv', 'venv', '__pycache__',
  'appdata', 'application data', 'localappdata'
])

/** Extensions scanned by searchContent. Anything else is skipped unread. */
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.rst', '.log', '.csv', '.tsv',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.html', '.htm', '.xml', '.css', '.scss',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.rb', '.go', '.rs', '.java', '.cs', '.c', '.h', '.cpp', '.hpp',
  '.sh', '.ps1', '.bat', '.sql', '.tex'
])

class FileAccessError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'FileAccessError'
    this.code = code
  }
}

/**
 * `fsApi` is a parameter rather than a hard import so a second consumer can
 * inject a fake and still be governed by *this* containment logic instead of
 * growing its own. `realpathSync.native` is preferred when present because it
 * is what the real `node:fs` provides on Windows.
 */
function realpathSync(target, fsApi) {
  const resolver = fsApi.realpathSync
  return typeof resolver.native === 'function' ? resolver.native(target) : resolver(target)
}

/**
 * Resolves the configured roots once, at composition time.
 *
 * Roots are realpath'd here so that containment checks later compare like with
 * like. On Windows a user profile directory is frequently reached through a
 * junction, and comparing a realpath'd target against a non-realpath'd root
 * would reject legitimate files.
 */
function normalizeRoots(roots, fsApi = fs) {
  if (!Array.isArray(roots)) throw new TypeError('File access requires an array of roots.')
  const resolved = []
  for (const root of roots) {
    if (typeof root !== 'string' || !root.trim()) continue
    try {
      resolved.push(realpathSync(path.resolve(root), fsApi))
    } catch {
      // A root that does not exist on this machine is skipped rather than
      // fatal: not every Windows profile has every known folder.
    }
  }
  return Object.freeze([...new Set(resolved)])
}

function isDeniedName(name) {
  return DENIED_NAME_PATTERNS.some(pattern => pattern.test(name))
}

function isDeniedDirectory(name) {
  return DENIED_DIRECTORY_NAMES.has(String(name).toLowerCase())
}

/** True when `candidate` is the root itself or sits underneath it. */
function isWithin(root, candidate) {
  if (candidate === root) return true
  const relative = path.relative(root, candidate)
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * The single gate every path passes through, for every tool domain that reads
 * the user's disk. `electron/filesystem-scan.cjs` calls this rather than
 * carrying its own containment logic, so there is exactly one place where
 * "which paths may Rata touch" is decided.
 *
 * Order matters: syntax, then realpath, then containment, then sensitivity.
 * Resolving before comparing is what makes `..` and symlinks harmless; checking
 * the name last means a denied name inside an allowed root is still refused.
 */
function resolveWithinRoots(input, roots, fsApi = fs) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new FileAccessError('A file path is required.', 'invalid-path')
  }
  if (input.length > MAX_PATH_LENGTH) {
    throw new FileAccessError('That path is too long.', 'invalid-path')
  }
  if (input.includes('\0')) {
    throw new FileAccessError('That path is not valid.', 'invalid-path')
  }
  if (!roots.length) {
    throw new FileAccessError('No readable folders are configured.', 'no-roots')
  }

  let resolved
  try {
    resolved = realpathSync(path.resolve(input), fsApi)
  } catch {
    // Do not echo the OS error: it distinguishes "denied" from "missing" and
    // would turn this into a probe for paths outside the roots.
    throw new FileAccessError('That file is not available.', 'not-found')
  }

  if (!roots.some(root => isWithin(root, resolved))) {
    throw new FileAccessError('That path is outside the folders Rata may read.', 'outside-roots')
  }
  if (isDeniedName(path.basename(resolved))) {
    throw new FileAccessError('That file type is not readable for safety reasons.', 'denied-name')
  }
  const relativeSegments = roots
    .map(root => path.relative(root, resolved))
    .filter(relative => relative && !relative.startsWith('..'))
  if (relativeSegments.some(relative => relative.split(path.sep).some(segment => isDeniedDirectory(segment)))) {
    throw new FileAccessError('That folder is not readable for safety reasons.', 'denied-directory')
  }
  return resolved
}

/**
 * Split a write path without using `path.basename`, which on Windows strips a
 * drive letter from `C:notes.txt` and would turn a colon-bearing name into a
 * plausible file. Containment of the parent still goes through
 * `resolveWithinRoots`; this only names the two halves.
 */
function splitParentAndBasename(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new FileAccessError('A file path is required.', 'invalid-path')
  }
  if (input.length > MAX_PATH_LENGTH) {
    throw new FileAccessError('That path is too long.', 'invalid-path')
  }
  if (input.includes('\0')) {
    throw new FileAccessError('That path is not valid.', 'invalid-path')
  }
  // Do not trim the whole string: Windows trailing spaces in the basename
  // must still be visible so we can refuse them rather than writing a
  // different name than the one we checked.
  const lastSep = Math.max(input.lastIndexOf('/'), input.lastIndexOf('\\'))
  const parent = lastSep === -1 ? '' : input.slice(0, lastSep)
  const basename = lastSep === -1 ? input : input.slice(lastSep + 1)
  if (parent.split(/[\\/]/).some(segment => segment === '.' || segment === '..') || basename === '.' || basename === '..') {
    throw new FileAccessError('That path is not valid.', 'invalid-path')
  }
  return { parent, basename }
}

function isReservedDeviceName(name) {
  return RESERVED_DEVICE_PATTERN.test(name)
}

function isDeniedWriteExtension(name) {
  return DENIED_WRITE_EXTENSIONS.has(path.extname(name).toLowerCase())
}

/**
 * Basename rules for a file that does not exist yet. Separators, `..`, NUL,
 * colons (ADS / drive letters), reserved device names, and leading/trailing
 * dots or spaces are refused here so Windows cannot silently rewrite the name
 * after we have checked containment on the parent.
 */
function assertWritableBasename(name) {
  if (typeof name !== 'string' || !name) {
    throw new FileAccessError('A file name is required.', 'invalid-name')
  }
  if (name !== name.trim() || name.startsWith('.') || name.endsWith('.')) {
    throw new FileAccessError('That file name is not valid.', 'invalid-name')
  }
  if (/[\\/:\0]/.test(name) || name.includes('..')) {
    throw new FileAccessError('That file name is not valid.', 'invalid-name')
  }
  if (/^[a-zA-Z]:/.test(name)) {
    throw new FileAccessError('That file name is not valid.', 'invalid-name')
  }
  if (isReservedDeviceName(name)) {
    throw new FileAccessError('That file name is reserved by Windows.', 'reserved-name')
  }
  if (isDeniedName(name)) {
    throw new FileAccessError('That file type is not writable for safety reasons.', 'denied-name')
  }
  if (isDeniedWriteExtension(name)) {
    throw new FileAccessError('That file type cannot be created.', 'denied-extension')
  }
}

/**
 * Containment for a write: resolve the *parent directory* through the existing
 * gate, then append a validated basename. The target itself may not exist, so
 * it cannot be handed to `resolveWithinRoots` (realpath would fail closed as
 * not-found). Widening that gate to skip realpath would weaken every reader.
 */
function resolveWritableTarget(input, roots, fsApi = fs) {
  const { parent, basename } = splitParentAndBasename(input)
  assertWritableBasename(basename)
  if (!parent) {
    throw new FileAccessError('A file path is required.', 'invalid-path')
  }
  const resolvedParent = resolveWithinRoots(parent, roots, fsApi)
  let parentInfo
  try {
    parentInfo = fsApi.statSync(resolvedParent)
  } catch {
    throw new FileAccessError('That file is not available.', 'not-found')
  }
  if (typeof parentInfo.isDirectory === 'function' ? !parentInfo.isDirectory() : false) {
    throw new FileAccessError('The destination folder is not a folder.', 'not-a-file')
  }
  const target = path.join(resolvedParent, basename)
  if (!roots.some(root => isWithin(root, target))) {
    throw new FileAccessError('That path is outside the folders Rata may read.', 'outside-roots')
  }
  return { parent: resolvedParent, basename, target }
}

function normalizeWriteContent(content) {
  if (typeof content !== 'string') {
    throw new FileAccessError('File content must be a string.', 'not-a-string')
  }
  const cleaned = content.replace(/\0/g, '')
  const byteLength = Buffer.byteLength(cleaned, 'utf8')
  if (byteLength > MAX_WRITE_BYTES) {
    throw new FileAccessError(`Content is larger than the ${MAX_WRITE_BYTES}-byte write limit.`, 'too-large')
  }
  return { content: cleaned, byteLength }
}

async function atomicWriteFile(target, content) {
  const directory = path.dirname(target)
  const tmp = path.join(
    directory,
    `.rata-write-${process.pid}-${crypto.randomBytes(8).toString('hex')}.tmp`
  )
  let tmpExists = false
  try {
    await fsp.writeFile(tmp, content, { encoding: 'utf8', flag: 'wx' })
    tmpExists = true
    try {
      await fsp.rename(tmp, target)
      tmpExists = false
    } catch (error) {
      // POSIX rename replaces; Windows rename refuses an existing dest.
      const replaceable = process.platform === 'win32' && error && ['EPERM', 'EEXIST', 'EACCES'].includes(error.code)
      if (!replaceable) throw error
      try { await fsp.unlink(target) } catch (unlinkError) {
        if (unlinkError.code !== 'ENOENT') throw unlinkError
      }
      await fsp.rename(tmp, target)
      tmpExists = false
    }
  } finally {
    if (tmpExists) {
      try { await fsp.unlink(tmp) } catch { /* tmp already gone or never created */ }
    }
  }
}

function buildMatcher(query) {
  if (typeof query !== 'string' || !query.trim()) {
    throw new FileAccessError('A search term is required.', 'invalid-query')
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new FileAccessError(`A search term must be ${MAX_QUERY_LENGTH} characters or fewer.`, 'invalid-query')
  }
  const term = query.trim()
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // A query containing * or ? is treated as a glob over the file name; anything
  // else is a plain case-insensitive substring, which is what people mean.
  if (/[*?]/.test(term)) {
    const pattern = escaped.replace(/\\\*/g, '.*').replace(/\\\?/g, '.')
    return new RegExp(`^${pattern}$`, 'i')
  }
  return new RegExp(escaped, 'i')
}

/**
 * Breadth-limited directory walk.
 *
 * Symlinks and junctions are skipped outright rather than resolved. Following
 * them would mean re-running containment per entry, and a link farm can be
 * made to cycle; refusing is both safer and simpler to reason about.
 */
async function walkRoots(roots, visit) {
  let scanned = 0
  for (const root of roots) {
    const queue = [{ directory: root, depth: 0 }]
    while (queue.length) {
      const { directory, depth } = queue.shift()
      if (depth > MAX_DEPTH) continue

      let entries
      try {
        entries = await fsp.readdir(directory, { withFileTypes: true })
      } catch {
        continue // unreadable directory: skip, never surface the OS error
      }

      for (const entry of entries) {
        if (scanned >= MAX_ENTRIES_SCANNED) return { exhausted: true }
        scanned += 1
        if (entry.isSymbolicLink()) continue
        const full = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          if (!isDeniedDirectory(entry.name)) queue.push({ directory: full, depth: depth + 1 })
          continue
        }
        if (!entry.isFile() || isDeniedName(entry.name)) continue
        const stop = await visit(full, entry)
        if (stop === true) return { exhausted: false }
      }
    }
  }
  return { exhausted: scanned >= MAX_ENTRIES_SCANNED }
}

function createFileAccess({ roots }) {
  const allowedRoots = normalizeRoots(roots)

  async function searchFiles({ query, limit = MAX_RESULTS }) {
    const matcher = buildMatcher(query)
    const cap = Math.min(Number.isInteger(limit) && limit > 0 ? limit : MAX_RESULTS, MAX_RESULTS)
    const results = []
    const { exhausted } = await walkRoots(allowedRoots, async (full, entry) => {
      if (!matcher.test(entry.name)) return false
      let info
      try {
        info = await fsp.stat(full)
      } catch {
        return false
      }
      results.push({ path: full, name: entry.name, size: info.size, modified: info.mtime.toISOString() })
      return results.length >= cap
    })
    return { results, truncated: results.length >= cap || exhausted }
  }

  async function statFile({ path: input }) {
    const target = resolveWithinRoots(input, allowedRoots)
    const info = await fsp.stat(target)
    return {
      path: target,
      name: path.basename(target),
      extension: path.extname(target).toLowerCase(),
      size: info.size,
      directory: info.isDirectory(),
      modified: info.mtime.toISOString(),
      created: info.birthtime.toISOString()
    }
  }

  async function readTextFile({ path: input }) {
    const target = resolveWithinRoots(input, allowedRoots)
    const info = await fsp.stat(target)
    if (info.isDirectory()) {
      throw new FileAccessError('That path is a folder, not a file.', 'not-a-file')
    }
    if (info.size > MAX_READ_BYTES) {
      throw new FileAccessError(`That file is larger than the ${MAX_READ_BYTES}-byte read limit.`, 'too-large')
    }

    const handle = await fsp.open(target, 'r')
    let buffer
    try {
      buffer = Buffer.alloc(Math.min(info.size, MAX_READ_BYTES))
      await handle.read(buffer, 0, buffer.length, 0)
    } finally {
      await handle.close()
    }
    // A NUL byte is the cheapest reliable binary signal. Reading a binary as
    // text produces garbage that is then sent to a provider, which is both
    // useless and a way to smuggle bytes into a prompt.
    if (buffer.includes(0)) {
      throw new FileAccessError('That file is not readable text.', 'not-text')
    }

    const content = buffer.toString('utf8')
    return {
      path: target,
      name: path.basename(target),
      content: content.slice(0, MAX_CONTENT_CHARS),
      truncated: content.length > MAX_CONTENT_CHARS || info.size > buffer.length,
      // The same label web.fetch uses. Anything carrying it must reach a
      // provider fenced as untrusted data, never as instructions.
      trust: 'untrusted-external'
    }
  }

  async function searchFileContent({ query, limit = MAX_RESULTS }) {
    const matcher = buildMatcher(query)
    const cap = Math.min(Number.isInteger(limit) && limit > 0 ? limit : MAX_RESULTS, MAX_RESULTS)
    const matches = []
    const { exhausted } = await walkRoots(allowedRoots, async full => {
      if (!TEXT_EXTENSIONS.has(path.extname(full).toLowerCase())) return false
      let info
      try {
        info = await fsp.stat(full)
      } catch {
        return false
      }
      if (info.size > MAX_READ_BYTES) return false

      let text
      try {
        const buffer = await fsp.readFile(full)
        if (buffer.includes(0)) return false
        text = buffer.toString('utf8')
      } catch {
        return false
      }

      let found = 0
      const lines = text.split(/\r?\n/)
      for (let index = 0; index < lines.length && found < MAX_MATCHES_PER_FILE; index += 1) {
        if (!matcher.test(lines[index])) continue
        found += 1
        matches.push({
          path: full,
          name: path.basename(full),
          line: index + 1,
          snippet: lines[index].trim().slice(0, 300)
        })
        if (matches.length >= cap) return true
      }
      return false
    })
    return { matches, truncated: matches.length >= cap || exhausted, trust: 'untrusted-external' }
  }

  function inspectWriteTarget(target) {
    try {
      return fs.lstatSync(target)
    } catch (error) {
      if (error && error.code === 'ENOENT') return null
      throw new FileAccessError('That file is not available.', 'not-found')
    }
  }

  function prepareSave({ path: input, content, overwrite = false }) {
    if (overwrite !== undefined && overwrite !== true && overwrite !== false) {
      throw new FileAccessError('overwrite must be true or false.', 'invalid-overwrite')
    }
    const replace = overwrite === true
    const { content: cleaned, byteLength } = normalizeWriteContent(content)
    const { target, basename } = resolveWritableTarget(input, allowedRoots)
    const existing = inspectWriteTarget(target)
    if (existing) {
      if (existing.isSymbolicLink()) {
        throw new FileAccessError('That path cannot be overwritten.', 'is-symlink')
      }
      if (existing.isDirectory()) {
        throw new FileAccessError('That path is a folder, not a file.', 'not-a-file')
      }
      if (!replace) {
        throw new FileAccessError('That file already exists. Pass overwrite: true to replace it.', 'exists')
      }
      // The file exists, so the read gate can realpath it and catch a
      // junction/symlink that lstat missed on an unusual volume.
      resolveWithinRoots(target, allowedRoots)
    }
    return {
      path: target,
      name: basename,
      content: cleaned,
      byteLength,
      overwrite: replace,
      exists: Boolean(existing)
    }
  }

  async function saveTextFile(input) {
    const prepared = prepareSave(input)
    await atomicWriteFile(prepared.path, prepared.content)
    return {
      path: prepared.path,
      name: prepared.name,
      byteLength: prepared.byteLength,
      overwritten: prepared.exists
    }
  }

  return {
    roots: allowedRoots,
    searchFiles,
    statFile,
    readTextFile,
    searchFileContent,
    prepareSave,
    saveTextFile,
    resolvePath: input => resolveWithinRoots(input, allowedRoots)
  }
}

module.exports = {
  createFileAccess,
  normalizeRoots,
  resolveWithinRoots,
  resolveWritableTarget,
  splitParentAndBasename,
  assertWritableBasename,
  isDeniedName,
  isDeniedDirectory,
  isDeniedWriteExtension,
  isReservedDeviceName,
  isWithin,
  buildMatcher,
  FileAccessError,
  MAX_PATH_LENGTH,
  MAX_READ_BYTES,
  MAX_WRITE_BYTES,
  MAX_CONTENT_CHARS,
  MAX_RESULTS,
  MAX_DEPTH,
  MAX_QUERY_LENGTH,
  TEXT_EXTENSIONS,
  DENIED_NAME_PATTERNS,
  DENIED_DIRECTORY_NAMES,
  DENIED_WRITE_EXTENSIONS
}
