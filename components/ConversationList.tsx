'use client'

import { useQuery, useConvexAuth } from 'convex/react'
import { api } from '../convex/_generated/api'
import { cn } from '@/lib/utils'

interface ConversationListProps {
  selectedThreadId: string | null
  onSelectThread: (threadId: string) => void
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function ConversationList({ selectedThreadId, onSelectThread }: ConversationListProps) {
  const { isAuthenticated } = useConvexAuth()
  const threads = useQuery(api.threads.list, isAuthenticated ? undefined : 'skip')

  if (!isAuthenticated) {
    return null
  }

  if (threads === undefined) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>
  }

  if (threads.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No conversations yet</div>
  }

  return (
    <div className="flex flex-col">
      {threads.map((thread) => {
        const isSelected = thread._id === selectedThreadId
        const title = thread.title || 'New conversation'

        return (
          <button
            key={thread._id}
            onClick={() => onSelectThread(thread._id)}
            className={cn(
              'w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors',
              'border-l-2 border-transparent',
              isSelected && 'bg-muted border-l-primary'
            )}
          >
            <div className="text-sm font-medium truncate">{title}</div>
            <div className="text-xs text-muted-foreground">
              {formatRelativeTime(thread._creationTime)}
            </div>
          </button>
        )
      })}
    </div>
  )
}
