import { useEffect, useRef, useState } from 'react'
import type { CharacterState } from '../../types'

/**
 * Idle presence: what Rata does when nothing is happening.
 *
 * After a minute with the agent idle he gets bored, then peeks, then goes
 * sleepy. Any sign of life — the agent doing something, or the user touching
 * the keyboard or pointer — wakes him up excited for a moment before he
 * settles back to idle.
 *
 * The escalation is derived entirely in the renderer. The agent never sends
 * these states, which is why they are not part of the IPC contract: this is
 * presentation, and `AGENTS.md` rule 15 keeps business logic out of the
 * character.
 *
 * The timing table and the reducer below are pure so they can be tested
 * without a DOM or a clock.
 */

export const IDLE_STAGES = [
  { after: 60_000, state: 'bored' },
  { after: 120_000, state: 'peeking' },
  { after: 180_000, state: 'sleepy' },
  // Fully asleep after ten quiet minutes. Without this last stage the
  // 'sleeping' state and its artwork were unreachable: nothing in the app ever
  // set it, so the asset shipped but never appeared. RATA-010.
  { after: 600_000, state: 'sleeping' }
] as const satisfies readonly { after: number; state: CharacterState }[]

/** How long the wake-up celebration lasts before returning to idle. */
export const EXCITED_MS = 2_500

/**
 * Which idle stage applies after `elapsed` milliseconds of nothing happening.
 * Returns 'idle' before the first threshold.
 */
export function idleStageFor(elapsed: number): CharacterState {
  let stage: CharacterState = 'idle'
  for (const step of IDLE_STAGES) {
    if (elapsed >= step.after) stage = step.state
  }
  return stage
}

/** True for the states Rata enters on his own while nobody is around. */
export function isIdleStage(state: CharacterState): boolean {
  return IDLE_STAGES.some(step => step.state === state)
}

/**
 * Decides the state to render.
 *
 * `agentState` wins whenever the agent is actually doing something — idle
 * presence must never mask thinking, an approval prompt, or an error.
 */
export function presentedState({
  agentState,
  elapsed,
  excitedUntil,
  now
}: {
  agentState: CharacterState
  elapsed: number
  excitedUntil: number
  now: number
}): CharacterState {
  if (agentState !== 'idle') return agentState
  if (now < excitedUntil) return 'excited'
  return idleStageFor(elapsed)
}

type IdlePresenceOptions = {
  /** Injectable for tests; defaults to the real clock. */
  now?: () => number
  /** Set false to disable escalation, e.g. for a static preview. */
  enabled?: boolean
}

/**
 * React wiring around the pure helpers above.
 *
 * Ticks once a second rather than scheduling a timer per stage, so a laptop
 * waking from sleep lands on the correct stage instead of firing three stale
 * timeouts at once.
 */
export function useIdlePresence(
  agentState: CharacterState,
  { now = () => Date.now(), enabled = true }: IdlePresenceOptions = {}
): CharacterState {
  const lastActivity = useRef(now())
  const excitedUntil = useRef(0)
  const wasEscalated = useRef(false)
  const [, forceTick] = useState(0)

  // Anything the agent does counts as activity.
  useEffect(() => {
    if (agentState === 'idle') return
    lastActivity.current = now()
    wasEscalated.current = false
    excitedUntil.current = 0
  }, [agentState, now])

  // So does the user, even when the agent stays idle.
  useEffect(() => {
    if (!enabled) return
    const wake = () => {
      const at = now()
      // Only celebrate if he had actually drifted off; otherwise every
      // keystroke would trigger a party.
      if (wasEscalated.current) {
        excitedUntil.current = at + EXCITED_MS
        wasEscalated.current = false
      }
      lastActivity.current = at
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'focus']
    for (const event of events) window.addEventListener(event, wake, { passive: true })
    return () => {
      for (const event of events) window.removeEventListener(event, wake)
    }
  }, [enabled, now])

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => forceTick(value => value + 1), 1_000)
    return () => clearInterval(timer)
  }, [enabled])

  if (!enabled) return agentState

  const at = now()
  const state = presentedState({
    agentState,
    elapsed: at - lastActivity.current,
    excitedUntil: excitedUntil.current,
    now: at
  })
  if (isIdleStage(state)) wasEscalated.current = true
  return state
}
