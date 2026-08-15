'use strict'

/**
 * Provider status for Control Center.
 *
 * Returns which providers exist, their labels and models, and whether each is
 * configured — a boolean. It must never return a credential, and there is a
 * regression test asserting exactly that (tests/provider-ipc.test.cjs).
 *
 * Read-only: switching provider goes through the existing `setSetting` channel
 * so it passes the same validation as every other setting.
 */
module.exports = {
  id: 'providers',
  channels: ['getProviders'],
  register({ handle, services }) {
    handle('getProviders', () => {
      const provider = services.getProvider?.()
      if (!provider || typeof provider.describe !== 'function') {
        return { mode: 'mock', providers: [], searchConfigured: false }
      }
      const described = provider.describe()
      return {
        mode: described.mode,
        providers: described.providers,
        // Whether web search has a key, so the UI can explain why the tool is
        // unavailable rather than failing at execution time.
        searchConfigured: Boolean(services.isSearchConfigured?.())
      }
    })
  }
}
