import { useEffect, useMemo, useRef, useState } from 'react'
import { createAudioRecorder, type AudioRecorder } from './useAudioRecorder'

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
  // RATA-009: record locally and transcribe with Handy when it is installed.
  // The Windows recognizer stays as the fallback, so a machine without Handy
  // behaves exactly as before.
  // Lazily constructed: `useRef(createAudioRecorder())` would build and discard
  // a recorder on every render, since the argument is evaluated each time even
  // though only the first value is kept.
  const recorderRef = useRef<AudioRecorder | null>(null)
  if (!recorderRef.current) recorderRef.current = createAudioRecorder()
  const localRef = useRef(false)
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
    const recorder = recorderRef.current
    return () => {
      // Releases the microphone tracks as well as the recognizer.
      recorder?.cancel()
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

      // Prefer local transcription. getUserMedia is refused by the main
      // process when the microphone setting is off, so this path is gated by
      // the same boundary as the recognizer.
      try {
        await recorderRef.current!.start()
        localRef.current = true
        return
      } catch {
        localRef.current = false
      }

      try {
        await window.rata.startVoiceListening()
      } catch {
        setListen(false)
        onMessage?.("I couldn't access speech recognition. Check that a microphone is connected.")
        onError?.()
      }
    }

    async function stopSession() {
      if (localRef.current) {
        localRef.current = false
        setListen(false)
        const audio = await recorderRef.current!.stop()
        if (!audio) {
          onMessage?.("I didn't catch that. Click the microphone and speak, then click it again.")
          return
        }
        onMessage?.('Transcribing…')
        try {
          const { transcript } = await window.rata.transcribeAudio(audio)
          const text = transcript?.trim()
          if (!text) {
            onMessage?.("I didn't catch that. Click the microphone and speak, then click it again.")
            return
          }
          heardRef.current = true
          onTranscript(text)
        } catch {
          // Handy missing or failing must not look like a dead microphone.
          onMessage?.("I couldn't transcribe that. Check that local speech to text is installed.")
          onError?.()
        }
        return
      }

      await window.rata.stopVoiceListening()
      const heard = heardRef.current
      setListen(false)
      if (!heard) onMessage?.("I didn't catch that. Click the microphone and speak, then click it again.")
    }

    async function cancel() {
      if (!listeningRef.current) return
      if (localRef.current) {
        localRef.current = false
        recorderRef.current!.cancel()
      } else {
        await window.rata.stopVoiceListening()
      }
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
