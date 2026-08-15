import { useMemo, useState } from 'react'
import { RataAvatar } from '../components/RataAvatar'
import { useActivity } from '../hooks/useActivity'
import { useAgentConversation } from '../hooks/useAgentConversation'
import { useRataSettings } from '../hooks/useRataSettings'
import { useSkills } from '../hooks/useSkills'
import type { ControlPage } from '../types'
import { ActivityPage } from './control/ActivityPage'
import { AppearancePage } from './control/AppearancePage'
import { ChatPage } from './control/ChatPage'
import { DashboardPage } from './control/DashboardPage'
import { DeveloperPage } from './control/DeveloperPage'
import { IntegrationsPage } from './control/IntegrationsPage'
import { PermissionsPage } from './control/PermissionsPage'
import { SkillsPage } from './control/SkillsPage'
import { pages, type ControlCenterContextValue } from './control/model'

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

  return (
    <main className="control-root">
      <aside className="sidebar">
        <div className="brand-row">
          <RataAvatar size="small" state={conversation.agentState} />
          <div><strong>Rata</strong><span>Office Assistant</span></div>
        </div>
        <nav>
          {pages.map(item => (
            <button key={item.id} className={page === item.id ? 'nav-active' : ''} onClick={() => setPage(item.id)}>
              <span>{item.icon}</span>{item.label}
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
            <h1>{pages.find(item => item.id === page)?.label}</h1>
          </div>
          <div className="top-actions">
            <button className="button-secondary" onClick={() => window.rata.showOverlay()}>Show Rata</button>
            <button className="button-primary" onClick={() => setPage('chat')}>Ask Rata</button>
          </div>
        </header>

        {page === 'dashboard' && <DashboardPage ctx={ctx} />}
        {page === 'chat' && <ChatPage ctx={ctx} />}
        {page === 'permissions' && <PermissionsPage ctx={ctx} />}
        {page === 'skills' && <SkillsPage ctx={ctx} />}
        {page === 'activity' && <ActivityPage ctx={ctx} />}
        {page === 'appearance' && <AppearancePage ctx={ctx} />}
        {page === 'integrations' && <IntegrationsPage />}
        {page === 'developer' && <DeveloperPage />}
      </section>
    </main>
  )
}
