'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHavenData } from '@/components/data-provider'
import {
  assetSchema,
  auditSchema,
  complianceSchema,
  incidentSchema,
  residentSchema,
  staffSchema,
  type CreateKind
} from '@/lib/schemas'
import { cn } from '@/lib/utils'

type Field = {
  name: string
  label: string
  type?: 'text' | 'date' | 'time' | 'number' | 'textarea' | 'select'
  options?: string[]
  defaultValue?: string | number
  placeholder?: string
  wide?: boolean
}

const kloeOptions = ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led']

const configurations: Record<CreateKind, { title: string; description: string; submit: string; fields: Field[] }> = {
  resident: {
    title: 'Add resident',
    description: 'Create a resident profile and set the first care-plan review.',
    submit: 'Add resident',
    fields: [
      { name: 'name', label: 'Full name', placeholder: 'e.g. Mary Jones', wide: true },
      { name: 'room', label: 'Room', placeholder: 'e.g. 14B' },
      { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
      { name: 'risk', label: 'Risk level', type: 'select', options: ['Low', 'Medium', 'High'], defaultValue: 'Low' },
      { name: 'status', label: 'Residency status', type: 'select', options: ['Active', 'Hospital', 'Respite'] },
      { name: 'nextReview', label: 'Next care-plan review', type: 'date', wide: true }
    ]
  },
  staff: {
    title: 'Add staff member',
    description: 'Add an employee and their core workforce compliance dates.',
    submit: 'Add staff member',
    fields: [
      { name: 'name', label: 'Full name', placeholder: 'e.g. Hannah Green' },
      { name: 'role', label: 'Role', placeholder: 'e.g. Care Assistant' },
      {
        name: 'employment',
        label: 'Employment type',
        type: 'select',
        options: ['Permanent', 'Bank', 'Agency']
      },
      {
        name: 'status',
        label: 'Compliance status',
        type: 'select',
        options: ['Compliant', 'Due soon', 'Action required']
      },
      { name: 'dbsExpiry', label: 'DBS expiry', type: 'date' },
      { name: 'nextTraining', label: 'Next training', type: 'date' },
      { name: 'supervisionDate', label: 'Next supervision', type: 'date', wide: true }
    ]
  },
  audit: {
    title: 'Schedule audit',
    description: 'Plan a quality audit against one of the five CQC KLOEs.',
    submit: 'Schedule audit',
    fields: [
      { name: 'title', label: 'Audit title', placeholder: 'e.g. Infection control', wide: true },
      { name: 'kloe', label: 'CQC KLOE', type: 'select', options: kloeOptions },
      { name: 'auditor', label: 'Auditor', placeholder: 'e.g. Olivia Bennett' },
      { name: 'date', label: 'Audit date', type: 'date' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: ['Scheduled', 'In progress', 'Complete']
      },
      { name: 'score', label: 'Current score (%)', type: 'number', defaultValue: 0 }
    ]
  },
  compliance: {
    title: 'Add compliance check',
    description: 'Assign a trackable compliance check to a CQC key line of enquiry.',
    submit: 'Add check',
    fields: [
      { name: 'title', label: 'Check title', placeholder: 'e.g. Night staffing spot check', wide: true },
      { name: 'kloe', label: 'CQC KLOE', type: 'select', options: kloeOptions },
      { name: 'owner', label: 'Owner', placeholder: 'e.g. Amelia Wright' },
      { name: 'dueDate', label: 'Due date', type: 'date' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: ['Compliant', 'In progress', 'Action required', 'Overdue'],
        defaultValue: 'In progress'
      },
      { name: 'progress', label: 'Progress (%)', type: 'number', defaultValue: 0 }
    ]
  },
  incident: {
    title: 'Report incident',
    description: 'Record the initial facts. Sensitive details should remain factual and necessary.',
    submit: 'Report incident',
    fields: [
      {
        name: 'type',
        label: 'Incident type',
        type: 'select',
        options: ['Fall', 'Medication', 'Safeguarding', 'Behaviour', 'Skin integrity', 'Other']
      },
      {
        name: 'severity',
        label: 'Severity',
        type: 'select',
        options: ['Low', 'Medium', 'High', 'Critical'],
        defaultValue: 'Medium'
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: ['Open', 'Investigating', 'Closed'],
        defaultValue: 'Open'
      },
      { name: 'location', label: 'Location', placeholder: 'e.g. Ground floor lounge' },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'time', label: 'Time', type: 'time' },
      { name: 'resident', label: 'Resident', placeholder: 'e.g. Margaret Wilson' },
      { name: 'reporter', label: 'Reported by', placeholder: 'e.g. Jack Thompson' },
      {
        name: 'summary',
        label: 'Factual summary',
        type: 'textarea',
        placeholder: 'What happened and what immediate action was taken?',
        wide: true
      }
    ]
  },
  asset: {
    title: 'Register asset',
    description: 'Add equipment to the service, warranty, and condition register.',
    submit: 'Register asset',
    fields: [
      { name: 'name', label: 'Asset name', placeholder: 'e.g. Mobile shower chair' },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: ['Medical', 'Safety', 'Mobility', 'Furniture']
      },
      { name: 'serial', label: 'Serial number', placeholder: 'e.g. MSC-20441' },
      { name: 'location', label: 'Location', placeholder: 'e.g. Ground floor wet room' },
      { name: 'purchaseDate', label: 'Purchase date', type: 'date' },
      { name: 'warrantyUntil', label: 'Warranty until', type: 'date' },
      { name: 'lastService', label: 'Last service', type: 'date' },
      { name: 'nextService', label: 'Next service', type: 'date' },
      {
        name: 'condition',
        label: 'Condition',
        type: 'select',
        options: ['Excellent', 'Good', 'Fair', 'Poor'],
        defaultValue: 'Good'
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: ['Operational', 'Service due', 'Out of service']
      }
    ]
  }
}

function FormField({ field }: { field: Field }) {
  const id = `create-${field.name}`
  return (
    <div className={cn('space-y-2', field.wide && 'sm:col-span-2')}>
      <Label htmlFor={id}>{field.label}</Label>
      {field.type === 'select' ? (
        <select
          id={id}
          name={field.name}
          defaultValue={field.defaultValue ?? field.options?.[0]}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          {field.options?.map(option => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          id={id}
          name={field.name}
          required
          placeholder={field.placeholder}
          className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      ) : (
        <Input
          id={id}
          name={field.name}
          type={field.type ?? 'text'}
          defaultValue={field.defaultValue}
          placeholder={field.placeholder}
          min={field.type === 'number' ? 0 : undefined}
          max={field.type === 'number' ? 100 : undefined}
          required
        />
      )}
    </div>
  )
}

export function CreateDialog({ kind, children }: { kind: CreateKind; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const data = useHavenData()
  const configuration = configurations[kind]

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))

    const fail = (message: string) => setError(message)

    switch (kind) {
      case 'resident': {
        const result = residentSchema.safeParse(values)
        if (!result.success) return fail(result.error.issues[0].message)
        data.addResident(result.data)
        break
      }
      case 'staff': {
        const result = staffSchema.safeParse(values)
        if (!result.success) return fail(result.error.issues[0].message)
        data.addStaff(result.data)
        break
      }
      case 'audit': {
        const result = auditSchema.safeParse(values)
        if (!result.success) return fail(result.error.issues[0].message)
        data.addAudit(result.data)
        break
      }
      case 'compliance': {
        const result = complianceSchema.safeParse(values)
        if (!result.success) return fail(result.error.issues[0].message)
        data.addCompliance(result.data)
        break
      }
      case 'incident': {
        const result = incidentSchema.safeParse(values)
        if (!result.success) return fail(result.error.issues[0].message)
        data.addIncident(result.data)
        break
      }
      case 'asset': {
        const result = assetSchema.safeParse(values)
        if (!result.success) return fail(result.error.issues[0].message)
        data.addAsset(result.data)
        break
      }
    }

    event.currentTarget.reset()
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        setOpen(nextOpen)
        if (nextOpen) setError('')
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{configuration.title}</DialogTitle>
          <DialogDescription>{configuration.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {configuration.fields.map(field => (
              <FormField field={field} key={field.name} />
            ))}
          </div>
          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">{configuration.submit}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
