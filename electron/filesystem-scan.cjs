'use strict'

const nodeFs = require('node:fs')
const nodeFsp = require('node:fs/promises')
const nodePath = require('node:path')
const nodeCrypto = require('node:crypto')

const {
  FileAccessError,
  MAX_PATH_LENGTH,
  isDeniedDirectory,
  isDeniedName,
  normalizeRoots,
  resolveWithinRoots
} = require('./file-access.cjs')

/**
 * Read-only storage inventory for RATA-SKILL-007.
 *
 * This is the highest-risk read surface in the app: it walks the user's real
 * disk and everything it returns can end up in a provider prompt. Three rules
 * carry the design.
 *
 * 1. **Containment is not re-implemented here.** Every path goes through
 *    `resolveWithinRoots` in `electron/file-access.cjs`, which is the single
 *    place that decides which paths Rata may touch. A second validator would
 *    drift from the first, and the weaker of the two would become the real
 *    policy. What this module adds is a *stricter* syntax gate in front of it
 *    (see `assertScannablePath`), never a looser one.
 *
 * 2. **No file contents, ever.** `scan` returns names, relative paths, sizes
 *    and timestamps. `hash` returns a digest string. Neither opens a file to
 *    give its bytes back to a caller — `hash` reads in fixed-size chunks that
 *    are folded into the digest and discarded. Returning content is a
 *    different tool (`file.readText`) with a different confirmation story.
 *
 * 3. **Everything is bounded.** Depth, entries visited, entries returned,
 *    wall-clock time and bytes hashed all have caps, and a truncated result
 *    says so. An unbounded recursive walk of a whole volume is a bug, not a
 *    feature.
 *
 * Roots are supplied by the composition root in `electron/main.cjs`. This
 * module deliberately does not read `os.homedir()` or any other source of
 * candidate roots: a tool module that can discover its own roots can widen
 * them, and no caller input names a root.
 */

/** Deepest directory level the walk will descend to. */
const MAX_SCAN_DEPTH = 6
/** Directory entries the walk may look at before it stops. */
const MAX_ENTRIES_VISITED = 20_000
/** Files described in a result. Everything past this is truncated away. */
const MAX_RETURNED_ENTRIES = 200
/** Folder aggregates described in a result. */
const MAX_RETURNED_FOLDERS = 50
/** Wall-clock budget for one scan. */
const MAX_SCAN_MILLISECONDS = 15_000
/** Largest file `hash` will read. Bigger files are refused, not partly hashed. */
const MAX_HASH_BYTES = 16 * 1024 * 1024
const HASH_CHUNK_BYTES = 64 * 1024
const HASH_ALGORITHMS = Object.freeze(['sha256', 'sha512'])
const MAX_NAME_CHARS = 260

/** `\\.\PhysicalDrive0`, `\\?\C:\...` — raw device namespaces. */
const DEVICE_PATH_PATTERN = /^[\\/]{2}[.?][\\/]/
/** `\\server\share` — a network location, which is not user-scoped storage. */
const UNC_PATH_PATTERN = /^[\\/]{2}/
const DRIVE_ABSOLUTE_PATTERN = /^[a-zA-Z]:[\\/]/

/**
 * Characters stripped from every name before it leaves this module.
 *
 * A file name is attacker-controlled text that reaches a UI and possibly a
 * provider prompt. Control characters can forge line structure inside an
 * untrusted-content fence; bidirectional overrides can make `report.txt.exe`
 * render as `report.exe.txt`. Neither belongs in a name we are only reporting.
 */
// `\p{Cc}` is the Unicode control category, which is exactly C0, DEL and C1.
const UNSAFE_NAME_CHARACTERS = /[\p{Cc}\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu

function safeName(value) {
  return String(value).replace(UNSAFE_NAME_CHARACTERS, ' ').slice(0, MAX_NAME_CHARS)
}

function safeRelativePath(value) {
  return String(value)
    .replace(UNSAFE_NAME_CHARACTERS, ' ')
    .slice(0, MAX_PATH_LENGTH)
}

function boundedInteger(value, fallback, limit) {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < 1) {
    throw new FileAccessError('That limit must be a whole number of at least 1.', 'invalid-limit')
  }
  return Math.min(value, limit)
}

function isoTime(value) {
  const time = value instanceof Date ? value : new Date(value)
  return Number.isFinite(time.getTime()) ? time.toISOString() : null
}

/**
 * Syntax gate applied *before* the shared containment gate.
 *
 * `resolveWithinRoots` already neutralises `..` and symlinks by resolving
 * first and comparing afterwards, so this is defence in depth rather than the
 * only line. It matters because it refuses without touching the filesystem:
 * a device path, a UNC share or a drive-relative fragment never reaches a
 * `realpath` call, so it cannot probe, block on a dead network share, or open
 * a device handle.
 */
function assertScannablePath(input, pathApi) {
  if (typeof input !== 'string') {
    throw new FileAccessError('A folder path is required.', 'invalid-path')
  }
  const value = input.trim()
  if (!value) {
    throw new FileAccessError('A folder path is required.', 'invalid-path')
  }
  if (value.length > MAX_PATH_LENGTH) {
    throw new FileAccessError('That path is too long.', 'invalid-path')
  }
  if (value.includes('\0')) {
    throw new FileAccessError('That path is not valid.', 'invalid-path')
  }
  if (DEVICE_PATH_PATTERN.test(value)) {
    throw new FileAccessError('Device paths cannot be scanned.', 'device-path')
  }
  if (UNC_PATH_PATTERN.test(value)) {
    throw new FileAccessError('Network paths cannot be scanned.', 'unc-path')
  }
  // A leading slash on Windows is drive-relative, not absolute, so it is only
  // accepted on a host where it genuinely is absolute.
  const absolute = DRIVE_ABSOLUTE_PATTERN.test(value) || (pathApi.sep === '/' && value.startsWith('/'))
  if (!absolute) {
    throw new FileAccessError('A full path to a folder inside your user folders is required.', 'relative-path')
  }
  if (value.split(/[\\/]/).includes('..')) {
    throw new FileAccessError('Relative path segments are not allowed.', 'traversal')
  }
  return value
}

function createFilesystemScan({
  roots,
  fsApi = nodeFs,
  fspApi = nodeFsp,
  pathApi = nodePath,
  cryptoApi = nodeCrypto,
  now = () => Date.now()
} = {}) {
  const allowedRoots = normalizeRoots(roots, fsApi)

  /** Syntax gate, then the one shared containment gate. Nothing else. */
  function resolveTarget(input) {
    const candidate = assertScannablePath(input, pathApi)
    return resolveWithinRoots(candidate, allowedRoots, fsApi)
  }

  function requireRoots() {
    if (!allowedRoots.length) {
      throw new FileAccessError('No readable folders are configured.', 'no-roots')
    }
  }

  function labelFor(root) {
    return safeName(pathApi.basename(root) || root)
  }

  /**
   * Breadth-first, budgeted walk of one root.
   *
   * Entries are sorted per directory so two runs over the same tree visit the
   * same files in the same order. Without that, a truncated result would be
   * arbitrary rather than reproducible, and "the ten largest files" would
   * change between runs for reasons the user cannot see.
   */
  async function walkRoot(root, label, budget) {
    const files = []
    const folders = new Map()
    const totals = { files: 0, directories: 0, bytes: 0 }
    let skipped = 0

    const queue = [{ directory: root, depth: 0, top: null }]
    while (queue.length) {
      if (now() >= budget.deadline) {
        budget.truncationReason = budget.truncationReason || 'time'
        break
      }
      const { directory, depth, top } = queue.shift()

      let entries
      try {
        entries = await fspApi.readdir(directory, { withFileTypes: true })
      } catch {
        // Unreadable directory. Reported as a count, never as an OS error:
        // the error text distinguishes "denied" from "missing".
        skipped += 1
        continue
      }
      entries = [...entries].sort((left, right) => String(left.name).localeCompare(String(right.name)))

      let stop = false
      for (const entry of entries) {
        if (budget.visited >= budget.maxVisited) {
          budget.truncationReason = budget.truncationReason || 'entry-budget'
          stop = true
          break
        }
        if (now() >= budget.deadline) {
          budget.truncationReason = budget.truncationReason || 'time'
          stop = true
          break
        }
        budget.visited += 1

        // Links are skipped rather than resolved, the same choice
        // file-access.cjs makes: a junction farm can be made to cycle, and
        // refusing is easier to reason about than re-checking containment per
        // entry.
        if (entry.isSymbolicLink()) {
          skipped += 1
          continue
        }

        const full = pathApi.join(directory, entry.name)
        const relative = safeRelativePath(pathApi.join(label, pathApi.relative(root, full)))

        if (entry.isDirectory()) {
          totals.directories += 1
          if (isDeniedDirectory(entry.name)) {
            skipped += 1
            continue
          }
          if (depth + 1 > budget.maxDepth) {
            budget.truncationReason = budget.truncationReason || 'depth'
            skipped += 1
            continue
          }
          queue.push({ directory: full, depth: depth + 1, top: top || safeName(entry.name) })
          continue
        }
        if (!entry.isFile()) {
          skipped += 1
          continue
        }
        if (isDeniedName(entry.name)) {
          // Credential-shaped files are not inventoried at all. Even a name
          // and a size is more than this surface needs to disclose.
          skipped += 1
          continue
        }

        let info
        try {
          info = await fspApi.stat(full)
        } catch {
          skipped += 1
          continue
        }
        const size = Number.isFinite(info.size) && info.size >= 0 ? info.size : 0

        totals.files += 1
        totals.bytes += size
        files.push({
          name: safeName(entry.name),
          path: relative,
          size,
          modified: isoTime(info.mtime),
          directory: false
        })

        const bucket = top || label
        const folder = folders.get(bucket) || { name: bucket, files: 0, bytes: 0 }
        folder.files += 1
        folder.bytes += size
        folders.set(bucket, folder)
      }
      if (stop) break
    }

    return { files, folders: [...folders.values()], totals, skipped }
  }

  /**
   * Metadata inventory of one allowed folder, or of every allowed root when no
   * path is given. Returns no file contents under any input.
   */
  async function scan({ path: input, maxDepth, maxEntries } = {}) {
    requireRoots()
    const targets = input === undefined
      ? allowedRoots.map(root => ({ root, label: labelFor(root) }))
      : [{ root: resolveTarget(input), label: null }]

    for (const target of targets) {
      if (target.label === null) target.label = labelFor(target.root)
      const info = await fspApi.stat(target.root).catch(() => null)
      if (!info) throw new FileAccessError('That folder is not available.', 'not-found')
      if (!info.isDirectory()) throw new FileAccessError('That path is a file, not a folder.', 'not-a-directory')
    }

    const returnLimit = boundedInteger(maxEntries, MAX_RETURNED_ENTRIES, MAX_RETURNED_ENTRIES)
    const budget = {
      visited: 0,
      maxVisited: MAX_ENTRIES_VISITED,
      maxDepth: boundedInteger(maxDepth, MAX_SCAN_DEPTH, MAX_SCAN_DEPTH),
      deadline: now() + MAX_SCAN_MILLISECONDS,
      truncationReason: null
    }

    const files = []
    const folders = []
    const totals = { files: 0, directories: 0, bytes: 0 }
    let skipped = 0
    for (const target of targets) {
      const result = await walkRoot(target.root, target.label, budget)
      files.push(...result.files)
      folders.push(...result.folders)
      totals.files += result.totals.files
      totals.directories += result.totals.directories
      totals.bytes += result.totals.bytes
      skipped += result.skipped
    }

    // Largest first, then by path, so a truncated list is reproducible.
    const bySize = (left, right) => right.size - left.size || left.path.localeCompare(right.path)
    files.sort(bySize)
    folders.sort((left, right) => right.bytes - left.bytes || left.name.localeCompare(right.name))

    const truncated = files.length > returnLimit || budget.truncationReason !== null
    return {
      scopes: targets.map(target => target.label),
      totals,
      entries: files.slice(0, returnLimit),
      folders: folders.slice(0, MAX_RETURNED_FOLDERS),
      skipped,
      truncated,
      truncationReason: truncated ? budget.truncationReason || 'result-limit' : null,
      limits: {
        maxDepth: budget.maxDepth,
        maxEntriesVisited: budget.maxVisited,
        maxEntriesReturned: returnLimit,
        maxMilliseconds: MAX_SCAN_MILLISECONDS
      },
      // File names are attacker-controlled text. Anything carrying this label
      // must reach a provider through the untrusted-content fence.
      trust: 'untrusted-external'
    }
  }

  /**
   * Capacity totals for the volumes behind the allowed roots. No names, no
   * per-file data, nothing but numbers and the volume root.
   *
   * A volume that cannot be interrogated is reported as unavailable rather
   * than thrown, because one unreadable drive must not fail a report about the
   * others.
   */
  async function diskUsage({ path: input } = {}) {
    requireRoots()
    const targets = input === undefined ? [...allowedRoots] : [resolveTarget(input)]

    const volumes = []
    const seen = new Set()
    for (const target of targets) {
      // Several allowed roots normally live on one volume; report it once.
      const volume = pathApi.parse(target).root || target
      if (seen.has(volume)) continue
      seen.add(volume)

      if (typeof fspApi.statfs !== 'function') {
        volumes.push({ volume, available: false, reason: 'unsupported' })
        continue
      }
      let stats
      try {
        stats = await fspApi.statfs(target)
      } catch {
        volumes.push({ volume, available: false, reason: 'unavailable' })
        continue
      }
      const blockSize = Number(stats?.bsize)
      const totalBytes = blockSize * Number(stats?.blocks)
      const freeBytes = blockSize * Number(stats?.bavail)
      const usable = [blockSize, totalBytes, freeBytes].every(value => Number.isFinite(value) && value >= 0)
      if (!usable || totalBytes <= 0 || freeBytes > totalBytes) {
        volumes.push({ volume, available: false, reason: 'unavailable' })
        continue
      }
      volumes.push({
        volume,
        available: true,
        totalBytes,
        freeBytes,
        usedBytes: totalBytes - freeBytes,
        usedPercent: Math.round(((totalBytes - freeBytes) / totalBytes) * 1000) / 10
      })
    }
    return { volumes }
  }

  /**
   * Digest of one allowed file, for confirming a duplicate that size and
   * metadata only made a candidate.
   *
   * Bytes are read in fixed chunks, folded into the digest and dropped. A file
   * larger than the cap is refused outright rather than hashed in part: a
   * prefix digest looks exactly like a whole-file digest to the caller and
   * would produce confident, wrong duplicate claims.
   */
  async function hash({ path: input, algorithm = 'sha256' } = {}) {
    requireRoots()
    if (typeof algorithm !== 'string' || !HASH_ALGORITHMS.includes(algorithm)) {
      throw new FileAccessError('That hash algorithm is not supported.', 'invalid-algorithm')
    }
    const target = resolveTarget(input)

    const info = await fspApi.stat(target).catch(() => null)
    if (!info) throw new FileAccessError('That file is not available.', 'not-found')
    if (info.isDirectory()) throw new FileAccessError('That path is a folder, not a file.', 'not-a-file')
    const size = Number.isFinite(info.size) && info.size >= 0 ? info.size : 0
    if (size > MAX_HASH_BYTES) {
      throw new FileAccessError(`That file is larger than the ${MAX_HASH_BYTES}-byte hashing limit.`, 'too-large')
    }

    const digestor = cryptoApi.createHash(algorithm)
    const handle = await fspApi.open(target, 'r')
    let hashed = 0
    try {
      const buffer = Buffer.alloc(HASH_CHUNK_BYTES)
      while (hashed < size) {
        const wanted = Math.min(HASH_CHUNK_BYTES, size - hashed)
        const { bytesRead } = await handle.read(buffer, 0, wanted, hashed)
        if (!bytesRead) break
        hashed += bytesRead
        // The file could have grown between stat and read. The cap is enforced
        // against bytes actually consumed, not just the size we were told.
        if (hashed > MAX_HASH_BYTES) {
          throw new FileAccessError(`That file is larger than the ${MAX_HASH_BYTES}-byte hashing limit.`, 'too-large')
        }
        digestor.update(buffer.subarray(0, bytesRead))
      }
    } finally {
      await handle.close()
    }

    return {
      name: safeName(pathApi.basename(target)),
      algorithm,
      // A digest string. The bytes that produced it are not returned, held or
      // logged anywhere.
      digest: String(digestor.digest('hex')),
      bytes: hashed,
      trust: 'untrusted-external'
    }
  }

  return {
    roots: allowedRoots,
    scan,
    diskUsage,
    hash,
    /**
     * Exposed so a tool's `validateInput` can refuse an out-of-roots path
     * before the policy engine ever renders an approval card. Returns the
     * resolved path; callers that only need the check may discard it.
     */
    assertPath: input => resolveTarget(input)
  }
}

module.exports = {
  createFilesystemScan,
  assertScannablePath,
  safeName,
  safeRelativePath,
  HASH_ALGORITHMS,
  MAX_ENTRIES_VISITED,
  MAX_HASH_BYTES,
  MAX_NAME_CHARS,
  MAX_RETURNED_ENTRIES,
  MAX_RETURNED_FOLDERS,
  MAX_SCAN_DEPTH,
  MAX_SCAN_MILLISECONDS
}
