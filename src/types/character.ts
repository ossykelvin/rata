export type CharacterState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'awaiting_approval'
  | 'working'
  | 'success'
  | 'error'
  | 'sleeping'
  // Idle-presence states. These are never sent by the agent — the character
  // derives them itself after a period with nothing happening, and returns to
  // 'excited' briefly when the user comes back. See idlePresence.ts.
  | 'bored'
  | 'peeking'
  | 'sleepy'
  | 'excited'
