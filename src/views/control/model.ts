import type { ReactNode } from 'react'
import type { AgentConversation } from '../../hooks/useAgentConversation'
import type { ActivityEvent, ControlPage, InstalledSkill, RataSettings, SkillsSnapshot } from '../../types'

export type ControlCenterContextValue = {
  page: ControlPage
  setPage: (page: ControlPage) => void
  settings: RataSettings
  setSetting: <K extends keyof RataSettings>(key: K, value: RataSettings[K]) => Promise<RataSettings>
  activity: ActivityEvent[]
  skills: SkillsSnapshot
  conversation: AgentConversation
  readyCount: number
}

export type ControlPageRegistration = {
  id: ControlPage
  icon: string
  label: string
  order: number
  render: (ctx: ControlCenterContextValue) => ReactNode
}

export function skillStatusLabel(skill: InstalledSkill) {
  if (skill.status === 'ready') return 'Ready'
  if (skill.status === 'partial') return 'Partial'
  return 'Unavailable'
}
