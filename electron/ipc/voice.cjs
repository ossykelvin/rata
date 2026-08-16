module.exports = {
  id: 'voice',
  channels: ['startVoiceListening', 'stopVoiceListening'],
  register({ handle, services }) {
    handle('startVoiceListening', () => {
      const settings = services.getStore().getSettings()
      if (settings.microphoneEnabled !== true) {
        throw new Error('Microphone is disabled.')
      }
      return services.getVoice().start()
    })
    handle('stopVoiceListening', () => services.getVoice().stop())
  }
}
