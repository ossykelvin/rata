/**
 * The `filesystem.` domain — RATA-SKILL-007.
 *
 * `skills/filesystem-scan/` declares exactly three tools: `filesystem.scan`,
 * `filesystem.diskUsage` and `filesystem.hash`. The skill reported
 * `unavailable` because none of them existed, and a skill cannot reach past the
 * Tool Registry to make up the difference (ADR-003). This module owns those
 * three ids and nothing else.
 *
 * Every tool here is `risk: 'read'` and read-only by construction. There is no
 * write, move, rename, delete, quarantine or compress path in this file, and
 * none of the three returns file contents. The security core is
 * `electron/filesystem-scan.cjs`; this is the contract layer — risk,
 * confirmation, input validation and what the approval card says.
 *
 * `filesystemScan` is optional in the same way `fileAccess` is. A machine with
 * no readable roots is a legitimate state, and throwing during composition
 * would take every other tool down with it.
 */
const MAX_PATH_INPUT = 4096

function requireObject(input, toolId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolId} input must be an object.`)
  }
  return input
}

/**
 * Shape check only. Whether the path is *allowed* is decided by
 * `scan.assertPath`, which runs the one shared containment gate — see
 * `requireAllowedPath`.
 */
function requirePathShape(value, toolId) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${toolId} requires a folder path.`)
  }
  if (value.length > MAX_PATH_INPUT || value.includes('\0')) {
    throw new TypeError(`${toolId} received an invalid path.`)
  }
  return value
}

function requireCount(value, toolId, limit) {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || value < 1 || value > limit) {
    throw new TypeError(`${toolId} limits must be a whole number between 1 and ${limit}.`)
  }
  return value
}

function unavailable() {
  throw new Error('Storage scanning is not configured.')
}

function formatBytes(value) {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB']
  let size = Number(value) || 0
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${unit === 0 ? size : size.toFixed(1)} ${units[unit]}`
}

const TRUNCATION_REASONS = Object.freeze(Object.assign(Object.create(null), {
  'entry-budget': 'the scan reached its entry limit',
  depth: 'the scan reached its folder-depth limit',
  time: 'the scan reached its time limit',
  'result-limit': 'more files matched than the result limit allows'
}))

function truncationNote(result) {
  if (!result.truncated) return ''
  const reason = Object.hasOwn(TRUNCATION_REASONS, result.truncationReason)
    ? TRUNCATION_REASONS[result.truncationReason]
    : 'the scan hit a safety limit'
  return ` This is a partial picture: ${reason}.`
}

function create({ filesystemScan } = {}) {
  const scan = filesystemScan || {
    roots: [],
    scan: unavailable,
    diskUsage: unavailable,
    hash: unavailable,
    assertPath: unavailable
  }

  /**
   * Refuses a path the user may not scan *during validation*, before the
   * policy engine renders an approval card. Fail-closed ordering matters here:
   * a forbidden path should never produce a prompt the user could approve.
   */
  function requireAllowedPath(value, toolId) {
    const candidate = requirePathShape(value, toolId)
    scan.assertPath(candidate)
    return candidate
  }

  return [
    {
      id: 'filesystem.scan',
      description: 'Inventory sizes and timestamps inside the folders Rata may read. Never reads file contents.',
      risk: 'read',
      // A bulk inventory of file names is at least as revealing as reading one
      // file, and it travels the same way — onward to a provider. It is
      // therefore governed by the existing local-file egress gate rather than
      // a second overlapping setting. See ADR-014.
      confirmation: 'configurable',
      confirmationSetting: 'fileReadConfirm',
      validateInput: input => {
        const value = requireObject(input, 'filesystem.scan')
        const validated = {}
        if (value.path !== undefined) validated.path = requireAllowedPath(value.path, 'filesystem.scan')
        const maxDepth = requireCount(value.maxDepth, 'filesystem.scan', 6)
        const maxEntries = requireCount(value.maxEntries, 'filesystem.scan', 200)
        if (maxDepth !== undefined) validated.maxDepth = maxDepth
        if (maxEntries !== undefined) validated.maxEntries = maxEntries
        return validated
      },
      describeInput: input => {
        const where = input.path
          ? String(input.path).slice(0, 300)
          : 'Documents, Downloads and Desktop'
        return `List file names, sizes and dates inside ${where}. No file contents are read, and nothing is changed. The file list may be sent to your AI provider.`
      },
      execute: async ({ path: target, maxDepth, maxEntries }) => {
        const result = await scan.scan({ path: target, maxDepth, maxEntries })
        const scope = result.scopes.join(', ')
        const top = result.entries
          .slice(0, 10)
          .map(entry => `• ${entry.path} — ${formatBytes(entry.size)}`)
          .join('\n')
        return {
          ...result,
          // Audit detail is built from `summary`, so it carries counts and the
          // scope only. A per-file dump does not belong in the activity log.
          summary: `Scanned ${scope}: ${result.totals.files} file(s), ${formatBytes(result.totals.bytes)}${result.truncated ? ' (truncated)' : ''}`,
          message: result.totals.files
            ? `${scope} holds ${result.totals.files} file(s) across ${result.totals.directories} folder(s), ${formatBytes(result.totals.bytes)} in total.${truncationNote(result)}\n\nLargest files:\n${top}`
            : `I found no readable files in ${scope}.${truncationNote(result)}`
        }
      }
    },
    {
      id: 'filesystem.diskUsage',
      description: 'Report capacity totals for the volumes holding the folders Rata may read.',
      risk: 'read',
      confirmation: 'configurable',
      confirmationSetting: 'fileReadConfirm',
      validateInput: input => {
        const value = requireObject(input, 'filesystem.diskUsage')
        return value.path === undefined
          ? {}
          : { path: requireAllowedPath(value.path, 'filesystem.diskUsage') }
      },
      describeInput: () => 'Report how full your drive is. Totals only — no file names and no file contents.',
      execute: async ({ path: target }) => {
        const { volumes } = await scan.diskUsage({ path: target })
        const readable = volumes.filter(volume => volume.available)
        const lines = volumes.map(volume => volume.available
          ? `• ${volume.volume} — ${formatBytes(volume.usedBytes)} used of ${formatBytes(volume.totalBytes)} (${volume.usedPercent}%), ${formatBytes(volume.freeBytes)} free`
          : `• ${volume.volume} — capacity could not be read`)
        return {
          volumes,
          summary: `Disk usage for ${readable.length} of ${volumes.length} volume(s)`,
          message: readable.length
            ? `Storage:\n${lines.join('\n')}`
            : `I could not read capacity for ${volumes.length === 1 ? 'that volume' : 'those volumes'}.`
        }
      }
    },
    {
      id: 'filesystem.hash',
      description: 'Compute a digest of one readable file to confirm a suspected duplicate. Returns the digest, never the file.',
      risk: 'read',
      confirmation: 'configurable',
      confirmationSetting: 'fileReadConfirm',
      validateInput: input => {
        const value = requireObject(input, 'filesystem.hash')
        const validated = { path: requireAllowedPath(value.path, 'filesystem.hash') }
        if (value.algorithm !== undefined) {
          if (value.algorithm !== 'sha256' && value.algorithm !== 'sha512') {
            throw new TypeError('filesystem.hash supports sha256 and sha512 only.')
          }
          validated.algorithm = value.algorithm
        }
        return validated
      },
      describeInput: input =>
        `Compute a ${input.algorithm || 'sha256'} digest of ${String(input.path).slice(0, 300)}. Rata reads the file to fingerprint it and returns only the digest; the contents are not returned or stored.`,
      execute: async ({ path: target, algorithm }) => {
        const result = await scan.hash({ path: target, ...(algorithm ? { algorithm } : {}) })
        return {
          ...result,
          summary: `${result.algorithm} digest computed (${result.bytes} bytes read)`,
          message: `${result.name} — ${result.algorithm}: ${result.digest}. A matching digest confirms two files are identical; it does not mean either one is safe to delete.`
        }
      }
    }
  ]
}

module.exports = {
  id: 'filesystem',
  toolIds: ['filesystem.scan', 'filesystem.diskUsage', 'filesystem.hash'],
  create
}
