/** Provider ids accepted by the `provider` setting. Mirrors PROVIDER_IDS. */
export type ProviderId = 'mock' | 'gemini' | 'openrouter' | 'auto'

/** Mirrors STT_PROVIDER_IDS / TTS_PROVIDER_IDS in the contracts package. */
export type SttProviderId = 'auto' | 'local' | 'windows'
export type TtsProviderId = 'off' | 'windows'

/**
 * What the main process says Rata can actually do right now.
 *
 * `stt.mode` is the resolved decision, not the setting: a user who asked for
 * the local transcriber on a machine without it gets `none` plus a `reason`,
 * rather than a microphone button that silently does nothing.
 */
export type SpeechCapabilities = {
  stt: {
    mode: 'local' | 'windows' | 'none'
    requested: SttProviderId
    reason: string | null
    localAvailable: boolean
    windowsAvailable: boolean
  }
  tts: {
    provider: TtsProviderId
    speaking: boolean
  }
}

export type RataSettings = {
  alwaysOnTop: boolean
  opacity: number
  doNotDisturb: boolean
  microphoneEnabled: boolean
  provider: ProviderId
  clipboardConfirm: boolean
  /** Web search sends the query to a third party. Confirmed by default. */
  webSearchConfirm: boolean
  /** Fetching a public page is a separate outbound action. Confirmed by default. */
  webFetchConfirm: boolean
  /** File contents flow on to a provider, so reading one is an egress decision. Confirmed by default. */
  fileReadConfirm: boolean
  /** Saving a local file is a disk write. Confirmed by default. Overwrite always confirms. */
  fileWriteConfirm: boolean
  /** A weather lookup sends the named location to a third party. Confirmed by default. */
  weatherConfirm: boolean
  /**
   * Opt-in. When on, unmatched requests may be interpreted by a provider and
   * conversational replies may be rewritten. Off by default because both
   * stages send text off the machine.
   */
  communicatorEnabled: boolean
  /**
   * Master switch for capturing the screen and sending the image to a vision
   * provider. Off by default. Confirmation is always when this is on.
   */
  screenCaptureEnabled: boolean
  /**
   * Which speech-to-text path to use. `auto` prefers the local transcriber
   * when it is installed. The resolved mode comes from the main process via
   * `speechCapabilities()` — the renderer executes it, it does not choose it.
   */
  sttProvider: SttProviderId
  /** How Rata could speak. `off` by default, so a fresh install is silent. */
  ttsProvider: TtsProviderId
  /** Whether Rata should speak. Separate from `ttsProvider` on purpose. */
  speakReplies: boolean
  /** Bring a running catalogued app to the front. Confirmed by default. Launch always asks. */
  appFocusConfirm: boolean
}
