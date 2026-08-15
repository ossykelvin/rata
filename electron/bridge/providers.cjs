'use strict'

/**
 * Preload fragment for provider status. Discovered automatically by
 * esbuild.preload.cjs and bundled into the sandboxed preload.
 */
module.exports = {
  id: 'providers',
  channels: ['getProviders'],
  create({ invoke }) {
    return { getProviders: () => invoke('getProviders') }
  }
}
