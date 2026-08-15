module.exports = {
  id: 'notifications',
  channels: ['testNotification'],
  register({ handle, services }) {
    handle('testNotification', () => {
      const settings = services.getStore().getSettings()
      if (settings.doNotDisturb) return
      if (services.Notification.isSupported()) {
        new services.Notification({ title: 'Rata', body: 'I\'m here and ready to help.' }).show()
      }
      services.logActivity('Notification tested', 'Desktop notification requested.', 'success')
    })
  }
}
