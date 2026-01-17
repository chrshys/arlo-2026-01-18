'use client'

import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { TaskDetailHeader } from './TaskDetailHeader'
import { TaskDescription } from './TaskDescription'
import { TaskProperties } from './TaskProperties'
import { ReminderList } from './ReminderList'
import { SubtaskList } from './SubtaskList'

interface TaskDetailPanelProps {
  className?: string
}

export function TaskDetailPanel({ className }: TaskDetailPanelProps) {
  const { selectedTaskId } = useTaskNavigation()

  const tasks = useQuery(api.tasks.list)
  const task = tasks?.find((t) => t._id === selectedTaskId)

  if (!selectedTaskId) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a task to view details
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <TaskDetailHeader taskId={task._id} title={task.title} />

      <div className="flex-1 overflow-auto">
        <TaskProperties taskId={task._id} dueDate={task.dueDate} priority={task.priority} />

        <div className="border-t border-border">
          <ReminderList taskId={task._id} reminders={task.reminders} />
        </div>

        <div className="border-t border-border">
          <SubtaskList taskId={task._id} />
        </div>

        <div className="border-t border-border">
          <TaskDescription taskId={task._id} description={task.description} />
        </div>
      </div>
    </div>
  )
}
