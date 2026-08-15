/**
 * Rata shared contracts.
 *
 * This package is the single source of truth for:
 *   - risk / confirmation vocabularies used by the policy engine,
 *   - IPC channel names used by preload and main,
 *   - runtime validators for every privileged IPC payload and MVP tool input.
 *
 * It is intentionally dependency-free CommonJS so the Electron main process,
 * the preload script and `node --test` can all load it without a build step.
 * The matching renderer types live in `contracts.d.ts`.
 *
 * Rule: preload signatures and TypeScript types are developer ergonomics.
 * Validation here is the trust boundary.
 */

class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** Ordered from least to most authority. See docs/SECURITY.md. */
const RISK_LEVELS = Object.freeze(['read', 'safe-write', 'external-write', 'destructive'])

/**
 * never        - the policy engine may allow without asking.
 * configurable - a named boolean setting decides; missing setting means confirm.
 * always       - the user is asked every time.
 */
const CONFIRMATION_MODES = Object.freeze(['never', 'configurable', 'always'])

const AGENT_STATES = Object.freeze(['idle', 'listening', 'thinking', 'working', 'success', 'error'])

const ACTIVITY_STATUSES = Object.freeze(['info', 'success', 'warning', 'error'])

const IPC = Object.freeze({
  getSettings: 'rata:get-settings',
  setSetting: 'rata:set-setting',
  getActivity: 'rata:get-activity',
  agentMessage: 'rata:agent-message',
  approveAction: 'rata:approve-action',
  rejectAction: 'rata:reject-action',
  showControl: 'rata:show-control',
  showOverlay: 'rata:show-overlay',
  hideOverlay: 'rata:hide-overlay',
  testNotification: 'rata:test-notification',
  settingsChanged: 'rata:settings-changed',
  activity: 'rata:activity',
  overlayMessage: 'rata:overlay-message'
})

const LIMITS = Object.freeze({
  /** Longest user message accepted over IPC. Guards against renderer/model flooding. */
  messageLength: 2000,
  /** Longest text a single clipboard write may carry. */
  clipboardTextLength: 10000,
  /** Retained audit events. */
  activityHistory: 250,
  /** Approvals held in memory at once. */
  pendingApprovals: 20,
  /** How long an approval stays valid, in milliseconds. */
  pendingApprovalTtlMs: 5 * 60 * 1000
})

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

function requirePlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object.`)
  }
  return value
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') throw new ValidationError(`${label} must be true or false.`)
  return value
}

function requireString(value, label, { maxLength, minLength = 1 } = {}) {
  if (typeof value !== 'string') throw new ValidationError(`${label} must be a string.`)
  const trimmed = value.trim()
  if (trimmed.length < minLength) throw new ValidationError(`${label} must not be empty.`)
  if (maxLength && trimmed.length > maxLength) {
    throw new ValidationError(`${label} must be ${maxLength} characters or fewer.`)
  }
  return trimmed
}

function requireNumberInRange(value, label, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${label} must be a finite number.`)
  }
  if (value < min || value > max) throw new ValidationError(`${label} must be between ${min} and ${max}.`)
  return value
}

function requireEnum(value, label, allowed) {
  if (!allowed.includes(value)) throw new ValidationError(`${label} must be one of: ${allowed.join(', ')}.`)
  return value
}

/**
 * UUIDs are the only approval identifiers Rata issues. Rejecting anything else
 * keeps renderer-supplied strings away from map lookups and log lines.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireUuid(value, label) {
  const text = requireString(value, label, { maxLength: 64 })
  if (!UUID_PATTERN.test(text)) throw new ValidationError(`${label} is not a valid identifier.`)
  return text.toLowerCase()
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Every persisted setting declares its default and its validator. `store.cjs`
 * uses this to reject unknown keys and to repair a hand-edited store file.
 */
const SETTINGS_SCHEMA = Object.freeze({
  alwaysOnTop: { default: true, validate: value => requireBoolean(value, 'alwaysOnTop') },
  opacity: { default: 1, validate: value => requireNumberInRange(value, 'opacity', 0.55, 1) },
  doNotDisturb: { default: false, validate: value => requireBoolean(value, 'doNotDisturb') },
  voiceEnabled: { default: false, validate: value => requireBoolean(value, 'voiceEnabled') },
  microphoneEnabled: { default: true, validate: value => requireBoolean(value, 'microphoneEnabled') },
  provider: { default: 'mock', validate: value => requireEnum(value, 'provider', ['mock']) },
  clipboardConfirm: { default: true, validate: value => requireBoolean(value, 'clipboardConfirm') }
})

const SETTING_KEYS = Object.freeze(Object.keys(SETTINGS_SCHEMA))

function defaultSettings() {
  const settings = {}
  for (const [key, spec] of Object.entries(SETTINGS_SCHEMA)) settings[key] = spec.default
  return settings
}

/** Validates a single `{ key, value }` change arriving over IPC. */
function validateSettingChange(payload) {
  const { key, value } = requirePlainObject(payload, 'Setting payload')
  if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMA, key)) {
    throw new ValidationError('Unknown setting.')
  }
  return { key, value: SETTINGS_SCHEMA[key].validate(value) }
}

/**
 * Coerces an arbitrary object (e.g. a store file edited by hand) into a valid
 * settings object, discarding anything that fails validation.
 */
function coerceSettings(candidate) {
  const settings = defaultSettings()
  if (candidate === null || typeof candidate !== 'object') return settings
  for (const key of SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(candidate, key)) continue
    try {
      settings[key] = SETTINGS_SCHEMA[key].validate(candidate[key])
    } catch {
      // Keep the default for this key and carry on repairing the rest.
    }
  }
  return settings
}

// ---------------------------------------------------------------------------
// IPC payloads
// ---------------------------------------------------------------------------

function validateAgentMessage(payload) {
  const { message } = requirePlainObject(payload, 'Message payload')
  return requireString(message, 'Message', { maxLength: LIMITS.messageLength })
}

function validateApprovalRequest(payload) {
  const { id } = requirePlainObject(payload, 'Approval payload')
  return requireUuid(id, 'Approval id')
}

// ---------------------------------------------------------------------------
// MVP tool inputs
// ---------------------------------------------------------------------------

/** Apps Rata may launch in the MVP. Extending this list is a policy decision. */
const APP_ALLOW_LIST = Object.freeze({
  notepad: { executable: 'notepad.exe', label: 'Notepad' },
  calculator: { executable: 'calc.exe', label: 'Calculator' }
})

function validateOpenAppInput(input) {
  const { appName } = requirePlainObject(input, 'Open-app input')
  const name = requireString(appName, 'Application name', { maxLength: 64 }).toLowerCase()
  if (!Object.prototype.hasOwnProperty.call(APP_ALLOW_LIST, name)) {
    throw new ValidationError('Application is not in the MVP allow-list.')
  }
  return { appName: name }
}

function validateClipboardWriteInput(input) {
  const { text } = requirePlainObject(input, 'Clipboard input')
  return { text: requireString(text, 'Clipboard text', { maxLength: LIMITS.clipboardTextLength }) }
}

module.exports = {
  ValidationError,
  RISK_LEVELS,
  CONFIRMATION_MODES,
  AGENT_STATES,
  ACTIVITY_STATUSES,
  IPC,
  LIMITS,
  SETTINGS_SCHEMA,
  SETTING_KEYS,
  APP_ALLOW_LIST,
  defaultSettings,
  coerceSettings,
  validateSettingChange,
  validateAgentMessage,
  validateApprovalRequest,
  validateOpenAppInput,
  validateClipboardWriteInput,
  requirePlainObject,
  requireBoolean,
  requireString,
  requireNumberInRange,
  requireEnum,
  requireUuid
}
