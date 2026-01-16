'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { ActivityTable } from '@/components/ActivityTable'

const LIMIT_OPTIONS = [25, 50, 100] as const
type LimitOption = (typeof LIMIT_OPTIONS)[number]

export default function ActivityPage() {
  const [limit, setLimit] = useState<LimitOption>(25)
  const activity = useQuery(api.usage.activityLog, { limit })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Show:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) as LimitOption)}
            className="border rounded px-2 py-1 text-sm"
          >
            {LIMIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activity === undefined ? (
        <div className="text-gray-500">Loading activity...</div>
      ) : activity.length === 0 ? (
        <div className="text-gray-500">No activity yet</div>
      ) : (
        <ActivityTable items={activity} />
      )}
    </div>
  )
}
