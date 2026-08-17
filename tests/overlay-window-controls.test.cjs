const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const overlay = fs.readFileSync(path.join(root, 'src', 'views', 'Overlay.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'src', 'styles', 'overlay.css'), 'utf8')
const main = fs.readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8')
const windowsIpc = fs.readFileSync(path.join(root, 'electron', 'ipc', 'windows.cjs'), 'utf8')

test('Ask bar places minimize and close after Open Control Center', () => {
  assert.match(
    overlay,
    /aria-label="Minimize Rata"[\s\S]*aria-label="Close Rata"/
  )
  const formStart = overlay.indexOf('className="quick-input no-drag"')
  assert.notEqual(formStart, -1)
  const form = overlay.slice(formStart)
  assert.match(form, /Open Control Center[\s\S]*\{windowControls\}/)
  assert.match(css, /\.quick-input\s*\{[^}]*grid-template-columns:\s*1fr 38px 38px 38px 38px 38px/)
})

test('Hide collapses the Ask bar including minimize and close', () => {
  assert.match(overlay, /expanded \? 'Hide' : 'Ask'/)
  assert.doesNotMatch(overlay, /overlay-window-controls/)
  assert.doesNotMatch(css, /\.overlay-window-controls/)
  const formStart = overlay.indexOf('className="quick-input no-drag"')
  const beforeForm = overlay.slice(0, formStart)
  const form = overlay.slice(formStart)
  assert.equal((beforeForm.match(/\{windowControls\}/g) || []).length, 0)
  assert.equal((form.match(/\{windowControls\}/g) || []).length, 1)
  assert.match(overlay, /expanded && \(/)
})

test('minimize collapses to a small draggable icon that can restore', () => {
  assert.match(overlay, /overlay-root--compact/)
  assert.match(overlay, /aria-label="Restore Rata"/)
  assert.match(overlay, /size="small"/)
  assert.match(css, /\.overlay-root--compact \.drag-zone\s*\{[^}]*flex:\s*0\s+0\s+auto/)
  assert.match(css, /\.overlay-root--compact \.drag-zone\s*\{[^}]*-webkit-app-region:\s*drag/)
  assert.match(css, /\.rata-stack--compact\s*\{[^}]*-webkit-app-region:\s*drag/)
  assert.match(css, /\.rata-stack\s*\{[^}]*-webkit-app-region:\s*drag/)
  assert.match(overlay, /className="rata-restore no-drag"/)
  assert.match(css, /\.rata-restore \.rata-character[\s\S]*pointer-events:\s*none/)
})

test('close hides the overlay and keeps the process in the tray', () => {
  assert.match(overlay, /window\.rata\.hideOverlay\(\)/)
  assert.equal((overlay.match(/hideOverlay\(\)/g) || []).length, 1)
  assert.doesNotMatch(overlay, /window\.close\(/)
  assert.doesNotMatch(overlay, /app\.quit/)
  assert.match(windowsIpc, /getOverlayWindow\(\)\?\.hide\(\)/)
  assert.doesNotMatch(windowsIpc, /app\.quit/)
  assert.match(main, /skipTaskbar:\s*true/)
  assert.match(main, /label: 'Show Rata'/)
  assert.match(main, /label: 'Hide Rata'/)
  // Was pinned as `overlayWindow?.show()`, which is the FIX-003 bug: once the
  // overlay has been closed the reference is undefined and the optional chain
  // silently does nothing. Since this feature is what lets the user reach that
  // state from the tray, the click must go through the lifecycle service that
  // recreates a missing overlay.
  assert.match(main, /tray\.on\('click',\s*\(\) => showOverlay\(\)\)/)
  assert.doesNotMatch(main, /tray\.on\('click',\s*\(\) => overlayWindow\?\.show\(\)\)/)
  assert.match(main, /window-all-closed[\s\S]*preventDefault/)
  assert.match(main, /setSkipTaskbar\(true\)/)
})
