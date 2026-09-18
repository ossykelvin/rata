'use client'

import { useMemo, useState } from 'react'
import { Bell, BellDot, CheckCheck, CircleAlert, Trash2, TriangleAlert } from 'lucide-react'
import { useHavenData } from '@/components/data-provider'
import { EmptyState, PageHeader, StatCard, StatusBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const filters = ['All', 'Unread', 'Alerts', 'Warnings'] as const

export function NotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead, deleteNotification } = useHavenData()
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const unread = notifications.filter(notification => !notification.read).length

  const filtered = useMemo(
    () =>
      notifications.filter(notification => {
        if (filter === 'Unread') return !notification.read
        if (filter === 'Alerts') return notification.type === 'Alert'
        if (filter === 'Warnings') return notification.type === 'Warning'
        return true
      }),
    [filter, notifications]
  )

  const filterCount = (name: (typeof filters)[number]) => {
    if (name === 'Unread') return unread
    if (name === 'Alerts') return notifications.filter(item => item.type === 'Alert').length
    if (name === 'Warnings') return notifications.filter(item => item.type === 'Warning').length
    return notifications.length
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Keep on top of alerts, warnings, and operational updates."
        action={
          <Button variant="outline" onClick={markAllNotificationsRead} disabled={!unread}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="All notifications" value={notifications.length} detail="Current inbox" icon={Bell} />
        <StatCard title="Unread" value={unread} detail="Require review" icon={BellDot} tone="blue" />
        <StatCard
          title="High priority"
          value={notifications.filter(item => item.priority === 'High').length}
          detail="Manager attention"
          icon={CircleAlert}
          tone="red"
        />
        <StatCard
          title="Warnings"
          value={notifications.filter(item => item.type === 'Warning').length}
          detail="Upcoming deadlines"
          icon={TriangleAlert}
          tone="amber"
        />
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-fit">
        {filters.map(name => (
          <button
            type="button"
            key={name}
            onClick={() => setFilter(name)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition',
              filter === name
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            )}
          >
            {name} <span className="ml-1 text-xs opacity-75">{filterCount(name)}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="divide-y divide-slate-100 p-0">
          {filtered.length ? (
            filtered.map(notification => (
              <div
                key={notification.id}
                className={cn(
                  'flex flex-col gap-4 p-5 transition sm:flex-row sm:items-start',
                  !notification.read && 'bg-blue-50/40'
                )}
              >
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-xl',
                    notification.type === 'Alert'
                      ? 'bg-rose-100 text-rose-600'
                      : notification.type === 'Warning'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-blue-100 text-blue-600'
                  )}
                >
                  {notification.type === 'Alert' ? (
                    <CircleAlert className="size-5" />
                  ) : notification.type === 'Warning' ? (
                    <TriangleAlert className="size-5" />
                  ) : (
                    <Bell className="size-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {!notification.read ? <span className="size-2 rounded-full bg-blue-600" /> : null}
                    <p className="font-semibold text-slate-900">{notification.title}</p>
                    <StatusBadge value={notification.type} />
                    <StatusBadge value={`${notification.priority} priority`} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{notification.message}</p>
                  <p className="mt-2 text-xs font-medium text-slate-400">
                    {new Intl.DateTimeFormat('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    }).format(new Date(notification.date))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!notification.read ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markNotificationRead(notification.id)}
                      aria-label={`Mark ${notification.title} as read`}
                    >
                      <CheckCheck /> <span className="hidden sm:inline">Mark read</span>
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-rose-600"
                    onClick={() => deleteNotification(notification.id)}
                    aria-label={`Delete ${notification.title}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="Nothing here" description="No notifications match this filter." />
          )}
        </CardContent>
      </Card>
    </>
  )
}
