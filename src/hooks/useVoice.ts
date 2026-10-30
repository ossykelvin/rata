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
  // Lazily constructed: `useRef(createAudioRecorder())` would build and discard
  // a recorder on every render, since the argument is evaluated each time even
  // though only the first value is kept.
  const recorderRef = useRef<AudioRecorder | null>(null)
  if (!recorderRef.current) recorderRef.current = createAudioRecorder()
  const localRef = useRef(false)
  /**
   * Which speech-to-text path to run, as resolved by the main process.
   *
   * This used to be decided here: start the local recorder, and if
   * `getUserMedia` threw, fall back to the Windows recognizer. That made
   * provider policy a renderer concern — and the renderer is not a boundary,
   * which is why `microphoneEnabled` is re-checked in main rather than trusted
   * from the UI. It also meant the choice could not be configured, and that
   * Handy's availability was discovered by exception. RATA-004.
   */
  const sttModeRef = useRef<'local' | 'windows' | 'none'>('windows')
  const sttReasonRef = useRef<string | null>(null)
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

  // Re-read on every settings change, because the user may have switched
  // provider or installed the local transcriber since the last press.
  useEffect(() => {
    let cancelled = false
    void window.rata.speechCapabilities().then(capabilities => {
      if (cancelled) return
      sttModeRef.current = capabilities.stt.mode
      sttReasonRef.current = capabilities.stt.reason
    }).catch(() => {
      // Leave the default. A capability query that fails must not disable the
      // microphone outright.
    })
    return () => {
      cancelled = true
    }
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
      if (sttModeRef.current === 'none') {
        // Say which provider is missing. "I couldn't access speech
        // recognition" with no detail is the unfalsifiable message that made
        // the earlier voice failures so hard to diagnose.
        onMessage?.(sttReasonRef.current || 'No speech to text provider is available.')
        onError?.()
        return
      }

      heardRef.current = false
      setListen(true)
      onMessage?.("I'm listening…")

      // Stop Rata talking before the microphone opens, so the recording does
      // not contain the synthesizer. The main process does the same for the
      // Windows recognizer; the local path has no IPC call to hang it on.
      void window.rata.cancelSpeech().catch(() => {})

      if (sttModeRef.current === 'local') {
        try {
          await recorderRef.current!.start()
          localRef.current = true
          return
        } catch {
          // The resolved mode said local was available, so a failure here is a
          // real fault rather than a reason to silently use another provider.
          localRef.current = false
          setListen(false)
          onMessage?.("I couldn't start recording. Check that a microphone is connected.")
          onError?.()
          return
        }
      }

      localRef.current = false
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
