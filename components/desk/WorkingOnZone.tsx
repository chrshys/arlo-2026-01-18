'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { DeskZone } from './DeskZone'
import { ProgressCard } from './ProgressCard'
import { Hourglass } from 'lucide-react'

export function WorkingOnZone() {
  const items = useQuery(api.desk.queries.listByZone, { zone: 'working' })

  if (!items) {
    return null // Don't show loading state for working zone
  }

  if (items.length === 0) {
    return null // Don't show working zone if empty
  }

  return (
    <DeskZone title="ARLO IS WORKING ON" icon={<Hourglass className="h-4 w-4" />}>
      {items.map((item) => {
        const data = item.data as
          | {
              operation?: string
              percent?: number
              status?: 'running' | 'completed' | 'failed'
            }
          | undefined
        return (
          <ProgressCard
            key={item._id}
            title={item.title}
            description={data?.operation}
            percent={data?.percent}
            status={data?.status || 'running'}
          />
        )
      })}
    </DeskZone>
  )
}
