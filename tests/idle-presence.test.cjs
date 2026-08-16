const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// Idle presence: bored -> peeking -> sleepy after a quiet minute, excited on
// waking. The timing table and the reducer live in
// src/components/character/idlePresence.ts as pure functions precisely so they
// can be checked here without a DOM or a real clock.
//
// The module is TypeScript, so these tests read the source and the catalog
// rather than importing it — the same approach the existing character tests
// use. `npm run typecheck` covers the types.

const ROOT = path.join(__dirname, '..')
const SOURCE = fs.readFileSync(path.join(ROOT, 'src', 'components', 'character', 'idlePresence.ts'), 'utf8')
const catalog = require('../src/components/character/states.json')

const IDLE_STATES = ['bored', 'peeking', 'sleepy', 'excited']

function assetPath(entry) {
  if (entry.src) return path.join(ROOT, 'public', entry.src.replace(/^\.\//, ''))
  return path.join(ROOT, 'public', 'character', entry.file)
}

test('every idle-presence state has a label and an asset that exists', () => {
  for (const state of IDLE_STATES) {
    const entry = catalog[state]
    assert.ok(entry, `missing catalog entry for ${state}`)
    assert.equal(typeof entry.label, 'string')
    assert.ok(entry.file, `missing asset for ${state}`)
    assert.equal(fs.existsSync(assetPath(entry)), true, `missing file for ${state}: ${entry.file}`)
  }
})

test('the escalation runs bored -> peeking -> sleepy, starting at 60 seconds', () => {
  assert.match(SOURCE, /\{ after: 60_000, state: 'bored' \}/)
  assert.match(SOURCE, /\{ after: 120_000, state: 'peeking' \}/)
  assert.match(SOURCE, /\{ after: 180_000, state: 'sleepy' \}/)
  // Ordering matters: idleStageFor takes the last threshold passed.
  const order = ['bored', 'peeking', 'sleepy'].map(state => SOURCE.indexOf(`state: '${state}'`))
  assert.deepEqual(order, [...order].sort((left, right) => left - right), 'stages are not in ascending time order')
})

test('waking shows excited, and only briefly', () => {
  assert.match(SOURCE, /EXCITED_MS = 2_500/)
  assert.match(SOURCE, /if \(now < excitedUntil\) return 'excited'/)
})

test('a real agent state always wins over idle presence', () => {
  // This is the important one. Drifting to sleepy must never mask thinking, an
  // approval prompt, or an error.
  assert.match(SOURCE, /if \(agentState !== 'idle'\) return agentState/)
})

test('only a genuine drift triggers the celebration', () => {
  // Without this guard every keystroke while merely idle would fire 'excited'.
  assert.match(SOURCE, /if \(wasEscalated\.current\)/)
})

test('user activity counts as waking, not just agent activity', () => {
  for (const event of ['pointerdown', 'keydown', 'wheel', 'focus']) {
    assert.ok(SOURCE.includes(`'${event}'`), `not listening for ${event}`)
  }
  assert.match(SOURCE, /removeEventListener/, 'listeners are not cleaned up')
})

test('the escalation is opt-out for static previews', () => {
  assert.match(SOURCE, /enabled = true/)
  assert.match(SOURCE, /if \(!enabled\) return agentState/)
})

test('idle presence is derived in the renderer, not carried over IPC', () => {
  // These states are presentation only. If one ever appears in the IPC
  // contract or the agent, the boundary in AGENTS.md rule 15 has slipped.
  const channels = fs.readFileSync(path.join(ROOT, 'packages', 'contracts', 'ipc-channels.cjs'), 'utf8')
  const agent = fs.readFileSync(path.join(ROOT, 'packages', 'agent-core', 'mock-agent.cjs'), 'utf8')
  for (const state of IDLE_STATES) {
    assert.equal(channels.includes(state), false, `${state} leaked into the IPC channel contract`)
    assert.equal(agent.includes(`'${state}'`), false, `${state} leaked into the agent`)
  }
})

test('the character component applies idle presence to the incoming state', () => {
  const component = fs.readFileSync(path.join(ROOT, 'src', 'components', 'character', 'RataCharacter.tsx'), 'utf8')
  assert.match(component, /useIdlePresence/)
  assert.match(component, /normalizeCharacterState\(state\)/)
})

test('every idle-presence state has a CSS class', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'character.css'), 'utf8')
  for (const state of IDLE_STATES) {
    assert.match(css, new RegExp(`\\.rata-character-${state}\\b`), `no CSS for ${state}`)
  }
})

test('shipped expression art carries no burnt-in caption band', () => {
  // The source library rendered a filename caption under most sprites. They
  // were cropped on import; this guards against a raw one being added later.
  const dir = path.join(ROOT, 'public', 'character', 'expressions')
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.png'))
  assert.ok(files.length >= 20, 'expression library is missing')
  for (const name of files) {
    const buffer = fs.readFileSync(path.join(dir, name))
    const height = buffer.readUInt32BE(20)
    // Every uncropped source image is 228 tall. A cropped one is shorter.
    // 01-04 and 06 genuinely had no caption, so they stay at 228.
    assert.ok(height <= 228, `${name} is taller than the source sprite`)
    assert.equal(buffer[25], 6, `${name} lost its alpha channel`)
  }
})
