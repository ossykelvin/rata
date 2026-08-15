import { useMemo, useState } from 'react'
import { RataAvatar } from '../components/RataAvatar'
import { useActivity } from '../hooks/useActivity'
import { useAgentConversation } from '../hooks/useAgentConversation'
import { useRataSettings } from '../hooks/useRataSettings'
import { useSkills } from '../hooks/useSkills'
import type { ControlPage } from '../types'
import type { ControlCenterContextValue } from './control/model'
import { controlPages } from './control/pages'

export function ControlCenter() {
  const [page, setPage] = useState<ControlPage>('dashboard')
  const { settings, setSetting } = useRataSettings()
  const activity = useActivity()
  const skills = useSkills()
  const conversation = useAgentConversation()

  const ctx = useMemo<ControlCenterContextValue | null>(() => {
    if (!settings) return null
    return {
      page,
      setPage,
      settings,
      setSetting,
      activity,
      skills,
      conversation,
      readyCount: skills.skills.filter(skill => skill.status === 'ready').length
    }
  }, [page, settings, setSetting, activity, skills, conversation])

  if (!settings || !ctx) return <div className="loading-screen">Starting Rata…</div>

  const current = controlPages.find(item => item.id === page)

  return (
    <main className="control-root">
      <aside className="sidebar">
        <div className="brand-row">
          <RataAvatar size="small" state={conversation.agentState} />
          <div>
            <strong>Rata</strong>
            <span>Office Assistant</span>
          </div>
        </div>
        <nav>
          {controlPages.map(item => (
            <button key={item.id} className={page === item.id ? 'nav-active' : ''} onClick={() => setPage(item.id)}>
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="online-dot" /> MVP runtime online
          <small>v0.1.0</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">RATA CONTROL CENTER</p>
            <h1>{current?.label}</h1>
          </div>
          <div className="top-actions">
            <button className="button-secondary" onClick={() => window.rata.showOverlay()}>
              Show Rata
            </button>
            <button className="button-primary" onClick={() => setPage('chat')}>
              Ask Rata
            </button>
          </div>
        </header>

        {current?.render(ctx)}
      </section>
    </main>
  )
}
