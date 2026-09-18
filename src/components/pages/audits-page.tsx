'use client'

import { useMemo, useState } from 'react'
import { CalendarCheck, CheckCheck, ClipboardList, ListChecks, Plus } from 'lucide-react'
import { CreateDialog } from '@/components/create-dialog'
import { useHavenData } from '@/components/data-provider'
import { EmptyState, FilterSelect, PageHeader, SearchBox, StatCard, StatusBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'

export function AuditsPage() {
  const { audits } = useHavenData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [kloe, setKloe] = useState('All KLOEs')

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return audits.filter(
      audit =>
        (!query ||
          audit.title.toLowerCase().includes(query) ||
          audit.auditor.toLowerCase().includes(query) ||
          audit.id.toLowerCase().includes(query)) &&
        (status === 'All statuses' || audit.status === status) &&
        (kloe === 'All KLOEs' || audit.kloe === kloe)
    )
  }, [audits, kloe, search, status])

  const completed = audits.filter(audit => audit.status === 'Complete')
  const average = completed.length
    ? Math.round(completed.reduce((total, audit) => total + audit.score, 0) / completed.length)
    : 0

  return (
    <>
      <PageHeader
        title="Audits"
        description="Schedule assurance reviews, record scores, and manage resulting actions."
        action={
          <CreateDialog kind="audit">
            <Button>
              <Plus /> Schedule audit
            </Button>
          </CreateDialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total audits" value={audits.length} detail="Current assurance cycle" icon={ClipboardList} />
        <StatCard
          title="Scheduled"
          value={audits.filter(item => item.status === 'Scheduled').length}
          detail="Next 30 days"
          icon={CalendarCheck}
          tone="blue"
        />
        <StatCard
          title="Average score"
          value={`${average}%`}
          detail="Across completed audits"
          icon={CheckCheck}
          tone="green"
        />
        <StatCard
          title="Open actions"
          value={audits.reduce((total, audit) => total + audit.actions, 0)}
          detail="From recent findings"
          icon={ListChecks}
          tone="amber"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit programme</CardTitle>
          <div className="flex flex-col gap-3 pt-3 md:flex-row">
            <SearchBox value={search} onChange={setSearch} placeholder="Search audit, auditor or ID..." />
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
              options={['All statuses', 'Scheduled', 'In progress', 'Complete']}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Audit</TableHead>
                  <TableHead>KLOE</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-40">Score</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(audit => (
                  <TableRow key={audit.id}>
                    <TableCell>
                      <p className="font-semibold text-slate-800">{audit.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{audit.id}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={audit.kloe} />
                    </TableCell>
                    <TableCell>{audit.auditor}</TableCell>
                    <TableCell>{formatDate(audit.date)}</TableCell>
                    <TableCell>
                      <StatusBadge value={audit.status} />
                    </TableCell>
                    <TableCell>
                      {audit.status === 'Scheduled' ? (
                        <span className="text-slate-400">Not started</span>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Progress value={audit.score} />
                          <span className="w-8 text-xs font-semibold">{audit.score}%</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-700">{audit.actions}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="No audits found" description="Try another filter or schedule a new quality audit." />
          )}
        </CardContent>
      </Card>
    </>
  )
}
