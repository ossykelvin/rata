'use client'

import { useMemo, useState } from 'react'
import { BadgeCheck, BriefcaseBusiness, GraduationCap, Plus, UserRoundCheck } from 'lucide-react'
import { CreateDialog } from '@/components/create-dialog'
import { useHavenData } from '@/components/data-provider'
import { EmptyState, FilterSelect, PageHeader, SearchBox, StatCard, StatusBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'

export function StaffPage() {
  const { staff } = useHavenData()
  const [search, setSearch] = useState('')
  const [employment, setEmployment] = useState('All employment')
  const [status, setStatus] = useState('All statuses')

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return staff.filter(
      member =>
        (!query ||
          member.name.toLowerCase().includes(query) ||
          member.role.toLowerCase().includes(query) ||
          member.id.toLowerCase().includes(query)) &&
        (employment === 'All employment' || member.employment === employment) &&
        (status === 'All statuses' || member.status === status)
    )
  }, [employment, search, staff, status])

  return (
    <>
      <PageHeader
        title="Staff"
        description="Monitor DBS, training, supervision, and workforce compliance."
        action={
          <CreateDialog kind="staff">
            <Button>
              <Plus /> Add staff
            </Button>
          </CreateDialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Team members"
          value={staff.length}
          detail="Across all employment types"
          icon={BriefcaseBusiness}
        />
        <StatCard
          title="Fully compliant"
          value={staff.filter(item => item.status === 'Compliant').length}
          detail="DBS and training current"
          icon={BadgeCheck}
          tone="green"
        />
        <StatCard
          title="Training due"
          value={staff.filter(item => item.status === 'Due soon').length}
          detail="Within the next 30 days"
          icon={GraduationCap}
          tone="amber"
        />
        <StatCard
          title="Action required"
          value={staff.filter(item => item.status === 'Action required').length}
          detail="Manager follow-up needed"
          icon={UserRoundCheck}
          tone="red"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workforce compliance</CardTitle>
          <div className="flex flex-col gap-3 pt-3 md:flex-row">
            <SearchBox value={search} onChange={setSearch} placeholder="Search name, role or ID..." />
            <FilterSelect
              label="Filter by employment type"
              value={employment}
              onChange={setEmployment}
              options={['All employment', 'Permanent', 'Bank', 'Agency']}
            />
            <FilterSelect
              label="Filter by compliance status"
              value={status}
              onChange={setStatus}
              options={['All statuses', 'Compliant', 'Due soon', 'Action required']}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  <TableHead>Employment</TableHead>
                  <TableHead>DBS expiry</TableHead>
                  <TableHead>Next training</TableHead>
                  <TableHead>Supervision</TableHead>
                  <TableHead className="min-w-40">Completion</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(member => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <p className="font-semibold text-slate-800">{member.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{member.role}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={member.employment} />
                    </TableCell>
                    <TableCell>{formatDate(member.dbsExpiry)}</TableCell>
                    <TableCell>{formatDate(member.nextTraining)}</TableCell>
                    <TableCell>{formatDate(member.supervisionDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Progress value={member.completion} />
                        <span className="w-8 text-xs font-semibold">{member.completion}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={member.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="No staff found" description="Try another filter or add a new staff member." />
          )}
        </CardContent>
      </Card>
    </>
  )
}
