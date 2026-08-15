import { useState } from 'react'
import type { CharacterState } from '../types'

type Props = {
  state?: CharacterState
  size?: 'small' | 'large'
}

export function RataAvatar({ state = 'idle', size = 'large' }: Props) {
  const [missingAsset, setMissingAsset] = useState(false)

  return (
    <div className={`rata-avatar rata-${state} ${size === 'small' ? 'rata-small' : ''}`} aria-label={`Rata is ${state}`}>
      <div className="rata-crop">
        {missingAsset ? (
          <div className="rata-fallback" aria-hidden="true">R</div>
        ) : (
          <img
            src="./rata-concept.png"
            alt="Rata, the office assistant"
            draggable={false}
            onError={() => setMissingAsset(true)}
          />
        )}
      </div>
      <span className="rata-status-dot" />
    </div>
  )
}
