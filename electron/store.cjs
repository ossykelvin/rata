const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { validateSettingValue, isKnownSetting } = require('../packages/contracts/ipc-validation.cjs')

const defaults = {
  settings: {
    alwaysOnTop: true,
    opacity: 1,
    doNotDisturb: false,
    voiceEnabled: false,
    microphoneEnabled: true,
    // Stays 'mock' so a fresh install performs no network egress until the
    // user opts in. See docs/decisions/ADR-007-ai-provider-chain.md.
    provider: 'mock',
    clipboardConfirm: true,
    webSearchConfirm: true,
    webFetchConfirm: true,
    fileReadConfirm: true,
    fileWriteConfirm: true,
    weatherConfirm: true,
    // Opt-in. Both communicator stages send text to a provider. ADR-012.
    communicatorEnabled: false
  },
  activity: []
}

// These are used only when a value read from an existing file is invalid.
// Microphone access fails closed, while every configurable confirmation falls
// back to enabled. Fresh-install product defaults remain unchanged above.
const safeDiskFallbackSettings = Object.freeze({
  ...defaults.settings,
  microphoneEnabled: false,
  clipboardConfirm: true,
  webSearchConfirm: true,
  webFetchConfirm: true,
  fileReadConfirm: true,
  fileWriteConfirm: true,
  weatherConfirm: true,
  communicatorEnabled: false
})

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function safeSettingLabel(key) {
  return /^[a-z][a-zA-Z0-9]{0,63}$/.test(key) ? key : '[unrecognized]'
}

class JsonStore {
  constructor(app) {
    this.file = path.join(app.getPath('userData'), 'rata-store.json')
    this.data = structuredClone(defaults)
    this.load()
  }

  load() {
    if (!fs.existsSync(this.file)) return

    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      if (!isRecord(parsed)) throw new TypeError('invalid-store-shape')

      this.data = {
        settings: { ...defaults.settings },
        activity: Array.isArray(parsed.activity) ? parsed.activity.slice(0, 250) : []
      }

      if (!isRecord(parsed.settings)) {
        if (parsed.settings !== undefined) {
          this.data.settings = { ...safeDiskFallbackSettings }
          this.recordLoadFallback('Stored settings had an invalid shape; safe settings were restored.')
        }
        return
      }

      for (const key of Object.keys(parsed.settings)) {
        if (!isKnownSetting(key)) {
          this.recordLoadFallback(`Unknown stored setting was dropped: ${safeSettingLabel(key)}.`)
          continue
        }
        try {
          this.data.settings[key] = validateSettingValue(key, parsed.settings[key])
        } catch {
          this.data.settings[key] = safeDiskFallbackSettings[key]
          this.recordLoadFallback(`Invalid stored setting was replaced safely: ${key}.`)
        }
      }
    } catch {
      this.data = { settings: { ...safeDiskFallbackSettings }, activity: [] }
      this.recordLoadFallback('The stored data was unreadable; safe settings were restored.')
      // Do not include parser text or the local file path in logs.
      console.error('Rata store load failed; safe settings were restored.')
    }
  }

  recordLoadFallback(detail) {
    this.data.activity.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      action: 'Store recovery',
      detail,
      status: 'warning'
    })
    this.data.activity = this.data.activity.slice(0, 250)
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8')
  }

  getSettings() { return { ...this.data.settings } }

  setSetting(key, value) {
    // Defence in depth: the caller already validated, but this store is the
    // thing that persists to disk and broadcasts to renderers, so it refuses
    // unknown keys on its own authority rather than trusting the caller.
    if (!isKnownSetting(key)) throw new TypeError(`Unknown setting: ${String(key)}`)
    const validated = validateSettingValue(key, value)
    this.data.settings[key] = validated
    this.save()
    return this.getSettings()
  }

  getActivity() { return [...this.data.activity] }

  addActivity(event) {
    this.data.activity.unshift(event)
    this.data.activity = this.data.activity.slice(0, 250)
    this.save()
  }
}

module.exports = { JsonStore }
