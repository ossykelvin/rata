'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { createSkillRegistry } = require('../packages/skills/index.cjs')
const { createMvpRegistry } = require('../electron/tools/index.cjs')
const {
  AppCatalogError,
  catalogIdFor,
  createAppCatalog,
  createExecFileLauncher,
  createWindowsFocus,
  parseLnkTarget,
  parseProcessList,
  resolveWindowsScriptDir
} = require('../electron/app-catalog.cjs')
const appTools = require('../electron/tools/app.cjs')

const ROOT = path.join(__dirname, '..')
const MACHINE_ROOT = 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'
const USER_ROOT = 'C:\\Users\\rata\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs'

const NOTEPAD = 'C:\\Apps\\Notepad\\notepad.exe'
const CALC = 'C:\\Windows\\System32\\calc.exe'
const EXCEL = 'C:\\Program Files\\Microsoft Office\\Office16\\EXCEL.EXE'
const POWERSHELL = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const CMD = 'C:\\Windows\\System32\\cmd.exe'
const SETUP_EXE = 'C:\\Apps\\Product\\setup.exe'
const UNINSTALL_EXE = 'C:\\Apps\\Product\\uninstall.exe'
const REPAIR_EXE = 'C:\\Apps\\Product\\helper.exe'
const BAT = 'C:\\Apps\\tools\\run.bat'
const PS1 = 'C:\\Apps\\tools\\run.ps1'
const MSI = 'C:\\Apps\\tools\\setup.msi'
const MISSING = 'C:\\Apps\\gone\\missing.exe'
const SYMLINK_TARGET = 'C:\\Apps\\linked\\app.exe'

function norm(value) {
  return path.normalize(value).replace(/\//g, '\\')
}

function keyOf(value) {
  return norm(value).toLowerCase()
}

class MemDirent {
  constructor(name, kind) {
    this.name = name
    this._kind = kind
  }

  isFile() { return this._kind === 'file' }
  isDirectory() { return this._kind === 'dir' }
  isSymbolicLink() { return this._kind === 'symlink' || this._kind === 'junction' }
  isBlockDevice() { return false }
  isCharacterDevice() { return false }
  isFIFO() { return false }
  isSocket() { return false }
}

function createMemoryFs(spec) {
  const nodes = new Map()

  function ensureDir(dirPath) {
    const full = norm(dirPath)
    if (!nodes.has(keyOf(full))) {
      nodes.set(keyOf(full), { kind: 'dir', name: path.win32.basename(full), path: full })
    }
    const parent = path.win32.dirname(full)
    if (parent && parent !== full) ensureDir(parent)
  }

  function add(filePath, node) {
    const full = norm(filePath)
    ensureDir(path.win32.dirname(full))
    nodes.set(keyOf(full), { ...node, name: path.win32.basename(full), path: full })
  }

  for (const [filePath, node] of Object.entries(spec)) add(filePath, node)

  function get(filePath) {
    return nodes.get(keyOf(filePath))
  }

  function childrenOf(dirPath) {
    const dirKey = keyOf(dirPath)
    const prefix = dirKey.endsWith('\\') ? dirKey : `${dirKey}\\`
    const children = []
    for (const node of nodes.values()) {
      if (keyOf(path.win32.dirname(node.path)) === dirKey && keyOf(node.path) !== dirKey) {
        children.push(node)
      }
    }
    // Keep prefix referenced so a mistaken relative child cannot sneak in.
    return children.filter(node => keyOf(node.path).startsWith(prefix) || keyOf(node.path) === dirKey)
  }

  return {
    promises: {
      async readdir(directory, options) {
        const dir = get(directory)
        if (!dir || dir.kind !== 'dir') {
          const error = new Error('ENOENT')
          error.code = 'ENOENT'
          throw error
        }
        const children = childrenOf(directory).filter(node => keyOf(path.win32.dirname(node.path)) === keyOf(directory))
        if (options && options.withFileTypes) {
          return children.map(node => new MemDirent(node.name, node.kind))
        }
        return children.map(node => node.name)
      },
      async lstat(filePath) {
        const node = get(filePath)
        if (!node) {
          const error = new Error('ENOENT')
          error.code = 'ENOENT'
          throw error
        }
        return {
          isFile: () => node.kind === 'file',
          isDirectory: () => node.kind === 'dir',
          isSymbolicLink: () => node.kind === 'symlink' || node.kind === 'junction'
        }
      },
      async readFile() {
        throw new Error('Tests must inject resolveShortcut rather than reading .lnk bytes.')
      }
    },
    add,
    delete(filePath) { nodes.delete(keyOf(filePath)) },
    has(filePath) { return nodes.has(keyOf(filePath)) }
  }
}

function fixtureFiles() {
  return {
    [path.win32.join(MACHINE_ROOT, 'Accessories', 'Notepad.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Accessories', 'Calculator.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'System Tools.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Command Prompt.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Windows PowerShell.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Uninstall Product.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Repair Product.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Setup Wizard.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Product Installer.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Run Script.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Run PowerShell Script.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Install Package.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Missing App.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'Linked App.lnk')]: { kind: 'file' },
    [path.win32.join(MACHINE_ROOT, 'junction-folder')]: { kind: 'junction' },
    [path.win32.join(MACHINE_ROOT, 'symlink-shortcut.lnk')]: { kind: 'symlink' },
    [path.win32.join(USER_ROOT, 'Excel.lnk')]: { kind: 'file' },
    [NOTEPAD]: { kind: 'file' },
    [CALC]: { kind: 'file' },
    [EXCEL]: { kind: 'file' },
    [POWERSHELL]: { kind: 'file' },
    [CMD]: { kind: 'file' },
    [SETUP_EXE]: { kind: 'file' },
    [UNINSTALL_EXE]: { kind: 'file' },
    [REPAIR_EXE]: { kind: 'file' },
    [BAT]: { kind: 'file' },
    [PS1]: { kind: 'file' },
    [MSI]: { kind: 'file' },
    [SYMLINK_TARGET]: { kind: 'symlink' }
  }
}

function fixtureShortcuts() {
  return {
    [norm(path.win32.join(MACHINE_ROOT, 'Accessories', 'Notepad.lnk'))]: NOTEPAD,
    [norm(path.win32.join(MACHINE_ROOT, 'Accessories', 'Calculator.lnk'))]: CALC,
    [norm(path.win32.join(MACHINE_ROOT, 'System Tools.lnk'))]: POWERSHELL,
    [norm(path.win32.join(MACHINE_ROOT, 'Command Prompt.lnk'))]: CMD,
    [norm(path.win32.join(MACHINE_ROOT, 'Windows PowerShell.lnk'))]: POWERSHELL,
    [norm(path.win32.join(MACHINE_ROOT, 'Uninstall Product.lnk'))]: UNINSTALL_EXE,
    [norm(path.win32.join(MACHINE_ROOT, 'Repair Product.lnk'))]: REPAIR_EXE,
    [norm(path.win32.join(MACHINE_ROOT, 'Setup Wizard.lnk'))]: SETUP_EXE,
    [norm(path.win32.join(MACHINE_ROOT, 'Product Installer.lnk'))]: NOTEPAD,
    [norm(path.win32.join(MACHINE_ROOT, 'Run Script.lnk'))]: BAT,
    [norm(path.win32.join(MACHINE_ROOT, 'Run PowerShell Script.lnk'))]: PS1,
    [norm(path.win32.join(MACHINE_ROOT, 'Install Package.lnk'))]: MSI,
    [norm(path.win32.join(MACHINE_ROOT, 'Missing App.lnk'))]: MISSING,
    [norm(path.win32.join(MACHINE_ROOT, 'Linked App.lnk'))]: SYMLINK_TARGET,
    [norm(path.win32.join(USER_ROOT, 'Excel.lnk'))]: EXCEL
  }
}

function createFixtureCatalog(overrides = {}) {
  const files = fixtureFiles()
  const shortcuts = fixtureShortcuts()
  const fsApi = createMemoryFs(files)
  const resolveShortcut = async lnkPath => {
    const target = shortcuts[norm(lnkPath)]
    if (!target) throw new AppCatalogError('Shortcut is not a valid Windows link.', 'invalid-shortcut')
    return target
  }
  const catalog = createAppCatalog({
    roots: [MACHINE_ROOT, USER_ROOT],
    fsApi,
    resolveShortcut,
    ...overrides
  })
  return { catalog, fsApi, shortcuts, files }
}

function toolRegistry(catalog, { launches = [], focus = async () => ({ focused: false }) } = {}) {
  const launchApp = async (...args) => {
    launches.push(args)
  }
  return {
    launches,
    registry: createMvpRegistry({
      spawnProcess: () => ({ unref() {} }),
      clipboardApi: { writeText() {} },
      catalog,
      launchApp,
      focusApp: focus
    })
  }
}

function assertNoFilesystemPath(value, label) {
  const serialized = JSON.stringify(value)
  assert.equal(serialized.includes('\\\\'), false, `${label} leaked a backslash path: ${serialized}`)
  assert.equal(/[A-Za-z]:[\\/]/.test(serialized), false, `${label} leaked a drive path: ${serialized}`)
  assert.equal(serialized.toLowerCase().includes('.exe'), false, `${label} leaked an executable name: ${serialized}`)
  assert.equal(serialized.toLowerCase().includes('.lnk'), false, `${label} leaked a shortcut path: ${serialized}`)
  assert.equal(serialized.toLowerCase().includes('start menu'), false, `${label} leaked a Start Menu path: ${serialized}`)
}

test('app module declares the three launcher ids and is auto-discovered', () => {
  assert.equal(appTools.id, 'app')
  assert.deepEqual(appTools.toolIds, ['app.find', 'app.launch', 'app.focus'])
  const registry = createMvpRegistry({
    spawnProcess: () => ({ unref() {} }),
    clipboardApi: { writeText() {} }
  })
  assert.equal(registry.has('app.find'), true)
  assert.equal(registry.has('app.launch'), true)
  assert.equal(registry.has('app.focus'), true)
  assert.equal(registry.has('system.openApp'), true)
})

test('catalog over a fixture tree exposes exactly the allow-listed entries', async () => {
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const listed = catalog.list().slice().sort((left, right) => left.name.localeCompare(right.name))
  assert.deepEqual(listed.map(entry => entry.name), ['Calculator', 'Excel', 'Notepad'])
  for (const entry of listed) {
    assert.equal(Object.hasOwn(entry, 'target'), false, `${entry.name} exposed a target path`)
    assert.equal(catalog.getById(entry.id).target.toLowerCase().endsWith('.exe'), true)
  }
  assert.equal(catalog.getById(catalogIdFor(NOTEPAD)).name, 'Notepad')
  assert.equal(catalog.getById(catalogIdFor(CALC)).name, 'Calculator')
  assert.equal(catalog.getById(catalogIdFor(EXCEL)).name, 'Excel')
})

test('each rejection class is refused at catalog-build time', async () => {
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const names = catalog.list().map(entry => entry.name).sort()
  assert.equal(names.includes('Run Script'), false, '.bat target was catalogued')
  assert.equal(names.includes('Run PowerShell Script'), false, '.ps1 target was catalogued')
  assert.equal(names.includes('Install Package'), false, '.msi target was catalogued')
  assert.equal(names.includes('Uninstall Product'), false, 'uninstaller label was catalogued')
  assert.equal(names.includes('Repair Product'), false, 'repair label was catalogued')
  assert.equal(names.includes('Setup Wizard'), false, 'setup.exe was catalogued')
  assert.equal(names.includes('Product Installer'), false, 'installer label was catalogued')
  assert.equal(names.includes('Missing App'), false, 'missing target was catalogued')
  assert.equal(names.includes('Linked App'), false, 'symlinked target was catalogued')
  assert.equal(catalog.getById(catalogIdFor(BAT)), null)
  assert.equal(catalog.getById(catalogIdFor(PS1)), null)
  assert.equal(catalog.getById(catalogIdFor(MSI)), null)
  assert.equal(catalog.getById(catalogIdFor(MISSING)), null)
  assert.equal(catalog.getById(catalogIdFor(SYMLINK_TARGET)), null)
  assert.equal(catalog.getById(catalogIdFor(SETUP_EXE)), null)
  assert.equal(catalog.getById(catalogIdFor(UNINSTALL_EXE)), null)
})

test('powershell.exe and cmd.exe are not in the catalog and cannot be launched, including via an innocuous shortcut name', async () => {
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const powershellId = catalogIdFor(POWERSHELL)
  const cmdId = catalogIdFor(CMD)
  assert.equal(catalog.getById(powershellId), null, 'powershell.exe entered the catalog')
  assert.equal(catalog.getById(cmdId), null, 'cmd.exe entered the catalog')
  assert.equal(catalog.list().some(entry => entry.name === 'System Tools'), false, 'reviewer: asserted on the label, not the target')

  const launches = []
  const { registry } = toolRegistry(catalog, { launches })
  assert.throws(() => registry.validate('app.launch', { id: powershellId }), /catalog id|not available/)
  assert.throws(() => registry.validate('app.launch', { id: cmdId }), /catalog id|not available/)
  await assert.rejects(() => registry.execute('app.launch', { id: powershellId }), /catalog id|not available/)
  await assert.rejects(() => registry.execute('app.launch', { id: cmdId }), /catalog id|not available/)
  assert.deepEqual(launches, [])
})

test('a path where an id is expected is refused', async () => {
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const { registry, launches } = toolRegistry(catalog)
  const notepadId = catalogIdFor(NOTEPAD)
  const refused = [
    NOTEPAD,
    '\\\\server\\share\\evil.exe',
    '..\\..\\Windows\\System32\\cmd.exe',
    `${notepadId}\\..\\..\\Windows\\System32\\cmd.exe`,
    `${notepadId}/Windows/System32/cmd.exe`,
    { id: NOTEPAD },
    { id: notepadId, path: NOTEPAD },
    { id: notepadId, args: ['/c', 'whoami'] }
  ]
  for (const input of refused) {
    const payload = typeof input === 'string' ? { id: input } : input
    assert.throws(
      () => registry.validate('app.launch', payload),
      /catalog id|accepts only/,
      `accepted ${JSON.stringify(payload)}`
    )
    await assert.rejects(
      () => registry.execute('app.launch', payload),
      /catalog id|accepts only/
    )
  }
  assert.deepEqual(launches, [])
})

test('an id valid at validate time but gone at execute time is refused rather than launched', async () => {
  const { catalog, fsApi, shortcuts } = createFixtureCatalog()
  await catalog.refresh()
  const notepadLnk = norm(path.win32.join(MACHINE_ROOT, 'Accessories', 'Notepad.lnk'))
  const notepadId = catalogIdFor(NOTEPAD)
  const { registry, launches } = toolRegistry(catalog)
  const validated = registry.validate('app.launch', { id: notepadId })
  assert.deepEqual(validated, { id: notepadId })
  delete shortcuts[notepadLnk]
  fsApi.delete(notepadLnk)
  await catalog.refresh()
  await assert.rejects(() => registry.execute('app.launch', { id: notepadId }), /not available/)
  assert.deepEqual(launches, [])
})

test('app.find results contain no filesystem paths', async () => {
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const { registry } = toolRegistry(catalog)
  const result = await registry.execute('app.find', { query: 'note' })
  assert.equal(result.matches.length, 1)
  assert.equal(result.matches[0].name, 'Notepad')
  assert.equal(result.matches[0].id, catalogIdFor(NOTEPAD))
  assertNoFilesystemPath(result, 'app.find result')
  assertNoFilesystemPath(result.matches, 'app.find matches')
})

test('the injected launcher is called with the catalog target and no args', async () => {
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const launches = []
  const { registry } = toolRegistry(catalog, { launches })
  const notepadId = catalogIdFor(NOTEPAD)
  const result = await registry.execute('app.launch', { id: notepadId })
  assert.deepEqual(launches, [[NOTEPAD]])
  assert.equal(result.launched, true)
  assert.equal(result.name, 'Notepad')
  assertNoFilesystemPath(result, 'app.launch result')
  const preview = registry.preview('app.launch', { id: notepadId })
  assert.match(preview, /Notepad/)
  assert.match(preview, /notepad\.exe/i)
})

test('app.launch always confirms and uses safe-write rather than inventing local-write', async () => {
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const { registry } = toolRegistry(catalog)
  const meta = registry.describe('app.launch')
  assert.equal(meta.risk, 'safe-write')
  assert.equal(meta.confirmation, 'always')
  const policy = new PolicyEngine()
  const decision = policy.evaluate(meta, { id: catalogIdFor(NOTEPAD) }, { appFocusConfirm: false })
  assert.equal(decision.decision, 'confirm')
})

test('app.focus is configurable and does not launch a second instance', async () => {
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const launches = []
  const focusCalls = []
  const { registry } = toolRegistry(catalog, {
    launches,
    focus: async (...args) => {
      focusCalls.push(args)
      return { focused: false }
    }
  })
  const meta = registry.describe('app.focus')
  assert.equal(meta.risk, 'safe-write')
  assert.equal(meta.confirmation, 'configurable')
  assert.equal(meta.confirmationSetting, 'appFocusConfirm')
  const policy = new PolicyEngine()
  assert.equal(policy.evaluate(meta, { id: catalogIdFor(CALC) }, { appFocusConfirm: true }).decision, 'confirm')
  assert.equal(policy.evaluate(meta, { id: catalogIdFor(CALC) }, { appFocusConfirm: false }).decision, 'allow')
  const result = await registry.execute('app.focus', { id: catalogIdFor(CALC) })
  assert.equal(result.focused, false)
  assert.match(result.message, /did not start a second copy/)
  assert.deepEqual(launches, [])
  assert.deepEqual(focusCalls, [[CALC]])
  assertNoFilesystemPath(result, 'app.focus result')
})

test('app.focus reports success when the focuser finds a running instance', async () => {
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const { registry } = toolRegistry(catalog, {
    focus: async target => ({ focused: target === EXCEL })
  })
  const result = await registry.execute('app.focus', { id: catalogIdFor(EXCEL) })
  assert.equal(result.focused, true)
  assert.equal(result.name, 'Excel')
  assertNoFilesystemPath(result, 'app.focus success result')
})

test('system.openApp remains the notepad/calculator allow-list and is a different tool', async () => {
  const spawned = []
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const registry = createMvpRegistry({
    spawnProcess: exe => {
      spawned.push(exe)
      return { unref() {} }
    },
    clipboardApi: { writeText() {} },
    catalog
  })
  const opened = await registry.execute('system.openApp', { appName: 'notepad' })
  assert.match(opened.message, /Notepad/)
  assert.deepEqual(spawned, ['notepad.exe'])
  assert.throws(() => registry.validate('system.openApp', { appName: 'powershell' }), /allow-list/)
  assert.equal(registry.describe('app.launch').id, 'app.launch')
  assert.equal(registry.describe('system.openApp').id, 'system.openApp')
})

test('production execFile launcher never enables a shell and never passes args', async () => {
  const calls = []
  const launcher = createExecFileLauncher((file, args, options) => {
    calls.push({ file, args, options })
    return { unref() {}, once() {} }
  })
  await launcher(NOTEPAD)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].file, NOTEPAD)
  assert.deepEqual(calls[0].args, [])
  assert.equal(calls[0].options.shell, false)
})

test('shortcut parser reads a local LinkInfo path and refuses a buffer without one', () => {
  const header = Buffer.alloc(0x4C)
  header.writeUInt32LE(0x4C, 0)
  header.writeUInt32LE(0x00000002, 20)
  const ansi = Buffer.from(`${NOTEPAD}\0`, 'latin1')
  const headerSize = 0x1C
  const volumeIdSize = 16
  const localBasePathOffset = headerSize + volumeIdSize
  const suffixOffset = localBasePathOffset + ansi.length
  const infoSize = suffixOffset + 1
  const info = Buffer.alloc(infoSize)
  info.writeUInt32LE(infoSize, 0)
  info.writeUInt32LE(headerSize, 4)
  info.writeUInt32LE(1, 8)
  info.writeUInt32LE(headerSize, 12)
  info.writeUInt32LE(localBasePathOffset, 16)
  info.writeUInt32LE(0, 20)
  info.writeUInt32LE(suffixOffset, 24)
  info.writeUInt32LE(volumeIdSize, headerSize)
  ansi.copy(info, localBasePathOffset)
  assert.equal(parseLnkTarget(Buffer.concat([header, info])), NOTEPAD)
  assert.throws(() => parseLnkTarget(Buffer.alloc(10)), AppCatalogError)
  const noInfo = Buffer.alloc(0x4C)
  noInfo.writeUInt32LE(0x4C, 0)
  assert.throws(() => parseLnkTarget(noInfo), /no local target/)
})

test('process-list parser keeps pid and executable path and drops everything else', () => {
  const parsed = parseProcessList(JSON.stringify({
    ProcessId: 4242,
    ExecutablePath: NOTEPAD,
    CommandLine: 'notepad.exe C:\\secrets\\passwords.txt',
    MainWindowTitle: 'passwords.txt - Notepad'
  }))
  assert.deepEqual(parsed, [{ pid: 4242, executablePath: NOTEPAD }])
  assert.equal(parseProcessList('not-json').length, 0)
  assert.equal(parseProcessList(JSON.stringify({ ProcessId: 0, ExecutablePath: NOTEPAD })).length, 0)
})

test('catalog is built once: find does not rebuild from a mutated tree', async () => {
  const { catalog, fsApi, shortcuts } = createFixtureCatalog()
  await catalog.refresh()
  const excelLnk = norm(path.win32.join(USER_ROOT, 'Excel.lnk'))
  delete shortcuts[excelLnk]
  fsApi.delete(excelLnk)
  const listed = catalog.list().map(entry => entry.name).sort()
  assert.deepEqual(listed, ['Calculator', 'Excel', 'Notepad'])
  await catalog.refresh()
  assert.deepEqual(catalog.list().map(entry => entry.name).sort(), ['Calculator', 'Notepad'])
})

test('focus helper passes a validated PID as a separate argument to a fixed script', async () => {
  const calls = []
  const focusApp = createWindowsFocus({
    execFileFn: (file, args, options, callback) => {
      calls.push({ file, args, options })
      if (args.some(arg => String(arg).endsWith('list-process-executables.ps1'))) {
        callback(null, JSON.stringify({ ProcessId: 99, ExecutablePath: NOTEPAD }), '')
        return
      }
      callback(null, '', '')
    },
    scriptDir: path.join(ROOT, 'electron', 'windows'),
    env: { SystemRoot: 'C:\\Windows' }
  })
  const result = await focusApp(NOTEPAD)
  assert.equal(result.focused, true)
  for (const call of calls) {
    assert.equal(call.options.shell, false)
    assert.equal(call.args.includes('-Command'), false)
    assert.equal(call.args.includes('-EncodedCommand'), false)
  }
  const focusCall = calls.find(call => call.args.some(arg => String(arg).endsWith('focus-pid.ps1')))
  assert.ok(focusCall, 'focus script was not invoked')
  const pidIndex = focusCall.args.indexOf('-ProcessId')
  assert.equal(focusCall.args[pidIndex + 1], '99')
  assert.equal(focusCall.file.toLowerCase().endsWith('powershell.exe'), true)
})

test('packaged focus scripts resolve outside the asar archive', () => {
  const packaged = resolveWindowsScriptDir({ packaged: true, resourcesPath: 'C:\\app\\resources' })
  assert.equal(packaged, path.join('C:\\app\\resources', 'windows'))
  assert.equal(packaged.includes('app.asar'), false)
  const pkg = require('../package.json')
  const extra = pkg.build.extraResources || []
  for (const name of ['list-process-executables.ps1', 'focus-pid.ps1']) {
    const entry = extra.find(item => item.from && item.from.endsWith(name))
    assert.ok(entry, `${name} is not in build.extraResources`)
    assert.equal(entry.to, `windows/${name}`)
    assert.equal(require('node:fs').existsSync(path.join(ROOT, entry.from)), true)
  }
})

test('app-launcher reports ready against a composed production-style registry', async () => {
  const { catalog } = createFixtureCatalog()
  await catalog.refresh()
  const tools = createMvpRegistry({
    spawnProcess: () => ({ unref() {} }),
    clipboardApi: { writeText() {} },
    catalog,
    launchApp: async () => {},
    focusApp: async () => ({ focused: false })
  })
  const skills = createSkillRegistry({ rootDir: ROOT, toolRegistry: tools })
  const launcher = skills.list().find(skill => skill.id === 'app-launcher')
  assert.ok(launcher, 'app-launcher skill is missing')
  assert.equal(launcher.status, 'ready')
  assert.deepEqual(launcher.missingTools, [])
  assert.deepEqual(launcher.availableTools.slice().sort(), ['app.find', 'app.focus', 'app.launch'])
})
