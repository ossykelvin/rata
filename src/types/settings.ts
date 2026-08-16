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
}
