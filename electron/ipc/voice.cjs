const { isMicrophoneEnabled } = require('../security.cjs')

module.exports = {
  id: 'voice',
  channels: ['startVoiceListening', 'stopVoiceListening'],
  register({ handle, services }) {
    handle('startVoiceListening', async () => {
      if (!isMicrophoneEnabled(services.getStore().getSettings())) {
        throw new Error('Microphone is disabled.')
      }
      // Rata must not talk over the user. Speech is cancelled before the
      // recognizer opens, not after, so the microphone never hears the
      // synthesizer. RATA-004.
      services.getSpeaker?.()?.cancel?.()
      const result = await services.getVoice().start()
      if (!isMicrophoneEnabled(services.getStore().getSettings())) {
        services.getVoice().stop()
        throw new Error('Microphone is disabled.')
      }
      return result
    })
    handle('stopVoiceListening', () => services.getVoice().stop())
  }
}
