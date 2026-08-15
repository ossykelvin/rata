'use strict'

const fs = require('node:fs')
const path = require('node:path')

function extractSystemPrompt(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    throw new TypeError('Skill file is empty.')
  }
  const match = markdown.match(/## System prompt\s+```text\r?\n([\s\S]*?)```/)
  if (!match || !match[1].trim()) {
    throw new TypeError('Skill file is missing a system prompt block.')
  }
  return match[1].trim()
}

function createSkillLoader({ registry }) {
  if (!registry || typeof registry.get !== 'function') {
    throw new TypeError('Skill loader requires a registry.')
  }

  function loadPrompt(skillId) {
    const skill = registry.get(skillId)
    if (!skill) throw new TypeError(`Unknown skill: ${skillId}`)
    const file = path.resolve(registry.rootDir, skill.path)
    const markdown = fs.readFileSync(file, 'utf8')
    return extractSystemPrompt(markdown)
  }

  return { extractSystemPrompt, loadPrompt }
}

module.exports = { createSkillLoader, extractSystemPrompt }
