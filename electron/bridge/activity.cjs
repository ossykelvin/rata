module.exports = {
  id: 'activity',
  channels: ['getActivity', 'activity'],
  create({ invoke, subscribe }) {
    return {
      getActivity: () => invoke('getActivity'),
      onActivity: callback => subscribe('activity', callback)
    }
  }
}
