'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Circle, CheckCircle2, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface DraggableTaskRowProps {
  taskId: Id<'tasks'>
  title: string
  status: 'pending' | 'completed'
  priority?: 'none' | 'low' | 'medium' | 'high' | null
  dueDate?: number | null
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-500',
  medium: 'text-orange-500',
  low: 'text-blue-500',
  none: 'text-muted-foreground/30',
}

function formatDueDate(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday = date.toDateString() === today.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  if (isToday) return 'Today'
  if (isTomorrow) return 'Tomorrow'

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (date.getFullYear() !== today.getFullYear()) {
    options.year = 'numeric'
  }

  return date.toLocaleDateString('en-US', options)
}

function getDueDateClass(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (date < today) return 'text-red-500'
  if (date.toDateString() === today.toDateString()) return 'text-orange-500'
  return 'text-muted-foreground'
}

export function DraggableTaskRow({
  taskId,
  title,
  status,
  priority,
  dueDate,
}: DraggableTaskRowProps) {
  const { selectedTaskId, setSelectedTaskId } = useTaskNavigation()
  const completeTask = useMutation(api.tasks.completeFromUI)
  const reopenTask = useMutation(api.tasks.reopen)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isSelected = selectedTaskId === taskId
  const isCompleted = status === 'completed'
  const priorityValue = priority ?? 'none'

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCompleted) {
      await reopenTask({ taskId })
    } else {
      await completeTask({ taskId })
    }
  }

  const handleClick = () => {
    setSelectedTaskId(taskId)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left cursor-pointer',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground',
        isCompleted && 'opacity-60',
        isDragging && 'opacity-50 bg-accent shadow-lg'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>

      <button
        onClick={handleToggle}
        className={cn(
          'shrink-0 transition-colors',
          isCompleted ? 'text-primary' : 'text-muted-foreground hover:text-primary'
        )}
      >
        {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </button>

      <span className={cn('flex-1 truncate', isCompleted && 'line-through')}>{title}</span>

      {dueDate && (
        <span className={cn('text-xs shrink-0', getDueDateClass(dueDate))}>
          {formatDueDate(dueDate)}
        </span>
      )}

      {priorityValue !== 'none' && (
        <Flag className={cn('h-3.5 w-3.5 shrink-0', PRIORITY_COLORS[priorityValue])} />
      )}
    </div>
  )
}
