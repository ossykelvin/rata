export type Risk = 'read' | 'safe-write' | 'external-write' | 'destructive'

export type CharacterState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'awaiting_approval'
  | 'working'
  | 'success'
  | 'error'
  | 'sleeping'

export type RataSettings = {
  alwaysOnTop: boolean
  opacity: number
  doNotDisturb: boolean
  voiceEnabled: boolean
  microphoneEnabled: boolean
  provider: string
  clipboardConfirm: boolean
}

export type ActivityEvent = {
  id: string
  at: string
  action: string
  detail: string
  status: 'info' | 'success' | 'warning' | 'error'
}

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

export type InstalledSkill = {
  id: string
  name: string
  category: string
  risk: string
  backgroundCapable: boolean
  confirmation: string
  permissions: string[]
  tools: string[]
  triggers: string[]
  availableTools: string[]
  missingTools: string[]
  status: 'ready' | 'partial' | 'unavailable'
}

export type SkillsSnapshot = {
  loaded: boolean
  error: string | null
  pack: { name: string; version: string; description: string } | null
  skills: InstalledSkill[]
}

export type RataBridge = {
  getSettings(): Promise<RataSettings>
  setSetting<K extends keyof RataSettings>(key: K, value: RataSettings[K]): Promise<RataSettings>
  getActivity(): Promise<ActivityEvent[]>
  getSkills(): Promise<SkillsSnapshot>
  agentMessage(message: string): Promise<AgentReply>
  approveAction(id: string): Promise<AgentReply>
  rejectAction(id: string): Promise<AgentReply>
  showControlCenter(): Promise<void>
  showOverlay(): Promise<void>
  hideOverlay(): Promise<void>
  testNotification(): Promise<void>
  onSettingsChanged(callback: (settings: RataSettings) => void): () => void
  onActivity(callback: (event: ActivityEvent) => void): () => void
  onOverlayMessage(callback: (payload: { message: string; state?: CharacterState }) => void): () => void
}

export type ControlPage =
  | 'dashboard'
  | 'chat'
  | 'permissions'
  | 'activity'
  | 'appearance'
  | 'integrations'
  | 'skills'
  | 'developer'
