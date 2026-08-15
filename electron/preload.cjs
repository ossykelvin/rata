const { contextBridge, ipcRenderer } = require('electron')
const { IPC } = require('../packages/contracts/ipc-channels.cjs')

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('rata', {
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  setSetting: (key, value) => ipcRenderer.invoke(IPC.setSetting, { key, value }),
  getActivity: () => ipcRenderer.invoke(IPC.getActivity),
  getSkills: () => ipcRenderer.invoke(IPC.getSkills),
  agentMessage: message => ipcRenderer.invoke(IPC.agentMessage, { message }),
  approveAction: id => ipcRenderer.invoke(IPC.approveAction, { id }),
  rejectAction: id => ipcRenderer.invoke(IPC.rejectAction, { id }),
  showControlCenter: () => ipcRenderer.invoke(IPC.showControl),
  showOverlay: () => ipcRenderer.invoke(IPC.showOverlay),
  hideOverlay: () => ipcRenderer.invoke(IPC.hideOverlay),
  testNotification: () => ipcRenderer.invoke(IPC.testNotification),
  onSettingsChanged: callback => subscribe(IPC.settingsChanged, callback),
  onActivity: callback => subscribe(IPC.activity, callback),
  onOverlayMessage: callback => subscribe(IPC.overlayMessage, callback)
})
