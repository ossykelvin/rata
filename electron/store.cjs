const fs = require('node:fs')
const path = require('node:path')
const { validateSettingValue, isKnownSetting } = require('../packages/contracts/ipc-validation.cjs')

const defaults = {
  settings: {
    alwaysOnTop: true,
    opacity: 1,
    doNotDisturb: false,
    voiceEnabled: false,
    microphoneEnabled: true,
    // Stays 'mock' so a fresh install performs no network egress until the
    // user opts in. See docs/decisions/ADR-006-ai-provider-chain.md.
    provider: 'mock',
    clipboardConfirm: true,
    webSearchConfirm: true
  },
  activity: []
}

class JsonStore {
  constructor(app) {
    this.file = path.join(app.getPath('userData'), 'rata-store.json')
    this.data = structuredClone(defaults)
    this.load()
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'))
        this.data = {
          ...structuredClone(defaults),
          ...parsed,
          settings: { ...defaults.settings, ...(parsed.settings || {}) },
          activity: Array.isArray(parsed.activity) ? parsed.activity : []
        }
      }
    } catch (error) {
      console.error('Rata store load failed:', error)
    }
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
