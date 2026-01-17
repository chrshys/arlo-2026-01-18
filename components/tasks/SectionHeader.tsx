'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface SectionHeaderProps {
  sectionId: Id<'sections'>
  name: string
  taskCount: number
  onAddTask?: () => void
}

export function SectionHeader({ sectionId, name, taskCount, onAddTask }: SectionHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(name)
  const [showMenu, setShowMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateSection = useMutation(api.sections.update)
  const removeSection = useMutation(api.sections.remove)

  useEffect(() => {
    setEditedName(name)
  }, [name])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleSave = async () => {
    if (editedName.trim() && editedName !== name) {
      await updateSection({ id: sectionId, name: editedName.trim() })
    } else {
      setEditedName(name)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditedName(name)
      setIsEditing(false)
    }
  }

  const handleDelete = async () => {
    await removeSection({ id: sectionId })
    setShowMenu(false)
  }

  const handleRename = () => {
    setShowMenu(false)
    setIsEditing(true)
  }

  return (
    <div className="group flex items-center gap-2 px-3 py-1.5">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm font-medium bg-transparent border-b border-primary outline-none"
        />
      ) : (
        <span className="flex-1 text-sm font-medium text-muted-foreground">
          {name}
          <span className="ml-1 text-xs">({taskCount})</span>
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onAddTask && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onAddTask}
            title="Add task"
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}

        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowMenu(!showMenu)}
            title="More options"
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[120px]">
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                onClick={handleRename}
              >
                <Pencil className="h-3 w-3" />
                Rename
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
