const { parseAgentMessage, parseApprovalRequest } = require('../../packages/contracts/ipc-validation.cjs')

module.exports = {
  id: 'agent',
  channels: ['agentMessage', 'approveAction', 'rejectAction'],
  register({ handle, IPC, services }) {
    const sendOverlayReply = result => {
      services.getOverlayWindow()?.webContents.send(IPC.overlayMessage, { message: result.message, state: result.state })
      return result
    }

    handle('agentMessage', async (_event, payload) => {
      const { message } = parseAgentMessage(payload)
      return sendOverlayReply(await services.getAgent().handle(message))
    })
    handle('approveAction', async (_event, payload) => {
      const { id } = parseApprovalRequest(payload)
      return sendOverlayReply(await services.getAgent().approve(id))
    })
    handle('rejectAction', async (_event, payload) => {
      const { id } = parseApprovalRequest(payload)
      return services.getAgent().reject(id)
    })
  }
}
