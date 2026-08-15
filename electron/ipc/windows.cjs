module.exports = {
  id: 'windows',
  channels: ['showControl', 'showOverlay', 'hideOverlay'],
  register({ handle, services }) {
    handle('showControl', () => services.showControl())
    handle('showOverlay', () => services.getOverlayWindow()?.show())
    handle('hideOverlay', () => services.getOverlayWindow()?.hide())
  }
}
