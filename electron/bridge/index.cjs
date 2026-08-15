const fs = require('node:fs')
const path = require('node:path')
const { composeBridge, exposeRataBridge, validateBridgeModule } = require('./compose.cjs')

function discoverBridgeModules(directory = __dirname) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.cjs') && entry.name !== 'index.cjs')
    .map(entry => path.join(directory, entry.name))
    .sort()
    .map(modulePath => require(modulePath))
}

function composeDiscoveredBridge(options) {
  return composeBridge({ ...options, modules: options.modules || discoverBridgeModules() })
}

function exposeDiscoveredRataBridge(options) {
  return exposeRataBridge({ ...options, modules: options.modules || discoverBridgeModules() })
}

module.exports = {
  composeBridge: composeDiscoveredBridge,
  discoverBridgeModules,
  exposeRataBridge: exposeDiscoveredRataBridge,
  validateBridgeModule
}
