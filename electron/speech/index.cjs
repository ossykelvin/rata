'use strict'

const { createWindowsSpeaker } = require('./tts-windows.cjs')

/**
 * Speech provider selection. RATA-004.
 *
 * Why this module exists
 * ----------------------
 * The STT choice used to live in the renderer: `useVoice` called the local
 * recorder, and if `getUserMedia` threw it fell back to the Windows
 * recognizer. That made provider policy a renderer concern, and the renderer
 * is not a boundary — the same reason `microphoneEnabled` is re-checked in the
 * main process rather than trusted from the UI. It also meant the choice could
 * not be configured, which RATA-004 requires, and that Handy's availability
 * was discovered by exception rather than asked for.
 *
 * Selection now happens here, from the stored setting plus what is actually
 * installed, and the renderer is told which mode to execute. The renderer still
 * does the recording, because only it has `getUserMedia` — but it no longer
 * decides.
 */

/** STT provider ids the `sttProvider` setting may hold. */
const STT_PROVIDERS = Object.freeze(['auto', 'local', 'windows'])
/** TTS provider ids the `ttsProvider` setting may hold. */
const TTS_PROVIDERS = Object.freeze(['off', 'windows'])

/**
 * Resolves which speech-to-text path the renderer should use.
 *
 * `auto` prefers the local transcriber because it keeps audio on the machine
 * and measured more accurately than the desktop recognizer, whose confidence
 * scores on this hardware ran 0.003–0.167 for ordinary speech.
 *
 * An explicit choice is honoured only while it is possible. Asking for a
 * provider that is not installed returns `none` with a reason rather than
 * silently substituting the other one: a user who selected Handy and is
 * quietly served the Windows recognizer has no way to tell why accuracy
 * changed.
 */
function resolveSttMode({ setting = 'auto', localAvailable = false, windowsAvailable = true } = {}) {
  const requested = STT_PROVIDERS.includes(setting) ? setting : 'auto'

  if (requested === 'local') {
    return localAvailable
      ? { mode: 'local', requested }
      : { mode: 'none', requested, reason: 'Local speech to text is not installed.' }
  }
  if (requested === 'windows') {
    return windowsAvailable
      ? { mode: 'windows', requested }
      : { mode: 'none', requested, reason: 'Windows speech recognition is not available.' }
  }
  if (localAvailable) return { mode: 'local', requested }
  if (windowsAvailable) return { mode: 'windows', requested }
  return { mode: 'none', requested, reason: 'No speech to text provider is available.' }
}

/**
 * A speaker that is always safe to call and never makes a sound.
 *
 * Used when TTS is off, which is the default. Having a real object rather than
 * a null means every caller can speak unconditionally, so "is TTS on?" is
 * answered in one place instead of at every call site.
 */
function createSilentSpeaker(reason = 'Spoken replies are turned off.') {
  return {
    id: 'off',
    available: false,
    speak: () => ({ ok: false, reason }),
    cancel: () => ({ ok: true, cancelled: false }),
    dispose: () => ({ ok: true }),
    warm: () => {},
    isSpeaking: () => false
  }
}

/**
 * Builds the speaker for the stored settings.
 *
 * `speakReplies` is a separate switch from `ttsProvider` on purpose: the
 * provider says *how* Rata could speak, the switch says whether it should.
 * Turning speech off must not discard a configured voice.
 */
function createSpeaker({ settings = {}, speakerFactories = {}, logActivity = () => {} } = {}) {
  const provider = TTS_PROVIDERS.includes(settings.ttsProvider) ? settings.ttsProvider : 'off'
  if (provider === 'off') return createSilentSpeaker()
  if (settings.speakReplies !== true) return createSilentSpeaker()

  const factory = speakerFactories[provider] || (provider === 'windows' ? createWindowsSpeaker : null)
  if (!factory) return createSilentSpeaker('That speech provider is not available.')

  try {
    return factory({ logActivity })
  } catch {
    // A synthesizer that cannot be constructed must not take the app down, and
    // must not look like silence-by-choice in the audit trail.
    logActivity('Text to speech', 'The speech synthesizer could not be created.', 'warning')
    return createSilentSpeaker('The speech synthesizer could not be created.')
  }
}

/**
 * The capability snapshot the renderer reads.
 *
 * Deliberately says what is *resolved*, not just what is configured, so the UI
 * can explain itself: "Local speech to text is not installed" is actionable,
 * and a microphone button that silently does nothing is not.
 */
function describeSpeechCapabilities({ settings = {}, localAvailable = false, windowsAvailable = true } = {}) {
  const stt = resolveSttMode({
    setting: settings.sttProvider,
    localAvailable,
    windowsAvailable
  })
  const ttsProvider = TTS_PROVIDERS.includes(settings.ttsProvider) ? settings.ttsProvider : 'off'
  return {
    stt: {
      mode: stt.mode,
      requested: stt.requested,
      reason: stt.reason || null,
      localAvailable,
      windowsAvailable
    },
    tts: {
      provider: ttsProvider,
      // Both must be true for Rata to speak, and the renderer should not have
      // to know that rule.
      speaking: ttsProvider !== 'off' && settings.speakReplies === true
    }
  }
}

module.exports = {
  STT_PROVIDERS,
  TTS_PROVIDERS,
  resolveSttMode,
  createSilentSpeaker,
  createSpeaker,
  describeSpeechCapabilities
}
