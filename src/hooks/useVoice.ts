import { useEffect, useMemo, useRef, useState } from 'react'

export type VoicePermissionState = 'off' | 'unavailable' | 'prompt' | 'granted' | 'denied'
export type VoiceError = { error?: string }

type BrowserSpeechRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: VoiceError) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechHost = {
  SpeechRecognition?: new () => BrowserSpeechRecognition
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition
}

export function getSpeechRecognitionCtor(host: SpeechHost = window as unknown as SpeechHost) {
  return host.SpeechRecognition || host.webkitSpeechRecognition || null
}

export function voiceButtonTitle(permission: VoicePermissionState, listening: boolean) {
  if (permission === 'off') return 'Microphone is disabled in Control Center'
  if (permission === 'unavailable') return 'Speech recognition is not available in this build'
  if (permission === 'denied') return 'Microphone permission denied'
  if (listening) return 'Release to stop listening'
  return 'Hold to talk'
}

export function useVoice(options: {
  microphoneEnabled: boolean
  lang?: string
  onTranscript: (transcript: string) => void
  onListeningChange?: (listening: boolean) => void
  onMessage?: (message: string) => void
  onError?: () => void
}) {
  const { microphoneEnabled, lang = 'en-GB', onTranscript, onListeningChange, onMessage, onError } = options
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const listeningRef = useRef(false)
  const [listening, setListening] = useState(false)
  const [permission, setPermission] = useState<VoicePermissionState>(
    microphoneEnabled ? 'prompt' : 'off'
  )

  function setListen(next: boolean) {
    listeningRef.current = next
    setListening(next)
    onListeningChange?.(next)
  }

  useEffect(() => {
    if (!microphoneEnabled) {
      setPermission('off')
      return
    }
    if (!getSpeechRecognitionCtor()) {
      setPermission('unavailable')
      return
    }

    let cancelled = false
    const permissions = navigator.permissions
    if (!permissions?.query) {
      setPermission('prompt')
      return
    }

    permissions
      .query({ name: 'microphone' as PermissionName })
      .then(status => {
        if (cancelled) return
        const apply = () => {
          if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
            setPermission(status.state)
          }
        }
        apply()
        status.onchange = apply
      })
      .catch(() => {
        if (!cancelled) setPermission('prompt')
      })

    return () => {
      cancelled = true
    }
  }, [microphoneEnabled])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const api = useMemo(() => {
    function stopSession() {
      recognitionRef.current?.stop()
    }

    function cancel() {
      if (!listeningRef.current && !recognitionRef.current) return
      recognitionRef.current?.abort()
      recognitionRef.current = null
      setListen(false)
      onMessage?.('Listening cancelled.')
    }

    function start() {
      if (!microphoneEnabled) {
        onMessage?.('Microphone is disabled in Control Center.')
        return
      }
      const SpeechRecognitionCtor = getSpeechRecognitionCtor()
      if (!SpeechRecognitionCtor) {
        setPermission('unavailable')
        onMessage?.('Speech recognition is not available in this Chromium build.')
        return
      }

      recognitionRef.current?.abort()
      const recognition = new SpeechRecognitionCtor()
      recognition.lang = lang
      recognition.interimResults = false
      recognition.continuous = false
      recognition.onresult = event => {
        // Keep the transcript only. Do not retain audio buffers or MediaStreams.
        const transcript = event.results[0]?.[0]?.transcript?.trim()
        if (transcript) onTranscript(transcript)
      }
      recognition.onerror = event => {
        const error = event?.error
        if (error === 'aborted') return
        if (error === 'no-speech') {
          onMessage?.("I didn't catch that. Hold the microphone and try again.")
          return
        }
        if (error === 'not-allowed') {
          setPermission('denied')
          onMessage?.('Microphone permission was denied. Enable it in Control Center or Windows settings.')
          onError?.()
          return
        }
        onMessage?.("I couldn't access speech recognition. You can keep typing for now.")
        onError?.()
      }
      recognition.onend = () => {
        recognitionRef.current = null
        setListen(false)
      }

      recognitionRef.current = recognition
      setListen(true)
      onMessage?.("I'm listening…")
      try {
        recognition.start()
      } catch {
        recognitionRef.current = null
        setListen(false)
        onMessage?.("I couldn't start speech recognition. You can keep typing for now.")
        onError?.()
      }
    }

    function toggle() {
      if (listeningRef.current) stopSession()
      else start()
    }

    return {
      start,
      stop: stopSession,
      cancel,
      toggle,
      press: start,
      release: stopSession
    }
  }, [lang, microphoneEnabled, onError, onListeningChange, onMessage, onTranscript])

  return {
    listening,
    permission,
    title: voiceButtonTitle(permission, listening),
    available: permission !== 'unavailable' && permission !== 'off',
    ...api
  }
}

export type VoiceController = ReturnType<typeof useVoice>
