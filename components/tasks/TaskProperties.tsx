'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, Plus, X, Flag } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { cn } from '@/lib/utils'

type Priority = 'none' | 'low' | 'medium' | 'high'

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: 'text-red-500' },
  { value: 'medium', label: 'Medium', color: 'text-orange-500' },
  { value: 'low', label: 'Low', color: 'text-blue-500' },
  { value: 'none', label: 'None', color: 'text-muted-foreground' },
]

interface TaskPropertiesProps {
  taskId: Id<'tasks'>
  dueDate?: number | null
  priority?: Priority | null
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.getFullYear() !== now.getFullYear()) {
    return format(date, 'EEE, MMM d, yyyy')
  }
  return format(date, 'EEE, MMM d')
}

export function TaskProperties({ taskId, dueDate, priority }: TaskPropertiesProps) {
  const [dateOpen, setDateOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const updateTask = useMutation(api.tasks.update)
  const clearField = useMutation(api.tasks.clearField)

  const priorityValue = priority ?? 'none'
  const currentPriority =
    PRIORITY_OPTIONS.find((p) => p.value === priorityValue) ?? PRIORITY_OPTIONS[3]

  const handleDateSelect = async (date: Date | undefined) => {
    if (date) {
      date.setHours(23, 59, 59, 999)
      await updateTask({ id: taskId, dueDate: date.getTime() })
      setDateOpen(false)
    }
  }

  const handleClearDate = async () => {
    await clearField({ id: taskId, field: 'dueDate' })
  }

  const handlePrioritySelect = async (value: Priority) => {
    await updateTask({ id: taskId, priority: value })
    setPriorityOpen(false)
  }

  const selectedDate = dueDate ? new Date(dueDate) : undefined

  return (
    <div className="px-4 py-3">
      <label className="text-sm font-medium text-muted-foreground mb-2 block">Due date</label>
      {dueDate ? (
        <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 flex-1 min-w-0">
                <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{formatDate(dueDate)}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex">
                <div className="border-r p-2 space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => handleDateSelect(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => {
                      const tomorrow = new Date()
                      tomorrow.setDate(tomorrow.getDate() + 1)
                      handleDateSelect(tomorrow)
                    }}
                  >
                    Tomorrow
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => {
                      const nextWeek = new Date()
                      nextWeek.setDate(nextWeek.getDate() + 7)
                      handleDateSelect(nextWeek)
                    }}
                  >
                    Next week
                  </Button>
                </div>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  defaultMonth={selectedDate}
                />
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleClearDate}
            title="Clear due date"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add date
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              <div className="border-r p-2 space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => handleDateSelect(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => {
                    const tomorrow = new Date()
                    tomorrow.setDate(tomorrow.getDate() + 1)
                    handleDateSelect(tomorrow)
                  }}
                >
                  Tomorrow
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => {
                    const nextWeek = new Date()
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    handleDateSelect(nextWeek)
                  }}
                >
                  Next week
                </Button>
              </div>
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} />
            </div>
          </PopoverContent>
        </Popover>
      )}

      <label className="text-sm font-medium text-muted-foreground mb-2 mt-4 block">Priority</label>
      <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 p-2 rounded bg-muted/50 w-full hover:bg-muted transition-colors">
            <Flag className={cn('h-4 w-4 shrink-0', currentPriority.color)} />
            <span className="text-sm">{currentPriority.label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1" align="start">
          <div className="flex flex-col gap-1">
            {PRIORITY_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start gap-2',
                  priorityValue === option.value && 'bg-accent'
                )}
                onClick={() => handlePrioritySelect(option.value)}
              >
                <Flag className={cn('h-4 w-4', option.color)} />
                {option.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
