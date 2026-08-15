const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const catalog = require('../src/components/character/states.json')
const REQUIRED = ['idle', 'listening', 'thinking', 'awaiting_approval', 'working', 'success', 'error', 'sleeping']
const ROOT = path.join(__dirname, '..')

function assetPath(entry) {
  if (entry.src) return path.join(ROOT, 'public', entry.src.replace(/^\.\//, ''))
  return path.join(ROOT, 'public', 'character', entry.file)
}

test('character catalog covers every RATA-003 presentation state', () => {
  for (const state of REQUIRED) {
    assert.ok(catalog[state], `missing catalog entry for ${state}`)
    assert.equal(typeof catalog[state].label, 'string')
    assert.ok(catalog[state].src || catalog[state].file, `missing asset for ${state}`)
  }
  assert.equal(catalog.typing.file, catalog.working.file)
})

test('idle uses rata-concept.png and other states use distinct files', () => {
  assert.equal(catalog.idle.src, './rata-concept.png')
  assert.equal(fs.existsSync(assetPath(catalog.idle)), true, 'missing public/rata-concept.png')
  const files = new Set()
  for (const state of REQUIRED) {
    if (state === 'idle') continue
    assert.equal(typeof catalog[state].file, 'string')
    files.add(catalog[state].file)
    assert.equal(fs.existsSync(assetPath(catalog[state])), true, `missing ${catalog[state].file}`)
  }
  assert.equal(files.size, REQUIRED.length - 1)
})

test('unknown states normalize to idle and typing aliases working', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'character', 'characterStates.ts'), 'utf8')
  for (const state of REQUIRED) {
    assert.match(source, new RegExp(`'${state}'`))
  }
  assert.match(source, /if \(state === 'typing'\) return 'working'/)
  assert.match(source, /return 'idle'/)
  assert.match(source, /resolveAssetSrc/)
})

test('character CSS defines a class for every runtime state', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'character.css'), 'utf8')
  assert.match(css, /\.rata-character\b/)
  assert.match(css, /\.rata-character-silhouette\b/)
  for (const state of REQUIRED) {
    if (state === 'idle') continue
    assert.match(css, new RegExp(`\\.rata-character-${state}\\b`))
  }
})
