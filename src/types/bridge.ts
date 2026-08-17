import type { ActivityEvent } from './activity'
import type { AgentReply } from './agent'
import type { CharacterState } from './character'
import type { ProvidersSnapshot } from './providers'
import type { RataSettings } from './settings'
import type { SkillsSnapshot } from './skills'

export type RataBridge = {
  getSettings(): Promise<RataSettings>
  setSetting<K extends keyof RataSettings>(key: K, value: RataSettings[K]): Promise<RataSettings>
  getActivity(): Promise<ActivityEvent[]>
  getSkills(): Promise<SkillsSnapshot>
  getProviders(): Promise<ProvidersSnapshot>
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
  startVoiceListening(): Promise<{ ok: boolean }>
  stopVoiceListening(): Promise<{ ok: boolean }>
  onVoiceTranscript(callback: (payload: { transcript: string; error?: string }) => void): () => void
  /** Sends a 16 kHz mono WAV for local transcription. RATA-009. */
  transcribeAudio(audio: Uint8Array): Promise<{ transcript: string }>
}
