import { ActivityList } from '../../components/ActivityList'
import { RataAvatar } from '../../components/RataAvatar'
import type { ControlCenterContextValue } from './model'

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <div className="metric-card"><span>{title}</span><strong>{value}</strong><small>{detail}</small></div>
}

export function DashboardPage({ ctx }: { ctx: ControlCenterContextValue }) {
  const { setPage, activity, skills, readyCount } = ctx
  return (
    <div className="page-grid">
      <section className="hero-card">
        <div>
          <span className="pill">● MVP online</span>
          <h2>Your desktop companion is ready.</h2>
          <p>This vertical slice proves the floating widget, secure IPC boundary, skill registry, settings, activity logging and permission-gated tools.</p>
          <div className="hero-actions">
            <button className="button-primary" onClick={() => setPage('chat')}>Try the agent</button>
            <button className="button-secondary" onClick={() => window.rata.testNotification()}>Test notification</button>
          </div>
        </div>
        <RataAvatar state="idle" />
      </section>

      <div className="metric-grid">
        <Metric title="Desktop overlay" value="Active" detail="Draggable + always on top" />
        <Metric title="Agent runtime" value="Mock" detail="Provider interface ready" />
        <Metric title="Permission gate" value="Active" detail="Risk-aware approvals" />
        <Metric title="Skills pack" value={`${readyCount}/${skills.skills.length || 0}`} detail="Ready tools / installed skills" />
      </div>

      <section className="panel span-2">
        <div className="panel-head"><div><p className="eyebrow">QUICK COMMANDS</p><h3>Try the working tool layer</h3></div></div>
        <div className="quick-command-grid">
          {['open notepad', 'what is 36 * 14?', 'copy Hello from Rata to clipboard'].map(command => (
            <button key={command} onClick={() => { setPage('chat'); ctx.conversation.setInput(command) }}>{command}<span>→</span></button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h3>Audit trail</h3></div><button className="link-button" onClick={() => setPage('activity')}>View all</button></div>
        <ActivityList activity={activity.slice(0, 5)} />
      </section>

      <section className="panel">
        <div className="panel-head"><div><p className="eyebrow">SAFETY</p><h3>Current authority</h3></div></div>
        <div className="authority-list">
          <p><span className="check">✓</span> Read-only suggestions</p>
          <p><span className="check">✓</span> Approved app launching</p>
          <p><span className="check">✓</span> Safe calculator (no eval)</p>
          <p><span className="lock">●</span> External writes require approval</p>
          <p><span className="lock">●</span> Destructive actions blocked</p>
        </div>
      </section>
    </div>
  )
}
