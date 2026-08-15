import { useEffect, useState } from 'react'
import type { CharacterState } from '../../types'
import '../../styles/character.css'
import { resolveCharacterPresentation, type CharacterSize } from './characterStates'

export type RataCharacterProps = {
  state?: CharacterState | string
  size?: CharacterSize
}

export function RataCharacter({ state = 'idle', size = 'large' }: RataCharacterProps) {
  const presentation = resolveCharacterPresentation(state)
  const [assetFailed, setAssetFailed] = useState(false)

  useEffect(() => {
    setAssetFailed(false)
  }, [presentation.src, presentation.state])

  const showFallback = assetFailed
  const label = `Rata is ${presentation.label}`

  return (
    <div
      className={`rata-character rata-character-${presentation.state} ${size === 'small' ? 'rata-character-small' : ''}`}
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
            alt=""
            draggable={false}
            onError={() => setAssetFailed(true)}
          />
        )}
      </div>
      <span className="rata-character-dot" />
    </div>
  )
}
