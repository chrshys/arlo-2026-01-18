'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { DeskZone } from './DeskZone'
import { PinnedCard } from './PinnedCard'
import { Pin } from 'lucide-react'

export function PinnedZone() {
  const items = useQuery(api.desk.queries.listByZone, { zone: 'pinned' })

  if (!items) {
    return (
      <DeskZone title="PINNED" icon={<Pin className="h-4 w-4" />}>
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      </DeskZone>
    )
  }

  if (items.length === 0) {
    return null // Don't show pinned zone if empty
  }

  return (
    <DeskZone title="PINNED" icon={<Pin className="h-4 w-4" />}>
      {items.map((item) => (
        <PinnedCard
          key={item._id}
          id={item._id}
          title={item.title}
          description={item.description}
          linkedEntityType={item.linkedEntityType}
          linkedEntityId={item.linkedEntityId}
        />
      ))}
    </DeskZone>
  )
}
