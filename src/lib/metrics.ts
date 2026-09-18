import type { HavenData } from '@/lib/types'

export function complianceScore(data: Pick<HavenData, 'complianceChecks'>) {
  if (!data.complianceChecks.length) return 0
  return Math.round(
    data.complianceChecks.reduce((total, check) => total + check.progress, 0) / data.complianceChecks.length
  )
}

export function openActionCount(data: Pick<HavenData, 'complianceChecks' | 'audits'>) {
  const checks = data.complianceChecks.filter(check => check.status !== 'Compliant').length
  const auditActions = data.audits.reduce((total, audit) => total + audit.actions, 0)
  return checks + auditActions
}

export function unreadNotificationCount(data: Pick<HavenData, 'notifications'>) {
  return data.notifications.filter(notification => !notification.read).length
}

export function incidentCounts(data: Pick<HavenData, 'incidents'>) {
  return {
    total: data.incidents.length,
    open: data.incidents.filter(incident => incident.status === 'Open').length,
    investigating: data.incidents.filter(incident => incident.status === 'Investigating').length,
    critical: data.incidents.filter(incident => incident.severity === 'Critical').length
  }
}
