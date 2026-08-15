import { ActivityList } from '../../components/ActivityList'
import type { ControlCenterContextValue } from './model'

export function ActivityPage({ ctx }: { ctx: ControlCenterContextValue }) {
  return (
    <section className="panel page-panel">
      <div className="panel-head"><div><p className="eyebrow">AUDIT LOG</p><h2>Rata activity</h2></div></div>
      <ActivityList activity={ctx.activity} />
    </section>
  )
}
