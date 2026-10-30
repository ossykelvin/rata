const { parseSettingChange } = require('../../packages/contracts/ipc-validation.cjs')
const { isMicrophoneEnabled } = require('../security.cjs')

/** Settings that require the speech synthesizer to be rebuilt. RATA-004. */
const SPEECH_SETTINGS = new Set(['ttsProvider', 'speakReplies'])

module.exports = {
  id: 'settings',
  channels: ['getSettings', 'setSetting'],
  register({ handle, services }) {
    handle('getSettings', () => services.getStore().getSettings())
    handle('setSetting', (_event, payload) => {
      const { key, value } = parseSettingChange(payload)
      const settings = services.getStore().setSetting(key, value)
      if (key === 'alwaysOnTop') services.getOverlayWindow()?.setAlwaysOnTop(Boolean(value), 'floating')
      if (!isMicrophoneEnabled(settings)) services.getVoice?.()?.stop?.()
      // A speaker is configured at spawn time, so a speech setting change
      // replaces it. Turning speech off must also stop an utterance already in
      // flight: leaving Rata talking after the user switched it off is the same
      // class of defect as a recognizer that keeps listening. RATA-004.
      if (SPEECH_SETTINGS.has(key)) {
        services.getSpeaker?.()?.cancel?.()
        services.rebuildSpeaker?.(settings)
      }
      services.broadcastSettings(settings)
      services.logActivity('Setting changed', `${key} = ${String(value)}`, 'info')
      return settings
    })
  }
}
