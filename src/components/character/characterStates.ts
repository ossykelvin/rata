import type { CharacterState } from '../../types'
import catalog from './states.json'

export const CHARACTER_STATES = [
  'idle',
  'listening',
  'thinking',
  'awaiting_approval',
  'working',
  'success',
  'error',
  'sleeping'
] as const satisfies readonly CharacterState[]

export type CharacterSize = 'small' | 'large'

export type CharacterPresentation = {
  state: CharacterState
  label: string
  src: string
  known: boolean
}

type CatalogEntry = { file: string; label: string }

const FALLBACK_ENTRY: CatalogEntry = catalog.idle

function isCharacterState(value: string): value is CharacterState {
  return (CHARACTER_STATES as readonly string[]).includes(value)
}

export function normalizeCharacterState(state: string | undefined): CharacterState {
  if (!state) return 'idle'
  if (state === 'typing') return 'working'
  if (isCharacterState(state)) return state
  return 'idle'
}

export function resolveCharacterPresentation(state: string | undefined): CharacterPresentation {
  const known = Boolean(state) && (state === 'typing' || isCharacterState(state))
  // Unknown states resolve to idle so the idle asset still loads; missing files use the silhouette.
  const resolved = normalizeCharacterState(state)
  const entry = (catalog as Record<string, CatalogEntry>)[resolved] || FALLBACK_ENTRY
  return {
    state: resolved,
    label: entry.label,
    src: `./character/${entry.file}`,
    known
  }
}
