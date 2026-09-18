'use client'

import { useMemo, useState } from 'react'
import { CircleOff, PackageCheck, Plus, ShieldCheck, Wrench } from 'lucide-react'
import { CreateDialog } from '@/components/create-dialog'
import { useHavenData } from '@/components/data-provider'
import { EmptyState, FilterSelect, PageHeader, SearchBox, StatCard, StatusBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'

export function AssetsPage() {
  const { assets } = useHavenData()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const [status, setStatus] = useState('All statuses')

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return assets.filter(
      asset =>
        (!query ||
          asset.name.toLowerCase().includes(query) ||
          asset.serial.toLowerCase().includes(query) ||
          asset.location.toLowerCase().includes(query)) &&
        (category === 'All categories' || asset.category === category) &&
        (status === 'All statuses' || asset.status === status)
    )
  }, [assets, category, search, status])

  return (
    <>
      <PageHeader
        title="Assets"
        description="Manage medical, safety, mobility, and furniture equipment across the home."
        action={
          <CreateDialog kind="asset">
            <Button>
              <Plus /> Register asset
            </Button>
          </CreateDialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Registered assets" value={assets.length} detail="Across all locations" icon={PackageCheck} />
        <StatCard
          title="Operational"
          value={assets.filter(item => item.status === 'Operational').length}
          detail="Available for use"
          icon={ShieldCheck}
          tone="green"
        />
        <StatCard
          title="Service due"
          value={assets.filter(item => item.status === 'Service due').length}
          detail="Planned maintenance required"
          icon={Wrench}
          tone="amber"
        />
        <StatCard
          title="Out of service"
          value={assets.filter(item => item.status === 'Out of service').length}
          detail="Unavailable and isolated"
          icon={CircleOff}
          tone="red"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asset register</CardTitle>
          <div className="flex flex-col gap-3 pt-3 md:flex-row">
            <SearchBox value={search} onChange={setSearch} placeholder="Search asset, serial or location..." />
            <FilterSelect
              label="Filter by asset category"
              value={category}
              onChange={setCategory}
              options={['All categories', 'Medical', 'Safety', 'Mobility', 'Furniture']}
            />
            <FilterSelect
              label="Filter by asset status"
              value={status}
              onChange={setStatus}
              options={['All statuses', 'Operational', 'Service due', 'Out of service']}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Purchase / warranty</TableHead>
                  <TableHead>Service dates</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(asset => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <p className="font-semibold text-slate-800">{asset.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{asset.id}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={asset.category} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{asset.serial}</TableCell>
                    <TableCell>
                      <p>{formatDate(asset.purchaseDate)}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Warranty: {formatDate(asset.warrantyUntil)}</p>
                    </TableCell>
                    <TableCell>
                      <p>Last: {formatDate(asset.lastService)}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Next: {formatDate(asset.nextService)}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={asset.condition} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={asset.status} />
                    </TableCell>
                    <TableCell>{asset.location}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="No assets found" description="Try another filter or register new equipment." />
          )}
        </CardContent>
      </Card>
    </>
  )
}
