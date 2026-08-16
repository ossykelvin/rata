const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const overlay = readFileSync(path.join(root, 'src', 'views', 'Overlay.tsx'), 'utf8')
const chat = readFileSync(path.join(root, 'src', 'views', 'control', 'ChatPage.tsx'), 'utf8')
const hook = readFileSync(path.join(root, 'src', 'hooks', 'useVoice.ts'), 'utf8')
const button = readFileSync(path.join(root, 'src', 'components', 'VoiceMicButton.tsx'), 'utf8')
const permissions = readFileSync(path.join(root, 'src', 'views', 'control', 'PermissionsPage.tsx'), 'utf8')
const main = readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8')

test('overlay and chat use the shared voice hook instead of Chromium speech recognition', () => {
  assert.match(overlay, /useVoice/)
  assert.match(overlay, /VoiceMicButton/)
  assert.match(chat, /useVoice/)
  assert.match(chat, /VoiceMicButton/)
  assert.doesNotMatch(overlay, /webkitSpeechRecognition|SpeechRecognition/)
  assert.doesNotMatch(chat, /webkitSpeechRecognition|SpeechRecognition/)
  assert.doesNotMatch(hook, /webkitSpeechRecognition|SpeechRecognition/)
})

test('push-to-talk starts on press, stops on release, and can be cancelled', () => {
  assert.match(button, /voice\.press\(\)/)
  assert.match(button, /voice\.release\(\)/)
  assert.match(button, /voice\.cancel\(\)/)
  assert.match(button, /Escape/)
  assert.match(hook, /startVoiceListening/)
  assert.match(hook, /stopVoiceListening/)
})

test('the voice hook keeps only the transcript string', () => {
  assert.doesNotMatch(hook, /getUserMedia|MediaRecorder|audioChunks|audioBuffer/)
  assert.match(hook, /onTranscript\(transcript\)/)
})

test('Control Center exposes the microphone setting that main enforces', () => {
  assert.match(permissions, /microphoneEnabled/)
  assert.match(main, /applySessionPermissionHandler\(session\.defaultSession/)
  assert.match(main, /createWindowsVoice/)
})
