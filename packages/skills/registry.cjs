'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { toPublicSkill, validateManifest, validatePackMetadata, validateSkillFragment } = require('./contracts.cjs')

function resolveUnder(rootDir, relativePath) {
  const root = path.resolve(rootDir)
  const resolved = path.resolve(root, relativePath)
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  if (resolved !== root && !resolved.startsWith(prefix)) throw new TypeError('Skill path escaped the project root.')
  return resolved
}

function readJsonFile(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new TypeError(`${label} could not be read: ${error.message}`, { cause: error })
  }
}

function assertPromptExists(rootDir, skill) {
  const skillFile = resolveUnder(rootDir, skill.path)
  if (!fs.existsSync(skillFile)) throw new TypeError(`Skill file missing for ${skill.id}: ${skill.path}`)
}

// Legacy aggregate loader retained for compatibility only. The production
// registry uses loadSkillFragments().
function loadManifestFile(rootDir, manifestPath) {
  const file = resolveUnder(rootDir, manifestPath)
  const manifest = validateManifest(readJsonFile(file, 'Skill manifest'))
  for (const skill of manifest.skills) assertPromptExists(rootDir, skill)
  return manifest
}

function loadSkillFragments(rootDir, skillsPath = 'skills') {
  const skillsDirectory = resolveUnder(rootDir, skillsPath)
  let entries
  try {
    entries = fs.readdirSync(skillsDirectory, { withFileTypes: true })
  } catch (error) {
    throw new TypeError(`Skills directory could not be read: ${error.message}`, { cause: error })
  }

  const errors = []
  let pack = null
  const packFile = path.join(skillsDirectory, 'pack.json')
  try {
    pack = validatePackMetadata(readJsonFile(packFile, 'Skill pack metadata'))
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Skill pack metadata is invalid.')
  }

  const skills = []
  const ids = new Set()
  const directories = entries.filter(entry => entry.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))
  for (const directory of directories) {
    const relativeFragment = path.posix.join(skillsPath.replaceAll('\\', '/'), directory.name, 'skill.json')
    const fragmentFile = resolveUnder(rootDir, relativeFragment)
    try {
      if (!fs.existsSync(fragmentFile)) throw new TypeError('Skill fragment is missing.')
      const skill = validateSkillFragment(readJsonFile(fragmentFile, `Skill fragment ${directory.name}`), directory.name)
      assertPromptExists(rootDir, skill)
      if (ids.has(skill.id)) throw new TypeError(`Duplicate skill id: ${skill.id}`)
      ids.add(skill.id)
      skills.push(skill)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Skill fragment is invalid.'
      errors.push(`${relativeFragment}: ${message}`)
    }
  }

  skills.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
  if (skills.length === 0) errors.push('No valid skill fragments were found.')
  return Object.freeze({ pack, skills: Object.freeze(skills), errors: Object.freeze(errors) })
}

function createSkillRegistry(options = {}) {
  const { rootDir, skillsPath = 'skills', manifestPath, toolRegistry = null } = options
  if (typeof rootDir !== 'string' || !rootDir) throw new TypeError('Skill registry requires rootDir.')

  let pack = null
  let loadedSkills = []
  let errors = []
  const explicitLegacyManifest = Object.hasOwn(options, 'manifestPath')
  const skillsDirectory = resolveUnder(rootDir, skillsPath)
  const legacyManifest = resolveUnder(rootDir, manifestPath || 'skills.manifest.json')
  const useLegacyManifest = explicitLegacyManifest || (!fs.existsSync(skillsDirectory) && fs.existsSync(legacyManifest))

  if (useLegacyManifest) {
    try {
      const manifest = loadManifestFile(rootDir, manifestPath || 'skills.manifest.json')
      pack = { pack: manifest.pack, version: manifest.version, description: manifest.description }
      loadedSkills = [...manifest.skills]
    } catch (error) {
      errors = [error instanceof Error ? error.message : 'Skill manifest is invalid.']
    }
  } else {
    try {
      const fragments = loadSkillFragments(rootDir, skillsPath)
      pack = fragments.pack
      loadedSkills = [...fragments.skills]
      errors = [...fragments.errors]
    } catch (error) {
      errors = [error instanceof Error ? error.message : 'Skill fragments could not be loaded.']
    }
  }

  const skills = new Map(loadedSkills.map(skill => [skill.id, skill]))
  const loadErrors = Object.freeze(errors)

  function list() {
    return [...skills.values()].map(skill => summarize(skill))
  }

  function get(id) {
    return skills.get(id) || null
  }

  function summarize(skill) {
    // Existence check only — the skill layer must never hold a tool executor.
    const availableTools = toolRegistry && typeof toolRegistry.has === 'function'
      ? skill.tools.filter(id => toolRegistry.has(id))
      : []
    const missingTools = skill.tools.filter(id => !availableTools.includes(id))
    return toPublicSkill(skill, { availableTools, missingTools })
  }

  return {
    pack: pack ? { name: pack.pack, version: pack.version, description: pack.description } : null,
    loadError: loadErrors.length ? loadErrors.join('\n') : null,
    loadErrors,
    loaded: skills.size > 0,
    rootDir: path.resolve(rootDir),
    get,
    list,
    summarize,
    count: () => skills.size
  }
}

module.exports = { createSkillRegistry, loadManifestFile, loadSkillFragments, resolveUnder }
