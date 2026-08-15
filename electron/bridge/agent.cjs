module.exports = {
  id: 'agent',
  channels: ['agentMessage', 'approveAction', 'rejectAction', 'overlayMessage'],
  create({ invoke, subscribe }) {
    return {
      agentMessage: message => invoke('agentMessage', { message }),
      approveAction: id => invoke('approveAction', { id }),
      rejectAction: id => invoke('rejectAction', { id }),
      onOverlayMessage: callback => subscribe('overlayMessage', callback)
    }
  }
}
