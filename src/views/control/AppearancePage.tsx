import { RataAvatar } from '../../components/RataAvatar'
import type { ControlCenterContextValue } from './model'

export function AppearancePage({ ctx }: { ctx: ControlCenterContextValue }) {
  const { settings, setSetting } = ctx
  return (
    <div className="settings-grid">
      <section className="panel page-panel">
        <p className="eyebrow">CHARACTER</p><h2>Desktop behaviour</h2>
        <label className="setting-row"><div><strong>Always on top</strong><span>Keep Rata visible above normal application windows.</span></div><input type="checkbox" checked={settings.alwaysOnTop} onChange={e => setSetting('alwaysOnTop', e.target.checked)} /></label>
        <label className="setting-row"><div><strong>Do not disturb</strong><span>Suppress proactive speech bubbles and notifications.</span></div><input type="checkbox" checked={settings.doNotDisturb} onChange={e => setSetting('doNotDisturb', e.target.checked)} /></label>
        <label className="slider-row"><div><strong>Overlay opacity</strong><span>{Math.round(settings.opacity * 100)}%</span></div><input type="range" min="0.55" max="1" step="0.05" value={settings.opacity} onChange={e => setSetting('opacity', Number(e.target.value))} /></label>
        <div className="button-row"><button className="button-secondary" onClick={() => window.rata.showOverlay()}>Show overlay</button><button className="button-secondary" onClick={() => window.rata.hideOverlay()}>Hide overlay</button></div>
      </section>
      <section className="preview-card"><RataAvatar state="idle" /><p>Replace the MVP crop with transparent WebM/Rive character states during the character-assets milestone. Missing assets fall back to a letter mark.</p></section>
    </div>
  )
}
