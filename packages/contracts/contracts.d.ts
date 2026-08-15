/**
 * Renderer-facing types for the Rata bridge.
 *
 * These mirror the runtime validators in `index.cjs`. They are ambient (global)
 * declarations so unprivileged React code can stay import-free, and they are
 * documentation only — the main process re-validates every payload.
 *
 * Keep this file in step with `packages/contracts/index.cjs`.
 */

/** See `RISK_LEVELS` in index.cjs and the risk table in docs/SECURITY.md. */
type RataRisk = 'read' | 'safe-write' | 'external-write' | 'destructive'

/** See `AGENT_STATES`. Drives character animation only. */
type RataAgentState = 'idle' | 'listening' | 'thinking' | 'working' | 'success' | 'error'

/** See `ACTIVITY_STATUSES`. */
type RataActivityStatus = 'info' | 'success' | 'warning' | 'error'

/** See `SETTINGS_SCHEMA`. */
type RataSettings = {
  alwaysOnTop: boolean
  /** Clamped to 0.55–1 by the main process. */
  opacity: number
  doNotDisturb: boolean
  voiceEnabled: boolean
  microphoneEnabled: boolean
  provider: 'mock'
  clipboardConfirm: boolean
}

type ActivityEvent = {
  id: string
  /** ISO 8601 timestamp. */
  at: string
  action: string
  detail: string
  status: RataActivityStatus
}

type PendingApproval = {
  id: string
  title: string
  detail: string
  risk: RataRisk
}

type AgentReply = {
  message: string
  state?: RataAgentState
  /** Present when the policy engine requires the user to approve before execution. */
  approval?: PendingApproval
}

type OverlayMessage = {
  message: string
  state?: RataAgentState
}

/** Unsubscribe function returned by every `on*` listener. */
type RataUnsubscribe = () => void

interface RataBridge {
  getSettings(): Promise<RataSettings>
  setSetting<K extends keyof RataSettings>(key: K, value: RataSettings[K]): Promise<RataSettings>
  getActivity(): Promise<ActivityEvent[]>
  agentMessage(message: string): Promise<AgentReply>
  approveAction(id: string): Promise<AgentReply>
  rejectAction(id: string): Promise<AgentReply>
  showControlCenter(): Promise<void>
  showOverlay(): Promise<void>
  hideOverlay(): Promise<void>
  testNotification(): Promise<void>
  onSettingsChanged(callback: (settings: RataSettings) => void): RataUnsubscribe
  onActivity(callback: (event: ActivityEvent) => void): RataUnsubscribe
  onOverlayMessage(callback: (payload: OverlayMessage) => void): RataUnsubscribe
}

interface Window {
  rata: RataBridge
}
