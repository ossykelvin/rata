const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'overlay.css'), 'utf8')
const bubble = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'SpeechBubble.tsx'), 'utf8')

test('speech bubble keeps a fixed header and a scrollable body', () => {
  assert.match(bubble, /className="bubble-head"/)
  assert.match(bubble, /className="bubble-body"/)
  assert.match(css, /\.bubble-head\s*\{[^}]*flex:\s*0\s+0\s+auto/)
  assert.match(css, /\.bubble-body\s*\{[^}]*overflow-y:\s*auto/)
  assert.match(css, /\.speech-bubble\s*\{[^}]*max-height:/)
})

test('overlay long tokens wrap and the avatar/input stay in the viewport', () => {
  assert.match(css, /overflow-wrap:\s*anywhere/)
  assert.match(css, /word-break:\s*break-word/)
  assert.match(css, /\.overlay-root\s*\{[^}]*overflow:\s*hidden/)
  assert.match(css, /\.rata-button\s*\{[^}]*flex:\s*0\s+0\s+auto/)
  assert.match(css, /\.quick-input\s*\{[^}]*flex:\s*0\s+0\s+auto/)
})
