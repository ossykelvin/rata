module.exports = {
  id: 'windows',
  channels: ['showControl', 'showOverlay', 'hideOverlay', 'testNotification'],
  create({ invoke }) {
    return {
      showControlCenter: () => invoke('showControl'),
      showOverlay: () => invoke('showOverlay'),
      hideOverlay: () => invoke('hideOverlay'),
      testNotification: () => invoke('testNotification')
    }
  }
}
