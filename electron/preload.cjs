const { contextBridge, ipcRenderer } = require('electron')
const { IPC } = require('../packages/contracts/ipc-channels.cjs')
const { exposeRataBridge } = require('./bridge/index.cjs')

exposeRataBridge({ contextBridge, ipcRenderer, IPC })
