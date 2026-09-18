'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Clock3, Plus, TriangleAlert } from 'lucide-react'
import { CreateDialog } from '@/components/create-dialog'
import { useHavenData } from '@/components/data-provider'
import { EmptyState, FilterSelect, PageHeader, SearchBox, StatCard, StatusBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'

export function CompliancePage() {
  const { complianceChecks } = useHavenData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [kloe, setKloe] = useState('All KLOEs')

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return complianceChecks.filter(
      check =>
        (!query ||
          check.title.toLowerCase().includes(query) ||
          check.owner.toLowerCase().includes(query) ||
          check.id.toLowerCase().includes(query)) &&
        (status === 'All statuses' || check.status === status) &&
        (kloe === 'All KLOEs' || check.kloe === kloe)
    )
  }, [complianceChecks, search, status, kloe])

  return (
    <>
      <PageHeader
        title="Compliance checks"
        description="Track assurance evidence and actions against CQC expectations."
        action={
          <CreateDialog kind="compliance">
            <Button>
              <Plus /> Add check
            </Button>
          </CreateDialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total checks"
          value={complianceChecks.length}
          detail="Across five KLOEs"
          icon={ClipboardCheck}
        />
        <StatCard
          title="Compliant"
          value={complianceChecks.filter(item => item.status === 'Compliant').length}
          detail="Evidence complete"
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard
          title="In progress"
          value={complianceChecks.filter(item => item.status === 'In progress').length}
          detail="Owned by your team"
          icon={Clock3}
          tone="blue"
        />
        <StatCard
          title="Needs attention"
          value={complianceChecks.filter(item => ['Action required', 'Overdue'].includes(item.status)).length}
          detail="Review priority actions"
          icon={TriangleAlert}
          tone="red"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance register</CardTitle>
          <div className="flex flex-col gap-3 pt-3 md:flex-row">
            <SearchBox value={search} onChange={setSearch} placeholder="Search check, owner or reference..." />
            <FilterSelect
              label="Filter by CQC KLOE"
              value={kloe}
              onChange={setKloe}
              options={['All KLOEs', 'Safe', 'Effective', 'Caring', 'Responsive', 'Well-led']}
            />
            <FilterSelect
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={['All statuses', 'Compliant', 'In progress', 'Action required', 'Overdue']}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check</TableHead>
                  <TableHead>KLOE</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-44">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(check => (
                  <TableRow key={check.id}>
                    <TableCell>
                      <p className="font-semibold text-slate-800">{check.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{check.id}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={check.kloe} />
                    </TableCell>
                    <TableCell>{check.owner}</TableCell>
                    <TableCell>{formatDate(check.dueDate)}</TableCell>
                    <TableCell>
                      <StatusBadge value={check.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Progress value={check.progress} />
                        <span className="w-9 text-xs font-semibold text-slate-600">{check.progress}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="No checks found" description="Try another filter or add a new compliance check." />
          )}
        </CardContent>
      </Card>
    </>
  )
}
