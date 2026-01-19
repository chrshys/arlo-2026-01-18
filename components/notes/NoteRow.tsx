'use client'

import { useState, useRef, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Id } from '@/convex/_generated/dataModel'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useTaskNavigation } from '@/hooks/use-task-navigation'

interface NoteRowProps {
  noteId: Id<'notes'>
  title: string
  isSelected: boolean
  onSelect: (noteId: Id<'notes'>) => void
}

export function NoteRow({ noteId, title, isSelected, onSelect }: NoteRowProps) {
  const { editingNoteId, setEditingNoteId, setSelectedNoteId, setShouldFocusNoteEditor } =
    useTaskNavigation()
  const isEditing = editingNoteId === noteId
  const [editedTitle, setEditedTitle] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateNote = useMutation(api.notes.update)

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
    // Open the note detail panel after saving
    setSelectedNoteId(noteId)
    if (focusEditor) {
      setShouldFocusNoteEditor(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave(true) // Focus the editor after saving
    } else if (e.key === 'Escape') {
      setEditedTitle(title)
      setEditingNoteId(null)
    }
  }

  if (isEditing) {
    return (
      <div
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left',
          'bg-accent text-accent-foreground'
        )}
      >
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

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingNoteId(noteId)
  }

  return (
    <div
      onClick={() => onSelect(noteId)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left cursor-pointer',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground'
      )}
    >
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span onDoubleClick={handleDoubleClick} className="flex-1 truncate">
        {title || 'Untitled'}
      </span>
    </div>
  )
}
