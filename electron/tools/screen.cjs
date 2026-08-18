'use strict'

const { ScreenCaptureError, digestPng } = require('../screen-capture.cjs')

const MAX_QUESTION_LENGTH = 2000
const HANDLE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DIGEST_PATTERN = /^[a-f0-9]{64}$/

function requireObject(input, toolId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolId} input must be an object.`)
  }
  return input
}

function unavailableCapture() {
  throw new Error('Screen capture is not configured.')
}

function create({
  screenCapture,
  screenCaptureEnabled = () => false,
  visionGenerate
} = {}) {
  const capture = screenCapture || {
    capturePrimary: unavailableCapture,
    peek: () => null,
    consume: unavailableCapture,
    previewDataUrl: () => undefined
  }

  function assertEnabled(toolId) {
    if (screenCaptureEnabled() !== true) {
      throw new TypeError(`${toolId} is disabled. Turn on screen capture in Permissions before Rata can take a screenshot.`)
    }
  }

  function publicError(error) {
    if (error instanceof ScreenCaptureError) return error.message
    if (error instanceof Error) return error.message
    return 'Screen capture failed.'
  }

  return [
    {
      id: 'screen.capture',
      description: 'Capture the primary display into a short-lived in-memory handle. Does not return image bytes.',
      risk: 'read',
      confirmation: 'always',
      validateInput: input => {
        assertEnabled('screen.capture')
        if (input === undefined || input === null) return {}
        requireObject(input, 'screen.capture')
        return {}
      },
      describeInput: () =>
        'Capture the primary display. Rata does not target windows by name. You will see the exact image before any pixels leave this machine.',
      execute: async () => {
        assertEnabled('screen.capture')
        try {
          const result = await capture.capturePrimary()
          return {
            summary: `Captured primary display ${result.width}×${result.height} (${result.byteCount} bytes)`,
            message: `I captured the primary display (${result.width}×${result.height}, ${result.byteCount} bytes). The image stays on this machine until you approve sending it.`,
            handle: result.handle,
            width: result.width,
            height: result.height,
            byteCount: result.byteCount
          }
        } catch (error) {
          throw new Error(publicError(error), { cause: error })
        }
      }
    },
    {
      id: 'vision.analyze',
      description: 'Send an approved screenshot handle to a vision-capable AI provider.',
      risk: 'read',
      confirmation: 'always',
      validateInput: input => {
        assertEnabled('vision.analyze')
        const value = requireObject(input, 'vision.analyze')
        for (const key of Object.keys(value)) {
          if (!['handle', 'question', 'imageDigest', 'width', 'height', 'byteCount'].includes(key)) {
            throw new TypeError('vision.analyze accepts only a capture handle and a question.')
          }
        }
        if (typeof value.handle !== 'string' || !HANDLE_PATTERN.test(value.handle.trim())) {
          throw new TypeError('vision.analyze requires a capture handle.')
        }
        if (typeof value.question !== 'string' || !value.question.trim()) {
          throw new TypeError('vision.analyze requires a question.')
        }
        if (value.question.length > MAX_QUESTION_LENGTH) {
          throw new TypeError(`vision.analyze questions must be ${MAX_QUESTION_LENGTH} characters or fewer.`)
        }
        const handle = value.handle.trim()
        const question = value.question.trim()
        const current = capture.peek(handle)
        if (!current) {
          throw new TypeError('That screenshot is no longer available.')
        }
        const imageDigest = typeof value.imageDigest === 'string' && DIGEST_PATTERN.test(value.imageDigest)
          ? value.imageDigest
          : digestPng(current.png)
        return {
          handle,
          question,
          imageDigest,
          width: current.width,
          height: current.height,
          byteCount: current.byteCount
        }
      },
      describeInput: input =>
        `Send this screenshot (${input.width}×${input.height}, ${input.byteCount} bytes) to your AI provider to answer: “${String(input.question).slice(0, 120)}”. The image leaves your machine.`,
      previewImage: input => capture.previewDataUrl(input.handle),
      execute: async ({ handle, question, imageDigest }) => {
        assertEnabled('vision.analyze')
        const current = capture.peek(handle)
        if (!current) {
          throw new Error('That screenshot is no longer available.')
        }
        const png = Buffer.from(current.png)
        if (digestPng(png) !== imageDigest) {
          try {
            capture.consume(handle, imageDigest)
          } catch {
            // Slot already empty or replaced; either way nothing is sent.
          }
          throw new Error('The screenshot has changed since you approved it.')
        }
        if (typeof visionGenerate !== 'function') {
          throw new Error('No vision-capable provider is configured. Screen analysis cannot run as text-only.')
        }
        let result
        try {
          result = await visionGenerate({
            question,
            image: {
              mimeType: current.mimeType,
              data: png.toString('base64')
            }
          })
        } catch (error) {
          throw new Error(publicError(error), { cause: error })
        }
        try {
          capture.consume(handle, imageDigest)
        } catch {
          // The approved bytes were already sent; a replaced slot is left alone.
        }
        const text = typeof result === 'string' ? result : String(result?.text || '')
        if (!text.trim()) {
          throw new Error('The vision provider returned no description.')
        }
        return {
          summary: `Analysed screenshot ${current.width}×${current.height} (${png.length} bytes)`,
          message: text.trim(),
          trust: 'untrusted-external'
        }
      }
    }
  ]
}

module.exports = {
  id: 'screen',
  toolIds: ['screen.capture', 'vision.analyze'],
  create,
  MAX_QUESTION_LENGTH
}
