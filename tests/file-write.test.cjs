const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const {
  createFileAccess,
  FileAccessError,
  DENIED_WRITE_EXTENSIONS,
  MAX_WRITE_BYTES,
  assertWritableBasename,
  isReservedDeviceName,
  isDeniedWriteExtension
} = require('../electron/file-access.cjs')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const fileModule = require('../electron/tools/file.cjs')

// RATA-013 file.save. A real temporary filesystem, same shape as
// tests/file-access-security.test.cjs, because containment, naming and
// leftover temp files are exactly what a mock would paper over.

async function sandbox() {
  // Realpath'd on purpose. saveTextFile returns the resolved path,
  // because resolving before comparing is what makes containment work.
  // A CI runner's temp directory is reached through an 8.3 short name
  // (C:\Users\RUNNER~1\...), so an un-resolved base makes every path
  // assertion fail there and pass on a developer machine.
  const base = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'rata-write-')))
  const root = path.join(base, 'root')
  const outside = path.join(base, 'outside')
  await fsp.mkdir(path.join(root, 'sub'), { recursive: true })
  await fsp.mkdir(outside, { recursive: true })
  await fsp.writeFile(path.join(root, 'existing.md'), 'original\n')
  await fsp.writeFile(path.join(outside, 'secret.txt'), 'OUTSIDE\n')
  return { base, root, outside, access: createFileAccess({ roots: [root] }) }
}

function names(directory) {
  return fs.readdirSync(directory).sort()
}

function toolRegistry(access) {
  const registry = new ToolRegistry()
  for (const definition of fileModule.create({ fileAccess: access })) {
    registry.register(definition)
  }
  return registry
}

async function listTmp(directory) {
  return (await fsp.readdir(directory)).filter(name => name.startsWith('.rata-write-') && name.endsWith('.tmp'))
}

// --- containment and naming --------------------------------------------

test('a path outside every root is refused and nothing is created', async () => {
  const { access, root, outside } = await sandbox()
  const beforeRoot = names(root)
  const beforeOutside = names(outside)
  await assert.rejects(
    () => access.saveTextFile({ path: path.join(outside, 'planted.txt'), content: 'nope' }),
    error => error instanceof FileAccessError && ['outside-roots', 'not-found'].includes(error.code)
  )
  assert.deepEqual(names(root), beforeRoot)
  assert.deepEqual(names(outside), beforeOutside)
})

test('.. in the directory or basename is refused and nothing is created', async () => {
  const { access, root, outside } = await sandbox()
  const beforeRoot = names(root)
  const beforeOutside = names(outside)
  const climbs = [
    path.join(root, 'sub', '..', '..', 'outside', 'pwned.txt'),
    path.join(root, '..', 'outside', 'pwned.txt'),
    path.join(root, 'foo..bar.txt')
  ]
  for (const target of climbs) {
    await assert.rejects(
      () => access.saveTextFile({ path: target, content: 'nope' }),
      error => error instanceof FileAccessError,
      `accepted ${target}`
    )
  }
  assert.deepEqual(names(root), beforeRoot)
  assert.deepEqual(names(outside), beforeOutside)
})

test('a basename with a separator, colon, drive letter or NUL is refused', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  assert.throws(() => assertWritableBasename('foo/bar.txt'), FileAccessError)
  assert.throws(() => assertWritableBasename('foo\\bar.txt'), FileAccessError)
  const bad = [
    path.join(root, 'foo:bar.txt'),
    path.join(root, 'C:notes.txt'),
    `${root}${path.sep}name\0.txt`
  ]
  for (const target of bad) {
    await assert.rejects(
      () => access.saveTextFile({ path: target, content: 'nope' }),
      error => error instanceof FileAccessError || error instanceof TypeError,
      `accepted ${JSON.stringify(target)}`
    )
  }
  assert.deepEqual(names(root), before)
})

test('CON, PRN, NUL, COM1 and LPT1 are refused with and without an extension', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  const reserved = ['CON', 'CON.txt', 'con', 'PRN', 'PRN.md', 'NUL', 'NUL.txt', 'COM1', 'COM1.exe', 'LPT1', 'lpt1.log']
  for (const name of reserved) {
    assert.equal(isReservedDeviceName(name), true, `${name} was not classified as reserved`)
    await assert.rejects(
      () => access.saveTextFile({ path: path.join(root, name), content: 'nope' }),
      error => error instanceof FileAccessError && ['reserved-name', 'invalid-name', 'denied-extension'].includes(error.code),
      `accepted ${name}`
    )
  }
  assert.deepEqual(names(root), before)
})

test('trailing dots and trailing spaces are refused', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  for (const name of ['notes.txt.', 'notes.txt ', '.hidden.md', ' spaced.txt']) {
    // Build the path by concatenation so Windows `path.join` cannot strip
    // the trailing space we are trying to refuse.
    const target = `${root}${path.sep}${name}`
    await assert.rejects(
      () => access.saveTextFile({ path: target, content: 'nope' }),
      error => error instanceof FileAccessError && error.code === 'invalid-name',
      `accepted ${JSON.stringify(name)}`
    )
  }
  assert.deepEqual(names(root), before)
})

test('writing .env, id_rsa or .npmrc inside an allowed root is refused', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  for (const name of ['.env', 'id_rsa', '.npmrc']) {
    await assert.rejects(
      () => access.saveTextFile({ path: path.join(root, name), content: 'SECRET=1\n' }),
      error => error instanceof FileAccessError && ['denied-name', 'invalid-name'].includes(error.code),
      `accepted ${name}`
    )
  }
  assert.deepEqual(names(root), before)
})

// --- executables -------------------------------------------------------

test('every deny-list extension is refused in both cases and no file appears', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  assert.ok(DENIED_WRITE_EXTENSIONS.size > 0)
  for (const ext of DENIED_WRITE_EXTENSIONS) {
    assert.equal(isDeniedWriteExtension(`payload${ext}`), true, `${ext} lower`)
    assert.equal(isDeniedWriteExtension(`payload${ext.toUpperCase()}`), true, `${ext} upper`)
    for (const name of [`payload${ext}`, `payload${ext.toUpperCase()}`]) {
      await assert.rejects(
        () => access.saveTextFile({ path: path.join(root, name), content: 'MZ' }),
        error => error instanceof FileAccessError && error.code === 'denied-extension',
        `accepted ${name}`
      )
    }
  }
  assert.deepEqual(names(root), before, 'an executable or script was created')
})

// --- overwrite ---------------------------------------------------------

test('an existing file is not overwritten without overwrite: true', async () => {
  const { access, root } = await sandbox()
  const target = path.join(root, 'existing.md')
  await assert.rejects(
    () => access.saveTextFile({ path: target, content: 'replaced\n' }),
    error => error instanceof FileAccessError && error.code === 'exists'
  )
  assert.equal(await fsp.readFile(target, 'utf8'), 'original\n')
})

test('overwrite: true replaces the file and policy confirms even when fileWriteConfirm is false', async () => {
  const { access, root } = await sandbox()
  const registry = toolRegistry(access)
  const policy = new PolicyEngine()
  const target = path.join(root, 'existing.md')
  const validated = registry.validate('file.save', { path: target, content: 'replaced\n', overwrite: true })
  const meta = registry.describe('file.save')
  assert.equal(policy.evaluate(meta, validated, { fileWriteConfirm: false }).decision, 'confirm')
  const detail = registry.preview('file.save', validated)
  assert.ok(detail.includes(target), 'approval card omitted the resolved path')
  assert.match(detail, /overwrite/i)

  const result = await registry.execute('file.save', { path: target, content: 'replaced\n', overwrite: true })
  assert.equal(result.overwritten, true)
  assert.equal(await fsp.readFile(target, 'utf8'), 'replaced\n')
})

test('a new save is configurable behind fileWriteConfirm', async () => {
  const { access, root } = await sandbox()
  const registry = toolRegistry(access)
  const policy = new PolicyEngine()
  const target = path.join(root, 'fresh.md')
  const validated = registry.validate('file.save', { path: target, content: 'hello\n' })
  const meta = registry.describe('file.save')
  assert.equal(meta.confirmation, 'configurable')
  assert.equal(meta.confirmationSetting, 'fileWriteConfirm')
  assert.equal(policy.evaluate(meta, validated, { fileWriteConfirm: true }).decision, 'confirm')
  assert.equal(policy.evaluate(meta, validated, {}).decision, 'confirm')
  assert.equal(policy.evaluate(meta, validated, { fileWriteConfirm: false }).decision, 'allow')
})

// --- atomicity and bounds ----------------------------------------------

test('a failing write leaves no temp file', async () => {
  const { access, root } = await sandbox()
  const target = path.join(root, 'fresh.md')
  const before = names(root)
  const originalRename = fsp.rename
  fsp.rename = async () => {
    throw Object.assign(new Error('injected rename failure'), { code: 'EIO' })
  }
  try {
    await assert.rejects(
      () => access.saveTextFile({ path: target, content: 'hello\n' }),
      /injected rename failure|EIO/
    )
  } finally {
    fsp.rename = originalRename
  }
  assert.equal(fs.existsSync(target), false, 'the target was created despite the failed write')
  assert.deepEqual(await listTmp(root), [])
  assert.deepEqual(names(root), before)
})

test('content over 5MB is refused before anything is written', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  const oversized = 'x'.repeat(MAX_WRITE_BYTES + 1)
  await assert.rejects(
    () => access.saveTextFile({ path: path.join(root, 'huge.md'), content: oversized }),
    error => error instanceof FileAccessError && error.code === 'too-large'
  )
  assert.deepEqual(names(root), before)
  assert.deepEqual(await listTmp(root), [])
})

test('non-string content is refused', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  for (const content of [null, 12, Buffer.from('x'), { text: 'x' }, ['x']]) {
    await assert.rejects(
      () => access.saveTextFile({ path: path.join(root, 'x.md'), content }),
      error => error instanceof FileAccessError && error.code === 'not-a-string'
    )
  }
  assert.deepEqual(names(root), before)
})

test('a legitimate markdown save writes the file inside the root', async () => {
  const { access, root } = await sandbox()
  const target = path.join(root, 'notes.md')
  const saved = await access.saveTextFile({ path: target, content: '# Hello\n\nNUL\0 inside\n' })
  assert.equal(saved.path, target)
  assert.equal(saved.overwritten, false)
  const written = await fsp.readFile(target, 'utf8')
  assert.equal(written.includes('\0'), false)
  assert.match(written, /Hello/)
  assert.deepEqual(await listTmp(root), [])
})

test('file.save declares risk and confirmation and file.delete stays disabled', async () => {
  const { access, root } = await sandbox()
  const registry = toolRegistry(access)
  const meta = registry.describe('file.save')
  assert.equal(meta.risk, 'safe-write')
  assert.equal(meta.confirmation, 'configurable')
  assert.equal(meta.confirmationSetting, 'fileWriteConfirm')
  await assert.rejects(() => registry.execute('file.delete', { path: path.join(root, 'existing.md') }), /disabled in MVP/)
  assert.equal(fs.existsSync(path.join(root, 'existing.md')), true)
})
