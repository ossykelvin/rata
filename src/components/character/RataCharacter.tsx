import { useEffect, useState } from 'react'
import type { CharacterState } from '../../types'
import '../../styles/character.css'
import { normalizeCharacterState, resolveCharacterPresentation, type CharacterSize } from './characterStates'
import { useIdlePresence } from './idlePresence'

export type RataCharacterProps = {
  state?: CharacterState | string
  size?: CharacterSize
  /**
   * Idle presence drifts to bored/peeking/sleepy after a quiet minute and
   * wakes excited. Turn it off for a static preview that should hold a pose.
   */
  idlePresence?: boolean
}

export function RataCharacter({ state = 'idle', size = 'large', idlePresence = true }: RataCharacterProps) {
  // The hook only ever overrides 'idle'; any real agent state passes through.
  const presented = useIdlePresence(normalizeCharacterState(state), { enabled: idlePresence })
  const presentation = resolveCharacterPresentation(presented)
  const [assetFailed, setAssetFailed] = useState(false)

  useEffect(() => {
    setAssetFailed(false)
  }, [presentation.src, presentation.state])

  const showFallback = assetFailed
  const label = `Rata is ${presentation.label}`

  return (
    <div
      className={`rata-character rata-character-${presentation.state}${size === 'small' ? ' rata-character-small' : ''}${presentation.crop ? ' rata-character-crop' : ''}`}
      data-character-state={presentation.state}
      aria-label={label}
    >
      <div className="rata-character-frame">
        {showFallback ? (
          <div className="rata-character-silhouette" aria-hidden="true">
            <span>R</span>
          </div>
        ) : (
          <img
            src={presentation.src}
            alt="Rata, the office assistant"
            draggable={false}
            onError={() => setAssetFailed(true)}
          />
        )}
      </div>
      <span className="rata-character-dot" />
    </div>
  )
}
