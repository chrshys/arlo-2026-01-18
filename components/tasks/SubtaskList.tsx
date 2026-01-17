'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { SubtaskItem } from './SubtaskItem'

interface SubtaskListProps {
  taskId: Id<'tasks'>
}

export function SubtaskList({ taskId }: SubtaskListProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const subtasks = useQuery(api.subtasks.listByTask, { taskId })
  const createSubtask = useMutation(api.subtasks.create)

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  const sortedSubtasks = subtasks?.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? []
  const completedCount = sortedSubtasks.filter((s) => s.completed).length
  const totalCount = sortedSubtasks.length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    await createSubtask({ title: newTitle.trim(), taskId })
    setNewTitle('')
    inputRef.current?.focus()
  }

  const handleBlur = () => {
    if (!newTitle.trim()) {
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setNewTitle('')
      setIsAdding(false)
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-muted-foreground">Subtasks</label>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      <div className="space-y-0.5">
        {sortedSubtasks.map((subtask) => (
          <SubtaskItem
            key={subtask._id}
            subtaskId={subtask._id}
            title={subtask.title}
            completed={subtask.completed}
          />
        ))}

        {isAdding ? (
          <form onSubmit={handleSubmit} className="px-2 py-1">
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Subtask name"
              className="w-full px-2 py-1 text-sm rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground w-full rounded hover:bg-muted/50"
          >
            <Plus className="h-4 w-4" />
            Add subtask
          </button>
        )}
      </div>
    </div>
  )
}
