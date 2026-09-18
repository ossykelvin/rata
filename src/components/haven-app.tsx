'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Building2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileBarChart,
  Gauge,
  Menu,
  ShieldAlert,
  Stethoscope,
  TriangleAlert,
  Users,
  Wrench,
  X,
  type LucideIcon
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useHavenData } from '@/components/data-provider'
import { cn } from '@/lib/utils'
import { DashboardPage } from '@/components/pages/dashboard-page'
import { CompliancePage } from '@/components/pages/compliance-page'
import { ResidentsPage } from '@/components/pages/residents-page'
import { StaffPage } from '@/components/pages/staff-page'
import { AuditsPage } from '@/components/pages/audits-page'
import { ReportsPage } from '@/components/pages/reports-page'
import { IncidentsPage } from '@/components/pages/incidents-page'
import { AssetsPage } from '@/components/pages/assets-page'
import { NotificationsPage } from '@/components/pages/notifications-page'

type NavItem = { name: string; href: string; icon: LucideIcon }

const mainNav: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: Gauge },
  { name: 'Compliance Checks', href: '/compliance-checks', icon: ClipboardCheck },
  { name: 'Residents', href: '/residents', icon: Users },
  { name: 'Staff', href: '/staff', icon: Stethoscope },
  { name: 'Audits', href: '/audits', icon: CalendarCheck },
  { name: 'Reports', href: '/reports', icon: FileBarChart }
]

const operationsNav: NavItem[] = [
  { name: 'Incidents', href: '/incidents', icon: ShieldAlert },
  { name: 'Assets', href: '/assets', icon: Wrench },
  { name: 'Notifications', href: '/notifications', icon: Bell }
]

const pageMetadata: Record<string, { label: string; eyebrow: string }> = {
  '/': { label: 'Dashboard', eyebrow: 'Rosewood House' },
  '/compliance-checks': { label: 'Compliance Checks', eyebrow: 'Quality & compliance' },
  '/residents': { label: 'Residents', eyebrow: 'Care records' },
  '/staff': { label: 'Staff', eyebrow: 'Workforce' },
  '/audits': { label: 'Audits', eyebrow: 'Quality assurance' },
  '/reports': { label: 'Reports', eyebrow: 'Insights' },
  '/incidents': { label: 'Incidents', eyebrow: 'Safety management' },
  '/assets': { label: 'Assets', eyebrow: 'Equipment register' },
  '/notifications': { label: 'Notifications', eyebrow: 'Updates & alerts' }
}

function Navigation({
  items,
  collapsed,
  pathname,
  onNavigate
}: {
  items: NavItem[]
  collapsed: boolean
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <nav className="space-y-1">
      {items.map(item => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.name : undefined}
            className={cn(
              'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
              active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
              collapsed && 'justify-center px-0'
            )}
          >
            {active ? <span className="absolute -left-3 h-5 w-1 rounded-r-full bg-blue-600" /> : null}
            <Icon className={cn('size-[18px] shrink-0', active ? 'text-blue-600' : 'text-slate-400')} />
            {!collapsed ? <span>{item.name}</span> : null}
          </Link>
        )
      })}
    </nav>
  )
}

function Sidebar({
  collapsed,
  pathname,
  onCollapse,
  mobile,
  onClose
}: {
  collapsed: boolean
  pathname: string
  onCollapse: () => void
  mobile?: boolean
  onClose?: () => void
}) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-slate-200 bg-white transition-[width] duration-200',
        collapsed ? 'w-[76px]' : 'w-[256px]'
      )}
    >
      <div className={cn('flex h-20 items-center border-b border-slate-100 px-5', collapsed && 'justify-center px-0')}>
        <Link href="/" className="flex min-w-0 items-center gap-3" onClick={onClose}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Building2 className="size-5" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block text-lg font-bold tracking-tight text-slate-950">Haven</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Care compliance
              </span>
            </span>
          ) : null}
        </Link>
        {mobile ? (
          <Button variant="ghost" size="icon" className="ml-auto" onClick={onClose} aria-label="Close navigation">
            <X />
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed ? (
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Overview</p>
        ) : null}
        <Navigation items={mainNav} collapsed={collapsed} pathname={pathname} onNavigate={onClose} />
        <div className="my-5 border-t border-slate-100" />
        {!collapsed ? (
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Operations</p>
        ) : null}
        <Navigation items={operationsNav} collapsed={collapsed} pathname={pathname} onNavigate={onClose} />
      </div>

      <div className="border-t border-slate-100 p-3">
        {!collapsed ? (
          <div className="mb-3 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                OB
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800">Olivia Bennett</span>
                <span className="block truncate text-xs text-slate-500">Home Manager</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-3 grid place-items-center">
            <span className="grid size-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              OB
            </span>
          </div>
        )}
        {!mobile ? (
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            className={cn('w-full', !collapsed && 'justify-start')}
            onClick={onCollapse}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
            {!collapsed ? 'Collapse sidebar' : <span className="sr-only">Expand sidebar</span>}
          </Button>
        ) : null}
      </div>
    </aside>
  )
}

function CurrentPage({ pathname }: { pathname: string }) {
  switch (pathname) {
    case '/compliance-checks':
      return <CompliancePage />
    case '/residents':
      return <ResidentsPage />
    case '/staff':
      return <StaffPage />
    case '/audits':
      return <AuditsPage />
    case '/reports':
      return <ReportsPage />
    case '/incidents':
      return <IncidentsPage />
    case '/assets':
      return <AssetsPage />
    case '/notifications':
      return <NotificationsPage />
    default:
      return <DashboardPage />
  }
}

export function HavenApp() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { notifications } = useHavenData()
  const unread = notifications.filter(notification => !notification.read).length
  const meta = pageMetadata[pathname] ?? pageMetadata['/']

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <Sidebar collapsed={collapsed} pathname={pathname} onCollapse={() => setCollapsed(value => !value)} />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/30"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-[280px]">
            <Sidebar
              collapsed={false}
              pathname={pathname}
              onCollapse={() => undefined}
              mobile
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div
        className={cn('min-h-screen transition-[margin] duration-200', collapsed ? 'lg:ml-[76px]' : 'lg:ml-[256px]')}
      >
        <header className="sticky top-0 z-30 flex h-20 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">{meta.eyebrow}</p>
            <p className="mt-0.5 font-semibold text-slate-900">{meta.label}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-slate-400">Friday, 18 September</p>
              <p className="text-sm font-semibold text-slate-700">Rosewood House</p>
            </div>
            <Link
              href="/notifications"
              className="relative grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-blue-600"
              aria-label={`${unread} unread notifications`}
            >
              <Bell className="size-[18px]" />
              {unread ? (
                <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-white">
                  {unread}
                </span>
              ) : null}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
          <CurrentPage pathname={pathname} />
        </main>
      </div>
    </div>
  )
}
