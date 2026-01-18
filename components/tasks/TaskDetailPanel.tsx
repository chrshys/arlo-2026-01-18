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
import { NoteDetailPanel } from '@/components/notes/NoteDetailPanel'

interface TaskDetailPanelProps {
  className?: string
}

export function TaskDetailPanel({ className }: TaskDetailPanelProps) {
  const { selectedTaskId, selectedNoteId, setSelectedNoteId } = useTaskNavigation()

  const tasks = useQuery(api.tasks.list)
  const task = tasks?.find((t) => t._id === selectedTaskId)

  // If a note is selected, show the note detail panel
  if (selectedNoteId) {
    return (
      <div className={cn('h-full', className)}>
        <NoteDetailPanel noteId={selectedNoteId} onClose={() => setSelectedNoteId(null)} />
      </div>
    )
  }

  if (!selectedTaskId) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a task or note to view details
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
        <TaskDescription taskId={task._id} description={task.description} />
        <TaskProperties taskId={task._id} dueDate={task.dueDate} priority={task.priority} />
        <ReminderList taskId={task._id} reminders={task.reminders} dueDate={task.dueDate} />
        <SubtaskList taskId={task._id} />
      </div>
    </div>
  )
}
