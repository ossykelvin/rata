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
  assertWritableBasename,
  isReservedDeviceName,
  isDeniedWriteExtension,
  sameVolume
} = require('../electron/file-access.cjs')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { createMvpRegistry } = require('../electron/tools/index.cjs')
const { createSkillRegistry } = require('../packages/skills/registry.cjs')
const fileModule = require('../electron/tools/file.cjs')

const ROOT = path.join(__dirname, '..')

// RATA-014 folder.create / file.move / file.rename. Real temp directories,
// same shape as tests/file-write.test.cjs, because containment and leftover
// files are exactly what a mock would paper over.

async function sandbox() {
  const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'rata-organize-'))
  const root = path.join(base, 'root')
  const otherRoot = path.join(base, 'other-root')
  const outside = path.join(base, 'outside')
  await fsp.mkdir(path.join(root, 'sub'), { recursive: true })
  await fsp.mkdir(otherRoot, { recursive: true })
  await fsp.mkdir(outside, { recursive: true })
  await fsp.writeFile(path.join(root, 'notes.txt'), 'hello\n')
  await fsp.writeFile(path.join(root, 'existing.txt'), 'keep\n')
  await fsp.writeFile(path.join(root, 'sub', 'deep.txt'), 'nested\n')
  await fsp.writeFile(path.join(otherRoot, 'other.txt'), 'other\n')
  await fsp.writeFile(path.join(outside, 'secret.txt'), 'OUTSIDE\n')
  await fsp.writeFile(path.join(root, 'id_rsa'), 'FAKEKEY\n')
  return {
    base,
    root,
    otherRoot,
    outside,
    access: createFileAccess({ roots: [root, otherRoot] })
  }
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

function composedRegistry() {
  return createMvpRegistry({
    spawnProcess: () => ({ unref() {} }),
    clipboardApi: { writeText() {} }
  })
}

// --- containment -------------------------------------------------------

test('a path outside every root is refused and nothing is created or moved', async () => {
  const { access, root, outside } = await sandbox()
  const beforeRoot = names(root)
  const beforeOutside = names(outside)
  await assert.rejects(
    () => access.createFolder({ path: path.join(outside, 'planted') }),
    error => error instanceof FileAccessError && ['outside-roots', 'not-found'].includes(error.code)
  )
  await assert.rejects(
    () => access.moveFile({
      source: path.join(root, 'notes.txt'),
      destination: path.join(outside, 'notes.txt')
    }),
    error => error instanceof FileAccessError && ['outside-roots', 'not-found'].includes(error.code)
  )
  await assert.rejects(
    () => access.renameFile({
      path: path.join(outside, 'secret.txt'),
      name: 'renamed.txt'
    }),
    error => error instanceof FileAccessError && ['outside-roots', 'not-found'].includes(error.code)
  )
  assert.deepEqual(names(root), beforeRoot)
  assert.deepEqual(names(outside), beforeOutside)
  assert.equal(fs.existsSync(path.join(root, 'notes.txt')), true)
})

test('.. in the directory or basename is refused and nothing is created or moved', async () => {
  const { access, root, outside } = await sandbox()
  const beforeRoot = names(root)
  const beforeOutside = names(outside)
  const climbs = [
    path.join(root, 'sub', '..', '..', 'outside', 'pwned'),
    path.join(root, '..', 'outside', 'pwned'),
    path.join(root, 'foo..bar')
  ]
  for (const target of climbs) {
    await assert.rejects(
      () => access.createFolder({ path: target }),
      error => error instanceof FileAccessError,
      `folder.create accepted ${target}`
    )
  }
  await assert.rejects(
    () => access.moveFile({
      source: path.join(root, 'notes.txt'),
      destination: path.join(root, 'sub', '..', '..', 'outside', 'notes.txt')
    }),
    error => error instanceof FileAccessError
  )
  await assert.rejects(
    () => access.renameFile({ path: path.join(root, 'notes.txt'), name: 'foo..bar.txt' }),
    error => error instanceof FileAccessError
  )
  assert.deepEqual(names(root), beforeRoot)
  assert.deepEqual(names(outside), beforeOutside)
})

test('a basename with a separator, colon, drive letter or NUL is refused', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  assert.throws(() => assertWritableBasename('foo/bar'), FileAccessError)
  assert.throws(() => assertWritableBasename('foo\\bar'), FileAccessError)
  const bad = [
    path.join(root, 'foo:bar'),
    path.join(root, 'C:notes'),
    `${root}${path.sep}name\0folder`
  ]
  for (const target of bad) {
    await assert.rejects(
      () => access.createFolder({ path: target }),
      error => error instanceof FileAccessError || error instanceof TypeError,
      `accepted ${JSON.stringify(target)}`
    )
  }
  await assert.rejects(
    () => access.renameFile({ path: path.join(root, 'notes.txt'), name: 'foo:bar.txt' }),
    error => error instanceof FileAccessError
  )
  assert.deepEqual(names(root), before)
})

test('CON, PRN, NUL, COM1 and LPT1 are refused with and without an extension', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  const reserved = ['CON', 'CON.txt', 'con', 'PRN', 'PRN.md', 'NUL', 'NUL.txt', 'COM1', 'COM1.exe', 'LPT1', 'lpt1.log']
  for (const name of reserved) {
    assert.equal(isReservedDeviceName(name), true, `${name} was not classified as reserved`)
    await assert.rejects(
      () => access.createFolder({ path: path.join(root, name) }),
      error => error instanceof FileAccessError && ['reserved-name', 'invalid-name', 'denied-extension'].includes(error.code),
      `folder.create accepted ${name}`
    )
    await assert.rejects(
      () => access.renameFile({ path: path.join(root, 'notes.txt'), name }),
      error => error instanceof FileAccessError && ['reserved-name', 'invalid-name', 'denied-extension'].includes(error.code),
      `file.rename accepted ${name}`
    )
  }
  assert.deepEqual(names(root), before)
  assert.equal(fs.existsSync(path.join(root, 'notes.txt')), true)
})

test('trailing dots and trailing spaces are refused', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  for (const name of ['notes.', 'notes ', '.hidden', ' spaced']) {
    const target = `${root}${path.sep}${name}`
    await assert.rejects(
      () => access.createFolder({ path: target }),
      error => error instanceof FileAccessError && error.code === 'invalid-name',
      `accepted ${JSON.stringify(name)}`
    )
  }
  await assert.rejects(
    () => access.renameFile({ path: path.join(root, 'notes.txt'), name: 'notes.txt ' }),
    error => error instanceof FileAccessError && error.code === 'invalid-name'
  )
  assert.deepEqual(names(root), before)
})

test('creating or renaming to .env, id_rsa or .npmrc is refused', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  for (const name of ['.env', 'id_rsa', '.npmrc']) {
    await assert.rejects(
      () => access.createFolder({ path: path.join(root, name) }),
      error => error instanceof FileAccessError && ['denied-name', 'invalid-name'].includes(error.code),
      `folder.create accepted ${name}`
    )
    await assert.rejects(
      () => access.renameFile({ path: path.join(root, 'notes.txt'), name }),
      error => error instanceof FileAccessError && ['denied-name', 'invalid-name'].includes(error.code),
      `file.rename accepted ${name}`
    )
    await assert.rejects(
      () => access.moveFile({
        source: path.join(root, 'notes.txt'),
        destination: path.join(root, 'sub', name)
      }),
      error => error instanceof FileAccessError && ['denied-name', 'invalid-name'].includes(error.code),
      `file.move accepted ${name}`
    )
  }
  assert.deepEqual(names(root), before)
  assert.equal(fs.existsSync(path.join(root, 'notes.txt')), true)
})

// --- executables -------------------------------------------------------

test('move and rename to every deny-list extension are refused in both cases', async () => {
  const { access, root } = await sandbox()
  const beforeRoot = names(root)
  const beforeSub = names(path.join(root, 'sub'))
  assert.ok(DENIED_WRITE_EXTENSIONS.size > 0)
  for (const ext of DENIED_WRITE_EXTENSIONS) {
    assert.equal(isDeniedWriteExtension(`payload${ext}`), true, `${ext} lower`)
    assert.equal(isDeniedWriteExtension(`payload${ext.toUpperCase()}`), true, `${ext} upper`)
    for (const name of [`payload${ext}`, `payload${ext.toUpperCase()}`]) {
      await assert.rejects(
        () => access.moveFile({
          source: path.join(root, 'notes.txt'),
          destination: path.join(root, 'sub', name)
        }),
        error => error instanceof FileAccessError && error.code === 'denied-extension',
        `file.move accepted ${name}`
      )
      await assert.rejects(
        () => access.renameFile({ path: path.join(root, 'notes.txt'), name }),
        error => error instanceof FileAccessError && error.code === 'denied-extension',
        `file.rename accepted ${name}`
      )
      await assert.rejects(
        () => access.createFolder({ path: path.join(root, name) }),
        error => error instanceof FileAccessError && error.code === 'denied-extension',
        `folder.create accepted ${name}`
      )
    }
  }
  assert.deepEqual(names(root), beforeRoot, 'directory contents changed after executable refusal')
  assert.deepEqual(names(path.join(root, 'sub')), beforeSub)
  assert.equal(await fsp.readFile(path.join(root, 'notes.txt'), 'utf8'), 'hello\n')
})

// --- overwrite ---------------------------------------------------------

test('an existing destination is not overwritten without overwrite: true', async () => {
  const { access, root } = await sandbox()
  await assert.rejects(
    () => access.moveFile({
      source: path.join(root, 'notes.txt'),
      destination: path.join(root, 'existing.txt')
    }),
    error => error instanceof FileAccessError && error.code === 'exists'
  )
  await assert.rejects(
    () => access.renameFile({
      path: path.join(root, 'notes.txt'),
      name: 'existing.txt'
    }),
    error => error instanceof FileAccessError && error.code === 'exists'
  )
  assert.equal(await fsp.readFile(path.join(root, 'existing.txt'), 'utf8'), 'keep\n')
  assert.equal(fs.existsSync(path.join(root, 'notes.txt')), true)
})

test('overwrite: true replaces the destination and policy confirms even when fileWriteConfirm is false', async () => {
  const { access, root } = await sandbox()
  const registry = toolRegistry(access)
  const policy = new PolicyEngine()
  const source = path.join(root, 'notes.txt')
  const destination = path.join(root, 'existing.txt')
  const validated = registry.validate('file.move', { source, destination, overwrite: true })
  const meta = registry.describe('file.move')
  assert.equal(policy.evaluate(meta, validated, { fileWriteConfirm: false }).decision, 'confirm')
  const detail = registry.preview('file.move', validated)
  assert.ok(detail.includes(source), 'approval card omitted the resolved source')
  assert.ok(detail.includes(destination), 'approval card omitted the resolved destination')
  assert.match(detail, /overwrite/i)

  const result = await registry.execute('file.move', { source, destination, overwrite: true })
  assert.equal(result.overwritten, true)
  assert.equal(fs.existsSync(source), false)
  assert.equal(await fsp.readFile(destination, 'utf8'), 'hello\n')
})

test('a new organize write is configurable behind fileWriteConfirm', async () => {
  const { access, root } = await sandbox()
  const registry = toolRegistry(access)
  const policy = new PolicyEngine()
  for (const id of ['folder.create', 'file.move', 'file.rename']) {
    const meta = registry.describe(id)
    assert.equal(meta.risk, 'safe-write', id)
    assert.equal(meta.confirmation, 'configurable', id)
    assert.equal(meta.confirmationSetting, 'fileWriteConfirm', id)
  }
  const created = registry.validate('folder.create', { path: path.join(root, 'inbox') })
  const folderMeta = registry.describe('folder.create')
  assert.equal(policy.evaluate(folderMeta, created, { fileWriteConfirm: true }).decision, 'confirm')
  assert.equal(policy.evaluate(folderMeta, created, {}).decision, 'confirm')
  assert.equal(policy.evaluate(folderMeta, created, { fileWriteConfirm: false }).decision, 'allow')
})

// --- folder.create -----------------------------------------------------

test('folder.create makes a real directory inside an allowed root', async () => {
  const { access, root } = await sandbox()
  const target = path.join(root, 'inbox')
  const created = await access.createFolder({ path: target })
  assert.equal(created.path, target)
  assert.equal(fs.statSync(target).isDirectory(), true)
  assert.deepEqual(fs.readdirSync(target), [])
})

test('folder.create refuses if the parent is missing', async () => {
  const { access, root } = await sandbox()
  const before = names(root)
  await assert.rejects(
    () => access.createFolder({ path: path.join(root, 'missing-parent', 'inbox') }),
    error => error instanceof FileAccessError && ['not-found', 'outside-roots'].includes(error.code)
  )
  assert.deepEqual(names(root), before)
  assert.equal(fs.existsSync(path.join(root, 'missing-parent')), false)
})

test('folder.create refuses if the folder already exists', async () => {
  const { access, root } = await sandbox()
  const target = path.join(root, 'inbox')
  await access.createFolder({ path: target })
  await fsp.writeFile(path.join(target, 'keep.txt'), 'stay\n')
  await assert.rejects(
    () => access.createFolder({ path: target }),
    error => error instanceof FileAccessError && error.code === 'exists'
  )
  assert.equal(await fsp.readFile(path.join(target, 'keep.txt'), 'utf8'), 'stay\n')
})

// --- rename vs move ----------------------------------------------------

test('file.rename to a different directory is refused', async () => {
  const { access, root } = await sandbox()
  await assert.rejects(
    () => access.renameFile({
      path: path.join(root, 'notes.txt'),
      destination: path.join(root, 'sub', 'notes.txt')
    }),
    error => error instanceof FileAccessError && error.code === 'not-a-rename'
  )
  await assert.rejects(
    () => access.renameFile({
      path: path.join(root, 'notes.txt'),
      name: path.join('sub', 'notes.txt')
    }),
    error => error instanceof FileAccessError && ['not-a-rename', 'invalid-name', 'outside-roots', 'not-found'].includes(error.code)
  )
  assert.equal(fs.existsSync(path.join(root, 'notes.txt')), true)
  assert.equal(fs.existsSync(path.join(root, 'sub', 'notes.txt')), false)
})

test('file.move to a different allowed folder succeeds and leaves the source gone', async () => {
  const { access, root } = await sandbox()
  const source = path.join(root, 'notes.txt')
  const destinationDir = path.join(root, 'sub')
  const moved = await access.moveFile({ source, destination: destinationDir })
  const expected = path.join(destinationDir, 'notes.txt')
  assert.equal(moved.path, expected)
  assert.equal(fs.existsSync(source), false)
  assert.equal(fs.existsSync(expected), true)
  assert.equal(await fsp.readFile(expected, 'utf8'), 'hello\n')
})

test('file.rename in the same folder succeeds', async () => {
  const { access, root } = await sandbox()
  const source = path.join(root, 'notes.txt')
  const renamed = await access.renameFile({ path: source, name: 'renamed.txt' })
  assert.equal(renamed.path, path.join(root, 'renamed.txt'))
  assert.equal(fs.existsSync(source), false)
  assert.equal(await fsp.readFile(path.join(root, 'renamed.txt'), 'utf8'), 'hello\n')
})

test('cross-root moves stay inside the allow-list', async () => {
  const { access, root, otherRoot } = await sandbox()
  const source = path.join(root, 'notes.txt')
  const moved = await access.moveFile({
    source,
    destination: path.join(otherRoot, 'notes.txt')
  })
  assert.equal(moved.path, path.join(otherRoot, 'notes.txt'))
  assert.equal(fs.existsSync(source), false)
  assert.equal(await fsp.readFile(path.join(otherRoot, 'notes.txt'), 'utf8'), 'hello\n')
})

test('moving or renaming a directory is refused', async () => {
  const { access, root } = await sandbox()
  await assert.rejects(
    () => access.moveFile({
      source: path.join(root, 'sub'),
      destination: path.join(root, 'inbox')
    }),
    error => error instanceof FileAccessError && error.code === 'is-directory'
  )
  assert.equal(fs.statSync(path.join(root, 'sub')).isDirectory(), true)
  assert.equal(fs.existsSync(path.join(root, 'sub', 'deep.txt')), true)
})

test('a denied-name source can be renamed to a safe name but not to another denied name', async () => {
  const { access, root } = await sandbox()
  const source = path.join(root, 'id_rsa')
  await assert.rejects(
    () => access.renameFile({ path: source, name: 'credentials' }),
    error => error instanceof FileAccessError && ['denied-name', 'invalid-name'].includes(error.code)
  )
  assert.equal(fs.existsSync(source), true)
  const renamed = await access.renameFile({ path: source, name: 'old-key.txt' })
  assert.equal(renamed.path, path.join(root, 'old-key.txt'))
  assert.equal(fs.existsSync(source), false)
  assert.equal(await fsp.readFile(path.join(root, 'old-key.txt'), 'utf8'), 'FAKEKEY\n')
})

test('same-volume helper refuses a different drive letter', () => {
  assert.equal(sameVolume(path.join(os.tmpdir(), 'a'), path.join(os.tmpdir(), 'b')), true)
  if (process.platform === 'win32') {
    assert.equal(sameVolume('C:\\Users\\a\\file.txt', 'C:\\Users\\b\\file.txt'), true)
    assert.equal(sameVolume('C:\\Users\\a\\file.txt', 'D:\\Users\\a\\file.txt'), false)
  }
})

test('file.delete stays disabled after the organize verbs land', async () => {
  const { access, root } = await sandbox()
  const registry = toolRegistry(access)
  await assert.rejects(
    () => registry.execute('file.delete', { path: path.join(root, 'notes.txt') }),
    /disabled in MVP/
  )
  assert.equal(fs.existsSync(path.join(root, 'notes.txt')), true)
})

test('file-organizer reports available against a composed registry', () => {
  const tools = composedRegistry()
  const skills = createSkillRegistry({ rootDir: ROOT, toolRegistry: tools })
  const organizer = skills.list().find(skill => skill.id === 'file-organizer')
  assert.ok(organizer, 'file-organizer skill is missing')
  assert.equal(organizer.status, 'ready')
  assert.deepEqual(organizer.missingTools, [])
  assert.deepEqual(
    organizer.availableTools.slice().sort(),
    ['file.move', 'file.rename', 'file.search', 'folder.create']
  )
})
