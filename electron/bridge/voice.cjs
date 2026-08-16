module.exports = {
  id: 'voice',
  channels: ['startVoiceListening', 'stopVoiceListening', 'voiceTranscript'],
  create({ invoke, subscribe }) {
    return {
      startVoiceListening: () => invoke('startVoiceListening'),
      stopVoiceListening: () => invoke('stopVoiceListening'),
      onVoiceTranscript: callback => subscribe('voiceTranscript', callback)
    }
  }
}
