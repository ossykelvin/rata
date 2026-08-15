module.exports = {
  id: 'activity',
  channels: ['getActivity'],
  register({ handle, services }) {
    handle('getActivity', () => services.getStore().getActivity())
  }
}
