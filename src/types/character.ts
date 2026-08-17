export type CharacterState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'awaiting_approval'
  | 'working'
  | 'success'
  | 'error'
  // A refusal, not a failure. The policy engine or a tool validator declined
  // the action, which is Rata working correctly and should not look like a
  // crash. RATA-010.
  | 'blocked'
  // A skill matched but its tools are not registered, so nothing can run.
  | 'unavailable'
  | 'sleeping'
  // Idle-presence states. These are never sent by the agent — the character
  // derives them itself after a period with nothing happening, and returns to
  // 'excited' briefly when the user comes back. See idlePresence.ts.
  | 'bored'
  | 'peeking'
  | 'sleepy'
  | 'excited'
