'use strict'

const SKILL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SKILL_PATH = /^skills\/[a-z0-9-]+\/SKILL\.md$/
const TOOL_ID = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/
const PERMISSION_ID = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/
const CATEGORY = /^[a-z0-9-]+$/

const SKILL_RISKS = new Set([
  'none',
  'read-only',
  'external-read',
  'mixed-read',
  'screen-read',
  'local-state',
  'local-write',
  'file-write',
  'external-write'
])

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`)
  }
  return value
}

function requireStringArray(value, label, pattern, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) {
    throw new TypeError(`${label} must be a string array.`)
  }
  if (!allowEmpty && value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string array.`)
  }
  if (pattern && value.some(item => !pattern.test(item))) {
    throw new TypeError(`${label} contains an invalid identifier.`)
  }
  return [...value]
}

function definitionLabel(source) {
  return Number.isInteger(source) ? `Skill at index ${source}` : `Skill fragment ${String(source)}`
}

function validateSkillDefinition(raw, source = 0) {
  const label = definitionLabel(source)
  const value = requireRecord(raw, label)
  if (typeof value.id !== 'string' || !SKILL_ID.test(value.id)) {
    throw new TypeError(`${label} has an invalid id.`)
  }
  if (typeof value.name !== 'string' || !value.name.trim()) {
    throw new TypeError(`Skill ${value.id} must declare a name.`)
  }
  if (typeof value.path !== 'string' || !SKILL_PATH.test(value.path)) {
    throw new TypeError(`Skill ${value.id} path must stay under skills/<id>/SKILL.md.`)
  }
  if (!value.path.startsWith(`skills/${value.id}/`)) {
    throw new TypeError(`Skill ${value.id} path must match its id.`)
  }
  if (typeof value.category !== 'string' || !CATEGORY.test(value.category)) {
    throw new TypeError(`Skill ${value.id} has an invalid category.`)
  }
  if (!SKILL_RISKS.has(value.risk)) {
    throw new TypeError(`Skill ${value.id} has an invalid risk class.`)
  }
  if (typeof value.background_capable !== 'boolean') {
    throw new TypeError(`Skill ${value.id} must declare background_capable.`)
  }
  if (typeof value.confirmation !== 'string' || !value.confirmation.trim()) {
    throw new TypeError(`Skill ${value.id} must declare a confirmation policy.`)
  }
  if (Object.hasOwn(value, 'selectable') && typeof value.selectable !== 'boolean') {
    throw new TypeError(`Skill ${value.id} selectable must be a boolean.`)
  }

  const selectable = value.selectable !== false
  return Object.freeze({
    id: value.id,
    name: value.name.trim(),
    path: value.path,
    order: Number.isInteger(value.order) ? value.order : Number.isInteger(source) ? source : 0,
    category: value.category,
    risk: value.risk,
    backgroundCapable: value.background_capable,
    confirmation: value.confirmation.trim(),
    selectable,
    permissions: Object.freeze(requireStringArray(value.permissions, `Skill ${value.id} permissions`, PERMISSION_ID, { allowEmpty: !selectable })),
    tools: Object.freeze(requireStringArray(value.tools, `Skill ${value.id} tools`, TOOL_ID, { allowEmpty: !selectable })),
    triggers: Object.freeze(requireStringArray(value.triggers, `Skill ${value.id} triggers`, undefined, { allowEmpty: !selectable }))
  })
}

function validateSkillFragment(raw, expectedId) {
  const value = requireRecord(raw, `Skill fragment ${expectedId}`)
  if (value.schema_version !== 1) throw new TypeError(`Skill fragment ${expectedId} has an unsupported schema_version.`)
  if (!Number.isInteger(value.order) || value.order < 0) {
    throw new TypeError(`Skill fragment ${expectedId} must declare a non-negative order.`)
  }
  const skill = validateSkillDefinition(value, expectedId)
  if (skill.id !== expectedId) throw new TypeError(`Skill fragment ${expectedId} id must match its directory.`)
  return skill
}

function validatePackMetadata(raw) {
  const value = requireRecord(raw, 'Skill pack metadata')
  if (value.schema_version !== 1) throw new TypeError('Unsupported skill pack schema_version.')
  if (typeof value.pack !== 'string' || !value.pack.trim()) throw new TypeError('Skill pack must declare a name.')
  if (typeof value.version !== 'string' || !value.version.trim()) throw new TypeError('Skill pack must declare a version.')
  if (typeof value.description !== 'string') throw new TypeError('Skill pack description must be a string.')
  return Object.freeze({ pack: value.pack.trim(), version: value.version.trim(), description: value.description.trim() })
}

// Retained for compatibility with integrations that still validate a legacy
// aggregate. The production registry loads per-skill fragments.
function validateManifest(raw) {
  const value = requireRecord(raw, 'Skill manifest')
  if (value.schema_version !== 1) throw new TypeError('Unsupported skills manifest schema_version.')
  if (!Array.isArray(value.skills) || value.skills.length === 0) {
    throw new TypeError('Skill manifest must declare at least one skill.')
  }

  const skills = value.skills.map((skill, index) => validateSkillDefinition(skill, index))
  const ids = new Set()
  for (const skill of skills) {
    if (ids.has(skill.id)) throw new TypeError(`Duplicate skill id: ${skill.id}`)
    ids.add(skill.id)
  }

  return Object.freeze({
    schemaVersion: value.schema_version,
    pack: typeof value.pack === 'string' ? value.pack : 'unknown',
    version: typeof value.version === 'string' ? value.version : '0',
    description: typeof value.description === 'string' ? value.description : '',
    skills: Object.freeze(skills)
  })
}

/**
 * `unroutableTools` are registered and callable, but no user phrase reaches
 * them. The Skills page previously derived readiness from registration alone,
 * so nine skills showed "ready" while unable to perform their core function —
 * and with a provider connected the model answered instead, which is how "keep
 * my PC awake" came back as "I have kept your PC awake" with no blocker held.
 * Reported separately from `missingTools`: the tool exists, the sentence does
 * not reach it, and those are different problems with different fixes.
 */
function toPublicSkill(skill, { availableTools = [], missingTools = [], unroutableTools = [] } = {}) {
  const ready = missingTools.length === 0
  const partial = availableTools.length > 0 && missingTools.length > 0
  return {
    id: skill.id,
    name: skill.name,
    category: skill.category,
    risk: skill.risk,
    backgroundCapable: skill.backgroundCapable,
    confirmation: skill.confirmation,
    permissions: [...skill.permissions],
    tools: [...skill.tools],
    triggers: [...skill.triggers],
    selectable: skill.selectable !== false,
    availableTools,
    missingTools,
    unroutableTools,
    status: ready ? 'ready' : partial ? 'partial' : 'unavailable'
  }
}

module.exports = {
  SKILL_RISKS,
  toPublicSkill,
  validateManifest,
  validatePackMetadata,
  validateSkillDefinition,
  validateSkillFragment
}
