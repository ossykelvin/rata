import { useMemo } from 'react'
import type { ControlCenterContextValue, ControlPageRegistration } from './model'

export function PermissionsPage({ ctx }: { ctx: ControlCenterContextValue }) {
  const { settings, setSetting } = ctx
  const permissionRows = useMemo(() => [
    ['Read local context', 'read', 'Automatic'],
    ['Evaluate arithmetic', 'read', 'Automatic'],
    ['Open approved Windows apps', 'safe-write', 'Automatic'],
    ['Write to clipboard', 'safe-write', settings.clipboardConfirm ? 'Ask every time' : 'Automatic'],
    ['Send email / invite attendees', 'external-write', 'Always ask'],
    ['Delete files / cancel meetings', 'destructive', 'Always ask']
  ], [settings.clipboardConfirm])

  return (
    <section className="panel page-panel">
      <div className="panel-head"><div><p className="eyebrow">POLICY ENGINE</p><h2>What Rata may do</h2></div></div>
      <p className="section-copy">Every system-changing action passes through the policy layer before execution. Skills never grant extra authority.</p>
      <div className="permission-table">
        {permissionRows.map(([name, risk, behaviour]) => (
          <div className="permission-row" key={name}>
            <div><strong>{name}</strong><span>{risk}</span></div><b>{behaviour}</b>
          </div>
        ))}
      </div>
      <label className="setting-row">
        <div><strong>Confirm clipboard writes</strong><span>Useful for demonstrating the approval flow in this MVP.</span></div>
        <input type="checkbox" checked={settings.clipboardConfirm} onChange={e => setSetting('clipboardConfirm', e.target.checked)} />
      </label>
      <label className="setting-row">
        <div><strong>Microphone</strong><span>Allow speech-to-text from the overlay and Chat. Main process denies media permission when this is off.</span></div>
        <input type="checkbox" checked={settings.microphoneEnabled} onChange={e => setSetting('microphoneEnabled', e.target.checked)} />
      </label>
      <label className="setting-row">
        <div><strong>Spoken replies</strong><span>Text-to-speech is not wired yet. This keeps the existing setting visible without enabling a provider.</span></div>
        <input type="checkbox" checked={settings.voiceEnabled} onChange={e => setSetting('voiceEnabled', e.target.checked)} />
      </label>
    </section>
  )
}

export const controlPage: ControlPageRegistration = {
  id: 'permissions',
  icon: '◈',
  label: 'Permissions',
  order: 30,
  render: ctx => <PermissionsPage ctx={ctx} />
}
