module.exports = {
  id: 'settings',
  channels: ['getSettings', 'setSetting', 'settingsChanged'],
  create({ invoke, subscribe }) {
    return {
      getSettings: () => invoke('getSettings'),
      setSetting: (key, value) => invoke('setSetting', { key, value }),
      onSettingsChanged: callback => subscribe('settingsChanged', callback)
    }
  }
}
