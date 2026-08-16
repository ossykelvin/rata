import type { ControlPageRegistration } from './model'

export function DeveloperPage() {
  return (
    <section className="panel page-panel developer-page">
      <p className="eyebrow">HANDOVER READY</p>
      <h2>Agent development contract</h2>
      <p>Codex, Claude and Cursor should start by reading <code>AGENTS.md</code>, <code>docs/CODEMAP.md</code> and <code>docs/ARCHITECTURE.md</code>.</p>
      <div className="code-block">Renderer → Preload IPC → Electron Main → Agent Runtime → Skill Router → Policy Engine → Tool Registry → OS / Connector</div>
      <h3>Next implementation sequence</h3>
      <ol>
        <li>Replace mock model with provider abstraction and streaming (RATA-002).</li>
        <li>Load only the selected skill prompt beneath the global system prompt.</li>
        <li>Add production STT/TTS adapters. Browser push-to-talk speech recognition is already in the overlay and Chat.</li>
        <li>Build the authenticated C# Windows UI Automation bridge.</li>
        <li>Add Microsoft Graph delegated OAuth for mail/calendar.</li>
        <li>Replace placeholder character SVGs with production transparent art (human-gated).</li>
      </ol>
    </section>
  )
}

export const controlPage: ControlPageRegistration = {
  id: 'developer',
  icon: '⌘',
  label: 'Developer',
  order: 80,
  render: () => <DeveloperPage />
}
