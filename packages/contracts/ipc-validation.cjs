const MAX_MESSAGE_LENGTH = 4_000
const MAX_PROVIDER_LENGTH = 64

// Null-prototype map on purpose. A plain object literal inherits
// Object.prototype members, so a dynamic `settingValidators[key]` lookup
// resolves inherited functions for keys like `constructor` and `toString` and
// then calls them as if they were validators — which lets unknown settings
// through. See docs/reviews/REVIEW-001-mvp-security.md (H1).
const settingValidators = Object.assign(Object.create(null), {
  alwaysOnTop: value => typeof value === 'boolean',
  opacity: value => typeof value === 'number' && Number.isFinite(value) && value >= 0.55 && value <= 1,
  doNotDisturb: value => typeof value === 'boolean',
  voiceEnabled: value => typeof value === 'boolean',
  microphoneEnabled: value => typeof value === 'boolean',
  provider: value => typeof value === 'string' && /^[a-z0-9-]+$/i.test(value) && value.length <= MAX_PROVIDER_LENGTH,
  clipboardConfirm: value => typeof value === 'boolean'
})

/** The complete set of writable settings. Use this rather than `key in obj`. */
const SETTING_KEYS = Object.freeze(Object.keys(settingValidators))

function isKnownSetting(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(settingValidators, key)
}

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`)
  }
  return value
}

function validateSettingValue(key, value) {
  if (!isKnownSetting(key)) throw new TypeError(`Unknown setting: ${String(key)}`)
  if (!settingValidators[key](value)) throw new TypeError(`Invalid value for setting: ${key}`)
  return value
}

function parseSettingChange(payload) {
  const value = requireRecord(payload, 'Setting change')
  if (typeof value.key !== 'string') throw new TypeError('Setting key must be a string.')
  validateSettingValue(value.key, value.value)
  return { key: value.key, value: value.value }
}

function parseAgentMessage(payload) {
  const value = requireRecord(payload, 'Agent message')
  if (typeof value.message !== 'string') throw new TypeError('Agent message must be a string.')
  const message = value.message.trim()
  if (!message) throw new TypeError('Agent message cannot be empty.')
  if (message.length > MAX_MESSAGE_LENGTH) throw new TypeError(`Agent message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`)
  return { message }
}

function parseApprovalRequest(payload) {
  const value = requireRecord(payload, 'Approval request')
  if (typeof value.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)) {
    throw new TypeError('Approval id must be a valid UUID.')
  }
  return { id: value.id }
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  SETTING_KEYS,
  isKnownSetting,
  parseAgentMessage,
  parseApprovalRequest,
  parseSettingChange,
  validateSettingValue
}
