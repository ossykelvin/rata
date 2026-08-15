const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const catalog = require('../src/components/character/states.json')
const REQUIRED = ['idle', 'listening', 'thinking', 'awaiting_approval', 'working', 'success', 'error', 'sleeping']
const ROOT = path.join(__dirname, '..', 'public', 'character')
const CONCEPT = path.join(__dirname, '..', 'public', 'rata-concept.png')

function stateEntries() {
  return Object.entries(catalog).filter(([, entry]) => entry && typeof entry === 'object' && 'file' in entry)
}

test('character catalog covers every RATA-003 presentation state', () => {
  for (const state of REQUIRED) {
    assert.ok(catalog[state], `missing catalog entry for ${state}`)
    assert.equal(typeof catalog[state].file, 'string')
    assert.equal(typeof catalog[state].label, 'string')
  }
  assert.equal(catalog.typing.file, catalog.working.file)
})

test('temporary shared art is the original concept crop', () => {
  assert.equal(catalog.temporaryArt.src, './rata-concept.png')
  assert.equal(catalog.temporaryArt.crop, true)
  assert.equal(fs.existsSync(CONCEPT), true, 'missing public/rata-concept.png')
})

test('placeholder assets exist for every catalog file', () => {
  const files = new Set(stateEntries().map(([, entry]) => entry.file))
  for (const file of files) {
    const target = path.join(ROOT, file)
    assert.equal(fs.existsSync(target), true, `missing ${file}`)
    assert.match(fs.readFileSync(target, 'utf8'), /<svg/)
  }
})

test('unknown states normalize to idle and typing aliases working', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'character', 'characterStates.ts'), 'utf8')
  for (const state of REQUIRED) {
    assert.match(source, new RegExp(`'${state}'`))
  }
  assert.match(source, /if \(state === 'typing'\) return 'working'/)
  assert.match(source, /return 'idle'/)
  assert.match(source, /TEMPORARY_ART/)
})

test('character CSS defines a class for every runtime state and the concept crop', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'character.css'), 'utf8')
  assert.match(css, /\.rata-character\b/)
  assert.match(css, /\.rata-character-silhouette\b/)
  assert.match(css, /\.rata-character-crop\b/)
  assert.match(css, /670px/)
  assert.match(css, /translate\(-5px, -108px\)/)
  assert.match(css, /205px/)
  assert.match(css, /translate\(-2px, -34px\)/)
  for (const state of REQUIRED) {
    if (state === 'idle') continue
    assert.match(css, new RegExp(`\\.rata-character-${state}\\b`))
  }
})
