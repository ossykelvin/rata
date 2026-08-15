const test = require('node:test')
const assert = require('node:assert/strict')
const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { parseAgentMessage, parseApprovalRequest, parseSettingChange } = require('../packages/contracts/ipc-validation.cjs')
const { createMvpRegistry } = require('../electron/mvp-tools.cjs')

test('IPC setting validation rejects unknown keys and invalid values', () => {
  assert.deepEqual(parseSettingChange({ key: 'opacity', value: 0.75 }), { key: 'opacity', value: 0.75 })
  assert.throws(() => parseSettingChange({ key: 'opacity', value: 2 }), /Invalid value/)
  assert.throws(() => parseSettingChange({ key: 'adminMode', value: true }), /Unknown setting/)
})

test('IPC message and approval validation reject malformed payloads', () => {
  assert.deepEqual(parseAgentMessage({ message: '  hello  ' }), { message: 'hello' })
  assert.throws(() => parseAgentMessage({ message: '   ' }), /cannot be empty/)
  assert.throws(() => parseApprovalRequest({ id: 'not-an-id' }), /valid UUID/)
})

test('tool registry requires complete security metadata', () => {
  const registry = new ToolRegistry()
  assert.throws(() => registry.register({ id: 'unsafe.tool', execute: async () => {} }), /description/)
  assert.throws(() => registry.register({
    id: 'mail.send',
    description: 'Send mail.',
    risk: 'external-write',
    confirmation: 'never',
    validateInput: input => input,
    execute: async () => {}
  }), /cannot disable confirmation/)
})

test('MVP tools validate inputs before invoking native dependencies', async () => {
  const launches = []
  const clipboardWrites = []
  const registry = createMvpRegistry({
    spawnProcess: (...args) => {
      launches.push(args)
      return { unref() {} }
    },
    clipboardApi: { writeText: text => clipboardWrites.push(text) }
  })

  await registry.execute('system.openApp', { appName: 'notepad', ignored: true })
  assert.equal(launches[0][0], 'notepad.exe')
  await assert.rejects(() => registry.execute('system.openApp', { appName: 'powershell' }), /allow-list/)
  await assert.rejects(() => registry.execute('clipboard.write', { text: 42 }), /Clipboard text/)
  assert.deepEqual(clipboardWrites, [])
})
