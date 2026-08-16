'use strict'

const { createSkillRegistry } = require('./registry.cjs')
const { createSkillLoader, extractSystemPrompt, extractNamedPrompt } = require('./loader.cjs')
const { createSkillRouter } = require('./router.cjs')
const { validateManifest, validatePackMetadata, validateSkillFragment } = require('./contracts.cjs')

module.exports = {
  createSkillLoader,
  createSkillRegistry,
  createSkillRouter,
  extractSystemPrompt,
  extractNamedPrompt,
  validateManifest,
  validatePackMetadata,
  validateSkillFragment
}
