const { parseSettingChange } = require('../../packages/contracts/ipc-validation.cjs')
const { isMicrophoneEnabled } = require('../security.cjs')

module.exports = {
  id: 'settings',
  channels: ['getSettings', 'setSetting'],
  register({ handle, services }) {
    handle('getSettings', () => services.getStore().getSettings())
    handle('setSetting', (_event, payload) => {
      const { key, value } = parseSettingChange(payload)
      const settings = services.getStore().setSetting(key, value)
      if (key === 'alwaysOnTop') services.getOverlayWindow()?.setAlwaysOnTop(Boolean(value), 'floating')
      if (!isMicrophoneEnabled(settings)) services.getVoice?.()?.stop?.()
      services.broadcastSettings(settings)
      services.logActivity('Setting changed', `${key} = ${String(value)}`, 'info')
      return settings
    })
  }
}
