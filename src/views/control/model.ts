import type { ActivityEvent, ControlPage, InstalledSkill, RataSettings, SkillsSnapshot } from '../../types'
import type { AgentConversation } from '../../hooks/useAgentConversation'

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

export const pages: { id: ControlPage; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '⌂', label: 'Dashboard' },
  { id: 'chat', icon: '✦', label: 'Chat' },
  { id: 'permissions', icon: '◈', label: 'Permissions' },
  { id: 'skills', icon: '▣', label: 'Skills' },
  { id: 'activity', icon: '↻', label: 'Activity' },
  { id: 'appearance', icon: '◐', label: 'Appearance' },
  { id: 'integrations', icon: '⛓', label: 'Integrations' },
  { id: 'developer', icon: '⌘', label: 'Developer' }
]

export function skillStatusLabel(skill: InstalledSkill) {
  if (skill.status === 'ready') return 'Ready'
  if (skill.status === 'partial') return 'Partial'
  return 'Unavailable'
}
