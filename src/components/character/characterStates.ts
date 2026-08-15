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

type CatalogEntry = {
  label: string
  file?: string
  src?: string
  crop?: boolean
}

const FALLBACK_ENTRY: CatalogEntry = catalog.idle

function isCharacterState(value: string | undefined): value is CharacterState {
  return typeof value === 'string' && (CHARACTER_STATES as readonly string[]).includes(value)
}

function catalogEntry(state: CharacterState): CatalogEntry {
  const entry = (catalog as Record<string, CatalogEntry | undefined>)[state]
  return entry && typeof entry.label === 'string' ? entry : FALLBACK_ENTRY
}

function resolveAssetSrc(entry: CatalogEntry): string {
  if (entry.src) return entry.src
  return `./character/${entry.file}`
}

export function normalizeCharacterState(state: string | undefined): CharacterState {
  if (!state) return 'idle'
  if (state === 'typing') return 'working'
  if (isCharacterState(state)) return state
  return 'idle'
}

export function resolveCharacterPresentation(state: string | undefined): CharacterPresentation {
  const known = Boolean(state) && (state === 'typing' || isCharacterState(state))
  const resolved = normalizeCharacterState(state)
  const entry = catalogEntry(resolved)
  return {
    state: resolved,
    label: entry.label,
    src: resolveAssetSrc(entry),
    crop: Boolean(entry.crop),
    known
  }
}
