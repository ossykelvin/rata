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

function requireStringArray(value, label, pattern) {
  if (!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== 'string' || !item.trim())) {
    throw new TypeError(`${label} must be a non-empty string array.`)
  }
  if (pattern && value.some(item => !pattern.test(item))) {
    throw new TypeError(`${label} contains an invalid identifier.`)
  }
  return [...value]
}

function validateSkillDefinition(raw, index) {
  const value = requireRecord(raw, `Skill at index ${index}`)
  if (typeof value.id !== 'string' || !SKILL_ID.test(value.id)) {
    throw new TypeError(`Skill at index ${index} has an invalid id.`)
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

  return Object.freeze({
    id: value.id,
    name: value.name.trim(),
    path: value.path,
    category: value.category,
    risk: value.risk,
    backgroundCapable: value.background_capable,
    confirmation: value.confirmation.trim(),
    permissions: Object.freeze(requireStringArray(value.permissions, `Skill ${value.id} permissions`, PERMISSION_ID)),
    tools: Object.freeze(requireStringArray(value.tools, `Skill ${value.id} tools`, TOOL_ID)),
    triggers: Object.freeze(requireStringArray(value.triggers, `Skill ${value.id} triggers`))
  })
}

function validateManifest(raw) {
  const value = requireRecord(raw, 'Skill manifest')
  if (value.schema_version !== 1) {
    throw new TypeError('Unsupported skills manifest schema_version.')
  }
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

function toPublicSkill(skill, { availableTools = [], missingTools = [] } = {}) {
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
    availableTools,
    missingTools,
    status: ready ? 'ready' : partial ? 'partial' : 'unavailable'
  }
}

module.exports = {
  SKILL_RISKS,
  toPublicSkill,
  validateManifest,
  validateSkillDefinition
}
