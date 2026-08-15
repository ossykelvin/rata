import { useEffect, useRef, useState } from 'react'
import { ApprovalActions } from '../components/ApprovalActions'
import { RataAvatar } from '../components/RataAvatar'
import { SpeechBubble } from '../components/SpeechBubble'
import { useAgentConversation } from '../hooks/useAgentConversation'
import { useRataSettings } from '../hooks/useRataSettings'

type BrowserSpeechRecognition = {
  lang: string
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
}

const overlayGreeting = "Hey! I'm Rata. Drag me anywhere, or ask me something."

export function Overlay() {
  const { settings } = useRataSettings()
  const conversation = useAgentConversation({ initialMessage: overlayGreeting })
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return window.rata.onOverlayMessage(payload => {
      conversation.setLastMessage(payload.message)
      if (payload.state) conversation.setAgentState(payload.state)
    })
  }, [conversation.setLastMessage, conversation.setAgentState])

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  function microphone() {
    if (!settings?.microphoneEnabled) {
      conversation.setLastMessage('Microphone is disabled in Control Center.')
      return
    }
    const host = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition
    }
    const SpeechRecognitionCtor = host.SpeechRecognition || host.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      conversation.setLastMessage(
        'Speech recognition is not available in this build yet. The handover includes the production voice ticket.'
      )
      return
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-GB'
    recognition.interimResults = false
    conversation.setAgentState('listening')
    conversation.setLastMessage("I'm listening…")
    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript
      conversation.setInput(transcript)
      conversation.setAgentState('idle')
      conversation.setLastMessage(`I heard: “${transcript}”`)
      setExpanded(true)
    }
    recognition.onerror = () => {
      conversation.setAgentState('error')
      conversation.setLastMessage("I couldn't access speech recognition. You can keep typing for now.")
    }
    recognition.onend = () => conversation.setAgentState(current => (current === 'listening' ? 'idle' : current))
    recognition.start()
  }

  return (
    <main className="overlay-root" style={{ opacity: settings?.opacity ?? 1 }}>
      <div className="drag-zone">
        <SpeechBubble message={conversation.lastMessage} state={conversation.agentState} />
        {conversation.approval && (
          <ApprovalActions approval={conversation.approval} onApprove={conversation.approve} onReject={conversation.reject} />
        )}
        <button className="rata-button no-drag" onClick={() => setExpanded(value => !value)} aria-label="Open Rata input">
          <RataAvatar state={conversation.agentState} />
        </button>
      </div>

      {expanded && (
        <form className="quick-input no-drag" onSubmit={conversation.sendForm}>
          <input
            ref={inputRef}
            value={conversation.input}
            onChange={e => conversation.setInput(e.target.value)}
            placeholder="Ask Rata…"
            aria-label="Ask Rata"
          />
          <button type="button" className="icon-button" onClick={microphone} title="Microphone">
            🎙️
          </button>
          <button type="submit" className="send-button">
            ➜
          </button>
          <button type="button" className="icon-button" onClick={() => window.rata.showControlCenter()} title="Open Control Center">
            ⚙
          </button>
        </form>
      )}
    </main>
  )
}
