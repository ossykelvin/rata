const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { resolveScriptPath, isPackagedRuntime, SCRIPT_NAME } = require('../electron/voice-win.cjs')

const ROOT = path.join(__dirname, '..')
const pkg = require('../package.json')

// The recognizer script is spawned by powershell.exe, an external process with
// no asar awareness. When it lived inside app.asar the feature worked in dev
// and silently did nothing once installed, and no test could see the
// difference because CI never packages. These tests pin the packaging shape.

test('the script resolves next to the module in development', () => {
  const resolved = resolveScriptPath({ packaged: false })
  assert.equal(path.basename(resolved), SCRIPT_NAME)
  assert.equal(resolved.includes('app.asar'), false)
  assert.equal(fs.existsSync(resolved), true, 'the dev script is missing')
})

test('the script resolves to resources/ when packaged, never inside the archive', () => {
  const resolved = resolveScriptPath({ packaged: true, resourcesPath: 'C:\\app\\resources' })
  assert.equal(resolved, path.join('C:\\app\\resources', SCRIPT_NAME))
  assert.equal(resolved.includes('app.asar'), false, 'powershell cannot read inside an asar archive')
})

test('packaged runtime is detected from the asar path', () => {
  assert.equal(isPackagedRuntime(`C:\\app\\resources\\app.asar${path.sep}electron`), true)
  assert.equal(isPackagedRuntime('C:\\repo\\electron'), false)
})

test('the build copies the script out of the archive', () => {
  const extra = pkg.build.extraResources || []
  const entry = extra.find(item => item.from && item.from.endsWith(SCRIPT_NAME))
  assert.ok(entry, `${SCRIPT_NAME} is not in build.extraResources — it would ship only inside app.asar`)
  assert.equal(entry.to, SCRIPT_NAME, 'the script must land directly in resources/')
  assert.equal(fs.existsSync(path.join(ROOT, entry.from)), true, `missing ${entry.from}`)
})

test('the Windows icon is large enough for electron-builder', () => {
  // electron-builder refuses anything under 256x256, which broke pack:win.
  const icon = pkg.build.win && pkg.build.win.icon
  assert.ok(icon, 'no Windows icon configured')
  const file = path.join(ROOT, icon)
  assert.equal(fs.existsSync(file), true, `missing ${icon}`)
  const buffer = fs.readFileSync(file)
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  assert.ok(width >= 256 && height >= 256, `${icon} is ${width}x${height}, electron-builder needs at least 256x256`)
})

test('a failed character asset is reported, not silently swallowed', () => {
  // The silhouette is a good fallback but used to be the only signal, so a
  // dead dev server or a missing file looked like a design choice.
  const source = fs.readFileSync(path.join(ROOT, 'src', 'components', 'character', 'RataCharacter.tsx'), 'utf8')
  assert.match(source, /console\.warn/, 'nothing is logged when the artwork fails')
  assert.match(source, /character asset failed to load/)
  assert.match(source, /data-asset-failed/, 'the failing URL is not exposed for inspection')
  assert.match(source, /title=\{failureDetail\}/, 'the failure is not surfaced in the UI')
})
