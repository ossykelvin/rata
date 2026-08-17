module.exports = {
  id: 'transcription',
  channels: ['transcribeAudio'],
  create({ invoke }) {
    return {
      // The renderer sends WAV bytes and receives text. It never learns where
      // the transcriber lives or how it is invoked.
      transcribeAudio: audio => invoke('transcribeAudio', { audio })
    }
  }
}
