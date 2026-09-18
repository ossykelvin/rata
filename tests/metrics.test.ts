import { describe, expect, it } from 'vitest'
import { complianceScore, incidentCounts, openActionCount, unreadNotificationCount } from '@/lib/metrics'

describe('Haven dashboard metrics', () => {
  it('recalculates compliance when a new check is added', () => {
    const checks = {
      complianceChecks: [
        { progress: 80, status: 'In progress' },
        { progress: 100, status: 'Compliant' }
      ]
    }

    expect(complianceScore(checks as never)).toBe(90)
    expect(
      complianceScore({
        complianceChecks: [...checks.complianceChecks, { progress: 60, status: 'Action required' }]
      } as never)
    ).toBe(80)
  })

  it('combines unresolved checks and audit actions', () => {
    expect(
      openActionCount({
        complianceChecks: [{ status: 'Compliant' }, { status: 'Overdue' }, { status: 'In progress' }],
        audits: [{ actions: 3 }, { actions: 1 }]
      } as never)
    ).toBe(6)
  })

  it('tracks incident and notification states', () => {
    expect(
      incidentCounts({
        incidents: [
          { status: 'Open', severity: 'High' },
          { status: 'Investigating', severity: 'Critical' },
          { status: 'Closed', severity: 'Low' }
        ]
      } as never)
    ).toEqual({ total: 3, open: 1, investigating: 1, critical: 1 })

    expect(
      unreadNotificationCount({
        notifications: [{ read: false }, { read: true }, { read: false }]
      } as never)
    ).toBe(2)
  })
})
