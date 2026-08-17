const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const {
  createFileAccess,
  normalizeRoots,
  isDeniedName,
  isWithin,
  buildMatcher,
  FileAccessError,
  MAX_READ_BYTES
} = require('../electron/file-access.cjs')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const fileModule = require('../electron/tools/file.cjs')

// Lane H coverage for RATA-006.
//
// These tools read the user's real documents and hand the text to a cloud
// provider, so the whole security value is in what they refuse. Every test
// here asserts a refusal, or asserts that an allowed read stayed inside its
// root. A real temporary filesystem is used rather than a mock, because the
// defences being tested are realpath, symlink handling and path containment —
// exactly the things a mock would paper over.

/**
 * Builds: <tmp>/root/{notes.txt, .env, secret.pem, sub/deep.txt, .git/config}
 * and <tmp>/outside/secret.txt, with a symlink root/escape -> outside.
 */
async function sandbox() {
  // Realpath'd on purpose. saveTextFile returns the resolved path,
  // because resolving before comparing is what makes containment work.
  // A CI runner's temp directory is reached through an 8.3 short name
  // (C:\Users\RUNNER~1\...), so an un-resolved base makes every path
  // assertion fail there and pass on a developer machine.
  const base = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'rata-files-')))
  const root = path.join(base, 'root')
  const outside = path.join(base, 'outside')
  await fsp.mkdir(path.join(root, 'sub'), { recursive: true })
  await fsp.mkdir(path.join(root, '.git'), { recursive: true })
  await fsp.mkdir(outside, { recursive: true })

  await fsp.writeFile(path.join(root, 'notes.txt'), 'project notes\nthe launch code is hunter2\n')
  await fsp.writeFile(path.join(root, 'report.md'), '# Report\nquarterly figures\n')
  await fsp.writeFile(path.join(root, '.env'), 'API_KEY=super-secret-value\n')
  await fsp.writeFile(path.join(root, 'server.pem'), '-----BEGIN PRIVATE KEY-----\n')
  await fsp.writeFile(path.join(root, 'photo.bin'), Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02]))
  await fsp.writeFile(path.join(root, 'sub', 'deep.txt'), 'nested content with hunter2\n')
  await fsp.writeFile(path.join(root, '.git', 'config'), 'url = https://token@github.com/x/y\n')
  await fsp.writeFile(path.join(outside, 'secret.txt'), 'PRIVATE DATA OUTSIDE THE ROOT\n')

  let symlinked = false
  try {
    await fsp.symlink(outside, path.join(root, 'escape'), 'junction')
    symlinked = true
  } catch {
    // Creating links can require elevation on Windows. The suite still runs;
    // the link-specific assertions are skipped and say so.
  }

  return { base, root, outside, symlinked, access: createFileAccess({ roots: [root] }) }
}

function toolRegistry(access, revealed = []) {
  const registry = new ToolRegistry()
  for (const definition of fileModule.create({ fileAccess: access, revealItem: target => revealed.push(target) })) {
    registry.register(definition)
  }
  return registry
}

// --- containment --------------------------------------------------------

test('a path outside every root is refused', async () => {
  const { access, outside } = await sandbox()
  await assert.rejects(
    () => access.readTextFile({ path: path.join(outside, 'secret.txt') }),
    error => error instanceof FileAccessError && error.code === 'outside-roots'
  )
})

test('traversal with .. cannot climb out of a root', async () => {
  const { access, root } = await sandbox()
  const climb = path.join(root, 'sub', '..', '..', 'outside', 'secret.txt')
  await assert.rejects(
    () => access.readTextFile({ path: climb }),
    error => error instanceof FileAccessError && ['outside-roots', 'not-found'].includes(error.code)
  )
})

test('a symlink pointing outside the root cannot be read through', async t => {
  const { access, root, symlinked } = await sandbox()
  if (!symlinked) return t.skip('this platform refused to create a link without elevation')
  await assert.rejects(
    () => access.readTextFile({ path: path.join(root, 'escape', 'secret.txt') }),
    error => error instanceof FileAccessError && error.code === 'outside-roots'
  )
})

test('a symlinked directory is not descended into during search', async t => {
  const { access, symlinked } = await sandbox()
  if (!symlinked) return t.skip('this platform refused to create a link without elevation')
  const { results } = await access.searchFiles({ query: 'secret' })
  assert.equal(
    results.some(item => item.name === 'secret.txt'),
    false,
    'search followed a symlink out of the root'
  )
})

test('containment compares resolved paths, not string prefixes', () => {
  assert.equal(isWithin('/home/user/docs', '/home/user/docs/a.txt'), true)
  assert.equal(isWithin('/home/user/docs', '/home/user/docs'), true)
  // The classic prefix bug: "docs-private" starts with "docs".
  assert.equal(isWithin('/home/user/docs', '/home/user/docs-private/a.txt'), false)
  assert.equal(isWithin('/home/user/docs', '/home/user/other/a.txt'), false)
})

test('a missing root is skipped rather than crashing composition', () => {
  const roots = normalizeRoots([path.join(os.tmpdir(), 'rata-does-not-exist-' + Date.now()), os.tmpdir()])
  assert.equal(roots.length, 1)
})

test('with no readable roots every operation fails closed', async () => {
  const access = createFileAccess({ roots: [] })
  await assert.rejects(() => access.readTextFile({ path: 'anything.txt' }), /No readable folders/)
})

// --- sensitivity, inside an allowed root --------------------------------

test('credential-shaped files are refused even inside an allowed root', async () => {
  const { access, root } = await sandbox()
  for (const name of ['.env', 'server.pem']) {
    await assert.rejects(
      () => access.readTextFile({ path: path.join(root, name) }),
      error => error instanceof FileAccessError && error.code === 'denied-name',
      `${name} was readable`
    )
  }
})

test('the denied-name list matches on shape, not location', () => {
  for (const name of ['.env', '.env.local', '.env.production', 'id_rsa', 'server.pem', 'store.kdbx', 'app.sqlite', '.npmrc']) {
    assert.equal(isDeniedName(name), true, `${name} was allowed`)
  }
  for (const name of ['notes.txt', 'report.md', 'environment.md', 'keynote.pptx']) {
    assert.equal(isDeniedName(name), false, `${name} was denied`)
  }
})

test('credential files never appear in name search results', async () => {
  const { access } = await sandbox()
  const { results } = await access.searchFiles({ query: '*' })
  const names = results.map(item => item.name)
  for (const denied of ['.env', 'server.pem']) {
    assert.equal(names.includes(denied), false, `${denied} was listed`)
  }
  assert.equal(names.includes('notes.txt'), true, 'ordinary files should still be found')
})

test('a .git directory is never descended into', async () => {
  const { access } = await sandbox()
  const { results } = await access.searchFiles({ query: 'config' })
  assert.equal(results.length, 0, 'a git config was reachable')
})

test('content search never reads a denied file', async () => {
  const { access } = await sandbox()
  const { matches } = await access.searchFileContent({ query: 'super-secret-value' })
  assert.equal(matches.length, 0, 'the contents of .env were searchable')
})

// --- read limits --------------------------------------------------------

test('a binary file is refused rather than returned as garbage text', async () => {
  const { access, root } = await sandbox()
  await assert.rejects(
    () => access.readTextFile({ path: path.join(root, 'photo.bin') }),
    error => error instanceof FileAccessError && error.code === 'not-text'
  )
})

test('a file larger than the read limit is refused', async () => {
  const { access, root } = await sandbox()
  const big = path.join(root, 'big.txt')
  await fsp.writeFile(big, 'a'.repeat(MAX_READ_BYTES + 1024))
  await assert.rejects(
    () => access.readTextFile({ path: big }),
    error => error instanceof FileAccessError && error.code === 'too-large'
  )
})

test('a directory is not readable as text', async () => {
  const { access, root } = await sandbox()
  await assert.rejects(
    () => access.readTextFile({ path: path.join(root, 'sub') }),
    error => error instanceof FileAccessError && error.code === 'not-a-file'
  )
})

test('read failures do not distinguish missing from forbidden', async () => {
  const { access, root, outside } = await sandbox()
  // Both report a generic failure. A different message per cause would let a
  // caller probe for the existence of paths it may not read.
  const missing = await access.readTextFile({ path: path.join(root, 'no-such-file.txt') }).catch(error => error)
  const forbidden = await access.readTextFile({ path: path.join(outside, 'nope.txt') }).catch(error => error)
  assert.equal(missing.code, 'not-found')
  assert.equal(forbidden.code, 'not-found')
  assert.equal(missing.message, forbidden.message)
})

// --- search behaviour ---------------------------------------------------

test('search matches substrings and globs, and finds nested files', async () => {
  const { access } = await sandbox()
  const substring = await access.searchFiles({ query: 'note' })
  assert.equal(substring.results.some(item => item.name === 'notes.txt'), true)

  const glob = await access.searchFiles({ query: '*.md' })
  assert.equal(glob.results.some(item => item.name === 'report.md'), true)
  assert.equal(glob.results.some(item => item.name === 'notes.txt'), false)

  const nested = await access.searchFiles({ query: 'deep' })
  assert.equal(nested.results.some(item => item.name === 'deep.txt'), true)
})

test('a search term is required and bounded', () => {
  for (const bad of ['', '   ', null, undefined, 'x'.repeat(201)]) {
    assert.throws(() => buildMatcher(bad), error => error instanceof FileAccessError)
  }
})

test('a regex-shaped query is treated as literal text', async () => {
  const { access } = await sandbox()
  // Would match everything if interpolated into a RegExp unescaped.
  const { results } = await access.searchFiles({ query: '.*' })
  assert.equal(results.length, 0, 'a regex metacharacter query behaved as a pattern')
})

test('content search returns the file, line and a bounded snippet', async () => {
  const { access } = await sandbox()
  const { matches, trust } = await access.searchFileContent({ query: 'hunter2' })
  assert.ok(matches.length >= 1)
  assert.equal(trust, 'untrusted-external')
  for (const match of matches) {
    assert.ok(match.line >= 1)
    assert.ok(match.snippet.length <= 300)
  }
})

// --- tool contract ------------------------------------------------------

test('every file tool declares risk and confirmation metadata', async () => {
  const { access } = await sandbox()
  const registry = toolRegistry(access)
  const expected = {
    'file.search': ['read', 'never'],
    'file.stat': ['read', 'never'],
    'file.readText': ['read', 'configurable'],
    'file.searchContent': ['read', 'configurable'],
    'file.reveal': ['safe-write', 'never'],
    'file.save': ['safe-write', 'configurable'],
    'file.delete': ['destructive', 'always']
  }
  for (const [id, [risk, confirmation]] of Object.entries(expected)) {
    const meta = registry.describe(id)
    assert.ok(meta, `${id} is not registered`)
    assert.equal(meta.risk, risk, `${id} risk`)
    assert.equal(meta.confirmation, confirmation, `${id} confirmation`)
  }
  assert.equal(registry.describe('file.readText').confirmationSetting, 'fileReadConfirm')
  assert.equal(registry.describe('file.save').confirmationSetting, 'fileWriteConfirm')
})

test('no file tool can write, move or delete', async () => {
  const { access, root } = await sandbox()
  const registry = toolRegistry(access)
  await assert.rejects(() => registry.execute('file.delete', { path: path.join(root, 'notes.txt') }), /disabled in MVP/)
  assert.equal(fs.existsSync(path.join(root, 'notes.txt')), true, 'a file was removed')
  // The module must not grow move/rename/delete without a fresh review.
  // file.save is the RATA-013 write verb; file.delete stays disabled.
  assert.deepEqual(
    [...fileModule.toolIds].sort(),
    ['file.delete', 'file.readText', 'file.reveal', 'file.save', 'file.search', 'file.searchContent', 'file.stat']
  )
})

test('malformed tool input fails closed before touching the disk', async () => {
  const { access } = await sandbox()
  const registry = toolRegistry(access)
  const bad = [
    ['file.search', {}],
    ['file.search', { query: '' }],
    ['file.search', { query: 'a', limit: 0 }],
    ['file.search', { query: 'a', limit: 5000 }],
    ['file.search', { query: 'a', limit: 1.5 }],
    ['file.readText', {}],
    ['file.readText', { path: '' }],
    ['file.readText', { path: 'a\0b' }],
    ['file.stat', { path: null }],
    ['file.reveal', { path: undefined }],
    ['file.searchContent', { query: ['a'] }]
  ]
  for (const [id, input] of bad) {
    await assert.rejects(() => registry.execute(id, input), `${id} accepted ${JSON.stringify(input)}`)
  }
})

test('reading a file through the registry requires approval by default', async () => {
  const { access, root } = await sandbox()
  const registry = toolRegistry(access)
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    // fileReadConfirm absent entirely: the policy must still confirm.
    settings: () => ({}),
    activity: () => {}
  })
  const reply = await agent.runTool('file.readText', { path: path.join(root, 'notes.txt') }, 'Read a file')
  assert.equal(reply.state, 'awaiting_approval')
  assert.match(reply.approval.detail, /sent to your AI provider/)
})

test('the approval card names the file without dumping its contents', async () => {
  const { access, root } = await sandbox()
  const registry = toolRegistry(access)
  const detail = registry.preview('file.readText', { path: path.join(root, 'notes.txt') })
  assert.match(detail, /notes\.txt/)
  assert.doesNotMatch(detail, /hunter2/, 'the approval card leaked file contents')
})

test('read content is labelled untrusted so it is fenced before reaching a provider', async () => {
  const { access, root } = await sandbox()
  const registry = toolRegistry(access)
  const result = await registry.execute('file.readText', { path: path.join(root, 'notes.txt') })
  assert.equal(result.trust, 'untrusted-external')
  assert.match(result.content, /hunter2/)
})

test('reveal is resolved through the same gate as a read', async () => {
  const { access, outside, root } = await sandbox()
  const revealed = []
  const registry = toolRegistry(access, revealed)
  await assert.rejects(() => registry.execute('file.reveal', { path: path.join(outside, 'secret.txt') }))
  assert.equal(revealed.length, 0, 'Explorer was pointed outside the allowed roots')

  await registry.execute('file.reveal', { path: path.join(root, 'notes.txt') })
  assert.equal(revealed.length, 1)
  assert.equal(path.basename(revealed[0]), 'notes.txt')
})

test('tools register and fail at execute when file access is unconfigured', async () => {
  const registry = new ToolRegistry()
  for (const definition of fileModule.create()) registry.register(definition)
  assert.ok(registry.describe('file.search'), 'file.search should still register')
  await assert.rejects(() => registry.execute('file.search', { query: 'anything' }), /not configured/)
})
