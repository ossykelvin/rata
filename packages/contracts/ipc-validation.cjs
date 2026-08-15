const MAX_MESSAGE_LENGTH = 4_000
const MAX_PROVIDER_LENGTH = 64

const settingValidators = {
  alwaysOnTop: value => typeof value === 'boolean',
  opacity: value => typeof value === 'number' && Number.isFinite(value) && value >= 0.55 && value <= 1,
  doNotDisturb: value => typeof value === 'boolean',
  voiceEnabled: value => typeof value === 'boolean',
  microphoneEnabled: value => typeof value === 'boolean',
  provider: value => typeof value === 'string' && /^[a-z0-9-]+$/i.test(value) && value.length <= MAX_PROVIDER_LENGTH,
  clipboardConfirm: value => typeof value === 'boolean'
}

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`)
  }
  return value
}

function validateSettingValue(key, value) {
  const validator = settingValidators[key]
  if (!validator) throw new TypeError(`Unknown setting: ${String(key)}`)
  if (!validator(value)) throw new TypeError(`Invalid value for setting: ${key}`)
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
  parseAgentMessage,
  parseApprovalRequest,
  parseSettingChange,
  validateSettingValue
}
