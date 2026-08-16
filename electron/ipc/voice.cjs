const { isMicrophoneEnabled } = require('../security.cjs')

module.exports = {
  id: 'voice',
  channels: ['startVoiceListening', 'stopVoiceListening'],
  register({ handle, services }) {
    handle('startVoiceListening', async () => {
      if (!isMicrophoneEnabled(services.getStore().getSettings())) {
        throw new Error('Microphone is disabled.')
      }
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
