import type { CharacterState } from '../types'

type Props = {
  message: string
  state: CharacterState | string
}

export function SpeechBubble({ message, state }: Props) {
  return (
    <div className="speech-bubble" role="status" aria-live="polite">
      <div className="bubble-head">
        <strong>Rata</strong>
        <span className={`state-chip state-${state}`}>{state.replaceAll('_', ' ')}</span>
      </div>
      {/* bubble-body is the scroll container (ISSUE-29). The paragraph stays
          no-drag so the text is selectable inside the drag region (ISSUE-34);
          the container itself is exempted from the drag region in CSS rather
          than here, so both features keep the class names they expect. */}
      <div className="bubble-body">
        <p className="no-drag">{message}</p>
      </div>
    </div>
  )
}
