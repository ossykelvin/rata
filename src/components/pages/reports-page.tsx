'use client'

import { Download, FileCheck2, FileText, LineChart as LineChartIcon, PieChart as PieChartIcon } from 'lucide-react'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useHavenData } from '@/components/data-provider'
import { PageHeader, StatCard, StatusBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { complianceTrend, kloeScores } from '@/lib/mock-data'
import { complianceScore } from '@/lib/metrics'

const reportRows = [
  { name: 'Monthly CQC compliance summary', category: 'Compliance', period: 'September 2026', status: 'Ready' },
  { name: 'Incidents and safeguarding overview', category: 'Safety', period: 'September 2026', status: 'Ready' },
  { name: 'Workforce compliance report', category: 'Staffing', period: 'Q3 2026', status: 'Ready' },
  { name: 'Resident care-plan assurance', category: 'Care quality', period: 'September 2026', status: 'Draft' }
]

export function ReportsPage() {
  const data = useHavenData()
  const openIncidents = data.incidents.filter(incident => incident.status !== 'Closed').length
  const compliantStaff = Math.round(
    (data.staff.filter(member => member.status === 'Compliant').length / data.staff.length) * 100
  )

  const downloadSummary = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Overall compliance', `${complianceScore(data)}%`],
      ['Residents', String(data.residents.length)],
      ['Staff compliance', `${compliantStaff}%`],
      ['Open incidents', String(openIncidents)]
    ]
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'haven-compliance-summary-september-2026.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Board-ready oversight across quality, safety, residents, and workforce."
        action={
          <Button onClick={downloadSummary}>
            <Download /> Export summary
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Compliance score"
          value={`${complianceScore(data)}%`}
          detail="Current assurance position"
          icon={LineChartIcon}
        />
        <StatCard
          title="Staff compliant"
          value={`${compliantStaff}%`}
          detail="Core checks in date"
          icon={FileCheck2}
          tone="green"
        />
        <StatCard
          title="Open incidents"
          value={openIncidents}
          detail="Requiring follow-up"
          icon={PieChartIcon}
          tone="red"
        />
        <StatCard title="Reports ready" value={3} detail="Updated this month" icon={FileText} tone="violet" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>CQC performance by domain</CardTitle>
            <CardDescription>Six-month movement for overall, Safe, and Effective assurance</CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={complianceTrend} margin={{ top: 10, right: 12, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis domain={[70, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                <Line type="monotone" dataKey="overall" stroke="#2563eb" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="safe" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="effective" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KLOE score distribution</CardTitle>
            <CardDescription>Relative assurance across the five CQC domains</CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={kloeScores}
                  dataKey="score"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={108}
                  paddingAngle={3}
                  stroke="none"
                >
                  {kloeScores.map(item => (
                    <Cell key={item.name} fill={item.colour} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report library</CardTitle>
          <CardDescription>Prepared outputs for governance meetings and assurance reviews</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportRows.map(report => (
                <TableRow key={report.name}>
                  <TableCell className="font-semibold text-slate-800">{report.name}</TableCell>
                  <TableCell>{report.category}</TableCell>
                  <TableCell>{report.period}</TableCell>
                  <TableCell>
                    <StatusBadge value={report.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={downloadSummary} aria-label={`Download ${report.name}`}>
                      <Download />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
