const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// P0-4 split global.css into base.css + overlay.css + control.css. The drag
// rules live in overlay.css; the shared .no-drag rule lives in base.css.
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'overlay.css'), 'utf8')
  + fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'base.css'), 'utf8')
const overlay = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'Overlay.tsx'), 'utf8')
const bubble = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'SpeechBubble.tsx'), 'utf8')

test('overlay character is a native drag surface with a separate Ask control', () => {
  assert.match(css, /\.drag-zone\s*\{[^}]*-webkit-app-region:\s*drag/)
  assert.match(css, /\.rata-stack\s*\{[^}]*-webkit-app-region:\s*drag/)
  assert.match(css, /\.rata-button\s*\{[^}]*pointer-events:\s*none/)
  assert.match(overlay, /className="rata-ask no-drag"/)
  assert.match(overlay, /Open Rata input/)
  assert.doesNotMatch(overlay, /rata-button no-drag/)
})

test('message body, approvals, and input stay interactive', () => {
  assert.match(bubble, /<p className="no-drag">/)
  assert.match(css, /\.no-drag,\s*\.no-drag \*\s*\{[^}]*-webkit-app-region:\s*no-drag/)
  assert.match(overlay, /className="quick-input no-drag"/)
})
