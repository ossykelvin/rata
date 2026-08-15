import type { ActivityEvent } from '../types'

export function ActivityList({ activity }: { activity: ActivityEvent[] }) {
  if (!activity.length) return <p className="empty-state">No activity yet. Ask Rata to open Notepad or calculate 36 * 14.</p>
  return (
    <div className="activity-list">
      {activity.map(item => (
        <div className="activity-item" key={item.id}>
          <span className={`activity-icon activity-${item.status}`}>•</span>
          <div>
            <strong>{item.action}</strong>
            <p>{item.detail}</p>
          </div>
          <time>{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        </div>
      ))}
    </div>
  )
}
