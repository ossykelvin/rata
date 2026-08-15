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
  crop: boolean
  known: boolean
}

type CatalogEntry = { file: string; label: string }

const FALLBACK_ENTRY: CatalogEntry = catalog.idle
// Shared concept-sheet crop until production per-state assets replace it.
const TEMPORARY_ART = catalog.temporaryArt

function isCharacterState(value: string | undefined): value is CharacterState {
  return typeof value === 'string' && (CHARACTER_STATES as readonly string[]).includes(value)
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
  const entry = (catalog as Record<string, CatalogEntry | typeof TEMPORARY_ART>)[resolved]
  const resolvedEntry = entry && 'file' in entry ? entry : FALLBACK_ENTRY
  return {
    state: resolved,
    label: resolvedEntry.label,
    src: TEMPORARY_ART?.src ?? `./character/${resolvedEntry.file}`,
    crop: Boolean(TEMPORARY_ART?.crop),
    known
  }
}
