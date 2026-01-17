'use client'

import { Calendar, Flag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { cn } from '@/lib/utils'

type Priority = 'none' | 'low' | 'medium' | 'high'

interface TaskPropertiesProps {
  taskId: Id<'tasks'>
  dueDate?: number | null
  priority?: Priority | null
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  none: { label: 'None', color: 'text-muted-foreground' },
  low: { label: 'Low', color: 'text-blue-500' },
  medium: { label: 'Medium', color: 'text-orange-500' },
  high: { label: 'High', color: 'text-red-500' },
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

export function TaskProperties({ taskId, dueDate, priority }: TaskPropertiesProps) {
  const updateTask = useMutation(api.tasks.update)
  const clearField = useMutation(api.tasks.clearField)

  const currentPriority = priority ?? 'none'

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value) {
      const date = new Date(value)
      date.setHours(23, 59, 59, 999)
      await updateTask({ id: taskId, dueDate: date.getTime() })
    }
  }

  const handleClearDate = async () => {
    await clearField({ id: taskId, field: 'dueDate' })
  }

  const handlePriorityChange = async (newPriority: Priority) => {
    await updateTask({ id: taskId, priority: newPriority })
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Due Date */}
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-2 block">Due Date</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={dueDate ? new Date(dueDate).toISOString().split('T')[0] : ''}
              onChange={handleDateChange}
              className="w-full pl-10 pr-3 py-2 text-sm rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {dueDate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleClearDate}
              title="Clear due date"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {dueDate && <p className="text-sm text-muted-foreground mt-1">{formatDate(dueDate)}</p>}
      </div>

      {/* Priority */}
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-2 block">Priority</label>
        <div className="flex gap-1">
          {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
            <Button
              key={p}
              variant={currentPriority === p ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('flex-1', currentPriority === p && PRIORITY_CONFIG[p].color)}
              onClick={() => handlePriorityChange(p)}
            >
              {p !== 'none' && <Flag className="h-3 w-3 mr-1" />}
              {PRIORITY_CONFIG[p].label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
