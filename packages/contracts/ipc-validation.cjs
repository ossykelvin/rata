const MAX_MESSAGE_LENGTH = 4_000
const MAX_PROVIDER_LENGTH = 64

/**
 * Provider ids the `provider` setting may hold. Mirrors PROVIDER_IDS in
 * packages/agent-core/providers/index.cjs; duplicated rather than imported so
 * this contracts package stays dependency-free.
 */
const PROVIDER_IDS = Object.freeze(['mock', 'gemini', 'openrouter', 'auto'])

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
  // Constrained to known ids. An arbitrary slug was accepted before, which
  // meant the renderer could name a provider the runtime does not implement.
  provider: value => typeof value === 'string' && value.length <= MAX_PROVIDER_LENGTH && PROVIDER_IDS.includes(value),
  clipboardConfirm: value => typeof value === 'boolean',
  // Web search sends the query to a third party. Confirmed by default.
  webSearchConfirm: value => typeof value === 'boolean',
  // Fetching a page is a separate outbound action. Confirmed by default.
  webFetchConfirm: value => typeof value === 'boolean',
  // Local file *contents* flow onward to a provider, so reading one is an
  // egress decision like web.fetch rather than a plain local read. Confirmed
  // by default. RATA-006.
  fileReadConfirm: value => typeof value === 'boolean'
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
  PROVIDER_IDS,
  SETTING_KEYS,
  isKnownSetting,
  parseAgentMessage,
  parseApprovalRequest,
  parseSettingChange,
  validateSettingValue
}
