import type { LucideIcon } from 'lucide-react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  action
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = 'blue'
}: {
  title: string
  value: string | number
  detail: string
  icon: LucideIcon
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'violet'
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600'
  }
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1.5 text-xs text-slate-500">{detail}</p>
        </div>
        <div className={cn('rounded-xl p-2.5', tones[tone])}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

export function SearchBox({
  value,
  onChange,
  placeholder = 'Search records...'
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  )
}

export function FilterSelect({
  value,
  onChange,
  label,
  options
}: {
  value: string
  onChange: (value: string) => void
  label: string
  options: string[]
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={event => onChange(event.target.value)}
      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    >
      {options.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

export function StatusBadge({ value }: { value: string }) {
  const normal = value.toLowerCase()
  const variant =
    normal.includes('compliant') ||
    normal.includes('complete') ||
    normal.includes('closed') ||
    normal.includes('operational') ||
    normal === 'active' ||
    normal === 'excellent' ||
    normal === 'good'
      ? 'green'
      : normal.includes('overdue') ||
          normal.includes('critical') ||
          normal.includes('high') ||
          normal.includes('out of service') ||
          normal.includes('action required')
        ? 'red'
        : normal.includes('progress') ||
            normal.includes('investigating') ||
            normal.includes('scheduled') ||
            normal.includes('hospital')
          ? 'blue'
          : normal.includes('medium') || normal.includes('warning') || normal.includes('due') || normal.includes('fair')
            ? 'amber'
            : normal.includes('caring') || normal.includes('respite')
              ? 'purple'
              : 'slate'

  return <Badge variant={variant}>{value}</Badge>
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center p-8 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  )
}
