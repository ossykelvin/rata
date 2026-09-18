'use client'

import { useMemo, useState } from 'react'
import { BedDouble, CalendarClock, HeartPulse, Plus, Users } from 'lucide-react'
import { CreateDialog } from '@/components/create-dialog'
import { useHavenData } from '@/components/data-provider'
import { EmptyState, FilterSelect, PageHeader, SearchBox, StatCard, StatusBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'

export function ResidentsPage() {
  const { residents } = useHavenData()
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState('All risk levels')
  const [status, setStatus] = useState('All statuses')

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return residents.filter(
      resident =>
        (!query ||
          resident.name.toLowerCase().includes(query) ||
          resident.room.toLowerCase().includes(query) ||
          resident.id.toLowerCase().includes(query)) &&
        (risk === 'All risk levels' || resident.risk === risk) &&
        (status === 'All statuses' || resident.status === status)
    )
  }, [residents, risk, search, status])

  return (
    <>
      <PageHeader
        title="Residents"
        description="Care-plan assurance, medication reviews, and risk at a glance."
        action={
          <CreateDialog kind="resident">
            <Button>
              <Plus /> Add resident
            </Button>
          </CreateDialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Current residents" value={residents.length} detail="91% occupancy" icon={Users} />
        <StatCard
          title="Active in home"
          value={residents.filter(item => item.status === 'Active').length}
          detail="Including permanent placements"
          icon={BedDouble}
          tone="green"
        />
        <StatCard
          title="High risk"
          value={residents.filter(item => item.risk === 'High').length}
          detail="Enhanced oversight in place"
          icon={HeartPulse}
          tone="red"
        />
        <StatCard
          title="Reviews due"
          value={residents.filter(item => item.carePlan === 'Review due').length}
          detail="Before month end"
          icon={CalendarClock}
          tone="amber"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resident register</CardTitle>
          <div className="flex flex-col gap-3 pt-3 md:flex-row">
            <SearchBox value={search} onChange={setSearch} placeholder="Search resident, room or ID..." />
            <FilterSelect
              label="Filter by risk"
              value={risk}
              onChange={setRisk}
              options={['All risk levels', 'Low', 'Medium', 'High']}
            />
            <FilterSelect
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={['All statuses', 'Active', 'Hospital', 'Respite']}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resident</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Care plan</TableHead>
                  <TableHead>Medication</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Next review</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(resident => (
                  <TableRow key={resident.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                          {resident.name
                            .split(' ')
                            .map(part => part[0])
                            .join('')}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">{resident.name}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{resident.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-700">{resident.room}</TableCell>
                    <TableCell>
                      <StatusBadge value={resident.carePlan} />
                    </TableCell>
                    <TableCell>{resident.medication}</TableCell>
                    <TableCell>
                      <StatusBadge value={resident.risk} />
                    </TableCell>
                    <TableCell>{formatDate(resident.nextReview)}</TableCell>
                    <TableCell>
                      <StatusBadge value={resident.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="No residents found" description="Try another filter or add a new resident profile." />
          )}
        </CardContent>
      </Card>
    </>
  )
}
