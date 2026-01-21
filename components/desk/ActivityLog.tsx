'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

export function ActivityLog() {
  const activities = useQuery(api.activity.list, { limit: 50 })

  if (!activities) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-muted" />
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return <p className="text-sm italic text-muted-foreground">No activity yet</p>
  }

  // Group by date
  const grouped = activities.reduce<Record<string, typeof activities>>((acc, activity) => {
    const date = new Date(activity._creationTime).toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(activity)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            {date === new Date().toLocaleDateString() ? 'Today' : date}
          </h3>
          <div className="space-y-2">
            {items.map((activity) => (
              <div key={activity._id} className="flex items-start gap-3 text-sm">
                <span className="w-16 flex-shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(activity._creationTime, {
                    addSuffix: true,
                  })}
                </span>
                <div>
                  <span
                    className={cn(
                      'mr-2 inline-block h-2 w-2 rounded-full',
                      activity.actor === 'arlo' ? 'bg-blue-500' : 'bg-green-500'
                    )}
                  />
                  <span>{activity.action}</span>
                  {activity.details && (
                    <span className="text-muted-foreground"> — {activity.details}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
