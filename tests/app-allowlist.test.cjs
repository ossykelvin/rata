const test = require('node:test')
const assert = require('node:assert/strict')

const { APP_ALLOW_LIST, isAllowListedApp, createMvpRegistry } = require('../electron/mvp-tools.cjs')

// Regression cover for REVIEW-001 finding H2.
//
// The allow-list check was `!APP_ALLOW_LIST[value.appName]` against a plain
// object literal. Object.freeze does not prevent inheritance, so
// APP_ALLOW_LIST['constructor'] resolved to the Object function — truthy —
// and `appName: 'constructor'` passed the check for an application that is
// not allow-listed, then reached spawnProcess().
const INHERITED_KEYS = [
  'constructor',
  'toString',
  'valueOf',
  'toLocaleString',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  '__proto__'
]

function harness() {
  const spawned = []
  const registry = createMvpRegistry({
    spawnProcess: (exe, args, options) => {
      spawned.push({ exe, args, options })
      return { unref() {} }
    },
    clipboardApi: { writeText() {} }
  })
  return { registry, spawned }
}

test('the allow-list does not inherit from Object.prototype', () => {
  assert.equal(Object.getPrototypeOf(APP_ALLOW_LIST), null)
  for (const key of INHERITED_KEYS) {
    assert.equal(APP_ALLOW_LIST[key], undefined, `allow-list resolved inherited key: ${key}`)
  }
})

test('inherited prototype keys fail system.openApp validation', () => {
  const { registry } = harness()
  for (const key of INHERITED_KEYS) {
    assert.throws(
      () => registry.validate('system.openApp', { appName: key }),
      /not in the MVP allow-list/,
      `expected validation to reject inherited key: ${key}`
    )
  }
})

test('inherited prototype keys never reach the process spawner', async () => {
  const { registry, spawned } = harness()
  for (const key of INHERITED_KEYS) {
    await assert.rejects(
      () => registry.execute('system.openApp', { appName: key }),
      /not in the MVP allow-list/
    )
  }
  assert.deepEqual(spawned, [], 'spawnProcess was invoked for a non-allow-listed application')
})

test('non-string application names are rejected', () => {
  const { registry } = harness()
  for (const appName of [null, undefined, 42, {}, [], ['notepad']]) {
    assert.throws(() => registry.validate('system.openApp', { appName }), /not in the MVP allow-list/)
  }
  assert.equal(isAllowListedApp(undefined), false)
})

test('allow-listed applications still launch', async () => {
  const { registry, spawned } = harness()

  const notepad = await registry.execute('system.openApp', { appName: 'notepad' })
  assert.match(notepad.message, /Notepad/)

  const calculator = await registry.execute('system.openApp', { appName: 'calculator' })
  assert.match(calculator.message, /Calculator/)

  assert.deepEqual(spawned.map(call => call.exe), ['notepad.exe', 'calc.exe'])
  assert.equal(spawned.every(call => call.options.detached === true), true)
})

test('unknown applications are still rejected', () => {
  const { registry } = harness()
  assert.throws(() => registry.validate('system.openApp', { appName: 'cmd' }), /not in the MVP allow-list/)
  assert.throws(() => registry.validate('system.openApp', { appName: 'powershell.exe' }), /not in the MVP allow-list/)
})
