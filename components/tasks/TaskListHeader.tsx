'use client'

import { Inbox, Calendar, CalendarDays, Hash } from 'lucide-react'
import { PanelHeader } from '@/components/layout/PanelHeader'
import { useTaskNavigation, type SmartListType } from '@/hooks/use-task-navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

const SMART_LIST_CONFIG: Record<
  SmartListType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  inbox: { label: 'Inbox', icon: Inbox },
  today: { label: 'Today', icon: Calendar },
  next7days: { label: 'Next 7 Days', icon: CalendarDays },
}

export function TaskListHeader() {
  const { selection } = useTaskNavigation()
  const projects = useQuery(api.projects.list)

  let title = 'Tasks'
  let Icon: React.ComponentType<{ className?: string }> = Hash

  if (selection.type === 'smart-list') {
    const config = SMART_LIST_CONFIG[selection.list]
    title = config.label
    Icon = config.icon
  } else {
    const project = projects?.find((p) => p._id === selection.projectId)
    if (project) {
      title = project.name
    }
  }

  return (
    <PanelHeader>
      <PanelHeader.Title>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </span>
      </PanelHeader.Title>
    </PanelHeader>
  )
}
