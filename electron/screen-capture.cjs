'use strict'

const crypto = require('node:crypto')

const MAX_WIDTH = 1920
const MAX_BYTES = 4 * 1024 * 1024
const CAPTURE_TTL_MS = 5 * 60 * 1000
const PNG_MIME = 'image/png'

class ScreenCaptureError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'ScreenCaptureError'
    this.code = code
  }
}

function digestPng(png) {
  return crypto.createHash('sha256').update(png).digest('hex')
}

function ownIds(ownWindowSourceIds) {
  const listed = typeof ownWindowSourceIds === 'function' ? ownWindowSourceIds() : ownWindowSourceIds
  return new Set((Array.isArray(listed) ? listed : []).filter(id => typeof id === 'string' && id))
}

function filterSources(sources, ownWindowSourceIds) {
  const own = ownIds(ownWindowSourceIds)
  if (!Array.isArray(sources)) return []
  return sources.filter(source => source && typeof source.id === 'string' && !own.has(source.id))
}

/**
 * In-memory primary-display capture. One slot, TTL-matched to pending
 * approvals. Bytes never go to disk. The handle is the only value a tool
 * may return to the agent.
 */
function createScreenCapture({
  getSources,
  getPrimaryDisplayId,
  ownWindowSourceIds = () => [],
  resizePng = null,
  now = () => Date.now(),
  ttlMs = CAPTURE_TTL_MS,
  maxWidth = MAX_WIDTH,
  maxBytes = MAX_BYTES
} = {}) {
  let slot = null

  function prune() {
    if (slot && slot.createdAt <= now() - ttlMs) slot = null
  }

  function peek(handle) {
    prune()
    if (!slot || slot.handle !== handle) return null
    return slot
  }

  async function capturePrimary() {
    if (typeof getSources !== 'function') {
      throw new ScreenCaptureError('Screen capture is not available.', 'unavailable')
    }
    const sources = filterSources(await getSources({ types: ['screen'] }), ownWindowSourceIds)
    const primaryId = typeof getPrimaryDisplayId === 'function' ? String(getPrimaryDisplayId() ?? '') : ''
    const selected = primaryId
      ? sources.find(source => String(source.displayId ?? source.display_id ?? '') === primaryId) || sources[0]
      : sources[0]
    if (!selected) {
      throw new ScreenCaptureError('The primary display could not be captured.', 'no-source')
    }

    let width = Number(selected.width)
    let height = Number(selected.height)
    let png = Buffer.isBuffer(selected.png) ? selected.png : null
    if (!png || !Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
      throw new ScreenCaptureError('The screenshot could not be encoded.', 'encode-failed')
    }

    if (width > maxWidth) {
      if (typeof resizePng !== 'function') {
        throw new ScreenCaptureError('The screenshot is too large to send. Capture was refused rather than reduced.', 'too-large')
      }
      const resized = await resizePng({ png, width, height, maxWidth })
      width = Number(resized?.width)
      height = Number(resized?.height)
      png = Buffer.isBuffer(resized?.png) ? resized.png : null
      if (!png || !Number.isInteger(width) || width < 1 || width > maxWidth || !Number.isInteger(height) || height < 1) {
        throw new ScreenCaptureError('The screenshot is too large to send. Capture was refused rather than reduced.', 'too-large')
      }
    }

    if (png.length > maxBytes) {
      throw new ScreenCaptureError('The screenshot is too large to send. Capture was refused rather than reduced.', 'too-large')
    }

    const handle = crypto.randomUUID()
    slot = {
      handle,
      png,
      width,
      height,
      byteCount: png.length,
      mimeType: PNG_MIME,
      imageDigest: digestPng(png),
      createdAt: now()
    }
    return { handle, width, height, byteCount: png.length }
  }

  function consume(handle, expectedDigest) {
    prune()
    if (!slot || slot.handle !== handle) {
      throw new ScreenCaptureError('That screenshot is no longer available.', 'missing')
    }
    if (typeof expectedDigest === 'string' && expectedDigest && digestPng(slot.png) !== expectedDigest) {
      slot = null
      throw new ScreenCaptureError('The screenshot has changed since you approved it.', 'mismatch')
    }
    const taken = slot
    slot = null
    return taken
  }

  function previewDataUrl(handle) {
    const capture = peek(handle)
    if (!capture) return undefined
    return `data:${PNG_MIME};base64,${capture.png.toString('base64')}`
  }

  return {
    capturePrimary,
    peek,
    consume,
    previewDataUrl,
    filterSources: sources => filterSources(sources, ownWindowSourceIds)
  }
}

module.exports = {
  createScreenCapture,
  ScreenCaptureError,
  digestPng,
  filterSources,
  MAX_WIDTH,
  MAX_BYTES,
  CAPTURE_TTL_MS,
  PNG_MIME
}
