'use strict'

const { createSkillRegistry } = require('./registry.cjs')
const { createSkillLoader, extractSystemPrompt } = require('./loader.cjs')
const { createSkillRouter } = require('./router.cjs')
const { validateManifest } = require('./contracts.cjs')

module.exports = {
  createSkillLoader,
  createSkillRegistry,
  createSkillRouter,
  extractSystemPrompt,
  validateManifest
}
