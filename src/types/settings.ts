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
}
