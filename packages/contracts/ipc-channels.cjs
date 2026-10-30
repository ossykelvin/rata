'use strict'

/** Named IPC channels shared by Electron main and preload. Never expose raw ipcRenderer. */
const IPC = Object.freeze({
  getSettings: 'rata:get-settings',
  setSetting: 'rata:set-setting',
  getActivity: 'rata:get-activity',
  getSkills: 'rata:get-skills',
  // Provider configuration status. Returns booleans and labels only — never a
  // credential. See ADR-006.
  getProviders: 'rata:get-providers',
  agentMessage: 'rata:agent-message',
  approveAction: 'rata:approve-action',
  rejectAction: 'rata:reject-action',
  showControl: 'rata:show-control',
  showOverlay: 'rata:show-overlay',
  hideOverlay: 'rata:hide-overlay',
  testNotification: 'rata:test-notification',
  settingsChanged: 'rata:settings-changed',
  activity: 'rata:activity',
  overlayMessage: 'rata:overlay-message',
  startVoiceListening: 'rata:voice-start',
  stopVoiceListening: 'rata:voice-stop',
  voiceTranscript: 'rata:voice-transcript',
  // Renderer-recorded audio transcribed locally by Handy. RATA-009.
  transcribeAudio: 'rata:transcribe-audio',
  // Spoken replies. RATA-004. `speechCapabilities` reports which speech-to-text
  // path the renderer should execute, so that choice stays in the main process.
  speakText: 'rata:speak-text',
  cancelSpeech: 'rata:cancel-speech',
  speechCapabilities: 'rata:speech-capabilities'
})

module.exports = { IPC }
