import { useEffect, useMemo, useRef, useState } from 'react'

export type VoicePermissionState = 'off' | 'unavailable' | 'prompt' | 'granted' | 'denied'

export function voiceButtonTitle(permission: VoicePermissionState, listening: boolean) {
  if (permission === 'off') return 'Microphone is disabled in Control Center'
  if (permission === 'unavailable') return 'Speech recognition is not available in this build'
  if (permission === 'denied') return 'Microphone permission denied'
  if (listening) return 'Listening — click or release to stop'
  return 'Click to talk, or hold to talk'
}

export function useVoice(options: {
  microphoneEnabled: boolean
  onTranscript: (transcript: string) => void
  onListeningChange?: (listening: boolean) => void
  onMessage?: (message: string) => void
  onError?: () => void
}) {
  const { microphoneEnabled, onTranscript, onListeningChange, onMessage, onError } = options
  const listeningRef = useRef(false)
  const heardRef = useRef(false)
  const pressAtRef = useRef(0)
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
    setPermission(microphoneEnabled ? 'granted' : 'off')
  }, [microphoneEnabled])

  useEffect(() => {
    return window.rata.onVoiceTranscript(payload => {
      if (payload?.error) {
        onMessage?.(payload.error)
        onError?.()
        setListen(false)
        return
      }
      const transcript = payload?.transcript?.trim()
      if (!transcript) return
      heardRef.current = true
      onTranscript(transcript)
    })
  }, [onError, onMessage, onTranscript])

  useEffect(() => {
    return () => {
      void window.rata.stopVoiceListening()
    }
  }, [])

  const api = useMemo(() => {
    async function start() {
      if (!microphoneEnabled) {
        onMessage?.('Microphone is disabled in Control Center.')
        return
      }
      heardRef.current = false
      setListen(true)
      onMessage?.("I'm listening…")
      try {
        await window.rata.startVoiceListening()
      } catch {
        setListen(false)
        onMessage?.("I couldn't access speech recognition. Check that a microphone is connected.")
        onError?.()
      }
    }

    async function stopSession() {
      await window.rata.stopVoiceListening()
      const heard = heardRef.current
      setListen(false)
      if (!heard) onMessage?.("I didn't catch that. Click the microphone and speak, then click it again.")
    }

    async function cancel() {
      if (!listeningRef.current) return
      await window.rata.stopVoiceListening()
      setListen(false)
      onMessage?.('Listening cancelled.')
    }

    function press() {
      pressAtRef.current = Date.now()
      if (listeningRef.current) void stopSession()
      else void start()
    }

    function release() {
      if (!listeningRef.current) return
      if (Date.now() - pressAtRef.current >= 500) void stopSession()
    }

    function toggle() {
      if (listeningRef.current) void stopSession()
      else void start()
    }

    return {
      start,
      stop: stopSession,
      cancel,
      toggle,
      press,
      release
    }
  }, [microphoneEnabled, onError, onListeningChange, onMessage, onTranscript])

  return {
    listening,
    permission,
    title: voiceButtonTitle(permission, listening),
    available: permission !== 'unavailable' && permission !== 'off',
    ...api
  }
}

export type VoiceController = ReturnType<typeof useVoice>
