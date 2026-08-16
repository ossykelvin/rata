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
  // A failed asset used to be silent: the silhouette rendered and nothing said
  // why, so a dead dev server or a missing file looked like a design choice.
  // Name the URL in the console and expose it on the element for inspection.
  const failureDetail = assetFailed ? `Character artwork failed to load: ${presentation.src}` : undefined

  return (
    <div
      className={`rata-character rata-character-${presentation.state}${size === 'small' ? ' rata-character-small' : ''}${presentation.crop ? ' rata-character-crop' : ''}`}
      data-character-state={presentation.state}
      data-asset-failed={assetFailed ? presentation.src : undefined}
      aria-label={label}
      title={failureDetail}
    >
      <div className="rata-character-frame">
        {showFallback ? (
          <div className="rata-character-silhouette" role="img" aria-label={failureDetail}>
            <span aria-hidden="true">R</span>
          </div>
        ) : (
          <img
            src={presentation.src}
            alt="Rata, the office assistant"
            draggable={false}
            onError={() => {
              // eslint-disable-next-line no-console -- the renderer has no audit channel; this is the only trace
              console.warn(`[rata] character asset failed to load: ${presentation.src}`)
              setAssetFailed(true)
            }}
          />
        )}
      </div>
      <span className="rata-character-dot" />
    </div>
  )
}
