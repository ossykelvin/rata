import { FormEvent, useEffect, useRef, useState } from 'react'
import { RataAvatar } from '../components/RataAvatar'
import { SpeechBubble } from '../components/SpeechBubble'
import { ApprovalActions } from '../components/ApprovalActions'
import { useRataSettings } from '../hooks/useRataSettings'
import type { AgentReply, CharacterState } from '../types'

type BrowserSpeechRecognition = {
  lang: string
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
}

export function Overlay() {
  const { settings } = useRataSettings()
  const [message, setMessage] = useState('Hey! I\'m Rata. Drag me anywhere, or ask me something.')
  const [state, setState] = useState<CharacterState>('idle')
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [approval, setApproval] = useState<AgentReply['approval']>()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return window.rata.onOverlayMessage(payload => {
      setMessage(payload.message)
      if (payload.state) setState(payload.state)
    })
  }, [])

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = input.trim()
    if (!value) return
    setInput('')
    setState('thinking')
    setMessage(`Working on: “${value}”`)
    const reply = await window.rata.agentMessage(value)
    setMessage(reply.message)
    setState(reply.state ?? 'idle')
    setApproval(reply.approval)
  }

  async function approve() {
    if (!approval) return
    setState('working')
    const reply = await window.rata.approveAction(approval.id)
    setApproval(undefined)
    setMessage(reply.message)
    setState(reply.state ?? 'success')
  }

  async function reject() {
    if (!approval) return
    const reply = await window.rata.rejectAction(approval.id)
    setApproval(undefined)
    setMessage(reply.message)
    setState(reply.state ?? 'idle')
  }

  function microphone() {
    if (!settings?.microphoneEnabled) {
      setMessage('Microphone is disabled in Control Center.')
      return
    }
    const host = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition
    }
    const SpeechRecognitionCtor = host.SpeechRecognition || host.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setMessage('Speech recognition is not available in this build yet. The handover includes the production voice ticket.')
      return
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-GB'
    recognition.interimResults = false
    setState('listening')
    setMessage('I\'m listening…')
    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      setState('idle')
      setMessage(`I heard: “${transcript}”`)
      setExpanded(true)
    }
    recognition.onerror = () => {
      setState('error')
      setMessage('I couldn\'t access speech recognition. You can keep typing for now.')
    }
    recognition.onend = () => setState(current => current === 'listening' ? 'idle' : current)
    recognition.start()
  }

  return (
    <main className="overlay-root" style={{ opacity: settings?.opacity ?? 1 }}>
      <div className="drag-zone">
        <SpeechBubble message={message} state={state} />
        {approval && <ApprovalActions approval={approval} onApprove={approve} onReject={reject} />}
        <div className="rata-stack">
          <div className="rata-button">
            <RataAvatar state={state} />
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
        <form className="quick-input no-drag" onSubmit={submit}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Rata…"
            aria-label="Ask Rata"
          />
          <button type="button" className="icon-button" onClick={microphone} title="Microphone">🎙️</button>
          <button type="submit" className="send-button">➜</button>
          <button type="button" className="icon-button" onClick={() => window.rata.showControlCenter()} title="Open Control Center">⚙</button>
        </form>
      )}
    </main>
  )
}
