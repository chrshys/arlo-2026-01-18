'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface TaskPropertiesProps {
  taskId: Id<'tasks'>
  dueDate?: number | null
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.getFullYear() !== now.getFullYear()) {
    return format(date, 'EEE, MMM d, yyyy')
  }
  return format(date, 'EEE, MMM d')
}

export function TaskProperties({ taskId, dueDate }: TaskPropertiesProps) {
  const [open, setOpen] = useState(false)
  const updateTask = useMutation(api.tasks.update)
  const clearField = useMutation(api.tasks.clearField)

  const handleDateSelect = async (date: Date | undefined) => {
    if (date) {
      date.setHours(23, 59, 59, 999)
      await updateTask({ id: taskId, dueDate: date.getTime() })
      setOpen(false)
    }
  }

  const handleClearDate = async () => {
    await clearField({ id: taskId, field: 'dueDate' })
  }

  const selectedDate = dueDate ? new Date(dueDate) : undefined

  return (
    <div className="px-4 py-3">
      <label className="text-sm font-medium text-muted-foreground mb-2 block">Due date</label>
      {dueDate ? (
        <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
          <Popover open={open} onOpenChange={setOpen}>
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
        <Popover open={open} onOpenChange={setOpen}>
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
    </div>
  )
}
