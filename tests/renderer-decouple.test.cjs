const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')

test('renderer types live in per-domain modules behind a barrel', () => {
  assert.equal(fs.existsSync(path.join(root, 'src', 'types.ts')), false)
  const barrel = read('src/types/index.ts')
  assert.match(barrel, /export type \{ CharacterState \}/)
  assert.match(barrel, /export type \{ RataBridge \}/)
  assert.match(barrel, /export type \{ ControlPage \}/)
  assert.match(read('src/types/character.ts'), /export type CharacterState/)
  assert.match(read('src/types/bridge.ts'), /export type RataBridge/)
})

test('overlay and control styles are split out of the old global sheet', () => {
  assert.equal(fs.existsSync(path.join(root, 'src', 'styles', 'global.css')), false)
  assert.match(read('src/main.tsx'), /styles\/base\.css/)
  assert.match(read('src/main.tsx'), /styles\/overlay\.css/)
  assert.match(read('src/main.tsx'), /styles\/control\.css/)
  assert.match(read('src/styles/overlay.css'), /\.overlay-root/)
  assert.match(read('src/styles/control.css'), /\.control-root/)
})

test('Control Center pages self-register and Overlay uses the shared conversation hook', () => {
  assert.match(read('src/views/control/pages.ts'), /import\.meta\.glob/)
  assert.doesNotMatch(read('src/views/ControlCenter.tsx'), /page === 'dashboard'/)
  assert.doesNotMatch(read('src/views/control/model.ts'), /export const pages/)
  for (const file of [
    'DashboardPage.tsx',
    'ChatPage.tsx',
    'PermissionsPage.tsx',
    'SkillsPage.tsx',
    'ActivityPage.tsx',
    'AppearancePage.tsx',
    'IntegrationsPage.tsx',
    'DeveloperPage.tsx'
  ]) {
    assert.match(read(`src/views/control/${file}`), /export const controlPage/)
  }
  assert.match(read('src/views/Overlay.tsx'), /useAgentConversation/)
  assert.doesNotMatch(read('src/views/Overlay.tsx'), /window\.rata\.agentMessage/)
})
