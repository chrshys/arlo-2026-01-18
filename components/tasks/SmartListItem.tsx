'use client'

import { Inbox, Calendar, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation, type SmartListType } from '@/hooks/use-task-navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

interface SmartListItemProps {
  list: SmartListType
}

const SMART_LIST_CONFIG: Record<
  SmartListType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  inbox: { label: 'Inbox', icon: Inbox },
  today: { label: 'Today', icon: Calendar },
  next7days: { label: 'Next 7 Days', icon: CalendarDays },
}

export function SmartListItem({ list }: SmartListItemProps) {
  const { selection, setSelection, setSelectedTaskId } = useTaskNavigation()
  const config = SMART_LIST_CONFIG[list]
  const Icon = config.icon

  // Get task counts
  const inboxTasks = useQuery(api.tasks.listByProject, { projectId: undefined })
  const todayTasks = useQuery(api.tasks.listToday)
  const next7Tasks = useQuery(api.tasks.listNext7Days)

  const getCount = () => {
    switch (list) {
      case 'inbox':
        return inboxTasks?.filter((t) => t.status === 'pending').length ?? 0
      case 'today':
        return todayTasks?.length ?? 0
      case 'next7days':
        return next7Tasks?.length ?? 0
    }
  }

  const isSelected = selection.type === 'smart-list' && selection.list === list
  const count = getCount()

  const handleClick = () => {
    setSelection({ type: 'smart-list', list })
    setSelectedTaskId(null)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">{config.label}</span>
      {count > 0 && <span className="text-xs text-muted-foreground">{count}</span>}
    </button>
  )
}
