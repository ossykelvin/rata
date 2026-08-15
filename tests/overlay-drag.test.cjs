const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'global.css'), 'utf8')
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
