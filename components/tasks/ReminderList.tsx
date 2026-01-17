'use client'

import { useState } from 'react'
import { Bell, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface ReminderListProps {
  taskId: Id<'tasks'>
  reminders?: number[] | null
  dueDate?: number | null
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

interface ReminderPreset {
  label: string
  time: number
}

function getReminderPresets(dueDate?: number | null): ReminderPreset[] {
  const now = new Date()

  const inOneHour = new Date(now)
  inOneHour.setHours(inOneHour.getHours() + 1, 0, 0, 0) // Round to the hour

  const tomorrowMorning = new Date(now)
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1)
  tomorrowMorning.setHours(9, 0, 0, 0)

  const tomorrowEvening = new Date(now)
  tomorrowEvening.setDate(tomorrowEvening.getDate() + 1)
  tomorrowEvening.setHours(18, 0, 0, 0)

  const presets: ReminderPreset[] = [
    { label: 'In 1 hour', time: inOneHour.getTime() },
    { label: 'Tomorrow morning', time: tomorrowMorning.getTime() },
    { label: 'Tomorrow evening', time: tomorrowEvening.getTime() },
  ]

  if (dueDate) {
    const oneHourBefore = new Date(dueDate)
    oneHourBefore.setHours(oneHourBefore.getHours() - 1)

    const oneDayBefore = new Date(dueDate)
    oneDayBefore.setDate(oneDayBefore.getDate() - 1)

    const oneWeekBefore = new Date(dueDate)
    oneWeekBefore.setDate(oneWeekBefore.getDate() - 7)

    presets.push({ label: '1 hour before due', time: oneHourBefore.getTime() })
    presets.push({ label: '1 day before due', time: oneDayBefore.getTime() })
    presets.push({ label: '1 week before due', time: oneWeekBefore.getTime() })
  }

  return presets
}

export function ReminderList({ taskId, reminders, dueDate }: ReminderListProps) {
  const [open, setOpen] = useState(false)

  const addReminder = useMutation(api.tasks.addReminder)
  const removeReminder = useMutation(api.tasks.removeReminder)

  const reminderList = reminders ?? []
  const allPresets = getReminderPresets(dueDate)
  const presets = allPresets.filter((preset) => !reminderList.includes(preset.time))

  const handleAddPreset = async (time: number) => {
    await addReminder({ id: taskId, reminderTime: time })
    setOpen(false)
  }

  const handleRemove = async (reminderTime: number) => {
    await removeReminder({ id: taskId, reminderTime })
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

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add reminder
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => handleAddPreset(preset.time)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
