'use client'

import Link from 'next/link'
import { Activity, ArrowUpRight, CheckCircle2, ClipboardCheck, ShieldCheck, TriangleAlert, Users } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useHavenData } from '@/components/data-provider'
import { PageHeader, StatCard, StatusBadge } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { complianceTrend, incidentTrend, kloeScores } from '@/lib/mock-data'
import { complianceScore, openActionCount } from '@/lib/metrics'
import { formatDate } from '@/lib/utils'

const chartTooltipStyle = {
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 28px rgba(15, 23, 42, 0.08)',
  fontSize: '12px'
}

export function DashboardPage() {
  const data = useHavenData()
  const score = complianceScore(data)
  const openActions = openActionCount(data)
  const openIncidents = data.incidents.filter(incident => incident.status !== 'Closed').length

  return (
    <>
      <PageHeader
        title="Good morning, Olivia"
        description="Here’s what’s happening across Rosewood House today."
        action={
          <Button asChild variant="outline">
            <Link href="/reports">
              View monthly report <ArrowUpRight />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Overall compliance"
          value={`${score}%`}
          detail="+3.2% from last month"
          icon={ShieldCheck}
          tone="blue"
        />
        <StatCard
          title="Open actions"
          value={openActions}
          detail="4 actions due this week"
          icon={ClipboardCheck}
          tone="amber"
        />
        <StatCard
          title="Residents"
          value={data.residents.length}
          detail={`${data.residents.filter(resident => resident.risk === 'High').length} high-risk care plans`}
          icon={Users}
          tone="violet"
        />
        <StatCard
          title="Open incidents"
          value={openIncidents}
          detail={`${data.incidents.filter(incident => incident.severity === 'Critical').length} critical priority`}
          icon={TriangleAlert}
          tone={openIncidents ? 'red' : 'green'}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>CQC key lines of enquiry</CardTitle>
            <CardDescription>Current assurance score across all five KLOEs</CardDescription>
          </div>
          <Badge variant="blue">Inspection ready</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {kloeScores.map(item => (
            <div key={item.name} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-4 flex items-start justify-between">
                <span
                  className="grid size-8 place-items-center rounded-lg text-white"
                  style={{ backgroundColor: item.colour }}
                >
                  <CheckCircle2 className="size-4" />
                </span>
                <span className="text-2xl font-bold text-slate-900">{item.score}%</span>
              </div>
              <p className="font-semibold text-slate-800">{item.name}</p>
              <Progress value={item.score} className="mt-3 h-1.5" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Compliance trend</CardTitle>
              <CardDescription>Six-month assurance performance</CardDescription>
            </div>
            <Badge variant="green">+8% since April</Badge>
          </CardHeader>
          <CardContent className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={complianceTrend} margin={{ left: -18, right: 8, top: 12 }}>
                <defs>
                  <linearGradient id="complianceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis domain={[70, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="overall"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fill="url(#complianceFill)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incident activity</CardTitle>
            <CardDescription>Reported versus closed each month</CardDescription>
          </CardHeader>
          <CardContent className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentTrend} margin={{ left: -25, right: 6, top: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="incidents" fill="#2563eb" radius={[5, 5, 0, 0]} />
                <Bar dataKey="closed" fill="#93c5fd" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Priority compliance actions</CardTitle>
              <CardDescription>Items needing attention from your team</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/compliance-checks">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.complianceChecks
              .filter(check => check.status !== 'Compliant')
              .slice(0, 4)
              .map(check => (
                <div key={check.id} className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Activity className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{check.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {check.owner} · Due {formatDate(check.dueDate)}
                    </p>
                  </div>
                  <StatusBadge value={check.status} />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Latest notifications</CardTitle>
              <CardDescription>Recent updates across the home</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/notifications">Open inbox</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.notifications.slice(0, 4).map(notification => (
              <div key={notification.id} className="flex gap-3 rounded-lg px-2 py-3 hover:bg-slate-50">
                <span
                  className={`mt-1 size-2 shrink-0 rounded-full ${
                    notification.type === 'Alert'
                      ? 'bg-rose-500'
                      : notification.type === 'Warning'
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                  }`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{notification.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{notification.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
