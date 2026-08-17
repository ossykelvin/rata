/**
 * Records microphone audio as a 16 kHz mono WAV, which is what the local
 * transcriber expects. RATA-009.
 *
 * Capture goes through `getUserMedia`, so Chromium's permission handler
 * applies and `decideRendererPermission()` in electron/security.cjs refuses it
 * when the microphone setting is off. That makes this path gated by the same
 * boundary the Windows recognizer uses, rather than a second one.
 *
 * Encoding is done here rather than with MediaRecorder because MediaRecorder
 * produces WebM/Opus, and the transcriber wants PCM. Downsampling to 16 kHz in
 * the renderer also keeps the payload small: one minute of speech is under
 * 2 MB, well inside the IPC size cap.
 */

const TARGET_SAMPLE_RATE = 16000

/** Average consecutive samples down to the target rate. */
export function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_SAMPLE_RATE) return input
  if (inputRate < TARGET_SAMPLE_RATE) {
    throw new Error(`Cannot upsample from ${inputRate}Hz.`)
  }
  const ratio = inputRate / TARGET_SAMPLE_RATE
  const outputLength = Math.floor(input.length / ratio)
  const output = new Float32Array(outputLength)
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.min(Math.floor((index + 1) * ratio), input.length)
    let sum = 0
    for (let cursor = start; cursor < end; cursor += 1) sum += input[cursor]
    output[index] = end > start ? sum / (end - start) : 0
  }
  return output
}

/** 16-bit PCM WAV: a 44-byte RIFF header followed by clamped samples. */
export function encodeWav(samples: Float32Array, sampleRate = TARGET_SAMPLE_RATE): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)                  // PCM
  view.setUint16(22, 1, true)                  // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)     // byte rate
  view.setUint16(32, 2, true)                  // block align
  view.setUint16(34, 16, true)                 // bits per sample
  ascii(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }
  return new Uint8Array(buffer)
}

export type AudioRecorder = {
  start: () => Promise<void>
  stop: () => Promise<Uint8Array | null>
  cancel: () => void
  recording: () => boolean
}

export function createAudioRecorder(): AudioRecorder {
  let context: AudioContext | null = null
  let stream: MediaStream | null = null
  let processor: ScriptProcessorNode | null = null
  let chunks: Float32Array[] = []
  let active = false

  function release() {
    active = false
    try { processor?.disconnect() } catch { /* already gone */ }
    // Stopping every track is what actually turns the microphone light off.
    try { stream?.getTracks().forEach(track => track.stop()) } catch { /* already gone */ }
    try { void context?.close() } catch { /* already gone */ }
    processor = null
    stream = null
    context = null
  }

  async function start() {
    if (active) return
    chunks = []
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    })
    context = new AudioContext()
    const source = context.createMediaStreamSource(stream)
    processor = context.createScriptProcessor(4096, 1, 1)
    processor.onaudioprocess = event => {
      if (!active) return
      chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
    }
    source.connect(processor)
    processor.connect(context.destination)
    active = true
  }

  async function stop() {
    if (!active) return null
    const rate = context?.sampleRate ?? 48000
    const captured = chunks
    chunks = []
    release()

    const total = captured.reduce((sum, chunk) => sum + chunk.length, 0)
    if (total === 0) return null
    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of captured) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    return encodeWav(downsampleTo16k(merged, rate))
  }

  function cancel() {
    chunks = []
    release()
  }

  return { start, stop, cancel, recording: () => active }
}
