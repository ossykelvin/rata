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
