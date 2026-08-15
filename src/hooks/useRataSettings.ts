import { useEffect, useState } from 'react'
import type { RataSettings } from '../types'

export function useRataSettings() {
  const [settings, setSettings] = useState<RataSettings | null>(null)

  useEffect(() => {
    window.rata.getSettings().then(setSettings)
    return window.rata.onSettingsChanged(setSettings)
  }, [])

  async function setSetting<K extends keyof RataSettings>(key: K, value: RataSettings[K]) {
    const next = await window.rata.setSetting(key, value)
    setSettings(next)
    return next
  }

  return { settings, setSetting }
}
