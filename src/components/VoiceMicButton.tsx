import type { VoiceController } from '../hooks/useVoice'

export function VoiceMicButton({
  voice,
  className = 'icon-button'
}: {
  voice: VoiceController
  className?: string
}) {
  return (
    <button
      type="button"
      className={`${className}${voice.listening ? ' listening' : ''}`}
      title={voice.title}
      aria-label={voice.title}
      aria-pressed={voice.listening}
      onPointerDown={event => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        voice.press()
      }}
      onPointerUp={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        voice.release()
      }}
      onPointerCancel={() => voice.release()}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          voice.cancel()
          return
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          voice.toggle()
        }
      }}
    >
      🎙️
    </button>
  )
}
