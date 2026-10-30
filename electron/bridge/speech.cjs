module.exports = {
  id: 'speech',
  channels: ['speakText', 'cancelSpeech', 'speechCapabilities'],
  create({ invoke }) {
    return {
      speakText: text => invoke('speakText', { text }),
      cancelSpeech: () => invoke('cancelSpeech'),
      speechCapabilities: () => invoke('speechCapabilities')
    }
  }
}
