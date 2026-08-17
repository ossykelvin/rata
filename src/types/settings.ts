/** Provider ids accepted by the `provider` setting. Mirrors PROVIDER_IDS. */
export type ProviderId = 'mock' | 'gemini' | 'openrouter' | 'auto'

export type RataSettings = {
  alwaysOnTop: boolean
  opacity: number
  doNotDisturb: boolean
  voiceEnabled: boolean
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
}
