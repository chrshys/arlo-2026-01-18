'use client'

import { Circle, CheckCircle2, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface TaskRowProps {
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
  const isPast = date < today && !isToday

  if (isToday) return 'Today'
  if (isTomorrow) return 'Tomorrow'

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (date.getFullYear() !== today.getFullYear()) {
    options.year = 'numeric'
  }

  const formatted = date.toLocaleDateString('en-US', options)
  return isPast ? formatted : formatted
}

function getDueDateClass(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (date < today) return 'text-red-500'
  if (date.toDateString() === today.toDateString()) return 'text-orange-500'
  return 'text-muted-foreground'
}

export function TaskRow({ taskId, title, status, priority, dueDate }: TaskRowProps) {
  const { selectedTaskId, setSelectedTaskId } = useTaskNavigation()
  const completeTask = useMutation(api.tasks.completeFromUI)
  const reopenTask = useMutation(api.tasks.reopen)

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
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left cursor-pointer',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground',
        isCompleted && 'opacity-60'
      )}
    >
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
