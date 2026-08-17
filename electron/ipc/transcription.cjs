const { parseAudioForTranscription } = require('../../packages/contracts/ipc-validation.cjs')
const { isMicrophoneEnabled } = require('../security.cjs')

/**
 * Local transcription of a renderer recording. RATA-009.
 *
 * The microphone gate is re-checked here even though Chromium already refused
 * `getUserMedia` when the setting is off. A renderer could hold a recording
 * made while the setting was on and submit it after the user turned it off,
 * and `isMicrophoneEnabled()` is the single source of truth for that decision.
 */
module.exports = {
  id: 'transcription',
  channels: ['transcribeAudio'],
  register({ handle, services }) {
    handle('transcribeAudio', async (_event, payload) => {
      if (!isMicrophoneEnabled(services.getStore().getSettings())) {
        throw new Error('Microphone is disabled.')
      }
      const transcriber = services.getTranscriber?.()
      if (!transcriber?.available) {
        throw new Error('Local speech to text is not installed.')
      }
      const { audio } = parseAudioForTranscription(payload)
      const result = await transcriber.transcribe(Buffer.from(audio))
      // Only the text crosses back. Timings stay in the main process.
      return { transcript: result.transcript }
    })
  }
}
