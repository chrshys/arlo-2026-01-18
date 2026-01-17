'use client'

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface TaskDescriptionProps {
  taskId: Id<'tasks'>
  description?: string | null
}

export function TaskDescription({ taskId, description }: TaskDescriptionProps) {
  const [value, setValue] = useState(description ?? '')

  const updateTask = useMutation(api.tasks.update)

  useEffect(() => {
    setValue(description ?? '')
  }, [description])

  const handleBlur = async () => {
    const trimmed = value.trim()
    if (trimmed !== (description ?? '')) {
      if (trimmed) {
        await updateTask({ id: taskId, description: trimmed })
      } else {
        // Clear description if empty
        await updateTask({ id: taskId, description: undefined })
      }
    }
  }

  return (
    <div className="px-4 py-3">
      <label className="text-sm font-medium text-muted-foreground mb-2 block">Description</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add a description..."
        className="w-full min-h-[100px] p-2 text-sm rounded border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}
