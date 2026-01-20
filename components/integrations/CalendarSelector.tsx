'use client'

import { useAction, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Calendar } from 'lucide-react'

interface CalendarItem {
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

  const [calendars, setCalendars] = useState<CalendarItem[]>([])
  const [enabledIds, setEnabledIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!isConnected) return

    const load = async () => {
      try {
        setLoading(true)
        const result = await fetchCalendars()
        if (result.error) {
          setError(result.error)
        } else {
          // Sort: primary first, then alphabetically
          const sorted = [...result.calendars].sort((a, b) => {
            if (a.primary && !b.primary) return -1
            if (!a.primary && b.primary) return 1
            return a.name.localeCompare(b.name)
          })
          setCalendars(sorted)
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

  const enabledCount = enabledIds.length
  const totalCount = calendars.length

  return (
    <div className="mt-4 border-t pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Calendars Arlo can access</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {enabledCount} of {totalCount} enabled
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 grid gap-2">
          {calendars.map((cal) => {
            const isEnabled = enabledIds.includes(cal.id)
            return (
              <label
                key={cal.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                  isEnabled
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-transparent hover:bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => handleToggle(cal.id, e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{cal.name}</span>
                {cal.primary && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    Primary
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
