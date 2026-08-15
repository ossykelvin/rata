import type { CharacterState } from '../types'

type Props = {
  message: string
  state: CharacterState | string
}

export function SpeechBubble({ message, state }: Props) {
  return (
    <div className="speech-bubble no-drag" role="status" aria-live="polite">
      <div className="bubble-head">
        <strong>Rata</strong>
        <span className={`state-chip state-${state}`}>{state.replaceAll('_', ' ')}</span>
      </div>
      <p>{message}</p>
    </div>
  )
}
