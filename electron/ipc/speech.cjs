const { parseSpeakRequest } = require('../../packages/contracts/ipc-validation.cjs')
const { describeSpeechCapabilities } = require('../speech/index.cjs')

/**
 * Spoken replies and speech capability reporting. RATA-004.
 *
 * Why speaking is IPC and not a registered tool
 * ---------------------------------------------
 * ADR-002 puts authority in tools, not in the model, so a new capability
 * normally arrives as a tool with a risk level and a confirmation policy.
 * Speech is deliberately not one.
 *
 * A tool is something the model can decide to invoke. Here the model decides
 * nothing: the renderer speaks a reply the user is already reading on screen,
 * after it has been produced. There is no new authority to grant — no egress,
 * no filesystem, no process launch — and nothing a prompt-injected model could
 * reach that it has not already reached by producing the text. Registering it
 * as a tool would imply the model may choose to speak, which is the opposite of
 * the intended design.
 *
 * What is still enforced here is the *setting*. The renderer asking to speak is
 * not permission to speak: `ttsProvider` and `speakReplies` are re-checked in
 * the main process, the same way `microphoneEnabled` is, because a renderer
 * could hold a stale capability snapshot from before the user turned speech
 * off.
 */
module.exports = {
  id: 'speech',
  channels: ['speakText', 'cancelSpeech', 'speechCapabilities'],
  register({ handle, services }) {
    function speechEnabled(settings) {
      return settings.ttsProvider !== 'off' && settings.speakReplies === true
    }

    handle('speakText', (_event, payload) => {
      const settings = services.getStore().getSettings()
      if (!speechEnabled(settings)) {
        // Not an error: the user turned it off. Reporting it as a failure would
        // put a warning in the activity log every time Rata answered.
        return { ok: false, reason: 'Spoken replies are turned off.' }
      }
      const { text } = parseSpeakRequest(payload)
      const speaker = services.getSpeaker?.()
      if (!speaker) return { ok: false, reason: 'No speech synthesizer is configured.' }
      return speaker.speak(text)
    })

    // Always allowed, even when speech is off. Cancelling is how the user
    // stops Rata talking, so it must not depend on the setting that may have
    // just been switched off mid-utterance.
    handle('cancelSpeech', () => services.getSpeaker?.()?.cancel?.() || { ok: true, cancelled: false })

    handle('speechCapabilities', () => {
      const settings = services.getStore().getSettings()
      return describeSpeechCapabilities({
        settings,
        localAvailable: Boolean(services.getTranscriber?.()?.available),
        // The desktop recognizer ships with Windows. It is reported as present
        // rather than probed: probing costs a process spawn, and a failure to
        // start is already surfaced through the transcript error channel.
        windowsAvailable: true
      })
    })
  }
}
