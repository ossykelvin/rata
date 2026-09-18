'use client'

import { useMemo, useState } from 'react'
import { AlertOctagon, Clock3, FileWarning, Plus, SearchCheck } from 'lucide-react'
import { CreateDialog } from '@/components/create-dialog'
import { useHavenData } from '@/components/data-provider'
import { EmptyState, FilterSelect, PageHeader, SearchBox, StatCard, StatusBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { incidentCounts } from '@/lib/metrics'
import { cn, formatDate } from '@/lib/utils'

const statusTabs = ['All', 'Open', 'Investigating', 'Closed'] as const

export function IncidentsPage() {
  const { incidents } = useHavenData()
  const [tab, setTab] = useState<(typeof statusTabs)[number]>('All')
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('All severities')
  const [type, setType] = useState('All types')
  const counts = incidentCounts({ incidents })

  const types = useMemo(
    () => ['All types', ...Array.from(new Set(incidents.map(incident => incident.type)))],
    [incidents]
  )

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return incidents.filter(
      incident =>
        (!query ||
          incident.reference.toLowerCase().includes(query) ||
          incident.resident.toLowerCase().includes(query) ||
          incident.location.toLowerCase().includes(query) ||
          incident.reporter.toLowerCase().includes(query)) &&
        (tab === 'All' || incident.status === tab) &&
        (severity === 'All severities' || incident.severity === severity) &&
        (type === 'All types' || incident.type === type)
    )
  }, [incidents, search, severity, tab, type])

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Report, investigate, and close incidents with clear management oversight."
        action={
          <CreateDialog kind="incident">
            <Button>
              <Plus /> Report incident
            </Button>
          </CreateDialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total incidents" value={counts.total} detail="Recorded this period" icon={FileWarning} />
        <StatCard title="Open" value={counts.open} detail="Awaiting initial action" icon={Clock3} tone="amber" />
        <StatCard
          title="Investigating"
          value={counts.investigating}
          detail="Review in progress"
          icon={SearchCheck}
          tone="blue"
        />
        <StatCard
          title="Critical"
          value={counts.critical}
          detail="Immediate oversight"
          icon={AlertOctagon}
          tone="red"
        />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 sm:w-fit">
            {statusTabs.map(status => {
              const count =
                status === 'All' ? incidents.length : incidents.filter(incident => incident.status === status).length
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setTab(status)}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-semibold transition',
                    tab === status ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  {status} <span className="ml-1 text-xs opacity-70">{count}</span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <SearchBox value={search} onChange={setSearch} placeholder="Search reference, resident, location..." />
            <FilterSelect
              label="Filter by incident severity"
              value={severity}
              onChange={setSeverity}
              options={['All severities', 'Low', 'Medium', 'High', 'Critical']}
            />
            <FilterSelect label="Filter by incident type" value={type} onChange={setType} options={types} />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Incident</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Resident / reporter</TableHead>
                  <TableHead>Date & time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(incident => (
                  <TableRow key={incident.id}>
                    <TableCell className="max-w-[260px]">
                      <p className="font-semibold text-slate-800">{incident.reference}</p>
                      <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500" title={incident.summary}>
                        {incident.summary}
                      </p>
                    </TableCell>
                    <TableCell className="font-medium">{incident.type}</TableCell>
                    <TableCell>
                      <StatusBadge value={incident.severity} />
                    </TableCell>
                    <TableCell>{incident.location}</TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-700">{incident.resident}</p>
                      <p className="mt-0.5 text-xs text-slate-400">by {incident.reporter}</p>
                    </TableCell>
                    <TableCell>
                      <p>{formatDate(incident.date)}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{incident.time}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={incident.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="No incidents found" description="Try another filter or report a new incident." />
          )}
        </CardContent>
      </Card>
    </>
  )
}
