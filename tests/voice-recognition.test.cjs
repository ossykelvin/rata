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
  assert.match(hook, /await window\.rata\.startVoiceListening\(\)/)
  assert.match(hook, /try \{[\s\S]*await window\.rata\.startVoiceListening\(\)[\s\S]*\} catch \{/)
})

test('the voice hook hands the app a transcript, never raw audio', () => {
  // Was: the hook must not contain getUserMedia at all, because the Windows
  // recognizer captured audio in the main process and only text ever reached
  // the renderer.
  //
  // RATA-009 changes that deliberately. Local transcription needs a recording,
  // and Electron has no dependency-free way to capture a microphone in the
  // main process, which is why the PowerShell recognizer existed in the first
  // place. Capture now happens in the renderer through getUserMedia, which is
  // gated by decideRendererPermission() in electron/security.cjs -- the same
  // boundary, not a second one. A compromised renderer could call getUserMedia
  // regardless of what this hook contains, so the permission handler is what
  // protects the microphone, not the absence of the call.
  //
  // The property worth keeping is narrower and is what this asserts: audio
  // leaves the hook only through the declared transcription channel, and what
  // reaches the rest of the app is still a plain string.
  assert.match(hook, /createAudioRecorder/, 'recording should live in its own module')
  assert.match(hook, /window\.rata\.transcribeAudio\(audio\)/, 'audio must go through the declared channel')
  assert.doesNotMatch(hook, /MediaRecorder/, 'MediaRecorder produces WebM, not the PCM the transcriber needs')
  assert.match(hook, /onTranscript\(transcript\)/)
  assert.match(hook, /onTranscript\(text\)/)

  // Raw audio must not escape through any other renderer surface.
  const recorder = readFileSync(path.join(root, 'src', 'hooks', 'useAudioRecorder.ts'), 'utf8')
  assert.match(recorder, /getTracks\(\)\.forEach\(track => track\.stop\(\)\)/, 'the microphone must be released')
  assert.doesNotMatch(recorder, /fetch\(|XMLHttpRequest|WebSocket/, 'a recording must never leave over the network')
})

test('Control Center exposes the microphone setting that main enforces', () => {
  assert.match(permissions, /microphoneEnabled/)
  assert.match(main, /applySessionPermissionHandler\(session\.defaultSession/)
  assert.match(main, /createWindowsVoice/)
})
