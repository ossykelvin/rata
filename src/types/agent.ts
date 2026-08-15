import type { CharacterState } from './character'
import type { Risk } from './risk'

export type ApprovalRequest = {
  id: string
  title: string
  detail: string
  risk: Risk
}

export type AgentReply = {
  message: string
  state?: CharacterState
  approval?: ApprovalRequest
}
