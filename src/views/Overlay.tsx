import { useEffect, useRef, useState } from 'react'
import { ApprovalActions } from '../components/ApprovalActions'
import { RataAvatar } from '../components/RataAvatar'
import { SpeechBubble } from '../components/SpeechBubble'
import { VoiceMicButton } from '../components/VoiceMicButton'
import { useAgentConversation } from '../hooks/useAgentConversation'
import { useRataSettings } from '../hooks/useRataSettings'
import { useVoice } from '../hooks/useVoice'

const overlayGreeting = "Hey! I'm Rata. Drag me anywhere, or ask me something."

export function Overlay() {
  const { settings } = useRataSettings()
  const conversation = useAgentConversation({ initialMessage: overlayGreeting })
  const [expanded, setExpanded] = useState(false)
  const [compact, setCompact] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return window.rata.onOverlayMessage(payload => {
      conversation.setLastMessage(payload.message)
      if (payload.state) conversation.setAgentState(payload.state)
    })
  }, [conversation.setLastMessage, conversation.setAgentState])

  useEffect(() => {
    if (expanded && !compact) inputRef.current?.focus()
  }, [expanded, compact])

  useEffect(() => {
    if (conversation.approval) setCompact(false)
  }, [conversation.approval])

  const voice = useVoice({
    microphoneEnabled: Boolean(settings?.microphoneEnabled),
    onTranscript: transcript => {
      conversation.setInput(transcript)
      conversation.setAgentState('idle')
      conversation.setLastMessage(`I heard: “${transcript}”`)
      setCompact(false)
      setExpanded(true)
    },
    onListeningChange: next => {
      conversation.setAgentState(current => {
        if (next) return 'listening'
        return current === 'listening' ? 'idle' : current
      })
    },
    onMessage: conversation.setLastMessage,
    onError: () => conversation.setAgentState('error')
  })

  const windowControls = (
    <>
      <button
        type="button"
        className="icon-button"
        onClick={() => setCompact(true)}
        title="Minimize Rata"
        aria-label="Minimize Rata"
      >
        −
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => {
          setCompact(false)
          void window.rata.hideOverlay()
        }}
        title="Close Rata"
        aria-label="Close Rata"
      >
        ×
      </button>
    </>
  )

  return (
    <main
      className={compact ? 'overlay-root overlay-root--compact' : 'overlay-root'}
      style={{ opacity: settings?.opacity ?? 1 }}
    >
      {compact ? (
        <div className="drag-zone">
          <div className="rata-stack rata-stack--compact">
            <button
              type="button"
              className="rata-restore no-drag"
              onClick={() => setCompact(false)}
              title="Restore Rata"
              aria-label="Restore Rata"
            >
              <RataAvatar state={conversation.agentState} size="small" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="drag-zone">
            {/* P0-4 moved conversation state into useAgentConversation; ISSUE-34
                replaced the single avatar button with a drag stack plus a separate
                Ask control. Both are kept: state comes from the hook, markup from
                the drag layout. */}
            <SpeechBubble message={conversation.lastMessage} state={conversation.agentState} />
            {conversation.approval && (
              <ApprovalActions approval={conversation.approval} onApprove={conversation.approve} onReject={conversation.reject} />
            )}
            <div className="rata-stack">
              <div className="rata-button">
                <RataAvatar state={conversation.agentState} />
              </div>
              <button
                type="button"
                className="rata-ask no-drag"
                onClick={() => setExpanded(value => !value)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Hide Rata input' : 'Open Rata input'}
              >
                {expanded ? 'Hide' : 'Ask'}
              </button>
            </div>
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
              <VoiceMicButton voice={voice} />
              <button type="submit" className="send-button">
                ➜
              </button>
              <button type="button" className="icon-button" onClick={() => window.rata.showControlCenter()} title="Open Control Center">
                ⚙
              </button>
              {windowControls}
            </form>
          )}
        </>
      )}
    </main>
  )
}
