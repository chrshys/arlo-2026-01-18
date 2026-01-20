'use client'

import { useAction, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useEffect, useState } from 'react'

interface Calendar {
  id: string
  name: string
  primary: boolean
  accessRole: string
}

interface CalendarSelectorProps {
  isConnected: boolean
}

export function CalendarSelector({ isConnected }: CalendarSelectorProps) {
  const fetchCalendars = useAction(api.integrationsNode.fetchCalendars)
  const setCalendarEnabled = useMutation(api.integrations.setCalendarEnabled)

  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [enabledIds, setEnabledIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected) return

    const load = async () => {
      try {
        setLoading(true)
        const result = await fetchCalendars()
        if (result.error) {
          setError(result.error)
        } else {
          setCalendars(result.calendars)
          setEnabledIds(result.enabledCalendarIds ?? ['primary'])
        }
      } catch {
        setError('Failed to load calendars')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [isConnected, fetchCalendars])

  const handleToggle = async (calendarId: string, enabled: boolean) => {
    // Optimistic update
    setEnabledIds((prev) =>
      enabled ? [...prev, calendarId] : prev.filter((id) => id !== calendarId)
    )

    try {
      await setCalendarEnabled({ calendarId, enabled })
    } catch {
      // Revert on error
      setEnabledIds((prev) =>
        enabled ? prev.filter((id) => id !== calendarId) : [...prev, calendarId]
      )
    }
  }

  if (!isConnected) return null
  if (loading) return <div className="mt-4 text-sm text-muted-foreground">Loading calendars...</div>
  if (error) return <div className="mt-4 text-sm text-red-500">{error}</div>

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="mb-3 text-sm font-medium">Calendars Arlo can access</h4>
      <div className="space-y-2">
        {calendars.map((cal) => (
          <label key={cal.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabledIds.includes(cal.id)}
              onChange={(e) => handleToggle(cal.id, e.target.checked)}
              className="rounded border-border"
            />
            <span>
              {cal.name}
              {cal.primary && <span className="ml-1 text-muted-foreground">(Primary)</span>}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
