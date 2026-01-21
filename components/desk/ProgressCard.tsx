'use client'

import { DeskCard } from './DeskCard'
import { Loader2 } from 'lucide-react'

type ProgressCardProps = {
  title: string
  description?: string
  percent?: number
  status: 'running' | 'completed' | 'failed'
}

export function ProgressCard({ title, description, percent, status }: ProgressCardProps) {
  return (
    <DeskCard
      title={title}
      description={description}
      icon={<Loader2 className="h-4 w-4 animate-spin" />}
      variant="progress"
    >
      {percent !== undefined && status === 'running' && (
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </DeskCard>
  )
}
