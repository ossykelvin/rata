const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { createMvpRegistry } = require('../electron/tools/index.cjs')
const systemModule = require('../electron/tools/system.cjs')
const { createSkillRegistry } = require('../packages/skills/registry.cjs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const SECRET_COMMAND_LINE = 'secret.exe --token abc --path C:\\Users\\private\\notes.txt'
const SECRET_TITLE = 'Confidential Payroll Window'

function fakeOs(overrides = {}) {
  return {
    type: () => 'Windows_NT',
    platform: () => 'win32',
    release: () => '10.0.22631',
    version: () => 'Windows 11 Pro',
    arch: () => 'x64',
    totalmem: () => 16 * 1_048_576 * 1024,
    freemem: () => 8 * 1_048_576 * 1024,
    uptime: () => 3661.4,
    ...overrides
  }
}

function createClock({ now = 1_000_000 } = {}) {
  const timers = new Map()
  let nextId = 1
  let current = now
  return {
    now: () => current,
    setNow: value => { current = value },
    setTimer: (fn, ms) => {
      const id = nextId
      nextId += 1
      timers.set(id, { fn, due: current + ms })
      return id
    },
    clearTimer: id => { timers.delete(id) },
    fireDue() {
      for (const [id, timer] of timers) {
        if (timer.due <= current) {
          timers.delete(id)
          timer.fn()
        }
      }
    },
    onQuit: undefined
  }
}

function nativeDeps(overrides = {}) {
  const clock = overrides.clock || createClock()
  return {
    spawnProcess: () => ({ unref() {} }),
    osApi: fakeOs(),
    listStorage: async () => [{ mount: 'C:\\', totalBytes: 1_073_741_824, freeBytes: 536_870_912 }],
    listProcesses: async () => [
      {
        name: 'chrome.exe',
        memoryBytes: 400_000_000,
        commandLine: SECRET_COMMAND_LINE,
        args: ['--token', 'abc'],
        title: SECRET_TITLE
      },
      { name: 'rata.exe', memoryBytes: 80_000_000 }
    ],
    powerSaveBlocker: {
      nextId: 1,
      started: [],
      stopped: [],
      start(type) {
        const id = this.nextId
        this.nextId += 1
        this.started.push({ id, type })
        return id
      },
      stop(id) {
        this.stopped.push(id)
        return true
      }
    },
    clock,
    ...overrides
  }
}

function registryFrom(overrides = {}) {
  const deps = nativeDeps(overrides)
  const registry = new ToolRegistry()
  for (const definition of systemModule.create(deps)) registry.register(definition)
  return { registry, deps }
}

test('system module still owns openApp and the six status tools', () => {
  assert.deepEqual(systemModule.toolIds, [
    'system.openApp',
    'system.info',
    'system.storage',
    'system.processSummary',
    'system.keepAwake.start',
    'system.keepAwake.stop',
    'system.keepAwake.status'
  ])
})

test('missing native dependencies fail closed before any tool is created', () => {
  const spawnProcess = () => ({ unref() {} })
  assert.throws(() => systemModule.create({ spawnProcess }), /osApi dependency is required/)
  assert.throws(
    () => systemModule.create({ spawnProcess, osApi: fakeOs() }),
    /listStorage dependency is required/
  )
  assert.throws(
    () => systemModule.create({ spawnProcess, osApi: fakeOs(), listStorage: async () => [] }),
    /listProcesses dependency is required/
  )
  assert.throws(
    () => systemModule.create({
      spawnProcess,
      osApi: fakeOs(),
      listStorage: async () => [],
      listProcesses: async () => []
    }),
    /powerSaveBlocker dependency is required/
  )
})

test('read tools declare risk read and confirmation never', () => {
  const { registry } = registryFrom()
  for (const id of ['system.info', 'system.storage', 'system.processSummary', 'system.keepAwake.status']) {
    assert.deepEqual(
      { risk: registry.describe(id).risk, confirmation: registry.describe(id).confirmation },
      { risk: 'read', confirmation: 'never' },
      id
    )
    assert.equal(typeof registry.describe(id).execute, 'undefined')
  }
})

test('keepAwake start and stop declare safe-write and confirmation never', () => {
  const { registry } = registryFrom()
  for (const id of ['system.keepAwake.start', 'system.keepAwake.stop']) {
    assert.deepEqual(
      { risk: registry.describe(id).risk, confirmation: registry.describe(id).confirmation },
      { risk: 'safe-write', confirmation: 'never' },
      id
    )
  }
})

test('empty-input tools reject extra fields', async () => {
  const { registry } = registryFrom()
  for (const id of ['system.info', 'system.storage', 'system.processSummary', 'system.keepAwake.stop', 'system.keepAwake.status']) {
    await assert.rejects(() => registry.execute(id, { unexpected: true }), /does not accept input fields/)
  }
})

test('system.info returns os, memory and uptime from the injected osApi', async () => {
  const { registry } = registryFrom()
  const result = await registry.execute('system.info', {})
  assert.equal(result.info.os, 'Windows_NT')
  assert.equal(result.info.release, '10.0.22631')
  assert.equal(result.info.version, 'Windows 11 Pro')
  assert.equal(result.info.arch, 'x64')
  assert.equal(result.info.totalMemBytes, 16 * 1_048_576 * 1024)
  assert.equal(result.info.freeMemBytes, 8 * 1_048_576 * 1024)
  assert.equal(result.info.uptimeSeconds, 3661)
})

test('system.storage returns per-drive total, free and used bytes', async () => {
  const { registry } = registryFrom()
  const result = await registry.execute('system.storage', {})
  assert.equal(result.volumes.length, 1)
  assert.deepEqual(result.volumes[0], {
    mount: 'C:\\',
    totalBytes: 1_073_741_824,
    freeBytes: 536_870_912,
    usedBytes: 536_870_912
  })
})

test('system.processSummary never copies command lines, arguments or window titles', async () => {
  const { registry } = registryFrom()
  const result = await registry.execute('system.processSummary', {})
  assert.equal(result.processCount, 2)
  assert.equal(result.top.length, 2)
  assert.deepEqual(result.top[0], { name: 'chrome.exe', memoryBytes: 400_000_000 })
  const dumped = JSON.stringify(result)
  assert.equal(dumped.includes(SECRET_COMMAND_LINE), false)
  assert.equal(dumped.includes('--token'), false)
  assert.equal(dumped.includes('Confidential'), false)
  assert.equal(dumped.includes('commandLine'), false)
  assert.equal(dumped.includes('title'), false)
  assert.equal(dumped.includes(SECRET_TITLE), false)
})

test('system.processSummary caps the top list and coarsens names', async () => {
  const many = Array.from({ length: 12 }, (_, index) => ({
    name: index === 0 ? 'C:\\Windows\\system32\\cmd.exe /c whoami' : `proc${index}.exe extra-arg`,
    memoryBytes: (12 - index) * 1000,
    commandLine: SECRET_COMMAND_LINE
  }))
  const { registry } = registryFrom({ listProcesses: async () => many })
  const result = await registry.execute('system.processSummary', {})
  assert.equal(result.processCount, 12)
  assert.equal(result.top.length, systemModule.PROCESS_SUMMARY_LIMIT)
  assert.equal(result.top[0].name, 'cmd.exe')
  assert.equal(JSON.stringify(result).includes('whoami'), false)
  assert.equal(JSON.stringify(result).includes(SECRET_COMMAND_LINE), false)
})

test('keepAwake.start rejects malformed duration and extra fields', async () => {
  const { registry } = registryFrom()
  await assert.rejects(() => registry.execute('system.keepAwake.start', {}), /positive whole number/)
  await assert.rejects(() => registry.execute('system.keepAwake.start', { durationSeconds: 0 }), /positive whole number/)
  await assert.rejects(() => registry.execute('system.keepAwake.start', { durationSeconds: 1.5 }), /positive whole number/)
  await assert.rejects(() => registry.execute('system.keepAwake.start', { durationSeconds: 60, extra: true }), /extra fields/)
})

test('keepAwake.start caps duration at four hours', async () => {
  const { registry, deps } = registryFrom()
  const result = await registry.execute('system.keepAwake.start', { durationSeconds: systemModule.MAX_KEEP_AWAKE_SECONDS + 60 })
  assert.equal(result.durationSeconds, systemModule.MAX_KEEP_AWAKE_SECONDS)
  assert.equal(result.held, true)
  assert.equal(deps.powerSaveBlocker.started[0].type, 'prevent-display-sleep')
})

test('keepAwake.start twice stops the first blocker id', async () => {
  const { registry, deps } = registryFrom()
  await registry.execute('system.keepAwake.start', { durationSeconds: 60 })
  await registry.execute('system.keepAwake.start', { durationSeconds: 30 })
  assert.deepEqual(deps.powerSaveBlocker.started.map(entry => entry.id), [1, 2])
  assert.deepEqual(deps.powerSaveBlocker.stopped, [1])
  const status = await registry.execute('system.keepAwake.status', {})
  assert.equal(status.held, true)
  assert.equal(status.remainingSeconds, 30)
})

test('keepAwake.stop is safe when nothing is held', async () => {
  const { registry, deps } = registryFrom()
  const result = await registry.execute('system.keepAwake.stop', {})
  assert.equal(result.held, false)
  assert.equal(result.released, false)
  assert.deepEqual(deps.powerSaveBlocker.stopped, [])
})

test('keepAwake auto-releases when the injected timer fires', async () => {
  const clock = createClock()
  const { registry, deps } = registryFrom({ clock })
  await registry.execute('system.keepAwake.start', { durationSeconds: 10 })
  clock.setNow(clock.now() + 10_000)
  clock.fireDue()
  const status = await registry.execute('system.keepAwake.status', {})
  assert.equal(status.held, false)
  assert.equal(status.remainingSeconds, 0)
  assert.deepEqual(deps.powerSaveBlocker.stopped, [1])
})

test('keepAwake releases on app quit', async () => {
  let quit = null
  const clock = createClock()
  clock.onQuit = handler => { quit = handler }
  const { registry, deps } = registryFrom({ clock })
  await registry.execute('system.keepAwake.start', { durationSeconds: 120 })
  assert.equal(typeof quit, 'function')
  quit()
  const status = await registry.execute('system.keepAwake.status', {})
  assert.equal(status.held, false)
  assert.deepEqual(deps.powerSaveBlocker.stopped, [1])
})

test('volume lister uses Node statfs and never interpolates input', () => {
  const seen = []
  const listStorage = systemModule.createWindowsVolumeLister(mount => {
    seen.push(mount)
    if (mount !== 'C:\\') throw new Error('missing')
    return { bsize: 4096, blocks: 1000, bavail: 250, bfree: 250 }
  })
  const volumes = listStorage()
  assert.equal(seen[0], 'A:\\')
  assert.equal(seen.at(-1), 'Z:\\')
  assert.deepEqual(volumes, [{ mount: 'C:\\', totalBytes: 4_096_000, freeBytes: 1_024_000 }])
})

test('process lister uses a fixed tasklist argv and drops window titles', async () => {
  const calls = []
  const spawnProcess = (exe, args, options) => {
    calls.push({ exe, args, options })
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stdout.setEncoding = () => {}
    queueMicrotask(() => {
      child.stdout.emit('data', '"chrome.exe","12","Console","1","1,024 K"\r\n')
      child.emit('exit', 0)
    })
    return child
  }
  const processes = await systemModule.createWindowsProcessLister(spawnProcess)()
  assert.deepEqual(calls[0].exe, 'tasklist.exe')
  assert.deepEqual(calls[0].args, ['/FO', 'CSV', '/NH'])
  assert.equal(calls[0].args.includes('/V'), false)
  assert.deepEqual(processes, [{ name: 'chrome.exe', memoryBytes: 1_024 * 1024 }])
})

test('composed registry unblocks system-info and keep-awake skills', () => {
  const tools = createMvpRegistry({
    spawnProcess: () => ({ unref() {} }),
    clipboardApi: { writeText() {} },
    ...nativeDeps()
  })
  const skills = createSkillRegistry({ rootDir: ROOT, toolRegistry: tools })
  const wanted = Object.fromEntries(
    skills.list().filter(skill => skill.id === 'system-info' || skill.id === 'keep-awake').map(skill => [skill.id, skill.status])
  )
  assert.equal(wanted['system-info'], 'ready')
  assert.equal(wanted['keep-awake'], 'ready')
})
