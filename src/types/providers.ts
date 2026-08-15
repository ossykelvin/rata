/** Provider status. Booleans and labels only — never a credential. */
export type ProviderSummary = {
  id: string
  label: string
  model: string
  configured: boolean
}

export type ProvidersSnapshot = {
  mode: string
  providers: ProviderSummary[]
  searchConfigured: boolean
}
