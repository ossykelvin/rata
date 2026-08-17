'use strict'

const fs = require('node:fs')
const path = require('node:path')

function extractNamedPrompt(markdown, heading) {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    throw new TypeError('Skill file is empty.')
  }
  if (typeof heading !== 'string' || !heading.trim()) {
    throw new TypeError('Prompt heading is required.')
  }
  const escaped = heading.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = markdown.match(new RegExp(`## ${escaped}\\s+\`\`\`text\\r?\\n([\\s\\S]*?)\`\`\``))
  if (!match || !match[1].trim()) {
    throw new TypeError(`Skill file is missing a ${heading.trim()} block.`)
  }
  return match[1].trim()
}

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

  function readSkillFile(skillId) {
    const skill = registry.get(skillId)
    if (!skill) throw new TypeError(`Unknown skill: ${skillId}`)
    const file = path.resolve(registry.rootDir, skill.path)
    return fs.readFileSync(file, 'utf8')
  }

  function loadPrompt(skillId) {
    return extractSystemPrompt(readSkillFile(skillId))
  }

  function loadNamedPrompt(skillId, heading) {
    return extractNamedPrompt(readSkillFile(skillId), heading)
  }

  return { extractSystemPrompt, extractNamedPrompt, loadPrompt, loadNamedPrompt }
}

module.exports = { createSkillLoader, extractSystemPrompt, extractNamedPrompt }
