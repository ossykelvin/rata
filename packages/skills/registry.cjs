'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { toPublicSkill, validateManifest } = require('./contracts.cjs')

function resolveUnder(rootDir, relativePath) {
  const root = path.resolve(rootDir)
  const resolved = path.resolve(root, relativePath)
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  if (resolved !== root && !resolved.startsWith(prefix)) {
    throw new TypeError('Skill path escaped the project root.')
  }
  return resolved
}

function loadManifestFile(rootDir, manifestPath) {
  const file = resolveUnder(rootDir, manifestPath)
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new TypeError(`Skill manifest could not be read: ${error.message}`)
  }
  const manifest = validateManifest(parsed)
  for (const skill of manifest.skills) {
    const skillFile = resolveUnder(rootDir, skill.path)
    if (!fs.existsSync(skillFile)) {
      throw new TypeError(`Skill file missing for ${skill.id}: ${skill.path}`)
    }
  }
  return manifest
}

function createSkillRegistry({ rootDir, manifestPath = 'skills.manifest.json', toolRegistry = null } = {}) {
  if (typeof rootDir !== 'string' || !rootDir) {
    throw new TypeError('Skill registry requires rootDir.')
  }

  let manifest = null
  let loadError = null
  try {
    manifest = loadManifestFile(rootDir, manifestPath)
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Skill manifest is invalid.'
  }

  const skills = manifest ? new Map(manifest.skills.map(skill => [skill.id, skill])) : new Map()

  function list() {
    return [...skills.values()].map(skill => summarize(skill))
  }

  function get(id) {
    return skills.get(id) || null
  }

  function summarize(skill) {
    const availableTools = toolRegistry && typeof toolRegistry.get === 'function'
      ? skill.tools.filter(id => Boolean(toolRegistry.get(id)))
      : []
    const missingTools = skill.tools.filter(id => !availableTools.includes(id))
    return toPublicSkill(skill, { availableTools, missingTools })
  }

  return {
    pack: manifest ? { name: manifest.pack, version: manifest.version, description: manifest.description } : null,
    loadError,
    loaded: Boolean(manifest),
    rootDir: path.resolve(rootDir),
    get,
    list,
    summarize,
    count: () => skills.size
  }
}

module.exports = { createSkillRegistry, loadManifestFile }
