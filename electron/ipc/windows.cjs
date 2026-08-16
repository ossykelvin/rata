module.exports = {
  id: 'windows',
  channels: ['showControl', 'showOverlay', 'hideOverlay'],
  register({ handle, services }) {
    handle('showControl', () => services.showControl())
    handle('showOverlay', () => services.showOverlay())
    handle('hideOverlay', () => services.getOverlayWindow()?.hide())
  }
}
