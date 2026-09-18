import { describe, expect, it } from 'vitest'
import { assetSchema, incidentSchema, residentSchema } from '@/lib/schemas'

describe('Haven create form validation', () => {
  it('accepts a complete resident record', () => {
    const result = residentSchema.safeParse({
      name: 'Mary Jones',
      room: '14B',
      dateOfBirth: '1939-04-17',
      risk: 'Low',
      nextReview: '2026-10-10',
      status: 'Active'
    })

    expect(result.success).toBe(true)
  })

  it('rejects an incident without a factual summary', () => {
    const result = incidentSchema.safeParse({
      type: 'Fall',
      severity: 'Medium',
      status: 'Open',
      location: 'Dining room',
      date: '2026-09-18',
      time: '13:15',
      resident: 'Mary Jones',
      reporter: 'Hannah Green',
      summary: 'Fall'
    })

    expect(result.success).toBe(false)
  })

  it('requires a serial and service dates for an asset', () => {
    const result = assetSchema.safeParse({
      name: 'Mobile hoist',
      category: 'Mobility',
      serial: '',
      purchaseDate: '2026-01-10',
      warrantyUntil: '2028-01-10',
      lastService: '',
      nextService: '2026-12-10',
      condition: 'Good',
      status: 'Operational',
      location: 'Equipment bay'
    })

    expect(result.success).toBe(false)
  })
})
