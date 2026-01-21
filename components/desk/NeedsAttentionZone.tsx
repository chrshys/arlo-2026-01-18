'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { DeskZone } from './DeskZone'
import { ApprovalCard } from './ApprovalCard'
import { AlertCircle } from 'lucide-react'

// Type for ApprovalCard data prop
type ApprovalCardData = {
  actions?: Array<{
    id: string
    label: string
    variant: 'primary' | 'secondary' | 'destructive'
  }>
  draftContent?: string
  question?: string
  options?: Array<{ id: string; label: string }>
  draftType?: string
  to?: string
  subject?: string
  body?: string
}

export function NeedsAttentionZone() {
  const items = useQuery(api.desk.queries.listByZone, { zone: 'attention' })

  if (!items) {
    return (
      <DeskZone title="NEEDS ATTENTION" icon={<AlertCircle className="h-4 w-4 text-red-500" />}>
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      </DeskZone>
    )
  }

  return (
    <DeskZone
      title="NEEDS ATTENTION"
      icon={<AlertCircle className="h-4 w-4 text-red-500" />}
      isEmpty={items.length === 0}
      emptyMessage="All clear!"
    >
      {items.map((item) => (
        <ApprovalCard
          key={item._id}
          id={item._id}
          title={item.title}
          description={item.description}
          type={item.type as 'draft' | 'approval' | 'question'}
          data={item.data as ApprovalCardData}
        />
      ))}
    </DeskZone>
  )
}
