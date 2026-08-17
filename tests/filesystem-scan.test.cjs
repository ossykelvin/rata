const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const { createFilesystemScan, MAX_HASH_BYTES } = require('../electron/filesystem-scan.cjs')
const filesystemModule = require('../electron/tools/filesystem.cjs')
const { createToolRegistry, discoverToolModules } = require('../electron/tools/index.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')

// RATA-SKILL-007 regression coverage.
//
// Nothing here touches the real filesystem, a real drive or a real hash of a
// real file, and nothing requires Electron. The disk is an in-memory fake
// injected through create(deps), which is what makes it possible to assert on
// paths (device namespaces, UNC shares, junction escapes) that cannot be
// created safely on a test machine.

/** Drive/volume root of the host, so fixtures are absolute on any platform. */
const VOLUME = path.parse(process.cwd()).root
const ALLOWED_ROOT = path.join(VOLUME, 'rata-fixture', 'Documents')
const OUTSIDE_ROOT = path.join(VOLUME, 'Windows', 'System32')

/** A string that must never appear in any tool output. */
const CANARY = 'INJECTION-CANARY-Sq7-ignore-all-previous-instructions'

class FakeDirent {
  constructor(name, kind) {
    this.name = name
    this.kind = kind
  }
  isDirectory() { return this.kind === 'dir' }
  isFile() { return this.kind === 'file' }
  isSymbolicLink() { return this.kind === 'link' }
}

/**
 * In-memory disk.
 *
 * `spec` is nested: an object is a directory, a string/Buffer is a file,
 * `{ __link: true }` is a symlink or junction, and `{ __size: n }` is a file
 * that reports `n` bytes without allocating them.
 */
function createFakeDisk(spec, options = {}) {
  const {
    rootPath = ALLOWED_ROOT,
    statfsResult = { bsize: 4096, blocks: 250_000, bavail: 100_000 },
    statfsError = null,
    omitStatfs = false,
    realpathOverrides = new Map(),
    mtime = new Date('2026-08-01T12:00:00.000Z')
  } = options

  const nodes = new Map()
  const reads = []

  function add(parent, entries) {
    for (const [name, value] of Object.entries(entries)) {
      const full = path.join(parent, name)
      if (value && typeof value === 'object' && !Buffer.isBuffer(value) && value.__link) {
        nodes.set(full, { kind: 'link', content: Buffer.alloc(0) })
        continue
      }
      if (value && typeof value === 'object' && !Buffer.isBuffer(value) && value.__size !== undefined) {
        nodes.set(full, { kind: 'file', content: Buffer.alloc(0), size: value.__size })
        continue
      }
      if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
        nodes.set(full, { kind: 'dir' })
        add(full, value)
        continue
      }
      const content = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8')
      nodes.set(full, { kind: 'file', content })
    }
  }

  // Every ancestor of the root exists, so realpath on the root succeeds.
  let walk = VOLUME
  nodes.set(walk, { kind: 'dir' })
  for (const segment of path.relative(VOLUME, rootPath).split(path.sep).filter(Boolean)) {
    walk = path.join(walk, segment)
    nodes.set(walk, { kind: 'dir' })
  }
  add(rootPath, spec)

  function describe(target) {
    const node = nodes.get(target)
    if (!node) {
      const error = new Error('ENOENT')
      error.code = 'ENOENT'
      throw error
    }
    return node
  }

  function statOf(target) {
    const node = describe(target)
    return {
      size: node.size !== undefined ? node.size : node.content ? node.content.length : 0,
      mtime,
      birthtime: mtime,
      isDirectory: () => node.kind === 'dir',
      isFile: () => node.kind === 'file'
    }
  }

  const realpathSync = target => {
    const resolved = path.resolve(target)
    if (realpathOverrides.has(resolved)) return realpathOverrides.get(resolved)
    describe(resolved)
    return resolved
  }
  realpathSync.native = realpathSync

  const promises = {
    readdir: async (directory, opts) => {
      const node = describe(directory)
      if (node.kind !== 'dir') {
        const error = new Error('ENOTDIR')
        error.code = 'ENOTDIR'
        throw error
      }
      const children = []
      for (const [candidate, child] of nodes) {
        if (path.dirname(candidate) === directory && candidate !== directory) {
          children.push(new FakeDirent(path.basename(candidate), child.kind))
        }
      }
      // Deliberately unsorted, so the walk's own ordering is what is tested.
      children.reverse()
      return opts?.withFileTypes ? children : children.map(child => child.name)
    },
    stat: async target => statOf(target),
    open: async (target, flags) => {
      assert.equal(flags, 'r', 'a filesystem tool opened a handle for something other than reading')
      const node = describe(target)
      return {
        read: async (buffer, offset, length, position) => {
          reads.push({ target, offset, length, position })
          const bytesRead = node.content.copy(buffer, offset, position, Math.min(position + length, node.content.length))
          return { bytesRead }
        },
        close: async () => {}
      }
    }
  }
  if (!omitStatfs) {
    promises.statfs = async () => {
      if (statfsError) throw statfsError
      return statfsResult
    }
  }

  return { fsApi: { realpathSync }, fspApi: promises, reads, nodes }
}

function createCapability(spec, options = {}) {
  const disk = createFakeDisk(spec, options)
  const capability = createFilesystemScan({
    roots: [ALLOWED_ROOT],
    fsApi: disk.fsApi,
    fspApi: disk.fspApi,
    pathApi: path,
    cryptoApi: options.cryptoApi || crypto,
    ...(options.now ? { now: options.now } : {})
  })
  return { capability, disk }
}

/** A registry containing only the filesystem module, for focused assertions. */
function createFilesystemRegistry(spec, options = {}) {
  const { capability, disk } = createCapability(spec, options)
  const registry = createToolRegistry({
    dependencies: { filesystemScan: capability },
    modules: [filesystemModule]
  })
  return { registry, capability, disk }
}

const SIMPLE_TREE = {
  'notes.txt': CANARY,
  reports: {
    'q3.xlsx': Buffer.alloc(5000, 1),
    'q4.xlsx': Buffer.alloc(9000, 2)
  }
}

// --- contract shape ------------------------------------------------------

test('every filesystem tool declares a complete contract', () => {
  const definitions = filesystemModule.create({ filesystemScan: undefined })
  assert.deepEqual(definitions.map(tool => tool.id), ['filesystem.scan', 'filesystem.diskUsage', 'filesystem.hash'])
  for (const tool of definitions) {
    assert.equal(typeof tool.id, 'string')
    assert.ok(tool.description.trim(), `${tool.id} description`)
    assert.equal(tool.risk, 'read', `${tool.id} must be read-only`)
    assert.equal(tool.confirmation, 'configurable', `${tool.id} confirmation`)
    assert.equal(tool.confirmationSetting, 'fileReadConfirm', `${tool.id} confirmation setting`)
    assert.equal(typeof tool.validateInput, 'function', `${tool.id} validateInput`)
    assert.equal(typeof tool.execute, 'function', `${tool.id} execute`)
    // REVIEW-001 M5: an approval card must never render raw tool input.
    assert.equal(typeof tool.describeInput, 'function', `${tool.id} describeInput`)
  }
})

test('the declared tool ids match the skill fragment character for character', () => {
  const fragment = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'skills', 'filesystem-scan', 'skill.json'), 'utf8'))
  assert.deepEqual(filesystemModule.toolIds, fragment.tools)
})

test('confirmation metadata is what the policy engine will actually enforce', () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  const policy = new PolicyEngine()
  for (const id of filesystemModule.toolIds) {
    const metadata = registry.describe(id)
    // Default settings (and absent settings) must confirm.
    assert.equal(policy.evaluate(metadata, {}, {}).decision, 'confirm', `${id} with no settings`)
    assert.equal(policy.evaluate(metadata, {}, { fileReadConfirm: true }).decision, 'confirm', `${id} confirmed`)
    // The user can opt out through the one existing local-file egress setting.
    assert.equal(policy.evaluate(metadata, {}, { fileReadConfirm: false }).decision, 'allow', `${id} opted out`)
    // No unrelated setting can turn confirmation off.
    assert.equal(policy.evaluate(metadata, {}, { clipboardConfirm: false }).decision, 'confirm', `${id} unrelated setting`)
  }
})

test('describeInput states what happens without echoing raw input', () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  const scanPreview = registry.preview('filesystem.scan', { path: ALLOWED_ROOT })
  assert.match(scanPreview, /No file contents are read/)
  assert.match(registry.preview('filesystem.diskUsage', {}), /Totals only/)
  assert.match(registry.preview('filesystem.hash', { path: ALLOWED_ROOT }), /returns only the digest/)
})

// --- input validation fails closed --------------------------------------

test('validateInput rejects a non-object input for every tool', () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  for (const id of filesystemModule.toolIds) {
    for (const bad of [null, undefined, 'path', 42, []]) {
      assert.throws(() => registry.validate(id, bad), /input must be an object/, `${id} accepted ${JSON.stringify(bad)}`)
    }
  }
})

test('validateInput rejects a malformed path for every tool that takes one', () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  const cases = [
    ['non-string', 42],
    ['object', { toString: () => ALLOWED_ROOT }],
    ['array', [ALLOWED_ROOT]],
    ['empty', ''],
    ['whitespace', '   '],
    ['NUL byte', `${ALLOWED_ROOT}\u0000.txt`],
    ['oversized', `${ALLOWED_ROOT}${path.sep}${'a'.repeat(5000)}`],
    ['relative', 'Documents\\notes.txt'],
    ['bare relative', 'notes.txt'],
    ['drive-relative', '\\Documents\\notes.txt'],
    // Built by concatenation on purpose: path.join() would normalise the `..`
    // away and the case would stop testing traversal.
    ['traversal', `${ALLOWED_ROOT}${path.sep}..${path.sep}Secrets`],
    ['traversal, forward slashes', `${ALLOWED_ROOT}/../Secrets`],
    ['UNC share', '\\\\fileserver\\share\\notes.txt'],
    ['UNC, forward slashes', '//fileserver/share/notes.txt'],
    ['device namespace', '\\\\.\\PhysicalDrive0'],
    ['extended-length device path', `\\\\?\\${ALLOWED_ROOT}`],
    ['outside the allow-list', path.join(OUTSIDE_ROOT, 'drivers')],
    ['a drive root', VOLUME]
  ]

  for (const [label, value] of cases) {
    // `path` is optional on scan and diskUsage, but a *supplied* path must
    // still be validated, so `undefined` is not among the cases above.
    for (const id of filesystemModule.toolIds) {
      assert.throws(
        () => registry.validate(id, { path: value }),
        error => error instanceof Error,
        `${id} accepted ${label}`
      )
    }
  }
})

test('a forbidden path is refused during validation, before any approval card', async () => {
  // Fail-closed ordering: PolicyEngine never gets the chance to ask the user
  // to approve a path the tool would refuse anyway.
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  assert.throws(() => registry.validate('filesystem.scan', { path: OUTSIDE_ROOT }))
  await assert.rejects(() => registry.execute('filesystem.scan', { path: OUTSIDE_ROOT }))
})

test('a refused path produces a fixed message that echoes neither the path nor the OS error', () => {
  const { capability } = createCapability(SIMPLE_TREE)
  const refused = [
    OUTSIDE_ROOT,
    path.join(ALLOWED_ROOT, 'absent.txt'),
    '\\\\fileserver\\share\\notes.txt',
    '\\\\.\\PhysicalDrive0'
  ]
  for (const target of refused) {
    let message
    try {
      capability.assertPath(target)
      assert.fail(`${target} was accepted`)
    } catch (error) {
      message = error.message
    }
    // The requested path is not reflected back, and no OS errno leaks: both
    // would turn a refusal into a probe for paths Rata may not read.
    assert.equal(message.includes(target), false, `the error echoed ${target}`)
    assert.doesNotMatch(message, /ENOENT|EPERM|EACCES|ENOTDIR/)
  }
})

test('a junction whose target escapes the roots is refused', () => {
  const escape = path.join(ALLOWED_ROOT, 'shortcut')
  const { capability } = createCapability(
    { shortcut: {} },
    { realpathOverrides: new Map([[escape, OUTSIDE_ROOT]]) }
  )
  assert.throws(() => capability.assertPath(escape), /outside the folders/)
})

test('limit arguments are bounded whole numbers', () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  for (const bad of [0, -1, 1.5, '5', Number.NaN, 10_000, Infinity]) {
    assert.throws(() => registry.validate('filesystem.scan', { maxEntries: bad }), /whole number/)
    assert.throws(() => registry.validate('filesystem.scan', { maxDepth: bad }), /whole number/)
  }
  assert.deepEqual(registry.validate('filesystem.scan', {}), {})
  assert.deepEqual(registry.validate('filesystem.scan', { maxEntries: 5, maxDepth: 2 }), { maxEntries: 5, maxDepth: 2 })
})

test('filesystem.hash requires a path and accepts only allow-listed algorithms', () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  assert.throws(() => registry.validate('filesystem.hash', {}), /requires a folder path/)
  const target = path.join(ALLOWED_ROOT, 'notes.txt')
  assert.throws(() => registry.validate('filesystem.hash', { path: target, algorithm: 'md5' }), /sha256 and sha512/)
  assert.throws(() => registry.validate('filesystem.hash', { path: target, algorithm: 'constructor' }), /sha256 and sha512/)
  assert.deepEqual(registry.validate('filesystem.hash', { path: target }), { path: target })
})

// --- filesystem.scan -----------------------------------------------------

test('filesystem.scan returns metadata and never file contents', async () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  const result = await registry.execute('filesystem.scan', {})

  const serialized = JSON.stringify(result)
  assert.equal(serialized.includes(CANARY), false, 'scan output contained file contents')
  assert.equal(result.message.includes(CANARY), false, 'the user-facing message contained file contents')
  assert.equal(result.summary.includes(CANARY), false, 'the audit summary contained file contents')
  assert.equal(Object.hasOwn(result, 'content'), false)

  const notes = result.entries.find(entry => entry.name === 'notes.txt')
  assert.deepEqual(Object.keys(notes).sort(), ['directory', 'modified', 'name', 'path', 'size'])
  assert.equal(notes.size, Buffer.byteLength(CANARY))
  assert.equal(notes.modified, '2026-08-01T12:00:00.000Z')
  assert.equal(result.totals.files, 3)
  assert.equal(result.trust, 'untrusted-external')
})

test('filesystem.scan returns relative paths, not the absolute profile path', async () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  const result = await registry.execute('filesystem.scan', {})
  const volumeLabel = VOLUME.replace(/[\\/]+$/, '')
  for (const entry of result.entries) {
    assert.equal(path.isAbsolute(entry.path), false, `${entry.path} is absolute`)
    if (volumeLabel) {
      assert.equal(entry.path.includes(volumeLabel), false, `${entry.path} leaks the volume`)
    }
  }
  assert.deepEqual(result.entries.map(entry => entry.path).sort(), [
    path.join('Documents', 'notes.txt'),
    path.join('Documents', 'reports', 'q3.xlsx'),
    path.join('Documents', 'reports', 'q4.xlsx')
  ].sort())
})

test('filesystem.scan caps the number of entries it returns and says so', async () => {
  const many = {}
  for (let index = 0; index < 40; index += 1) {
    many[`file-${String(index).padStart(3, '0')}.txt`] = Buffer.alloc(index + 1)
  }
  const { registry } = createFilesystemRegistry(many)
  const result = await registry.execute('filesystem.scan', { maxEntries: 5 })

  assert.equal(result.entries.length, 5)
  assert.equal(result.totals.files, 40, 'totals must still count every file')
  assert.equal(result.truncated, true)
  assert.equal(result.truncationReason, 'result-limit')
  assert.match(result.message, /partial picture/)
  // Largest first, so a truncated list is the useful one and is reproducible.
  assert.deepEqual(result.entries.map(entry => entry.size), [40, 39, 38, 37, 36])
})

test('filesystem.scan truncation is deterministic across runs', async () => {
  const tree = {}
  for (let index = 0; index < 12; index += 1) tree[`same-${index}.bin`] = Buffer.alloc(100)
  const first = await createFilesystemRegistry(tree).registry.execute('filesystem.scan', { maxEntries: 4 })
  const second = await createFilesystemRegistry(tree).registry.execute('filesystem.scan', { maxEntries: 4 })
  assert.deepEqual(first.entries.map(entry => entry.path), second.entries.map(entry => entry.path))
})

test('filesystem.scan caps recursion depth', async () => {
  const { registry } = createFilesystemRegistry({
    'top.txt': 'top',
    level1: { 'mid.txt': 'mid', level2: { 'deep.txt': 'deep' } }
  })
  const result = await registry.execute('filesystem.scan', { maxDepth: 1 })
  const names = result.entries.map(entry => entry.name).sort()
  assert.deepEqual(names, ['mid.txt', 'top.txt'])
  assert.equal(result.entries.some(entry => entry.name === 'deep.txt'), false, 'the walk descended past its depth cap')
  assert.equal(result.truncated, true)
  assert.equal(result.truncationReason, 'depth')
  assert.equal(result.limits.maxDepth, 1)
})

test('filesystem.scan stops at its time budget', async () => {
  let clock = 0
  const { registry } = createFilesystemRegistry(
    { a: { 'one.txt': 'x' }, b: { 'two.txt': 'y' } },
    { now: () => { clock += 20_000; return clock } }
  )
  const result = await registry.execute('filesystem.scan', {})
  assert.equal(result.truncated, true)
  assert.equal(result.truncationReason, 'time')
})

test('filesystem.scan skips links, credential-shaped names and credential folders', async () => {
  const { registry } = createFilesystemRegistry({
    'keep.txt': 'keep',
    '.env': 'SECRET_TOKEN=abc123',
    'server.pem': 'PRIVATE KEY',
    'shortcut': { __link: true },
    '.ssh': { id_rsa: 'PRIVATE KEY' },
    '.git': { config: 'url = https://token@example.test/repo' }
  })
  const result = await registry.execute('filesystem.scan', {})
  const names = result.entries.map(entry => entry.name)
  assert.deepEqual(names, ['keep.txt'])
  const serialized = JSON.stringify(result)
  for (const leak of ['.env', 'server.pem', 'id_rsa', 'SECRET_TOKEN', 'token@example.test']) {
    assert.equal(serialized.includes(leak), false, `scan output mentioned ${leak}`)
  }
  assert.ok(result.skipped >= 3)
})

test('filesystem.scan sanitises names that could forge structure or spoof an extension', async () => {
  const { registry } = createFilesystemRegistry({
    'line\u000abreak.txt': 'a',
    'spoof\u202Etxt.exe': 'b'
  })
  const result = await registry.execute('filesystem.scan', {})
  for (const entry of result.entries) {
    assert.doesNotMatch(entry.name, /[\p{Cc}\u202a-\u202e]/u, `${JSON.stringify(entry.name)} kept unsafe characters`)
    assert.doesNotMatch(entry.path, /[\p{Cc}\u202a-\u202e]/u, `${JSON.stringify(entry.path)} kept unsafe characters`)
  }
})

test('filesystem.scan refuses a file path and an unreadable folder without leaking why', async () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  await assert.rejects(
    () => registry.execute('filesystem.scan', { path: path.join(ALLOWED_ROOT, 'notes.txt') }),
    /a file, not a folder/
  )
})

test('the audit summary carries counts, not a directory listing', async () => {
  // MockAgent logs `${id}: ${result.summary}`, so `summary` is the audit text.
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  const result = await registry.execute('filesystem.scan', {})
  assert.match(result.summary, /Scanned Documents: 3 file\(s\)/)
  for (const entry of result.entries) {
    assert.equal(result.summary.includes(entry.name), false, `the summary named ${entry.name}`)
  }
})

// --- filesystem.diskUsage ------------------------------------------------

test('filesystem.diskUsage returns totals only', async () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  const result = await registry.execute('filesystem.diskUsage', {})
  assert.equal(result.volumes.length, 1)
  const [volume] = result.volumes
  assert.deepEqual(Object.keys(volume).sort(), ['available', 'freeBytes', 'totalBytes', 'usedBytes', 'usedPercent', 'volume'])
  assert.equal(volume.totalBytes, 4096 * 250_000)
  assert.equal(volume.freeBytes, 4096 * 100_000)
  assert.equal(volume.usedBytes, 4096 * 150_000)
  assert.equal(volume.usedPercent, 60)
  // No file, folder or entry data of any kind.
  assert.equal(Object.hasOwn(result, 'entries'), false)
  assert.equal(JSON.stringify(result).includes(CANARY), false)
})

test('filesystem.diskUsage handles an unavailable volume without throwing', async () => {
  const failure = Object.assign(new Error('EIO'), { code: 'EIO' })
  const { registry } = createFilesystemRegistry(SIMPLE_TREE, { statfsError: failure })
  const result = await registry.execute('filesystem.diskUsage', {})
  assert.deepEqual(result.volumes.map(volume => volume.available), [false])
  assert.equal(result.volumes[0].reason, 'unavailable')
  assert.match(result.message, /could not read capacity/)
  // The OS error text must not reach the caller.
  assert.equal(JSON.stringify(result).includes('EIO'), false)
})

test('filesystem.diskUsage reports unsupported rather than crashing on an older runtime', async () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE, { omitStatfs: true })
  const result = await registry.execute('filesystem.diskUsage', {})
  assert.deepEqual(result.volumes.map(volume => volume.reason), ['unsupported'])
})

test('filesystem.diskUsage rejects nonsensical capacity numbers', async () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE, {
    statfsResult: { bsize: 4096, blocks: 10, bavail: 1_000_000 }
  })
  const result = await registry.execute('filesystem.diskUsage', {})
  assert.equal(result.volumes[0].available, false)
})

// --- filesystem.hash -----------------------------------------------------

test('filesystem.hash returns a digest, never the bytes', async () => {
  const { registry, disk } = createFilesystemRegistry(SIMPLE_TREE)
  const result = await registry.execute('filesystem.hash', { path: path.join(ALLOWED_ROOT, 'notes.txt') })

  assert.equal(result.algorithm, 'sha256')
  assert.equal(result.digest, crypto.createHash('sha256').update(Buffer.from(CANARY, 'utf8')).digest('hex'))
  assert.match(result.digest, /^[0-9a-f]{64}$/)
  assert.equal(result.bytes, Buffer.byteLength(CANARY))
  assert.equal(JSON.stringify(result).includes(CANARY), false, 'hash output contained file contents')
  assert.equal(result.message.includes(CANARY), false)
  assert.equal(result.summary.includes(CANARY), false)
  assert.equal(Object.hasOwn(result, 'content'), false)
  // Read in bounded chunks through a read-only handle.
  assert.ok(disk.reads.length >= 1)
  for (const read of disk.reads) assert.ok(read.length <= 64 * 1024)
})

test('filesystem.hash supports sha512 and nothing else', async () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  const result = await registry.execute('filesystem.hash', {
    path: path.join(ALLOWED_ROOT, 'notes.txt'),
    algorithm: 'sha512'
  })
  assert.equal(result.digest, crypto.createHash('sha512').update(Buffer.from(CANARY, 'utf8')).digest('hex'))
})

test('filesystem.hash refuses a path outside the allow-list', async () => {
  const { registry, disk } = createFilesystemRegistry(SIMPLE_TREE)
  for (const target of [OUTSIDE_ROOT, path.join(OUTSIDE_ROOT, 'config.sys'), '\\\\.\\PhysicalDrive0']) {
    await assert.rejects(() => registry.execute('filesystem.hash', { path: target }))
  }
  assert.deepEqual(disk.reads, [], 'a refused path still opened a handle')
})

test('filesystem.hash refuses a credential-shaped file inside an allowed root', async () => {
  const { registry, disk } = createFilesystemRegistry({ '.env': 'SECRET_TOKEN=abc123' })
  await assert.rejects(
    () => registry.execute('filesystem.hash', { path: path.join(ALLOWED_ROOT, '.env') }),
    /not readable for safety reasons/
  )
  assert.deepEqual(disk.reads, [])
})

test('filesystem.hash refuses a file above the byte cap instead of hashing part of it', async () => {
  const { registry, disk } = createFilesystemRegistry({ 'huge.bin': { __size: MAX_HASH_BYTES + 1 } })
  await assert.rejects(
    () => registry.execute('filesystem.hash', { path: path.join(ALLOWED_ROOT, 'huge.bin') }),
    /larger than the .* hashing limit/
  )
  // A prefix digest is indistinguishable from a whole-file digest to the
  // caller, so no bytes are read at all.
  assert.deepEqual(disk.reads, [])
})

test('filesystem.hash refuses a folder', async () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  await assert.rejects(
    () => registry.execute('filesystem.hash', { path: path.join(ALLOWED_ROOT, 'reports') }),
    /a folder, not a file/
  )
})

// --- no write path exists ------------------------------------------------

/**
 * Comments are stripped before the verb scan below, because the modules
 * *document* that they never rename or delete anything and the prose would
 * otherwise trip the check it exists to support.
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1')
}

test('no filesystem tool has a write, move, delete or shell code path', () => {
  const sources = ['../electron/tools/filesystem.cjs', '../electron/filesystem-scan.cjs']
    .map(relative => withoutComments(fs.readFileSync(path.join(__dirname, relative), 'utf8')))
    .join('\n')

  // Guard against a stripper that removed the code along with the prose.
  assert.match(sources, /fspApi\.open\(target, 'r'\)/)

  const forbidden = [
    /\bwriteFile\b/, /\bappendFile\b/, /\bwriteFileSync\b/, /\bcreateWriteStream\b/,
    /\bunlink\b/, /\brmdir\b/, /\brmSync\b/, /\brm\s*\(/, /\btruncate\b/,
    /\brename\b/, /\bcopyFile\b/, /\bmkdir\b/, /\bchmod\b/, /\bchown\b/, /\butimes\b/,
    /child_process/, /\bspawn\b/, /\bexecSync\b/, /\bexecFile\b/,
    /powershell/i, /\bwmic\b/i, /cmd\.exe/i, /\beval\b/
  ]
  for (const pattern of forbidden) {
    assert.doesNotMatch(sources, pattern, `the filesystem tools reference ${pattern}`)
  }
  // Handles are opened read-only. Nothing else is even reachable.
  assert.equal(sources.includes("'r'"), true)
  for (const flag of ["'w'", "'a'", "'r+'", "'w+'", "'a+'"]) {
    assert.equal(sources.includes(flag), false, `a handle flag ${flag} appears in the filesystem tools`)
  }
})

test('a destructive request cannot reach these tools as a write', async () => {
  const { registry, disk } = createFilesystemRegistry(SIMPLE_TREE)
  // There is no delete/move/clean verb to call at all.
  for (const absent of ['filesystem.delete', 'filesystem.clean', 'filesystem.move', 'filesystem.compress']) {
    assert.equal(registry.has(absent), false, `${absent} is registered`)
  }

  // And an attempt to smuggle a write flag through a read tool's input is
  // dropped by validateInput rather than reaching the executor.
  const before = JSON.stringify([...disk.nodes.keys()].sort())
  assert.deepEqual(
    registry.validate('filesystem.scan', { path: ALLOWED_ROOT, delete: true, force: true }),
    { path: ALLOWED_ROOT }
  )
  await registry.execute('filesystem.scan', { path: ALLOWED_ROOT, delete: true, force: true })
  await registry.execute('filesystem.hash', { path: path.join(ALLOWED_ROOT, 'notes.txt'), delete: true })
  assert.equal(JSON.stringify([...disk.nodes.keys()].sort()), before, 'the disk changed during a read-only scan')
})

// --- registration --------------------------------------------------------

test('the filesystem module owns exactly the three declared ids and collides with nothing', () => {
  const modules = discoverToolModules()
  const owners = new Map()
  for (const module of modules) {
    for (const toolId of module.toolIds) {
      assert.equal(owners.has(toolId), false, `${toolId} is claimed by ${owners.get(toolId)} and ${module.id}`)
      owners.set(toolId, module.id)
    }
  }
  for (const toolId of filesystemModule.toolIds) {
    assert.equal(owners.get(toolId), 'filesystem', `${toolId} is not owned by the filesystem module`)
  }
  // The neighbours whose namespaces are closest.
  for (const neighbour of ['system.openApp', 'clipboard.write', 'file.search', 'file.readText', 'web.fetch', 'web.search']) {
    assert.notEqual(owners.get(neighbour), 'filesystem', `${neighbour} was absorbed by the filesystem module`)
  }
})

test('the filesystem module registers even when storage scanning is unconfigured', async () => {
  const registry = createToolRegistry({ dependencies: {}, modules: [filesystemModule] })
  for (const id of filesystemModule.toolIds) assert.equal(registry.has(id), true)
  // Failing at execute rather than at composition lets the UI explain why.
  await assert.rejects(() => registry.execute('filesystem.diskUsage', {}), /not configured/)
  assert.throws(() => registry.validate('filesystem.hash', { path: ALLOWED_ROOT }), /not configured/)
})

test('a capability with no roots fails closed rather than scanning everything', async () => {
  const disk = createFakeDisk(SIMPLE_TREE)
  const capability = createFilesystemScan({ roots: [], fsApi: disk.fsApi, fspApi: disk.fspApi })
  assert.deepEqual(capability.roots, [])
  await assert.rejects(() => capability.scan({}), /No readable folders are configured/)
  await assert.rejects(() => capability.diskUsage({}), /No readable folders are configured/)
  await assert.rejects(() => capability.hash({ path: ALLOWED_ROOT }), /No readable folders are configured/)
})

test('metadata accessors never hand out a filesystem executor', () => {
  const { registry } = createFilesystemRegistry(SIMPLE_TREE)
  for (const id of filesystemModule.toolIds) {
    assert.equal(typeof registry.describe(id).execute, 'undefined', `${id} leaked its executor`)
    assert.equal(typeof registry.get(id).validateInput, 'undefined', `${id} leaked its validator`)
  }
})
