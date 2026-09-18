import { z } from 'zod'

const requiredText = (label: string) => z.string().trim().min(2, `${label} is required`)
const dateText = z.string().min(1, 'Choose a date')

export const residentSchema = z.object({
  name: requiredText('Resident name'),
  room: z.string().trim().min(1, 'Room is required'),
  dateOfBirth: dateText,
  risk: z.enum(['Low', 'Medium', 'High']),
  nextReview: dateText,
  status: z.enum(['Active', 'Hospital', 'Respite'])
})

export const staffSchema = z.object({
  name: requiredText('Staff name'),
  role: requiredText('Role'),
  employment: z.enum(['Permanent', 'Bank', 'Agency']),
  dbsExpiry: dateText,
  nextTraining: dateText,
  supervisionDate: dateText,
  status: z.enum(['Compliant', 'Due soon', 'Action required'])
})

export const auditSchema = z.object({
  title: requiredText('Audit title'),
  kloe: z.enum(['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led']),
  auditor: requiredText('Auditor'),
  date: dateText,
  status: z.enum(['Scheduled', 'In progress', 'Complete']),
  score: z.coerce.number().min(0).max(100)
})

export const complianceSchema = z.object({
  title: requiredText('Check title'),
  kloe: z.enum(['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led']),
  owner: requiredText('Owner'),
  dueDate: dateText,
  status: z.enum(['Compliant', 'In progress', 'Action required', 'Overdue']),
  progress: z.coerce.number().min(0).max(100)
})

export const incidentSchema = z.object({
  type: requiredText('Incident type'),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
  status: z.enum(['Open', 'Investigating', 'Closed']),
  location: requiredText('Location'),
  date: dateText,
  time: z.string().min(1, 'Choose a time'),
  resident: requiredText('Resident'),
  reporter: requiredText('Reporter'),
  summary: z.string().trim().min(10, 'Add a short factual summary')
})

export const assetSchema = z.object({
  name: requiredText('Asset name'),
  category: z.enum(['Medical', 'Safety', 'Mobility', 'Furniture']),
  serial: z.string().trim().min(3, 'Serial number is required'),
  purchaseDate: dateText,
  warrantyUntil: dateText,
  lastService: dateText,
  nextService: dateText,
  condition: z.enum(['Excellent', 'Good', 'Fair', 'Poor']),
  status: z.enum(['Operational', 'Service due', 'Out of service']),
  location: requiredText('Location')
})

export const schemas = {
  resident: residentSchema,
  staff: staffSchema,
  audit: auditSchema,
  compliance: complianceSchema,
  incident: incidentSchema,
  asset: assetSchema
}

export type CreateKind = keyof typeof schemas
