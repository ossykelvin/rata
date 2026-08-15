function Integration({ title, icon, status, description }: { title: string; icon: string; status: string; description: string }) {
  return (
    <section className="integration-card">
      <div className="integration-icon">{icon}</div>
      <div>
        <div className="integration-title"><h3>{title}</h3><span>{status}</span></div>
        <p>{description}</p>
      </div>
    </section>
  )
}

export function IntegrationsPage() {
  return (
    <div className="integration-grid">
      <Integration title="Microsoft 365" icon="M" status="Planned" description="Outlook Mail, Calendar and Contacts through Microsoft Graph delegated permissions." />
      <Integration title="Web & Browser" icon="W" status="Planned" description="Search and Playwright browser automation behind explicit tool permissions." />
      <Integration title="Windows Bridge" icon="⊞" status="MVP partial" description="MVP launches approved apps. Native .NET UI Automation bridge is the next desktop-control milestone." />
      <Integration title="AI Providers" icon="AI" status="Mock" description="OpenAI, Anthropic, Gemini and local adapters fit behind the provider interface." />
    </div>
  )
}
