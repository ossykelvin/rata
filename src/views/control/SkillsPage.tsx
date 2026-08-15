import { skillStatusLabel, type ControlCenterContextValue, type ControlPageRegistration } from './model'

export function SkillsPage({ ctx }: { ctx: ControlCenterContextValue }) {
  const { skills } = ctx
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">SKILL REGISTRY</p>
          <h2>Installed skills</h2>
        </div>
      </div>
      <p className="section-copy">
        Skills are prompt packs, not authority. A skill can be selected only if it is in the registry; it can act only through registered tools and the policy engine.
      </p>
      {!skills.loaded && <p className="empty-state">Skill pack failed closed{skills.error ? `: ${skills.error}` : '.'}</p>}
      {skills.loaded && (
        <div className="skill-grid">
          {skills.skills.map(skill => (
            <article className="skill-card" key={skill.id}>
              <div className="skill-card-head">
                <h3>{skill.name}</h3>
                <span className={`skill-status skill-${skill.status}`}>{skillStatusLabel(skill)}</span>
              </div>
              <p className="skill-meta">{skill.category} · {skill.risk}{skill.backgroundCapable ? ' · background' : ''}</p>
              <p className="skill-tools">Tools: {skill.tools.join(', ')}</p>
              {skill.missingTools.length > 0 && (
                <p className="skill-missing">Not registered yet: {skill.missingTools.join(', ')}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export const controlPage: ControlPageRegistration = {
  id: 'skills',
  icon: '▣',
  label: 'Skills',
  order: 40,
  render: ctx => <SkillsPage ctx={ctx} />
}
