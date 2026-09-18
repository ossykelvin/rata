'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { z } from 'zod'
import { initialData } from '@/lib/mock-data'
import { assetSchema, auditSchema, complianceSchema, incidentSchema, residentSchema, staffSchema } from '@/lib/schemas'
import type { HavenData } from '@/lib/types'
import { makeId } from '@/lib/utils'

const STORAGE_KEY = 'haven-care-data-v1'

interface HavenDataContextValue extends HavenData {
  addResident: (input: z.infer<typeof residentSchema>) => void
  addStaff: (input: z.infer<typeof staffSchema>) => void
  addAudit: (input: z.infer<typeof auditSchema>) => void
  addCompliance: (input: z.infer<typeof complianceSchema>) => void
  addIncident: (input: z.infer<typeof incidentSchema>) => void
  addAsset: (input: z.infer<typeof assetSchema>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  deleteNotification: (id: string) => void
}

const HavenDataContext = createContext<HavenDataContextValue | null>(null)

function isStoredData(value: unknown): value is HavenData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<HavenData>
  return (
    Array.isArray(data.complianceChecks) &&
    Array.isArray(data.residents) &&
    Array.isArray(data.staff) &&
    Array.isArray(data.audits) &&
    Array.isArray(data.incidents) &&
    Array.isArray(data.assets) &&
    Array.isArray(data.notifications)
  )
}

export function HavenDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HavenData>(initialData)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        if (isStoredData(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setData(parsed)
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data, hydrated])

  const addResident = useCallback((input: z.infer<typeof residentSchema>) => {
    setData(current => ({
      ...current,
      residents: [
        {
          id: makeId('RES'),
          ...input,
          carePlan: 'Up to date',
          medication: 'Reviewed'
        },
        ...current.residents
      ]
    }))
  }, [])

  const addStaff = useCallback((input: z.infer<typeof staffSchema>) => {
    setData(current => ({
      ...current,
      staff: [
        {
          id: makeId('STF'),
          ...input,
          completion: input.status === 'Compliant' ? 100 : input.status === 'Due soon' ? 80 : 55
        },
        ...current.staff
      ]
    }))
  }, [])

  const addAudit = useCallback((input: z.infer<typeof auditSchema>) => {
    setData(current => ({
      ...current,
      audits: [
        {
          id: makeId('AUD'),
          ...input,
          actions: 0
        },
        ...current.audits
      ]
    }))
  }, [])

  const addCompliance = useCallback((input: z.infer<typeof complianceSchema>) => {
    setData(current => ({
      ...current,
      complianceChecks: [{ id: makeId('CHK'), ...input }, ...current.complianceChecks]
    }))
  }, [])

  const addIncident = useCallback((input: z.infer<typeof incidentSchema>) => {
    setData(current => {
      const reference = `INC-${new Date(input.date).getFullYear()}-${String(current.incidents.length + 119).padStart(3, '0')}`
      return {
        ...current,
        incidents: [{ id: makeId('INC'), reference, ...input }, ...current.incidents]
      }
    })
  }, [])

  const addAsset = useCallback((input: z.infer<typeof assetSchema>) => {
    setData(current => ({
      ...current,
      assets: [{ id: makeId('AST'), ...input }, ...current.assets]
    }))
  }, [])

  const markNotificationRead = useCallback((id: string) => {
    setData(current => ({
      ...current,
      notifications: current.notifications.map(item => (item.id === id ? { ...item, read: true } : item))
    }))
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setData(current => ({
      ...current,
      notifications: current.notifications.map(item => ({ ...item, read: true }))
    }))
  }, [])

  const deleteNotification = useCallback((id: string) => {
    setData(current => ({
      ...current,
      notifications: current.notifications.filter(item => item.id !== id)
    }))
  }, [])

  const value = useMemo(
    () => ({
      ...data,
      addResident,
      addStaff,
      addAudit,
      addCompliance,
      addIncident,
      addAsset,
      markNotificationRead,
      markAllNotificationsRead,
      deleteNotification
    }),
    [
      data,
      addResident,
      addStaff,
      addAudit,
      addCompliance,
      addIncident,
      addAsset,
      markNotificationRead,
      markAllNotificationsRead,
      deleteNotification
    ]
  )

  return <HavenDataContext.Provider value={value}>{children}</HavenDataContext.Provider>
}

export function useHavenData() {
  const context = useContext(HavenDataContext)
  if (!context) throw new Error('useHavenData must be used within HavenDataProvider')
  return context
}
