'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Common IANA timezones grouped by region
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Toronto', label: 'Eastern Time (Canada)' },
  { value: 'America/Vancouver', label: 'Pacific Time (Canada)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Australia/Melbourne', label: 'Melbourne' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
  { value: 'UTC', label: 'UTC' },
]

export default function AccountPage() {
  const user = useQuery(api.users.me)
  const updateTimezone = useMutation(api.users.updateTimezone)
  const [saving, setSaving] = useState(false)

  // Detect browser timezone for suggestion
  const [browserTimezone, setBrowserTimezone] = useState<string | null>(null)

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    setBrowserTimezone(tz)
  }, [])

  const handleTimezoneChange = async (timezone: string) => {
    setSaving(true)
    try {
      await updateTimezone({ timezone })
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Account</h1>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Timezone</label>
            <div className="w-64 h-10 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
      </div>
    )
  }

  const currentTimezone = user.timezone || browserTimezone || 'America/New_York'
  const showBrowserSuggestion =
    !user.timezone && browserTimezone && browserTimezone !== 'America/New_York'

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Account</h1>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Timezone</label>
          <Select value={currentTimezone} onValueChange={handleTimezoneChange} disabled={saving}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-sm text-muted-foreground">
            Used for calendar events and time-based features.
          </p>
          {showBrowserSuggestion && (
            <p className="mt-1 text-sm text-muted-foreground">Detected: {browserTimezone}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Managed by your authentication provider.
          </p>
        </div>
      </div>
    </div>
  )
}
