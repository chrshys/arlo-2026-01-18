'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { TodaySection } from './TodaySection'
import { NeedsAttentionZone } from './NeedsAttentionZone'
import { PinnedZone } from './PinnedZone'
import { WorkingOnZone } from './WorkingOnZone'
import { ActivityLog } from './ActivityLog'

type Tab = 'desk' | 'activity'

export function DeskPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('desk')

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex border-b px-4">
        <button
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'desk'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('desk')}
        >
          Desk
        </button>
        <button
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'activity'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'desk' ? (
          <div className="space-y-6">
            <TodaySection />
            <NeedsAttentionZone />
            <PinnedZone />
            <WorkingOnZone />
          </div>
        ) : (
          <ActivityLog />
        )}
      </div>
    </div>
  )
}
