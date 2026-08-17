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

// --- RATA-010: expression coverage ---------------------------------------

test('every mapped state points at a distinct, existing expression', () => {
  const seen = new Map()
  for (const [state, entry] of Object.entries(catalog)) {
    assert.equal(fs.existsSync(assetPath(entry)), true, `${state} points at a missing asset`)
    // `typing` is a documented alias of `working`; nothing else may double up,
    // or two different situations show Rata wearing the same face.
    const key = entry.file || entry.src
    if (seen.has(key) && !(state === 'typing' || seen.get(key) === 'typing')) {
      assert.fail(`${state} reuses the asset already mapped to ${seen.get(key)}`)
    }
    seen.set(key, state)
  }
})

test('a refusal and a failure do not share a face', () => {
  assert.ok(catalog.blocked, 'no expression for a policy refusal')
  assert.notEqual(catalog.blocked.file, catalog.error.file)
  assert.ok(catalog.unavailable, 'no expression for a skill with unregistered tools')
  assert.notEqual(catalog.unavailable.file, catalog.error.file)
})

test('the idle drift ends asleep, so no mapped state is unreachable', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'components', 'character', 'idlePresence.ts'), 'utf8')
  // 'sleeping' shipped with artwork but nothing ever set it: the drift stopped
  // at 'sleepy'. An expression nothing can reach is dead weight.
  assert.match(source, /state: 'sleeping'/)
  for (const stage of ['bored', 'peeking', 'sleepy', 'sleeping']) {
    assert.match(source, new RegExp(`state: '${stage}'`), `${stage} is not in the drift`)
  }
})

test('the unmapped expressions are the ones with no trigger', () => {
  // Mapping an expression to a state nothing sets would be worse than leaving
  // it on disk: it looks wired up and never appears. This pins which assets
  // are deliberately unused, so adding a trigger later is a conscious change.
  const dir = path.join(ROOT, 'public', 'character', 'expressions')
  const onDisk = fs.readdirSync(dir).filter(name => name.endsWith('.png'))
  const mapped = new Set(
    Object.values(catalog)
      .map(entry => entry.file)
      .filter(Boolean)
      .map(file => path.basename(file))
  )
  const unmapped = onDisk.filter(name => !mapped.has(name)).sort()
  assert.deepEqual(unmapped, [
    '02_happy.png',
    '03_laughing.png',
    '06_surprised.png',
    '07_shocked.png',
    '14_worried.png',
    '15_sad.png',
    '16_angry.png',
    '17_embarrassed.png',
    '18_mischievous.png',
    '20_encouraging.png',
    '24_coffee_activated.png'
  ], 'the set of unused expressions changed; map it to a real trigger or update this list')
})
