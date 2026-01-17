'use client'

import { useState } from 'react'
import { Bell, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface ReminderListProps {
  taskId: Id<'tasks'>
  reminders?: number[] | null
}

function formatReminderTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (isToday) return `Today at ${timeStr}`
  if (isTomorrow) return `Tomorrow at ${timeStr}`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ReminderList({ taskId, reminders }: ReminderListProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [dateValue, setDateValue] = useState('')
  const [timeValue, setTimeValue] = useState('')

  const addReminder = useMutation(api.tasks.addReminder)
  const removeReminder = useMutation(api.tasks.removeReminder)

  const reminderList = reminders ?? []

  const handleAdd = async () => {
    if (!dateValue || !timeValue) return

    const [hours, minutes] = timeValue.split(':').map(Number)
    const date = new Date(dateValue)
    date.setHours(hours, minutes, 0, 0)

    await addReminder({ id: taskId, reminderTime: date.getTime() })

    setDateValue('')
    setTimeValue('')
    setIsAdding(false)
  }

  const handleRemove = async (reminderTime: number) => {
    await removeReminder({ id: taskId, reminderTime })
  }

  const handleCancel = () => {
    setDateValue('')
    setTimeValue('')
    setIsAdding(false)
  }

  return (
    <div className="px-4 py-3">
      <label className="text-sm font-medium text-muted-foreground mb-2 block">Reminders</label>

      <div className="space-y-2">
        {reminderList.map((reminder) => (
          <div key={reminder} className="flex items-center gap-2 p-2 rounded bg-muted/50">
            <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm">{formatReminderTime(reminder)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => handleRemove(reminder)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}

        {isAdding ? (
          <div className="space-y-2 p-2 rounded border border-input">
            <div className="flex gap-2">
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="flex-1 px-2 py-1 text-sm rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="w-24 px-2 py-1 text-sm rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!dateValue || !timeValue}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add reminder
          </Button>
        )}
      </div>
    </div>
  )
}
