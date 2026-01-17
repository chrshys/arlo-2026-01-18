'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useTaskNavigation } from '@/hooks/use-task-navigation'

interface TaskDetailHeaderProps {
  taskId: Id<'tasks'>
  title: string
}

export function TaskDetailHeader({ taskId, title }: TaskDetailHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setSelectedTaskId } = useTaskNavigation()

  const updateTask = useMutation(api.tasks.update)
  const deleteTask = useMutation(api.tasks.remove)

  useEffect(() => {
    setEditedTitle(title)
  }, [title])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = async () => {
    if (editedTitle.trim() && editedTitle !== title) {
      await updateTask({ id: taskId, title: editedTitle.trim() })
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

  const handleDelete = async () => {
    await deleteTask({ id: taskId })
    setSelectedTaskId(null)
  }

  const handleClose = () => {
    setSelectedTaskId(null)
  }

  return (
    <div className="flex items-start gap-2 p-4 border-b border-border">
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full text-lg font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-ring rounded px-1 -ml-1"
          />
        ) : (
          <h2
            className="text-lg font-semibold cursor-text truncate"
            onClick={() => setIsEditing(true)}
          >
            {title}
          </h2>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          title="Delete task"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose} title="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
