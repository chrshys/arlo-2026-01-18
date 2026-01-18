'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FileText, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Id } from '@/convex/_generated/dataModel'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useUnifiedDrag } from '@/components/tasks/TasksView'
import { createDragId } from '@/lib/drag-utils'

interface DraggableNoteRowProps {
  noteId: Id<'notes'>
  title: string
  isSelected: boolean
  onSelect: (noteId: Id<'notes'>) => void
}

export function DraggableNoteRow({ noteId, title, isSelected, onSelect }: DraggableNoteRowProps) {
  const { editingNoteId, setEditingNoteId, setSelectedNoteId, setShouldFocusNoteEditor } =
    useTaskNavigation()
  const { activeId } = useUnifiedDrag()
  const isEditing = editingNoteId === noteId
  const [editedTitle, setEditedTitle] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateNote = useMutation(api.notes.update)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } =
    useSortable({
      id: createDragId('note', noteId),
      animateLayoutChanges: () => false,
    })

  const isActive = activeId === noteId
  const shouldHide = isDragging || isActive

  const style = {
    transform: shouldHide ? undefined : CSS.Transform.toString(transform),
    transition: shouldHide || isSorting ? undefined : transition,
  }

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  // Sync editedTitle when title prop changes (and not editing)
  useEffect(() => {
    if (!isEditing) {
      setEditedTitle(title)
    }
  }, [title, isEditing])

  const handleSave = async (focusEditor = false) => {
    const trimmedTitle = editedTitle.trim() || 'Untitled'
    if (trimmedTitle !== title) {
      await updateNote({ id: noteId, title: trimmedTitle })
    }
    setEditingNoteId(null)
    setSelectedNoteId(noteId)
    if (focusEditor) {
      setShouldFocusNoteEditor(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave(true)
    } else if (e.key === 'Escape') {
      setEditedTitle(title)
      setEditingNoteId(null)
    }
  }

  const handleClick = () => {
    onSelect(noteId)
  }

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left',
          'bg-accent text-accent-foreground',
          shouldHide && 'opacity-0'
        )}
      >
        <div className="shrink-0 cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        </div>
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onBlur={() => handleSave(false)}
          onKeyDown={handleKeyDown}
          placeholder="Note title"
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left cursor-pointer',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground',
        shouldHide && 'opacity-0'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{title || 'Untitled'}</span>
    </div>
  )
}
