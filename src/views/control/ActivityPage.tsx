import { ActivityList } from '../../components/ActivityList'
import type { ControlCenterContextValue, ControlPageRegistration } from './model'

export function ActivityPage({ ctx }: { ctx: ControlCenterContextValue }) {
  return (
    <section className="panel page-panel">
      <div className="panel-head"><div><p className="eyebrow">AUDIT LOG</p><h2>Rata activity</h2></div></div>
      <ActivityList activity={ctx.activity} />
    </section>
  )
}

export const controlPage: ControlPageRegistration = {
  id: 'activity',
  icon: '↻',
  label: 'Activity',
  order: 50,
  render: ctx => <ActivityPage ctx={ctx} />
}
