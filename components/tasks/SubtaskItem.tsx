'use client'

import { useState, useRef, useEffect } from 'react'
import { Circle, CheckCircle2, X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface SubtaskItemProps {
  subtaskId: Id<'subtasks'>
  title: string
  completed: boolean
}

export function SubtaskItem({ subtaskId, title, completed }: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  const toggleSubtask = useMutation(api.subtasks.toggle)
  const updateSubtask = useMutation(api.subtasks.update)
  const removeSubtask = useMutation(api.subtasks.remove)

  useEffect(() => {
    setEditedTitle(title)
  }, [title])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleToggle = async () => {
    await toggleSubtask({ id: subtaskId })
  }

  const handleSave = async () => {
    if (editedTitle.trim() && editedTitle !== title) {
      await updateSubtask({ id: subtaskId, title: editedTitle.trim() })
    } else {
      setEditedTitle(title)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditedTitle(title)
      setIsEditing(false)
    }
  }

  const handleRemove = async () => {
    await removeSubtask({ id: subtaskId })
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50',
        completed && 'opacity-60'
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />

      <button
        onClick={handleToggle}
        className={cn(
          'shrink-0 transition-colors',
          completed ? 'text-primary' : 'text-muted-foreground hover:text-primary'
        )}
      >
        {completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm bg-transparent border-none outline-none"
        />
      ) : (
        <span
          className={cn('flex-1 text-sm cursor-text', completed && 'line-through')}
          onClick={() => setIsEditing(true)}
        >
          {title}
        </span>
      )}

      <button
        onClick={handleRemove}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
