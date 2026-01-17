'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface QuickAddTaskProps {
  projectId?: Id<'projects'>
  sectionId?: Id<'sections'>
  className?: string
  autoOpen?: boolean
  onAutoOpenHandled?: () => void
}

export function QuickAddTask({
  projectId,
  sectionId,
  className,
  autoOpen,
  onAutoOpenHandled,
}: QuickAddTaskProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const createTask = useMutation(api.tasks.createFromUI)

  // Handle auto-open trigger
  useEffect(() => {
    if (autoOpen) {
      setIsAdding(true)
      onAutoOpenHandled?.()
    }
  }, [autoOpen, onAutoOpenHandled])

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    await createTask({
      title: title.trim(),
      projectId,
      sectionId,
    })

    setTitle('')
    // Keep input focused for rapid entry
    inputRef.current?.focus()
  }

  const handleBlur = () => {
    if (!title.trim()) {
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setTitle('')
      setIsAdding(false)
    }
  }

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm',
          'text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors',
          className
        )}
      >
        <Plus className="h-4 w-4" />
        <span>Add task</span>
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn('px-3 py-1', className)}>
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Task name"
        className={cn(
          'w-full px-2 py-1.5 text-sm rounded border border-input bg-background',
          'focus:outline-none focus:ring-2 focus:ring-ring'
        )}
      />
    </form>
  )
}
