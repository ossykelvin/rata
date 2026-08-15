const test = require('node:test')
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')

const {
  SETTING_KEYS,
  isKnownSetting,
  parseSettingChange,
  validateSettingValue
} = require('../packages/contracts/ipc-validation.cjs')
const { JsonStore } = require('../electron/store.cjs')

// Regression cover for REVIEW-001 finding H1.
//
// `settingValidators[key]` used to be a lookup on a plain object literal, so
// inherited Object.prototype members resolved to functions and were called as
// validators. `{ key: 'constructor' }` and `{ key: 'toString' }` passed
// validation and reached the persisted store.
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

function freshStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rata-settings-test-'))
  return new JsonStore({ getPath: () => dir })
}

test('inherited prototype keys are rejected as settings', () => {
  for (const key of INHERITED_KEYS) {
    assert.throws(
      () => validateSettingValue(key, { polluted: true }),
      /Unknown setting/,
      `expected validateSettingValue to reject inherited key: ${key}`
    )
  }
})

test('parseSettingChange rejects inherited prototype keys', () => {
  for (const key of INHERITED_KEYS) {
    assert.throws(
      () => parseSettingChange({ key, value: { polluted: true } }),
      /Unknown setting/,
      `expected parseSettingChange to reject inherited key: ${key}`
    )
  }
})

test('the store refuses to persist an inherited prototype key', () => {
  const store = freshStore()
  for (const key of INHERITED_KEYS) {
    assert.throws(() => store.setSetting(key, { polluted: true }), /Unknown setting/)
  }
  const settings = store.getSettings()
  for (const key of INHERITED_KEYS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(settings, key),
      false,
      `settings gained an own property for ${key}`
    )
  }
})

test('isKnownSetting only accepts declared keys', () => {
  assert.equal(isKnownSetting('opacity'), true)
  assert.equal(isKnownSetting('constructor'), false)
  assert.equal(isKnownSetting('adminMode'), false)
  // Non-string keys must not reach a property lookup at all.
  for (const key of [null, undefined, 42, {}, []]) {
    assert.equal(isKnownSetting(key), false)
  }
})

test('declared settings still validate normally', () => {
  assert.deepEqual(parseSettingChange({ key: 'opacity', value: 0.75 }), { key: 'opacity', value: 0.75 })
  assert.throws(() => parseSettingChange({ key: 'opacity', value: 2 }), /Invalid value/)
  assert.throws(() => parseSettingChange({ key: 'adminMode', value: true }), /Unknown setting/)

  const store = freshStore()
  assert.equal(store.setSetting('clipboardConfirm', false).clipboardConfirm, false)
  assert.equal(store.setSetting('opacity', 0.8).opacity, 0.8)
})

test('SETTING_KEYS is the complete declared surface', () => {
  assert.ok(SETTING_KEYS.includes('clipboardConfirm'))
  assert.equal(SETTING_KEYS.includes('constructor'), false)
  assert.equal(Object.isFrozen(SETTING_KEYS), true)
  for (const key of SETTING_KEYS) assert.equal(isKnownSetting(key), true)
})
