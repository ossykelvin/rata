const { exposeRataBridge } = require('./bridge/compose.cjs')

function installRataPreload({ contextBridge, ipcRenderer, IPC, modules }) {
  return exposeRataBridge({ contextBridge, ipcRenderer, IPC, modules })
}

module.exports = { installRataPreload }
